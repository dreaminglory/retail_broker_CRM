-- 20261006000001_create_import_tables.sql

CREATE TABLE import_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id        UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  entity_type      TEXT NOT NULL CHECK (entity_type IN ('contact', 'inquiry')),
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','staged','validated','committing','completed','failed','reverted')),
  file_name        TEXT NOT NULL,
  file_sha256      TEXT NOT NULL CHECK (file_sha256 ~ '^[a-f0-9]{64}$'),
  file_size_bytes  INT  NOT NULL CHECK (file_size_bytes BETWEEN 1 AND 5242880),
  encoding         TEXT NOT NULL DEFAULT 'utf-8' CHECK (encoding IN ('utf-8', 'windows-1251')),
  delimiter        TEXT NOT NULL DEFAULT ',',
  headers          JSONB NOT NULL DEFAULT '[]',
  column_mapping   JSONB NOT NULL DEFAULT '{}',
  options          JSONB NOT NULL DEFAULT '{}',
  total_rows       INT  NOT NULL DEFAULT 0,
  valid_count      INT  NOT NULL DEFAULT 0,
  invalid_count    INT  NOT NULL DEFAULT 0,
  duplicate_count  INT  NOT NULL DEFAULT 0,
  created_count    INT  NOT NULL DEFAULT 0,
  updated_count    INT  NOT NULL DEFAULT 0,
  skipped_count    INT  NOT NULL DEFAULT 0,
  error_count      INT  NOT NULL DEFAULT 0,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at     TIMESTAMPTZ,
  reverted_at      TIMESTAMPTZ,
  reverted_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_jobs_agency_created ON import_jobs(agency_id, created_at DESC);
CREATE INDEX idx_import_jobs_agency_hash    ON import_jobs(agency_id, file_sha256);

CREATE TABLE import_rows (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id      UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  import_job_id  UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  row_number     INT  NOT NULL,                 -- 1-based, excluding header
  raw            JSONB NOT NULL,                -- original cells keyed by header (PII: see retention)
  normalized     JSONB,                         -- validated payload ready for commit
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','valid','invalid','duplicate',
                                   'created','updated','skipped','error','reverted')),
  errors         JSONB NOT NULL DEFAULT '[]',   -- [{field, code}] — codes are i18n keys
  match_reason   TEXT CHECK (match_reason IN ('phone','email','external_ref','in_file','name_similar')),
  matched_entity_id UUID,                       -- existing record matched during validation
  entity_id      UUID,                          -- record created/updated by commit
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (import_job_id, row_number)
);
CREATE INDEX idx_import_rows_job_status ON import_rows(import_job_id, status, row_number);

-- Traceability on target entities
ALTER TABLE contacts ADD COLUMN import_job_id UUID REFERENCES import_jobs(id) ON DELETE SET NULL;
ALTER TABLE contacts ADD COLUMN external_ref  TEXT;   -- agency's own spreadsheet ID (optional)
CREATE UNIQUE INDEX uq_contacts_agency_external_ref
  ON contacts(agency_id, external_ref) WHERE external_ref IS NOT NULL;
CREATE INDEX idx_contacts_import_job ON contacts(import_job_id) WHERE import_job_id IS NOT NULL;

-- RLS: P-001 template, tightened — import is an owner/manager capability (AD-034)
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs FORCE ROW LEVEL SECURITY;

ALTER TABLE import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_rows FORCE ROW LEVEL SECURITY;

-- For each of import_jobs, import_rows — SELECT/INSERT/UPDATE/DELETE:
CREATE POLICY "tenant_select" ON import_jobs
  FOR SELECT USING (agency_id = current_agency_id() AND current_user_role() IN ('owner', 'manager'));
CREATE POLICY "tenant_insert" ON import_jobs
  FOR INSERT WITH CHECK (agency_id = current_agency_id() AND current_user_role() IN ('owner', 'manager'));
CREATE POLICY "tenant_update" ON import_jobs
  FOR UPDATE USING (agency_id = current_agency_id() AND current_user_role() IN ('owner', 'manager'))
  WITH CHECK (agency_id = current_agency_id() AND current_user_role() IN ('owner', 'manager'));
CREATE POLICY "tenant_delete" ON import_jobs
  FOR DELETE USING (agency_id = current_agency_id() AND current_user_role() IN ('owner', 'manager'));

CREATE POLICY "tenant_select" ON import_rows
  FOR SELECT USING (agency_id = current_agency_id() AND current_user_role() IN ('owner', 'manager'));
CREATE POLICY "tenant_insert" ON import_rows
  FOR INSERT WITH CHECK (agency_id = current_agency_id() AND current_user_role() IN ('owner', 'manager'));
CREATE POLICY "tenant_update" ON import_rows
  FOR UPDATE USING (agency_id = current_agency_id() AND current_user_role() IN ('owner', 'manager'))
  WITH CHECK (agency_id = current_agency_id() AND current_user_role() IN ('owner', 'manager'));
CREATE POLICY "tenant_delete" ON import_rows
  FOR DELETE USING (agency_id = current_agency_id() AND current_user_role() IN ('owner', 'manager'));

CREATE TRIGGER set_import_jobs_updated_at BEFORE UPDATE ON import_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
