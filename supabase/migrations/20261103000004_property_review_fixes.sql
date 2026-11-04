-- 20261103000004_property_review_fixes.sql
-- spec: properties, Checkpoint 3 review (AD-058).
--
-- 1. The link audit trigger wrote a removal row while its agency was being deleted, which broke
--    audit_log's agency foreign key: an agency with links couldn't be deleted.
-- 2. A link or a listing could be moved to another property (or a listing to another offer type)
--    with a plain UPDATE, past the archived check (rule 8) and without an audit row saying so.
--    Members may now update only the columns the app changes.
-- 3. A contact delete cascaded to its property parties, erasing the ownership history. The
--    parties now keep the contact (NO ACTION, so an agency delete still cascades), and the import
--    revert treats a party as work (AD-036).

-- ── 1. Link audit during an agency delete ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.audit_property_link_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row opportunity_properties := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  v_old TEXT;
  v_new TEXT;
BEGIN
  -- The agency is being deleted: its audit log goes with it.
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM agencies WHERE id = OLD.agency_id) THEN
    RETURN OLD;
  END IF;

  v_old := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE COALESCE(OLD.status, OLD.relation) END;
  v_new := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE COALESCE(NEW.status, NEW.relation) END;

  IF v_old IS NOT DISTINCT FROM v_new THEN
    RETURN v_row;
  END IF;

  INSERT INTO audit_log (agency_id, entity_type, entity_id, action, field_name, old_value, new_value, metadata, performed_by)
  VALUES (
    v_row.agency_id, 'opportunity', v_row.opportunity_id, 'status_change', 'property_link', v_old, v_new,
    jsonb_build_object(
      'property_id', v_row.property_id,
      'property_code', (SELECT code FROM properties WHERE id = v_row.property_id),
      'relation', v_row.relation,
      'rejected_reason', v_row.rejected_reason
    ),
    (SELECT auth.uid())
  );

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_property_link_changes() FROM PUBLIC, anon, authenticated;

-- ── 2. Links and listings stay on their property ─────────────────────────────
-- Column privileges: the triggers that set other columns (updated_at, closed_at) still work.

REVOKE UPDATE ON opportunity_properties FROM anon, authenticated;
GRANT UPDATE (status, rejected_reason) ON opportunity_properties TO authenticated;

REVOKE UPDATE ON listings FROM anon, authenticated;
GRANT UPDATE (price, status) ON listings TO authenticated;

-- ── 3. Party history survives a contact delete ───────────────────────────────

ALTER TABLE property_parties DROP CONSTRAINT fk_property_parties_contact;
ALTER TABLE property_parties ADD CONSTRAINT fk_property_parties_contact
  FOREIGN KEY (agency_id, contact_id) REFERENCES contacts (agency_id, id);

-- Body as in 20261102000005 plus the property_parties guard. Grants carry over
-- (20261102000007).
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
