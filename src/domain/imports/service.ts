import { SupabaseClient } from "@supabase/supabase-js";
import { ImportRepository } from "./repository";
import { CreateImportJobInput, ContactMappingInput, ContactImportOptionsInput, StageRowsInput, InquiryMappingInput, InquiryImportOptionsInput } from "./validation";
import { ImportJob, ImportSummary, RevertResult } from "./types";
import { mapRowToCandidate, mapRowToInquiryCandidate } from "./csv/row-mapper";
import { classifyDuplicates, ExistingContactInfo } from "./duplicate-classifier";
import { DomainError } from "@/lib/errors";
import { normalizePhone } from "../contacts/phone";
import { MemberRepository } from "../members/repository";
import { parseDate } from "./csv/date-parse";
import { resolveSource, resolveAssignee, resolveStatus } from "./csv/value-resolvers";
import { mapRowToPropertyCandidate } from "./csv/row-mapper";
import { areaKey, classifyPropertyRow, ownerMethods, resolveDefaultAssignee, settlementLookup, validatePropertyRow, type ClassifyState, type PropertyLookups } from "./property-validation";
import { SettlementRepository } from "../settlements/repository";
import { AreaRepository } from "../areas/repository";
import type { PropertyImportOptionsInput, PropertyMappingInput } from "./validation";
import type { ImportError, ImportRow } from "./types";
import { buildPropertyPreview, type PropertyPreview } from "./property-preview";

export { describeRowError } from "./row-error";
import { describeRowError } from "./row-error";

export class ImportService {
  private repository: ImportRepository;

  constructor(private db: SupabaseClient<any>) {
    this.repository = new ImportRepository(db);
  }

  async createJob(agencyId: string, input: CreateImportJobInput): Promise<{ jobId: string; previousJobs: ImportJob[] }> {
    const previousJobs = await this.repository.findJobsByHash(agencyId, input.file_sha256);
    
    const { data, error } = await this.db
      .from("import_jobs")
      .insert({
        agency_id: agencyId,
        entity_type: input.entity_type || "contact",
        status: "draft",
        file_name: input.file_name,
        file_sha256: input.file_sha256,
        file_size_bytes: input.file_size_bytes,
        encoding: input.encoding,
        delimiter: input.delimiter,
        headers: input.headers,
      })
      .select()
      .single();

    if (error) throw new DomainError('errors.saveFailed', `Failed to create import job: ${error.message}`);
    
    return {
      jobId: data.id,
      previousJobs
    };
  }

  async saveMapping(
    agencyId: string, 
    jobId: string, 
    mapping: ContactMappingInput | InquiryMappingInput | PropertyMappingInput,
    options: ContactImportOptionsInput | InquiryImportOptionsInput | PropertyImportOptionsInput
  ): Promise<ImportJob> {
    const job = await this.repository.getJob(agencyId, jobId);
    if (!job) throw new DomainError("import.errors.notFound", "Job not found");
    if (job.status !== "draft" && job.status !== "staged" && job.status !== "validated") {
      throw new DomainError("import.errors.invalidStatus", "Invalid status");
    }

    return await this.repository.updateJob(agencyId, jobId, {
      column_mapping: mapping as any,
      options: options as any,
      status: "staged"
    });
  }

  async stageRows(agencyId: string, jobId: string, input: StageRowsInput): Promise<void> {
    const job = await this.repository.getJob(agencyId, jobId);
    if (!job) throw new DomainError("import.errors.notFound", "Job not found");
    if (job.status !== "draft" && job.status !== "staged") {
      throw new DomainError("import.errors.invalidStatus", "Invalid status");
    }

    const newTotalRows = job.total_rows + input.rows.length;
    if (newTotalRows > 5000) {
      throw new DomainError("import.errors.tooManyRows", "Too many rows");
    }

    const rowsToInsert = input.rows.map((row, index) => ({
      row_number: input.startRow + index,
      raw: row,
      normalized: null,
      status: "pending" as const,
      errors: [],
      match_reason: null,
      matched_entity_id: null,
      entity_id: null
    }));

    await this.repository.insertRows(agencyId, jobId, rowsToInsert);
    await this.repository.updateJob(agencyId, jobId, { total_rows: newTotalRows, status: "staged" });
  }

