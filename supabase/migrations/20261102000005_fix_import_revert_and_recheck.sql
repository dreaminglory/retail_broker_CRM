-- 20261102000005_fix_import_revert_and_recheck.sql
-- trustworthy-loop, Task 11 (AC-8).
--
-- import_revert: the notes guard tested for blank content, which `notes` CHECK forbids, so
-- a contact with a broker's note was deleted along with the note. Row statuses were also
-- marked the wrong way round (kept inquiries `reverted`, deleted ones left `created`).
--
-- import_commit_contacts: `db_recheck` wasn't in the match_reason CHECK, so a duplicate found
-- at commit became an `error` row instead of `skipped`. The "update existing" strategy isn't
-- built: a job that still has it stored now skips duplicates.

ALTER TABLE import_rows DROP CONSTRAINT import_rows_status_check;
ALTER TABLE import_rows ADD CONSTRAINT import_rows_status_check
  CHECK (status IN ('pending','valid','invalid','duplicate',
                    'created','updated','skipped','error','reverted','revert_skipped'));

ALTER TABLE import_rows DROP CONSTRAINT import_rows_match_reason_check;
ALTER TABLE import_rows ADD CONSTRAINT import_rows_match_reason_check
  CHECK (match_reason IN ('phone','email','external_ref','in_file','name_similar','db_recheck'));

-- ── Revert ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION import_revert(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_user_id UUID := (SELECT auth.uid());
  v_deleted_inquiries INT := 0;
  v_kept_inquiries INT := 0;
  v_deleted_contacts INT := 0;
  v_kept_contacts INT := 0;
BEGIN
  SELECT * INTO v_job FROM import_jobs WHERE id = p_job_id FOR UPDATE;

  IF v_job IS NULL THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF v_job.agency_id != current_agency_id() THEN RAISE EXCEPTION 'Unauthorized agency'; END IF;
  IF current_user_role() NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'Unauthorized role'; END IF;
  IF v_job.status != 'completed' THEN RAISE EXCEPTION 'Job is not in completed state'; END IF;
  IF v_job.completed_at < now() - INTERVAL '7 days' THEN RAISE EXCEPTION 'Revert window (7 days) expired'; END IF;

  -- Inquiries go first: an imported contact is only free to delete once its inquiry is gone.
  IF v_job.entity_type = 'inquiry' THEN
    WITH deleted AS (
      DELETE FROM inquiries i
      WHERE i.import_job_id = p_job_id
        AND i.opportunity_id IS NULL
        AND i.updated_at <= v_job.completed_at
      RETURNING i.id
    ), marked AS (
      UPDATE import_rows r SET status = 'reverted'
      FROM deleted d
      WHERE r.import_job_id = p_job_id AND r.status = 'created' AND r.entity_id = d.id
    )
    SELECT count(*) INTO v_deleted_inquiries FROM deleted;

    SELECT count(*) INTO v_kept_inquiries FROM inquiries WHERE import_job_id = p_job_id;
  END IF;

  -- A contact is kept once anyone has worked on it. The note an import row brought in is not
  -- work; any other note is, and so is that note once edited (its content or updated_at moves).
  WITH deleted AS (
    DELETE FROM contacts c
    WHERE c.import_job_id = p_job_id
      AND c.updated_at <= v_job.completed_at
      AND NOT EXISTS (SELECT 1 FROM opportunities o WHERE o.primary_contact_id = c.id)
      AND NOT EXISTS (SELECT 1 FROM opportunity_participants op WHERE op.contact_id = c.id)
      AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.contact_id = c.id)
      AND NOT EXISTS (SELECT 1 FROM inquiries i WHERE i.contact_id = c.id)
      AND NOT EXISTS (
        SELECT 1 FROM merge_history mh
        WHERE mh.loser_contact_id = c.id OR mh.winner_contact_id = c.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM notes n
        WHERE n.contact_id = c.id
          AND NOT EXISTS (
            SELECT 1 FROM import_rows r
            WHERE r.import_job_id = p_job_id
              AND r.entity_id = c.id
              AND r.normalized->>'note' = n.content
              AND n.updated_at <= v_job.completed_at
          )
      )
    RETURNING c.id
  ), marked AS (
    UPDATE import_rows r SET status = 'reverted'
    FROM deleted d
    WHERE r.import_job_id = p_job_id AND r.status = 'created' AND r.entity_id = d.id
  )
  SELECT count(*) INTO v_deleted_contacts FROM deleted;

  SELECT count(*) INTO v_kept_contacts FROM contacts WHERE import_job_id = p_job_id;

  -- Whatever a row created and this revert didn't delete was kept.
  UPDATE import_rows SET status = 'revert_skipped'
  WHERE import_job_id = p_job_id AND status = 'created';

  UPDATE import_jobs
  SET status = 'reverted', reverted_at = now(), reverted_by = v_user_id
  WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'deleted', jsonb_build_object('contacts', v_deleted_contacts, 'inquiries', v_deleted_inquiries),
    'kept', jsonb_build_object('contacts', v_kept_contacts, 'inquiries', v_kept_inquiries)
  );
END;
$$;

-- ── Commit ───────────────────────────────────────────────────────────────────
-- Body unchanged from 20261102000001 apart from the duplicate branch.

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
        IF v_duplicate_strategy IN ('skip', 'update') THEN
          UPDATE import_rows
          SET status = 'skipped', match_reason = 'db_recheck', matched_entity_id = v_existing_contact_id
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
