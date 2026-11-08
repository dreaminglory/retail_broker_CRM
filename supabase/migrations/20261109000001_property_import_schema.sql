-- 20261109000001_property_import_schema.sql
-- spec: property-import, Task 1 (AD-064). A third import type on the AD-034 pipeline:
-- the entity type, the job id on every record a property row creates, the one address rule
-- shared by validation and commit, and the job id in the created audit rows.

-- ── Import job and row values ────────────────────────────────────────────────

ALTER TABLE import_jobs DROP CONSTRAINT import_jobs_entity_type_check;
ALTER TABLE import_jobs ADD CONSTRAINT import_jobs_entity_type_check
  CHECK (entity_type IN ('contact', 'inquiry', 'property'));

ALTER TABLE import_rows DROP CONSTRAINT import_rows_match_reason_check;
ALTER TABLE import_rows ADD CONSTRAINT import_rows_match_reason_check
  CHECK (match_reason IN ('phone','email','external_ref','in_file','name_similar','db_recheck','address'));

-- ── Traceability (as on contacts and inquiries) ──────────────────────────────

ALTER TABLE properties       ADD COLUMN import_job_id UUID REFERENCES import_jobs(id) ON DELETE SET NULL;
ALTER TABLE listings         ADD COLUMN import_job_id UUID REFERENCES import_jobs(id) ON DELETE SET NULL;
ALTER TABLE property_parties ADD COLUMN import_job_id UUID REFERENCES import_jobs(id) ON DELETE SET NULL;
ALTER TABLE areas            ADD COLUMN import_job_id UUID REFERENCES import_jobs(id) ON DELETE SET NULL;

CREATE INDEX idx_properties_import_job       ON properties (import_job_id)       WHERE import_job_id IS NOT NULL;
CREATE INDEX idx_listings_import_job         ON listings (import_job_id)         WHERE import_job_id IS NOT NULL;
CREATE INDEX idx_property_parties_import_job ON property_parties (import_job_id) WHERE import_job_id IS NOT NULL;
CREATE INDEX idx_areas_import_job            ON areas (import_job_id)            WHERE import_job_id IS NOT NULL;

-- ── Address key (rule 4) ─────────────────────────────────────────────────────
-- The only copy of the rule: lowercase, punctuation to spaces, the street-kind words
-- (ул, улица, бул, булевард, ж.к., жк) removed as whole words, then all whitespace removed.
-- `ул. "Яворов" № 12, ет. 3` and `ул Яворов 12 ет 3` both give `яворов12ет3`.
-- Blank text gives NULL, and a NULL key is never a duplicate.

CREATE OR REPLACE FUNCTION public.property_address_key(p_address TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT NULLIF(
    pg_catalog.regexp_replace(
      pg_catalog.regexp_replace(
        ' ' || pg_catalog.regexp_replace(
          pg_catalog.lower(p_address),
          '[[:punct:]№„“”«»‘’–—]+', ' ', 'g'
        ) || ' ',
        '\s(ул|улица|бул|булевард|жк|ж\s+к)(?=\s)', ' ', 'g'
      ),
      '\s+', '', 'g'
    ),
    ''
  );
$$;

REVOKE EXECUTE ON FUNCTION public.property_address_key(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.property_address_key(TEXT) TO authenticated;

ALTER TABLE properties
  ADD COLUMN address_key TEXT GENERATED ALWAYS AS (public.property_address_key(address)) STORED;

CREATE INDEX idx_properties_agency_address_key
  ON properties (agency_id, settlement_id, address_key) WHERE address_key IS NOT NULL;

-- ── Audit: the job id on the created rows (rule 7) ───────────────────────────
-- Bodies copied from 20261103000003_property_triggers.sql; only the INSERT metadata changes.

CREATE OR REPLACE FUNCTION public.audit_property_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := (SELECT auth.uid());
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (agency_id, entity_type, entity_id, action, metadata, performed_by)
    VALUES (
      NEW.agency_id, 'property', NEW.id, 'created',
      jsonb_strip_nulls(jsonb_build_object('code', NEW.code, 'import_job_id', NEW.import_job_id)),
      v_user
    );
    RETURN NEW;
  END IF;

  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO audit_log (agency_id, entity_type, entity_id, action, field_name, old_value, new_value, metadata, performed_by)
    VALUES (
      NEW.agency_id, 'property', NEW.id, 'assignment_change', 'assigned_to',
      OLD.assigned_to::TEXT, NEW.assigned_to::TEXT,
      jsonb_build_object('old_email', get_user_email(OLD.assigned_to), 'new_email', get_user_email(NEW.assigned_to)),
      v_user
    );
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO audit_log (agency_id, entity_type, entity_id, action, field_name, old_value, new_value, performed_by)
    VALUES (
      NEW.agency_id, 'property', NEW.id,
      CASE WHEN NEW.status = 'archived' THEN 'archived' ELSE 'status_change' END,
      'status', OLD.status, NEW.status, v_user
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_property_changes() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.audit_listing_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := (SELECT auth.uid());
  v_meta JSONB := jsonb_build_object('property_id', NEW.property_id, 'offer_type', NEW.offer_type);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (agency_id, entity_type, entity_id, action, new_value, metadata, performed_by)
    VALUES (
      NEW.agency_id, 'listing', NEW.id, 'created', NEW.price::TEXT,
      v_meta || jsonb_strip_nulls(jsonb_build_object('import_job_id', NEW.import_job_id)),
      v_user
    );
    RETURN NEW;
  END IF;

  IF NEW.price IS DISTINCT FROM OLD.price THEN
    INSERT INTO audit_log (agency_id, entity_type, entity_id, action, field_name, old_value, new_value, metadata, performed_by)
    VALUES (NEW.agency_id, 'listing', NEW.id, 'field_change', 'price', OLD.price::TEXT, NEW.price::TEXT, v_meta, v_user);
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO audit_log (agency_id, entity_type, entity_id, action, field_name, old_value, new_value, metadata, performed_by)
    VALUES (NEW.agency_id, 'listing', NEW.id, 'status_change', 'status', OLD.status, NEW.status, v_meta, v_user);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_listing_changes() FROM PUBLIC, anon, authenticated;
