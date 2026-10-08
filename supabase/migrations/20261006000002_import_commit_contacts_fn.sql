-- 20261006000002_import_commit_contacts_fn.sql

CREATE OR REPLACE FUNCTION import_commit_contacts(p_job_id UUID, p_limit INT DEFAULT 200)
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
  v_contact_id UUID;
  v_user_id UUID := (SELECT auth.uid());
  v_normalized_email TEXT;
  v_normalized_phone TEXT;
  v_external_ref TEXT;
  v_duplicate_exists BOOLEAN;
  v_existing_contact_id UUID;
  v_note TEXT;
  v_duplicate_strategy TEXT;
BEGIN
  -- 1. Guard checks
  SELECT * INTO v_job FROM import_jobs WHERE id = p_job_id FOR UPDATE;
  
  IF v_job IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  IF v_job.agency_id != current_agency_id() THEN
    RAISE EXCEPTION 'Unauthorized agency';
  END IF;

  IF current_user_role() NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized role';
  END IF;

  IF v_job.status NOT IN ('validated', 'committing') THEN
    RAISE EXCEPTION 'Job is not in a committable state';
  END IF;

  -- Update job status to committing
  IF v_job.status = 'validated' THEN
    UPDATE import_jobs SET status = 'committing' WHERE id = p_job_id;
  END IF;
  
  v_duplicate_strategy := COALESCE(v_job.options->>'duplicate_strategy', 'skip');

  -- 2. Loop through rows
  FOR v_row IN 
    SELECT * FROM import_rows 
    WHERE import_job_id = p_job_id AND status = 'valid' 
    ORDER BY row_number 
    LIMIT p_limit 
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      -- Savepoint begins implicitly in a BEGIN block with EXCEPTION inside a PL/pgSQL loop
      
      -- Extract key fields for duplicate check
      v_external_ref := v_row.normalized->>'external_ref';
      v_normalized_email := v_row.normalized->>'email';
      v_normalized_phone := v_row.normalized->>'phone';
      v_note := v_row.normalized->>'note';
      
      v_duplicate_exists := FALSE;
      v_existing_contact_id := NULL;

      -- Authoritative re-check for external_ref
      IF v_external_ref IS NOT NULL THEN
        SELECT id INTO v_existing_contact_id FROM contacts WHERE agency_id = v_job.agency_id AND external_ref = v_external_ref LIMIT 1;
        IF FOUND THEN
          v_duplicate_exists := TRUE;
        END IF;
      END IF;

      -- Authoritative re-check for email
      IF NOT v_duplicate_exists AND v_normalized_email IS NOT NULL THEN
        SELECT contact_id INTO v_existing_contact_id FROM contact_methods WHERE agency_id = v_job.agency_id AND type = 'email' AND value = v_normalized_email LIMIT 1;
        IF FOUND THEN
          v_duplicate_exists := TRUE;
        END IF;
      END IF;

      -- Authoritative re-check for phone
      IF NOT v_duplicate_exists AND v_normalized_phone IS NOT NULL THEN
        SELECT contact_id INTO v_existing_contact_id FROM contact_methods WHERE agency_id = v_job.agency_id AND type = 'phone' AND value = v_normalized_phone LIMIT 1;
        IF FOUND THEN
          v_duplicate_exists := TRUE;
        END IF;
      END IF;

      IF v_duplicate_exists THEN
        IF v_duplicate_strategy = 'skip' THEN
          UPDATE import_rows 
          SET status = 'skipped', match_reason = 'db_recheck', matched_entity_id = v_existing_contact_id 
          WHERE id = v_row.id;
        ELSIF v_duplicate_strategy = 'update' THEN
          -- For simplicity in pilot, update strategy just skips or does minimal update.
          UPDATE import_rows 
          SET status = 'skipped', match_reason = 'db_recheck_update_not_fully_implemented', matched_entity_id = v_existing_contact_id 
          WHERE id = v_row.id;
        ELSE -- 'create'
          -- proceed to create anyway
          v_duplicate_exists := FALSE;
        END IF;
      END IF;

      IF NOT v_duplicate_exists THEN
        -- Insert Contact
        INSERT INTO contacts (
          agency_id, 
          type, 
          first_name, 
          last_name, 
          company_name, 
          display_name, 
          created_by,
          import_job_id,
          external_ref
        ) VALUES (
          v_job.agency_id,
          v_row.normalized->>'contact_type',
          v_row.normalized->>'first_name',
          v_row.normalized->>'last_name',
          v_row.normalized->>'company_name',
          -- Computed display name logic
          CASE 
            WHEN v_row.normalized->>'contact_type' = 'organization' THEN COALESCE(v_row.normalized->>'company_name', '')
            ELSE TRIM(COALESCE(v_row.normalized->>'first_name', '') || ' ' || COALESCE(v_row.normalized->>'last_name', ''))
          END,
          v_user_id,
          p_job_id,
          v_external_ref
        ) RETURNING id INTO v_contact_id;

        -- Insert Contact Methods
        IF v_normalized_email IS NOT NULL THEN
          INSERT INTO contact_methods (agency_id, contact_id, type, value, is_primary)
          VALUES (v_job.agency_id, v_contact_id, 'email', v_normalized_email, TRUE);
        END IF;
        
        IF v_row.normalized->>'email_2' IS NOT NULL THEN
          INSERT INTO contact_methods (agency_id, contact_id, type, value, is_primary)
          VALUES (v_job.agency_id, v_contact_id, 'email', v_row.normalized->>'email_2', FALSE);
        END IF;

        IF v_normalized_phone IS NOT NULL THEN
          INSERT INTO contact_methods (agency_id, contact_id, type, value, is_primary)
          VALUES (v_job.agency_id, v_contact_id, 'phone', v_normalized_phone, TRUE);
        END IF;

        IF v_row.normalized->>'phone_2' IS NOT NULL THEN
          INSERT INTO contact_methods (agency_id, contact_id, type, value, is_primary)
          VALUES (v_job.agency_id, v_contact_id, 'phone', v_row.normalized->>'phone_2', FALSE);
        END IF;

        IF v_row.normalized->>'viber' IS NOT NULL THEN
          INSERT INTO contact_methods (agency_id, contact_id, type, value, is_primary)
          VALUES (v_job.agency_id, v_contact_id, 'viber', v_row.normalized->>'viber', FALSE);
        END IF;
        
        IF v_row.normalized->>'whatsapp' IS NOT NULL THEN
          INSERT INTO contact_methods (agency_id, contact_id, type, value, is_primary)
          VALUES (v_job.agency_id, v_contact_id, 'whatsapp', v_row.normalized->>'whatsapp', FALSE);
        END IF;

        -- Insert Note
        IF v_note IS NOT NULL AND v_note != '' THEN
          INSERT INTO notes (agency_id, contact_id, content, created_by)
          VALUES (v_job.agency_id, v_contact_id, v_note, v_user_id);
        END IF;

        -- Insert Audit Log
        INSERT INTO audit_log (
          agency_id,
          entity_type,
          entity_id,
          action,
          performed_by,
          metadata
        ) VALUES (
          v_job.agency_id,
          'contact',
          v_contact_id,
          'created',
          v_user_id,
          jsonb_build_object(
            'source', 'csv_import',
            'import_job_id', p_job_id,
            'file_name', v_job.file_name,
            'row_number', v_row.row_number
          )
        );

        UPDATE import_rows 
        SET status = 'created', entity_id = v_contact_id 
        WHERE id = v_row.id;
      END IF;

      v_processed := v_processed + 1;

    EXCEPTION WHEN OTHERS THEN
      -- If any error occurs for this row, mark as error and continue
      UPDATE import_rows 
      SET status = 'error', 
          errors = jsonb_build_array(jsonb_build_object('code', 'import.errors.dbWrite', 'detail', SQLERRM))
      WHERE id = v_row.id;
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

GRANT EXECUTE ON FUNCTION import_commit_contacts TO authenticated;