  /** `userId` is the importer: property rows with no assignee and no job default go to them. */
  async validate(agencyId: string, jobId: string, userId: string): Promise<ImportSummary> {
    const job = await this.repository.getJob(agencyId, jobId);
    if (!job) throw new DomainError("import.errors.notFound", "Job not found");

    if (job.entity_type === "inquiry") {
      return this.validateInquiries(agencyId, job);
    }
    if (job.entity_type === "property") {
      return this.validateProperties(agencyId, job, userId);
    }
    
    const pageSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const rows = await this.repository.listRows(agencyId, jobId, { offset, limit: pageSize });
      if (rows.length === 0) {
        hasMore = false;
        break;
      }

      const candidates = rows.map(row => {
        try {
          const candidate = mapRowToCandidate(row.raw, job.column_mapping, job.options as ContactImportOptionsInput);
          if (candidate.phone) candidate.phone = normalizePhone(candidate.phone);
          if (candidate.phone_2) candidate.phone_2 = normalizePhone(candidate.phone_2);
          if (candidate.email) candidate.email = candidate.email.toLowerCase();
          if (candidate.email_2) candidate.email_2 = candidate.email_2.toLowerCase();
          return candidate;
        } catch (e) {
          return null;
        }
      });

      const allEmails = new Set<string>();
      const allPhones = new Set<string>();
      const allRefs = new Set<string>();
      const allNames = new Set<string>();

      candidates.forEach(cand => {
        if (!cand) return;
        if (cand.email) allEmails.add(cand.email);
        if (cand.email_2) allEmails.add(cand.email_2);
        if (cand.phone) allPhones.add(cand.phone);
        if (cand.phone_2) allPhones.add(cand.phone_2);
        if (cand.external_ref) allRefs.add(cand.external_ref);
        
        const name = cand.contact_type === 'organization' ? cand.company_name : `${cand.first_name || ''} ${cand.last_name || ''}`.trim();
        if (name) allNames.add(name);
      });

      const [methods, refs, contactsByName] = await Promise.all([
        this.repository.lookupExistingMethods(agencyId, [...allEmails, ...allPhones]),
        this.repository.lookupExternalRefs(agencyId, [...allRefs]),
        this.repository.lookupContactsByName(agencyId, [...allNames])
      ]);

      const existingIndexMap = new Map<string, ExistingContactInfo>();
      
      refs.forEach(r => {
        if (!existingIndexMap.has(r.id)) existingIndexMap.set(r.id, { id: r.id, external_ref: r.external_ref, display_name: "", emails: [], phones: [] });
        existingIndexMap.get(r.id)!.external_ref = r.external_ref;
      });

      methods.forEach(m => {
        if (!existingIndexMap.has(m.contact_id)) existingIndexMap.set(m.contact_id, { id: m.contact_id, external_ref: null, display_name: "", emails: [], phones: [] });
        if (m.type === 'email') existingIndexMap.get(m.contact_id)!.emails.push(m.value);
        if (m.type === 'phone') existingIndexMap.get(m.contact_id)!.phones.push(m.value);
      });

      contactsByName.forEach(c => {
        if (!existingIndexMap.has(c.id)) existingIndexMap.set(c.id, { id: c.id, external_ref: null, display_name: c.display_name, emails: [], phones: [] });
        existingIndexMap.get(c.id)!.display_name = c.display_name;
      });

      const existingIndex = Array.from(existingIndexMap.values());

      const validCandidates = candidates.map(c => c || {
        contact_type: "person" as const, first_name: null, last_name: null, company_name: null, phone: null, phone_2: null, email: null, email_2: null, viber: null, whatsapp: null, note: null, external_ref: null
      });

      const classifications = classifyDuplicates(validCandidates, existingIndex);

      const updates = rows.map((row, i) => {
        const candidate = candidates[i];
        if (!candidate) {
          return { id: row.id, status: "invalid" as const, normalized: null, errors: [{ code: "import.errors.mappingFailed" }], match_reason: null, matched_entity_id: null };
        }

        if (!candidate.first_name && !candidate.last_name && !candidate.company_name) {
          return { id: row.id, status: "invalid" as const, normalized: candidate as any, errors: [{ code: "import.errors.missingName" }], match_reason: null, matched_entity_id: null };
        }

        const cls = classifications[i];
        return {
          id: row.id,
          status: cls.status,
          normalized: candidate as any,
          errors: [],
          match_reason: cls.match_reason,
          matched_entity_id: cls.matched_entity_id
        };
      });

      await this.repository.updateRowsBulk(agencyId, jobId, updates);
      
      if (rows.length < pageSize) {
        hasMore = false;
      } else {
        offset += pageSize;
      }
    }

