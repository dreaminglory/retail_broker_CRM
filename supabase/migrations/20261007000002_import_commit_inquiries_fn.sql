-- 20261007000002_import_commit_inquiries_fn.sql

CREATE OR REPLACE FUNCTION import_commit_inquiries(p_job_id UUID, p_limit INT DEFAULT 200)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_row RECORD;
  v_processed INT := 0;
  v_remaining INT := 0;
  v_inquiry_id UUID;
  v_user_id UUID := (SELECT auth.uid());
  v_normalized_email TEXT;
  v_normalized_phone TEXT;
  v_external_ref TEXT;
  v_contact_id UUID;
  v_source_id UUID;
  v_link_contacts BOOLEAN;
  v_create_missing BOOLEAN;
  v_default_status TEXT;
  v_status TEXT;
  v_assigned_to UUID;
  v_raw_payload JSONB;
BEGIN
  -- 1. Guard checks
  SELECT * INTO v_job FROM import_jobs WHERE id = p_job_id FOR UPDATE;
  
  IF v_job IS NULL THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF v_job.agency_id != current_agency_id() THEN RAISE EXCEPTION 'Unauthorized agency'; END IF;
  IF current_user_role() NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'Unauthorized role'; END IF;
  IF v_job.status NOT IN ('validated', 'committing') THEN RAISE EXCEPTION 'Job is not in a committable state'; END IF;

  IF v_job.status = 'validated' THEN
    UPDATE import_jobs SET status = 'committing' WHERE id = p_job_id;
  END IF;
  
  v_link_contacts := COALESCE((v_job.options->>'link_contacts')::BOOLEAN, TRUE);
  v_create_missing := COALESCE((v_job.options->>'create_missing_contacts')::BOOLEAN, FALSE);
  v_default_status := COALESCE(v_job.options->>'default_status', 'new');

  -- 2. Loop through rows
  FOR v_row IN 
    SELECT * FROM import_rows 
    WHERE import_job_id = p_job_id AND status = 'valid' 
    ORDER BY row_number 
    LIMIT p_limit 
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      v_contact_id := NULL;
      v_external_ref := v_row.normalized->>'external_ref';
      v_source_id := (v_row.normalized->>'source_id')::UUID;
      v_assigned_to := (v_row.normalized->>'assigned_to')::UUID;
      v_status := COALESCE(v_row.normalized->>'status', v_default_status);
      v_normalized_email := v_row.normalized->>'caller_email';
      v_normalized_phone := v_row.normalized->>'caller_phone';
      
      -- Link Contact
      IF v_link_contacts AND v_row.matched_entity_id IS NOT NULL THEN
        v_contact_id := v_row.matched_entity_id;
      ELSIF v_create_missing THEN
        IF v_normalized_email IS NOT NULL THEN
          SELECT contact_id INTO v_contact_id FROM contact_methods WHERE agency_id = v_job.agency_id AND type = 'email' AND value = v_normalized_email LIMIT 1;
        END IF;
        IF v_contact_id IS NULL AND v_normalized_phone IS NOT NULL THEN
          SELECT contact_id INTO v_contact_id FROM contact_methods WHERE agency_id = v_job.agency_id AND type = 'phone' AND value = v_normalized_phone LIMIT 1;
        END IF;
        
        IF v_contact_id IS NULL THEN
          INSERT INTO contacts (agency_id, first_name, display_name, created_by, import_job_id) 
          VALUES (
            v_job.agency_id, 
            COALESCE(v_row.normalized->>'caller_name', 'Unknown'), 
            COALESCE(v_row.normalized->>'caller_name', 'Unknown'),
            v_user_id, 
            p_job_id
          ) RETURNING id INTO v_contact_id;
          
          IF v_normalized_email IS NOT NULL THEN
            INSERT INTO contact_methods (agency_id, contact_id, type, value, is_primary) VALUES (v_job.agency_id, v_contact_id, 'email', v_normalized_email, TRUE);
          END IF;
          IF v_normalized_phone IS NOT NULL THEN
            INSERT INTO contact_methods (agency_id, contact_id, type, value, is_primary) VALUES (v_job.agency_id, v_contact_id, 'phone', v_normalized_phone, TRUE);
          END IF;
          
          INSERT INTO audit_log (agency_id, entity_type, entity_id, action, performed_by, metadata) 
          VALUES (v_job.agency_id, 'contact', v_contact_id, 'created', v_user_id, jsonb_build_object('source', 'csv_import', 'import_job_id', p_job_id));
        END IF;
      END IF;
      
      -- Create Inquiry
      v_raw_payload := jsonb_build_object(
        'import', jsonb_build_object('job_id', p_job_id, 'file_name', v_job.file_name, 'row_number', v_row.row_number),
        'row', v_row.raw
      );
      
      INSERT INTO inquiries (
        agency_id, source_id, external_ref, contact_id, assigned_to, status, 
        caller_name, caller_phone, caller_email, subject, description,
        received_at, created_by, import_job_id, raw_payload
      ) VALUES (
        v_job.agency_id, v_source_id, v_external_ref, v_contact_id, v_assigned_to, v_status,
        v_row.normalized->>'caller_name', v_normalized_phone, v_normalized_email,
        v_row.normalized->>'subject', v_row.normalized->>'description',
        COALESCE((v_row.normalized->>'received_at_parsed')::TIMESTAMPTZ, now()), v_user_id, p_job_id, v_raw_payload
      ) 
      ON CONFLICT (agency_id, source_id, external_ref) WHERE external_ref IS NOT NULL DO NOTHING
      RETURNING id INTO v_inquiry_id;

      IF v_inquiry_id IS NULL THEN
        UPDATE import_rows SET status = 'skipped', match_reason = 'external_ref' WHERE id = v_row.id;
      ELSE
        UPDATE import_rows SET status = 'created', entity_id = v_inquiry_id WHERE id = v_row.id;
      END IF;

      v_processed := v_processed + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE import_rows SET status = 'error', errors = jsonb_build_array(jsonb_build_object('code', 'import.errors.dbWrite', 'detail', SQLERRM)) WHERE id = v_row.id;
      v_processed := v_processed + 1;
    END;
  END LOOP;

  -- Recompute counters
  UPDATE import_jobs
  SET valid_count = (SELECT count(*) FROM import_rows WHERE import_job_id = p_job_id AND status = 'valid'),
      invalid_count = (SELECT count(*) FROM import_rows WHERE import_job_id = p_job_id AND status = 'invalid'),
      duplicate_count = (SELECT count(*) FROM import_rows WHERE import_job_id = p_job_id AND status = 'duplicate'),
      created_count = (SELECT count(*) FROM import_rows WHERE import_job_id = p_job_id AND status = 'created'),
      updated_count = (SELECT count(*) FROM import_rows WHERE import_job_id = p_job_id AND status = 'updated'),
      skipped_count = (SELECT count(*) FROM import_rows WHERE import_job_id = p_job_id AND status = 'skipped'),
      error_count = (SELECT count(*) FROM import_rows WHERE import_job_id = p_job_id AND status = 'error')
  WHERE id = p_job_id;

  SELECT count(*) INTO v_remaining FROM import_rows WHERE import_job_id = p_job_id AND status = 'valid';

  IF v_remaining = 0 THEN
    UPDATE import_jobs SET status = 'completed', completed_at = now() WHERE id = p_job_id;
  END IF;

  RETURN jsonb_build_object('processed', v_processed, 'remaining', v_remaining);
END;
$$;

GRANT EXECUTE ON FUNCTION import_commit_inquiries TO authenticated;
