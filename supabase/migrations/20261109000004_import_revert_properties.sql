-- 20261109000004_import_revert_properties.sql
-- spec: property-import, Task 6 (AD-064, AD-036 extended). import_revert learns property jobs.
-- The guards, the inquiry branch and the contact rule are copied unchanged from
-- 20261103000004_property_review_fixes.sql. Grants carry over (20261102000007).
--
-- For a property job, in this order:
--   1. Delete the job's properties nobody has worked on since the commit. Their listings and
--      parties cascade. Worked on = edited or archived (updated_at moved), or it has a note, a
--      task, an opportunity link, a listing that isn't the job's or changed after the commit,
--      or a party that isn't the job's, was ended or changed. Notes would cascade and tasks
--      would lose their property, so both are checked here, not left to the foreign keys.
--   2. The existing contact rule. An owner whose only parties were on deleted properties is
--      free now; a kept property keeps its owner party, so its owner is kept too.
--   3. Delete the job's areas that no property and no requirement uses.
-- A contact or inquiry job returns exactly the shape it always has.

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
  v_deleted_properties INT := 0;
  v_kept_properties INT := 0;
  v_deleted_areas INT := 0;
  v_kept_areas INT := 0;
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

  -- Properties go before contacts for the same reason: their owner parties hold the owners.
  IF v_job.entity_type = 'property' THEN
    WITH deleted AS (
      DELETE FROM properties p
      WHERE p.import_job_id = p_job_id
        AND p.agency_id = v_job.agency_id
        AND p.updated_at <= v_job.completed_at
        AND NOT EXISTS (SELECT 1 FROM notes n WHERE n.property_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.property_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM opportunity_properties op WHERE op.property_id = p.id)
        AND NOT EXISTS (
          SELECT 1 FROM listings l
          WHERE l.property_id = p.id
            AND (l.import_job_id IS DISTINCT FROM p_job_id OR l.updated_at > v_job.completed_at)
        )
        AND NOT EXISTS (
          SELECT 1 FROM property_parties pp
          WHERE pp.property_id = p.id
            AND (pp.import_job_id IS DISTINCT FROM p_job_id
                 OR pp.ended_at IS NOT NULL
                 OR pp.updated_at > v_job.completed_at)
        )
      RETURNING p.id
    ), marked AS (
      UPDATE import_rows r SET status = 'reverted'
      FROM deleted d
      WHERE r.import_job_id = p_job_id AND r.status = 'created' AND r.entity_id = d.id
    )
    SELECT count(*) INTO v_deleted_properties FROM deleted;

    SELECT count(*) INTO v_kept_properties FROM properties WHERE import_job_id = p_job_id;
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
      AND NOT EXISTS (SELECT 1 FROM property_parties pp WHERE pp.contact_id = c.id)
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

  -- New areas last: only once no property (kept or not from this job) and no requirement uses them.
  IF v_job.entity_type = 'property' THEN
    WITH deleted AS (
      DELETE FROM areas a
      WHERE a.import_job_id = p_job_id
        AND a.agency_id = v_job.agency_id
        AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.area_id = a.id)
        AND NOT EXISTS (SELECT 1 FROM requirement_locations rl WHERE rl.area_id = a.id)
      RETURNING a.id
    )
    SELECT count(*) INTO v_deleted_areas FROM deleted;

    SELECT count(*) INTO v_kept_areas FROM areas WHERE import_job_id = p_job_id;
  END IF;

  -- Whatever a row created and this revert didn't delete was kept.
  UPDATE import_rows SET status = 'revert_skipped'
  WHERE import_job_id = p_job_id AND status = 'created';

  UPDATE import_jobs
  SET status = 'reverted', reverted_at = now(), reverted_by = v_user_id
  WHERE id = p_job_id;

  IF v_job.entity_type = 'property' THEN
    RETURN jsonb_build_object(
      'deleted', jsonb_build_object('contacts', v_deleted_contacts, 'inquiries', 0,
                                    'properties', v_deleted_properties, 'areas', v_deleted_areas),
      'kept', jsonb_build_object('contacts', v_kept_contacts, 'inquiries', 0,
                                 'properties', v_kept_properties, 'areas', v_kept_areas)
    );
  END IF;

  RETURN jsonb_build_object(
    'deleted', jsonb_build_object('contacts', v_deleted_contacts, 'inquiries', v_deleted_inquiries),
    'kept', jsonb_build_object('contacts', v_kept_contacts, 'inquiries', v_kept_inquiries)
  );
END;
$$;