    const allRows = await this.repository.listRows(agencyId, jobId);
    const validCount = allRows.filter(r => r.status === 'valid').length;
    const invalidCount = allRows.filter(r => r.status === 'invalid').length;
    const duplicateCount = allRows.filter(r => r.status === 'duplicate').length;

    await this.repository.updateJob(agencyId, jobId, {
      status: "validated",
      valid_count: validCount,
      invalid_count: invalidCount,
      duplicate_count: duplicateCount
    });

    return { total: allRows.length, valid: validCount, invalid: invalidCount, duplicate: duplicateCount, completed: false };
  }

  private async validateInquiries(agencyId: string, job: ImportJob): Promise<ImportSummary> {
    const pageSize = 1000;
    let offset = 0;
    let hasMore = true;
    
    // Fetch lookup data
    const [{ data: sources, error: sourcesError }, members] = await Promise.all([
      this.db.from("lead_sources").select("id, name").eq("agency_id", agencyId),
      new MemberRepository(this.db).getActiveBrokers(agencyId)
    ]);
    if (sourcesError) throw new DomainError("errors.loadFailed", `Failed to load lead sources: ${sourcesError.message}`);

    const memberList = members.map(m => ({
      user_id: m.id,
      email: m.email,
      display_name: m.display_name
    }));

    const options = job.options as InquiryImportOptionsInput;

    while (hasMore) {
      const rows = await this.repository.listRows(agencyId, job.id, { offset, limit: pageSize });
      if (rows.length === 0) {
        hasMore = false;
        break;
      }

      const allRefs = new Set<string>();
      const allPhonesAndEmails = new Set<string>();
      
      const candidates = rows.map(row => {
        try {
          const candidate = mapRowToInquiryCandidate(row.raw, job.column_mapping);
          if (candidate.caller_phone) candidate.caller_phone = normalizePhone(candidate.caller_phone);
          if (candidate.caller_email) candidate.caller_email = candidate.caller_email.toLowerCase();
          
          if (candidate.external_ref) allRefs.add(candidate.external_ref);
          if (candidate.caller_phone) allPhonesAndEmails.add(candidate.caller_phone);
          if (candidate.caller_email) allPhonesAndEmails.add(candidate.caller_email);

          return candidate;
        } catch (e) {
          return null;
        }
      });

      const [refs, contacts] = await Promise.all([
        this.repository.lookupInquiryExternalRefs(agencyId, options.default_source_id || null, [...allRefs]),
        this.repository.lookupExistingMethods(agencyId, [...allPhonesAndEmails])
      ]);

      const existingRefs = new Set(refs.map(r => r.external_ref));
      
      const contactMap = new Map<string, string>(); // value -> contact_id
      contacts.forEach(c => contactMap.set(c.value, c.contact_id));

      const inBatchRefs = new Set<string>();

      const updates = rows.map((row, i) => {
        const candidate = candidates[i];
        if (!candidate) {
          return { id: row.id, status: "invalid" as const, normalized: null, errors: [{ code: "import.errors.mappingFailed" }], match_reason: null, matched_entity_id: null };
        }

        // Basic validation (at least one contact method or subject)
        if (!candidate.caller_name && !candidate.caller_phone && !candidate.caller_email && !candidate.subject && !candidate.description) {
          return { id: row.id, status: "invalid" as const, normalized: candidate as any, errors: [{ code: "import.errors.missingInquiryMapping" }], match_reason: null, matched_entity_id: null };
        }

        // Deduplication
        let isDuplicate = false;
        if (candidate.external_ref) {
          if (existingRefs.has(candidate.external_ref)) {
            isDuplicate = true;
          } else if (inBatchRefs.has(candidate.external_ref)) {
            isDuplicate = true;
          }
          inBatchRefs.add(candidate.external_ref);
        }

        if (isDuplicate) {
          return {
            id: row.id,
            status: "skipped" as const,
            normalized: candidate as any,
            errors: [],
            match_reason: "external_ref" as const,
            matched_entity_id: null
          };
        }

        const sourceId = resolveSource(candidate.source, sources || [], options.default_source_id || null);
        if (!sourceId && options.unknown_source === "error" && candidate.source) {
           return { id: row.id, status: "invalid" as const, normalized: candidate as any, errors: [{ code: "import.errors.unknownSource" }], match_reason: null, matched_entity_id: null };
        }

        const assignedTo = resolveAssignee(candidate.assigned_to, memberList, options.default_assigned_to || null);
        if (!assignedTo && candidate.assigned_to) {
          return { id: row.id, status: "invalid" as const, normalized: candidate as any, errors: [{ code: "import.errors.unknownAssignee" }], match_reason: null, matched_entity_id: null };
        }
        
        let receivedAt = parseDate(candidate.received_at, options.date_format); // tz can be picked up globally or from agency settings
        
        // Link contacts
        let matchedContactId: string | null = null;
        if (candidate.caller_phone && contactMap.has(candidate.caller_phone)) matchedContactId = contactMap.get(candidate.caller_phone)!;
        if (!matchedContactId && candidate.caller_email && contactMap.has(candidate.caller_email)) matchedContactId = contactMap.get(candidate.caller_email)!;

        return {
          id: row.id,
          status: "valid" as const,
          normalized: {
            ...candidate,
            source_id: sourceId,
            assigned_to: assignedTo,
            status: resolveStatus(candidate.status, options.default_status),
            received_at_parsed: receivedAt ? receivedAt.toISOString() : null
          },
          errors: [],
          match_reason: null,
          matched_entity_id: matchedContactId
        };
      });

      await this.repository.updateRowsBulk(agencyId, job.id, updates);
      
      if (rows.length < pageSize) {
        hasMore = false;
      } else {
        offset += pageSize;
      }
    }

    const allRows = await this.repository.listRows(agencyId, job.id);
    const validCount = allRows.filter(r => r.status === 'valid').length;
    const invalidCount = allRows.filter(r => r.status === 'invalid').length;
    const duplicateCount = allRows.filter(r => r.status === 'duplicate').length;
    const skippedCount = allRows.filter(r => r.status === 'skipped').length;

    await this.repository.updateJob(agencyId, job.id, {
      status: "validated",
      valid_count: validCount,
      invalid_count: invalidCount,
      duplicate_count: duplicateCount,
      skipped_count: skippedCount
    });
    // Compute broker impact for valid inquiries
    const impactMap = new Map<string, number>();
    allRows.filter(r => r.status === 'valid').forEach(r => {
      const assignedTo = r.normalized?.assigned_to;
      const status = r.normalized?.status;
      if (assignedTo && status === 'new') {
        impactMap.set(assignedTo, (impactMap.get(assignedTo) || 0) + 1);
      }
    });

    const brokerImpact = Array.from(impactMap.entries()).map(([userId, count]) => {
      const member = memberList.find(m => m.user_id === userId);
      return {
        userId,
        name: member?.display_name || "Unknown",
        newInquiries: count
      };
    });

    return { total: allRows.length, valid: validCount, invalid: invalidCount, duplicate: duplicateCount, completed: false, brokerImpact };
  }

  /**
   * Property rows (AD-064): each page resolves settlements, areas and the assignee and stores a
   * `normalized` payload with every id resolved, so the commit RPC never looks anything up by
   * name. Only the caller's agency's areas and members are loaded.
   */
  private async validateProperties(agencyId: string, job: ImportJob, importerId: string): Promise<ImportSummary> {
    const pageSize = 1000;
    const options = job.options as PropertyImportOptionsInput;
    const settlementRepo = new SettlementRepository(this.db);
    const areaRepo = new AreaRepository(this.db);

    const members = (await new MemberRepository(this.db).getActiveBrokers(agencyId)).map((m) => ({
      user_id: m.id,
      email: m.email,
      display_name: m.display_name,
    }));
    const defaultAssignee = resolveDefaultAssignee(options.default_assigned_to, importerId, members);
    // Earlier rows of the file, across pages: in-file external_ref and address duplicates.
    const state: ClassifyState = { refs: new Set(), addresses: new Set() };

    for (let offset = 0; ; offset += pageSize) {
      const rows = await this.repository.listRows(agencyId, job.id, { offset, limit: pageSize });
      if (rows.length === 0) break;

      const candidates = rows.map((row) => mapRowToPropertyCandidate(row.raw, job.column_mapping));

      const names: string[] = [];
      const codes: string[] = [];
      for (const candidate of candidates) {
        const query = settlementLookup(candidate.settlement);
        if (query && "code" in query) codes.push(query.code);
        else if (query) names.push(query.name);
      }
      const settlements = await settlementRepo.findByNamesOrCodes(names, codes);
      const areas = await areaRepo.findBySettlements(agencyId, settlements.map((s) => s.id));
      const areaIds = new Map(areas.map((a) => [areaKey(a.settlement_id, a.name), a.id]));

      const validated = candidates.map((candidate) =>
        validatePropertyRow(candidate, { settlements, areas: areaIds, members, defaultAssignee, dateFormat: options.date_format })
      );

      const refs: string[] = [];
      const phones: string[] = [];
      const emails: string[] = [];
      const addressItems: { row: number; settlement_id: string; address: string }[] = [];
      candidates.forEach((candidate, i) => {
        const methods = ownerMethods(candidate);
        if (methods.phone) phones.push(methods.phone);
        if (methods.email) emails.push(methods.email);
        if (candidate.external_ref) refs.push(candidate.external_ref);
        const property = validated[i].normalized?.property;
        if (property?.address) addressItems.push({ row: rows[i].row_number, settlement_id: property.settlement_id, address: property.address });
      });

      const [refRows, addressRows, phoneRows, emailRows] = await Promise.all([
        this.repository.lookupPropertyExternalRefs(agencyId, refs),
        this.repository.matchPropertyAddresses(addressItems),
        this.repository.lookupMethodsOfType(agencyId, "phone", phones),
        this.repository.lookupMethodsOfType(agencyId, "email", emails),
      ]);
      const contactNames = await this.repository.lookupContactNames(
        agencyId,
        [...phoneRows, ...emailRows].map((m) => m.contact_id)
      );
      const lookups: PropertyLookups = {
        refs: new Map(refRows.map((r) => [r.external_ref, r.id])),
        addresses: new Map(addressRows.map((a) => [a.row_index, { key: a.address_key, property_id: a.property_id }])),
        phones: new Map(phoneRows.map((m) => [m.value, m.contact_id])),
        emails: new Map(emailRows.map((m) => [m.value, m.contact_id])),
        contactNames,
      };

      // In file order, so "an earlier row" means the same thing as in the spreadsheet.
      const updates = rows.map((row, i) => {
        const result = classifyPropertyRow(row.row_number, candidates[i], validated[i], lookups, state);
        return {
          id: row.id,
          status: result.status,
          normalized: result.normalized as Record<string, unknown> | null,
          errors: result.errors,
          match_reason: result.match_reason,
          matched_entity_id: result.matched_entity_id,
        };
      });

      await this.repository.updateRowsBulk(agencyId, job.id, updates);
      if (rows.length < pageSize) break;
    }

    // Counted in the database: reading the rows back is capped at 1,000 by PostgREST.
    const counts = await this.repository.countRowsByStatus(agencyId, job.id, ["valid", "invalid", "duplicate", "skipped"]);
    const total = counts.valid + counts.invalid + counts.duplicate + counts.skipped;

    await this.repository.updateJob(agencyId, job.id, {
      status: "validated",
      valid_count: counts.valid,
      invalid_count: counts.invalid,
      duplicate_count: counts.duplicate,
      skipped_count: counts.skipped,
    });

    return { total, valid: counts.valid, invalid: counts.invalid, duplicate: counts.duplicate, completed: false };
  }

  async commitBatch(agencyId: string, jobId: string): Promise<{ processed: number; remaining: number }> {
    const job = await this.repository.getJob(agencyId, jobId);
    if (!job) throw new DomainError("import.errors.notFound", "Job not found");
    if (job.status !== "validated" && job.status !== "committing") {
      throw new DomainError("import.errors.invalidStatus", "Invalid status");
    }

    if (job.entity_type === "inquiry") {
      return await this.repository.commitInquiriesBatch(jobId);
    } else if (job.entity_type === "property") {
      return await this.repository.commitPropertiesBatch(jobId);
    } else {
      return await this.repository.commitContactsBatch(jobId);
    }
  }

  async revert(agencyId: string, jobId: string): Promise<RevertResult> {
    const job = await this.repository.getJob(agencyId, jobId);
    if (!job) throw new DomainError("import.errors.notFound", "Job not found");
    return await this.repository.revertJob(jobId);
  }

  /** Every row of the job in file order, page by page: one read is capped at 1,000 rows by PostgREST. */
  private async listAllRows(agencyId: string, jobId: string): Promise<ImportRow[]> {
    const pageSize = 1000;
    const all: ImportRow[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const page = await this.repository.listRows(agencyId, jobId, { offset, limit: pageSize });
      all.push(...page);
      if (page.length < pageSize) return all;
    }
  }

  private async getValidatedPropertyJob(agencyId: string, jobId: string): Promise<ImportJob> {
    const job = await this.repository.getJob(agencyId, jobId);
    if (!job) throw new DomainError("import.errors.notFound", "Job not found");
    if (job.entity_type !== "property" || job.status !== "validated") {
      throw new DomainError("import.errors.invalidStatus", "Not a validated property job");
    }
    return job;
  }

  /** The property preview (spec: property-import, "Preview"), read from the validated rows. */
  async getPropertyPreview(agencyId: string, jobId: string, locale: "bg" | "en" = "bg"): Promise<PropertyPreview> {
    const job = await this.getValidatedPropertyJob(agencyId, jobId);
    const rows = await this.listAllRows(agencyId, jobId);

    const settlementIds = new Set<string>();
    for (const row of rows) {
      const area = (row.normalized as { new_area?: { settlement_id: string } | null } | null)?.new_area;
      if (area) settlementIds.add(area.settlement_id);
    }
    const [settlements, areas] = await Promise.all([
      new SettlementRepository(this.db).findByIds([...settlementIds]),
      new AreaRepository(this.db).findBySettlements(agencyId, [...settlementIds]),
    ]);
    const existingAreas = new Map<string, string[]>();
    for (const area of areas) {
      existingAreas.set(area.settlement_id, [...(existingAreas.get(area.settlement_id) ?? []), area.name]);
    }
    const options = job.options as PropertyImportOptionsInput;

    return buildPropertyPreview(rows, {
      mapping: job.column_mapping,
      duplicateStrategy: options.duplicate_strategy ?? "skip",
      createAreas: options.create_areas,
      settlementNames: new Map(settlements.map((s) => [s.id, locale === "en" ? s.name_en : s.name_bg])),
      existingAreas,
    });
  }

  /** The new areas the user kept in the preview (`options.create_areas`); the commit creates only these. */
  async setCreateAreas(agencyId: string, jobId: string, keys: string[]): Promise<void> {
    const job = await this.getValidatedPropertyJob(agencyId, jobId);
    await this.repository.updateJob(agencyId, jobId, { options: { ...job.options, create_areas: keys } });
  }

  async getSummary(agencyId: string, jobId: string): Promise<ImportSummary> {
    const job = await this.repository.getJob(agencyId, jobId);
    if (!job) throw new DomainError("import.errors.notFound", "Job not found");

    return {
      total: job.total_rows,
      valid: job.valid_count,
      invalid: job.invalid_count,
      duplicate: job.duplicate_count,
      completed: job.status === "completed" || job.status === "failed" || job.status === "reverted"
    };
  }

  async buildErrorReportCsv(
    agencyId: string,
    jobId: string,
    labels: { reasonHeader: string; reason: (code: string) => string }
  ): Promise<string> {
    const job = await this.repository.getJob(agencyId, jobId);
    if (!job) throw new DomainError("import.errors.notFound", "Job not found");

    const errorRows = (await this.listAllRows(agencyId, jobId))
      .filter(r => r.status === 'invalid' || r.status === 'error');

    if (errorRows.length === 0) return "";

    const headers = [...job.headers, labels.reasonHeader];
    const delimiter = job.delimiter;
    
    let csv = '\uFEFF';
    csv += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(delimiter) + '\n';

    for (const row of errorRows) {
      const errorMsg = row.errors.map(e => describeRowError(e, labels.reason).replace(/"/g, '""')).join(", ");
      const rowValues = job.headers.map(h => {
        const val = row.raw[h] || "";
        return `"${val.replace(/"/g, '""')}"`;
      });
      rowValues.push(`"${errorMsg}"`);
      csv += rowValues.join(delimiter) + '\n';
    }

    return csv;
  }
}
