-- 20261109000005_property_import_review_fixes.sql
-- spec: property-import, Checkpoint 1 review fixes (AD-064).
--
-- 1. properties.updated_at moves only when a column someone can edit changes. Renaming an area
--    refreshes its properties' search_vector (trg_areas_search_vector_cascade); that used to
--    move updated_at too, so fixing a misspelled imported area made revert keep every property
--    in it as "worked on".
-- 2. import_revert: the agency and role guards are NULL-safe (IS DISTINCT FROM, as the commit
--    RPCs), and a property is also worked on when one of the listings or the owner party its
--    row created has since been deleted by hand (fewer of the job's listings than the row
--    made, or no owner party left). Everything else is copied unchanged from
--    20261109000004_import_revert_properties.sql. Grants carry over (20261102000007).

-- ── 1. updated_at ignores derived columns ───────────────────────────────────

-- A trigger WHEN can't take a whole-row reference on a table with generated columns
-- (address_key), so the comparison lives in the function. An update that changes nothing
-- editable keeps the old updated_at, even one that sets updated_at itself.
CREATE OR REPLACE FUNCTION public.properties_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (to_jsonb(NEW) - 'updated_at' - 'search_vector' - 'address_key')
     IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at' - 'search_vector' - 'address_key') THEN
    NEW.updated_at := now();
  ELSE
    NEW.updated_at := OLD.updated_at;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.properties_set_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER set_properties_updated_at ON properties;
CREATE TRIGGER set_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION properties_set_updated_at();

-- ── 2. import_revert ────────────────────────────────────────────────────────

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
  IF v_job.agency_id IS DISTINCT FROM current_agency_id() THEN RAISE EXCEPTION 'Unauthorized agency'; END IF;
  IF current_user_role() IS NULL OR current_user_role() NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'Unauthorized role'; END IF;
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
        -- A listing or the owner party the row created, deleted by hand since.
        AND NOT EXISTS (
          SELECT 1 FROM import_rows r
          WHERE r.import_job_id = p_job_id
            AND r.entity_id = p.id
            AND (
              (SELECT count(*) FROM listings l WHERE l.property_id = p.id AND l.import_job_id = p_job_id)
                < jsonb_array_length(COALESCE(r.normalized -> 'listings', '[]'::JSONB))
              OR (
                (r.normalized ->> 'owner_contact_id' IS NOT NULL
                 OR jsonb_typeof(r.normalized -> 'new_owner') = 'object')
                AND NOT EXISTS (
                  SELECT 1 FROM property_parties pp
                  WHERE pp.property_id = p.id AND pp.import_job_id = p_job_id
                )
              )
            )
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
