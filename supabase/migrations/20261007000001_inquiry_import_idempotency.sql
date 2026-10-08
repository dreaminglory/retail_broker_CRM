ALTER TABLE inquiries ADD COLUMN import_job_id UUID REFERENCES import_jobs(id) ON DELETE SET NULL;
CREATE INDEX idx_inquiries_import_job ON inquiries(import_job_id) WHERE import_job_id IS NOT NULL;

-- Pre-check (fail loudly with the offending keys instead of a cryptic index error)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM inquiries WHERE external_ref IS NOT NULL
             GROUP BY agency_id, source_id, external_ref HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate (agency_id, source_id, external_ref) rows exist — resolve before applying';
  END IF;
END $$;

-- Idempotency key for imports AND manual entry (AD-035). PG15+ NULLS NOT DISTINCT so a
-- NULL source_id still dedupes.
CREATE UNIQUE INDEX uq_inquiries_source_external_ref
  ON inquiries(agency_id, source_id, external_ref) NULLS NOT DISTINCT
  WHERE external_ref IS NOT NULL;
