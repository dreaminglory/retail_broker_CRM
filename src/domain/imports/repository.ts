import { SupabaseClient } from "@supabase/supabase-js";
import { ImportJob, ImportRow } from "./types";
import { CreateImportJobInput } from "./validation";

export class ImportRepository {
  constructor(private db: SupabaseClient<any>) {}

  async createJob(agencyId: string, input: CreateImportJobInput): Promise<ImportJob> {
    const { data, error } = await this.db
      .from("import_jobs")
      .insert({
        agency_id: agencyId,
        entity_type: "contact",
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
    return data as ImportJob;
  }

  async getJob(agencyId: string, jobId: string): Promise<ImportJob | null> {
    const { data, error } = await this.db
      .from("import_jobs")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("id", jobId)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data as ImportJob | null;
  }

  async listJobs(agencyId: string, options?: { limit?: number }): Promise<ImportJob[]> {
    let query = this.db
      .from("import_jobs")
      .select("*")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as ImportJob[];
  }

  async findJobsByHash(agencyId: string, hash: string): Promise<ImportJob[]> {
    const { data, error } = await this.db
      .from("import_jobs")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("file_sha256", hash)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as ImportJob[];
  }

  async updateJob(agencyId: string, jobId: string, updates: Partial<ImportJob>): Promise<ImportJob> {
    const { data, error } = await this.db
      .from("import_jobs")
      .update(updates)
      .eq("agency_id", agencyId)
      .eq("id", jobId)
      .select()
      .single();

    if (error) throw error;
    return data as ImportJob;
  }

  async insertRows(agencyId: string, jobId: string, rows: Omit<ImportRow, "id" | "created_at" | "agency_id" | "import_job_id">[]): Promise<void> {
    const payloads = rows.map((r) => ({
      ...r,
      agency_id: agencyId,
      import_job_id: jobId,
    }));

    const { error } = await this.db.from("import_rows").insert(payloads);
    if (error) throw error;
  }

  async listRows(agencyId: string, jobId: string, options?: { status?: string; offset?: number; limit?: number }): Promise<ImportRow[]> {
    let query = this.db
      .from("import_rows")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("import_job_id", jobId)
      .order("row_number", { ascending: true });

    if (options?.status) {
      query = query.eq("status", options.status);
    }
    if (options?.limit) {
      const offset = options.offset || 0;
      query = query.range(offset, offset + options.limit - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as ImportRow[];
  }

  async updateRowsBulk(agencyId: string, jobId: string, updates: Pick<ImportRow, "id" | "status" | "normalized" | "errors" | "match_reason" | "matched_entity_id">[]): Promise<void> {
    // Supabase JS doesn't have an easy bulk update API using the standard client without raw SQL if we want different values per row.
    // However, if we upsert based on ID, it works. Let's use upsert.
    const payloads = updates.map(u => ({
      ...u,
      agency_id: agencyId,
      import_job_id: jobId
    }));
    
    // We can't use standard upsert if we only provide partial fields, we might overwrite missing fields with nulls.
    // So we should probably do a chunked update or RPC. Since there's no bulk update in standard REST unless all columns are present,
    // we can use a loop for now or write a DB function. For Pilot, a simple Promise.all with chunking is fine for validation which handles ~1000 rows.
    
    const chunk_size = 200;
    for (let i = 0; i < updates.length; i += chunk_size) {
      const chunk = updates.slice(i, i + chunk_size);
      await Promise.all(chunk.map(u => 
        this.db.from("import_rows")
          .update(u)
          .eq("id", u.id)
          .eq("agency_id", agencyId)
      ));
    }
  }

  async lookupExistingMethods(agencyId: string, values: string[]): Promise<{ contact_id: string; type: string; value: string }[]> {
    if (values.length === 0) return [];
    
    // chunk to max 500
    const chunk_size = 500;
    const results: { contact_id: string; type: string; value: string }[] = [];
    
    for (let i = 0; i < values.length; i += chunk_size) {
      const chunk = values.slice(i, i + chunk_size);
      const { data, error } = await this.db
        .from("contact_methods")
        .select("contact_id, type, value")
        .eq("agency_id", agencyId)
        .in("value", chunk);
        
      if (error) throw error;
      if (data) results.push(...data);
    }
    
    return results;
  }

  async lookupExternalRefs(agencyId: string, refs: string[]): Promise<{ id: string; external_ref: string }[]> {
    if (refs.length === 0) return [];
    
    const chunk_size = 500;
    const results: { id: string; external_ref: string }[] = [];
    
    for (let i = 0; i < refs.length; i += chunk_size) {
      const chunk = refs.slice(i, i + chunk_size);
      const { data, error } = await this.db
        .from("contacts")
        .select("id, external_ref")
        .eq("agency_id", agencyId)
        .in("external_ref", chunk)
        .not("external_ref", "is", null);
        
      if (error) throw error;
      if (data) results.push(...data as any[]);
    }
    
    return results;
  }
  
  async lookupContactsByName(agencyId: string, names: string[]): Promise<{ id: string; display_name: string }[]> {
    if (names.length === 0) return [];
    
    const chunk_size = 500;
    const results: { id: string; display_name: string }[] = [];
    
    // ILIKE or IN is tricky for lowercased names. Let's fetch all and filter or use exact matches if small enough.
    // Given the constraints, we'll try an IN clause on display_name. We should lower the input and match if we had a lower column,
    // but PostgREST allows ilike. We'll do exact matches for now.
    
    for (let i = 0; i < names.length; i += chunk_size) {
      const chunk = names.slice(i, i + chunk_size);
      const { data, error } = await this.db
        .from("contacts")
        .select("id, display_name")
        .eq("agency_id", agencyId)
        .in("display_name", chunk);
        
      if (error) throw error;
      if (data) results.push(...data);
    }
    return results;
  }

  async lookupInquiryExternalRefs(agencyId: string, sourceId: string | null, refs: string[]): Promise<{ id: string; external_ref: string }[]> {
    if (refs.length === 0) return [];
    
    const chunk_size = 500;
    const results: { id: string; external_ref: string }[] = [];
    
    for (let i = 0; i < refs.length; i += chunk_size) {
      const chunk = refs.slice(i, i + chunk_size);
      let query = this.db
        .from("inquiries")
        .select("id, external_ref")
        .eq("agency_id", agencyId)
        .in("external_ref", chunk)
        .not("external_ref", "is", null);

      if (sourceId) {
        query = query.eq("source_id", sourceId);
      } else {
        query = query.is("source_id", null);
      }
        
      const { data, error } = await query;
      if (error) throw error;
      if (data) results.push(...data as any[]);
    }
    
    return results;
  }

  async commitContactsBatch(jobId: string, limit: number = 200): Promise<{ processed: number; remaining: number }> {
    const { data, error } = await this.db.rpc("import_commit_contacts", {
      p_job_id: jobId,
      p_limit: limit,
    });

    if (error) throw error;
    return data as { processed: number; remaining: number };
  }

  async commitInquiriesBatch(jobId: string, limit: number = 200): Promise<{ processed: number; remaining: number }> {
    const { data, error } = await this.db.rpc("import_commit_inquiries", {
      p_job_id: jobId,
      p_limit: limit,
    });

    if (error) throw error;
    return data as { processed: number; remaining: number };
  }

  async revertJob(jobId: string): Promise<{ deleted: { contacts: number; inquiries: number }; kept: { contacts: number; inquiries: number } }> {
    const { data, error } = await this.db.rpc("import_revert", {
      p_job_id: jobId,
    });

    if (error) throw error;
    return data as { deleted: { contacts: number; inquiries: number }; kept: { contacts: number; inquiries: number } };
  }
}
