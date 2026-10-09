import { SupabaseClient } from "@supabase/supabase-js";
import { ImportRepository } from "./repository";
import { CreateImportJobInput, ContactMappingInput, ContactImportOptionsInput, StageRowsInput, InquiryMappingInput, InquiryImportOptionsInput } from "./validation";
import { ImportJob, ImportSummary } from "./types";
import { mapRowToCandidate, mapRowToInquiryCandidate } from "./csv/row-mapper";
import { classifyDuplicates, ExistingContactInfo } from "./duplicate-classifier";
import { DomainError } from "@/lib/errors";
import { normalizePhone } from "../contacts/phone";
import { parseDate } from "./csv/date-parse";
import { resolveSource, resolveAssignee, resolveStatus } from "./csv/value-resolvers";

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

    if (error) throw error;
    
    return {
      jobId: data.id,
      previousJobs
    };
  }

  async saveMapping(
    agencyId: string, 
    jobId: string, 
    mapping: ContactMappingInput | InquiryMappingInput, 
    options: ContactImportOptionsInput | InquiryImportOptionsInput
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

  async validate(agencyId: string, jobId: string): Promise<ImportSummary> {
    const job = await this.repository.getJob(agencyId, jobId);
    if (!job) throw new DomainError("import.errors.notFound", "Job not found");
    
    if (job.entity_type === "inquiry") {
      return this.validateInquiries(agencyId, job);
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
    const [{ data: sources }, { data: members }] = await Promise.all([
      this.db.from("lead_sources").select("id, name").eq("agency_id", agencyId),
      this.db.from("agency_memberships")
        .select("user_id, status, profiles:user_id(display_name)")
        .eq("agency_id", agencyId)
        .eq("status", "active")
    ]);

    // Need email too for members, let's fetch emails for active users via RPC or if possible via a join.
    // Wait, profiles only has display_name. The email is restricted.
    // For Pilot we can just skip email resolution if it's too complex or we can assume display_name is enough.
    // The plan said: "assignee by email/name". If we can't easily fetch email, we'll just resolve by display_name.
    const memberList = (members || []).map(m => ({
      user_id: m.user_id,
      email: null, // Hard to fetch without admin rights securely
      display_name: (m.profiles as any)?.display_name
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

  async commitBatch(agencyId: string, jobId: string): Promise<{ processed: number; remaining: number }> {
    const job = await this.repository.getJob(agencyId, jobId);
    if (!job) throw new DomainError("import.errors.notFound", "Job not found");
    if (job.status !== "validated" && job.status !== "committing") {
      throw new DomainError("import.errors.invalidStatus", "Invalid status");
    }

    if (job.entity_type === "inquiry") {
      return await this.repository.commitInquiriesBatch(jobId);
    } else {
      return await this.repository.commitContactsBatch(jobId);
    }
  }

  async revert(agencyId: string, jobId: string): Promise<any> {
    const job = await this.repository.getJob(agencyId, jobId);
    if (!job) throw new DomainError("import.errors.notFound", "Job not found");
    return await this.repository.revertJob(jobId);
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

  async buildErrorReportCsv(agencyId: string, jobId: string): Promise<string> {
    const job = await this.repository.getJob(agencyId, jobId);
    if (!job) throw new DomainError("import.errors.notFound", "Job not found");

    const rows = await this.repository.listRows(agencyId, jobId);
    const errorRows = rows.filter(r => r.status === 'invalid' || r.status === 'error');

    if (errorRows.length === 0) return "";

    const headers = [...job.headers, "Error Reason"];
    const delimiter = job.delimiter;
    
    let csv = '\uFEFF';
    csv += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(delimiter) + '\n';

    for (const row of errorRows) {
      const errorMsg = row.errors.map(e => e.code).join(", ");
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
