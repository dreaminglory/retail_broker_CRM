-- 20261102000008_atomic_convert_and_merge.sql
-- AD-050: converting an inquiry and merging contacts each run in one transaction, so a failure
-- leaves nothing half done and retrying can't create a second contact or opportunity. Both are
-- SECURITY INVOKER, so RLS and the audit triggers apply as they did to the separate writes.
-- Refusals are raised as i18n keys (AD-032). The service normalises the input first (C2).

CREATE OR REPLACE FUNCTION public.convert_inquiry(
  p_agency_id       UUID,
  p_inquiry_id      UUID,
  p_title           TEXT,
  p_type            TEXT,
  p_stage_id        UUID,
  p_assigned_to     UUID,
  p_contact_id      UUID,
  p_new_contact     JSONB,
  p_contact_methods JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status         TEXT;
  v_source_id      UUID;
  v_contact_id     UUID := p_contact_id;
  v_opportunity_id UUID;
BEGIN
  IF p_agency_id IS DISTINCT FROM current_agency_id() THEN
    RAISE EXCEPTION 'errors.not_found';
  END IF;

  -- The lock makes a second, simultaneous conversion wait and then see 'converted' (I3).
  SELECT status, source_id INTO v_status, v_source_id
  FROM inquiries
  WHERE id = p_inquiry_id AND agency_id = p_agency_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'errors.not_found';
  END IF;
  IF v_status NOT IN ('new', 'contacted') THEN
    RAISE EXCEPTION 'errors.inquiries.invalid_transition';
  END IF;

  -- A foreign key doesn't see RLS, so another agency's stage or contact has to be refused here.
  IF NOT EXISTS (SELECT 1 FROM stages WHERE id = p_stage_id AND agency_id = p_agency_id) THEN
    RAISE EXCEPTION 'errors.not_found';
  END IF;

  IF p_new_contact IS NOT NULL THEN
    BEGIN
      INSERT INTO contacts (agency_id, type, first_name, last_name, company_name, display_name, created_by)
      VALUES (
        p_agency_id,
        p_new_contact->>'type',
        p_new_contact->>'first_name',
        p_new_contact->>'last_name',
        p_new_contact->>'company_name',
        p_new_contact->>'display_name',
        auth.uid()
      )
      RETURNING id INTO v_contact_id;
    EXCEPTION WHEN check_violation THEN
      RAISE EXCEPTION 'errors.inquiries.contact_creation_failed';
    END;

    INSERT INTO contact_methods (agency_id, contact_id, type, value, label, is_primary)
    SELECT p_agency_id, v_contact_id, m.type, m.value, m.label, m.is_primary
    FROM jsonb_to_recordset(p_contact_methods) AS m(type TEXT, value TEXT, label TEXT, is_primary BOOLEAN);
  ELSIF p_contact_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM contacts WHERE id = p_contact_id AND agency_id = p_agency_id) THEN
    RAISE EXCEPTION 'errors.not_found';
  END IF;

  INSERT INTO opportunities (
    agency_id, title, type, stage_id, source_id, inquiry_id, primary_contact_id, assigned_to,
    temperature, currency, created_by
  )
  VALUES (
    p_agency_id, p_title, p_type, p_stage_id, v_source_id, p_inquiry_id, v_contact_id, p_assigned_to,
    'warm', 'EUR', auth.uid()
  )
  RETURNING id INTO v_opportunity_id;

  UPDATE inquiries
  SET status = 'converted', contact_id = v_contact_id, opportunity_id = v_opportunity_id
  WHERE id = p_inquiry_id AND agency_id = p_agency_id;

  RETURN jsonb_build_object('opportunity_id', v_opportunity_id, 'contact_id', v_contact_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.convert_inquiry(UUID, UUID, TEXT, TEXT, UUID, UUID, UUID, JSONB, JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.convert_inquiry(UUID, UUID, TEXT, TEXT, UUID, UUID, UUID, JSONB, JSONB) TO authenticated;


CREATE OR REPLACE FUNCTION public.merge_contacts(
  p_agency_id UUID,
  p_winner_id UUID,
  p_loser_id  UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_snapshot JSONB;
BEGIN
  IF COALESCE(current_user_role(), '') NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'errors.forbidden';
  END IF;
  IF p_agency_id IS DISTINCT FROM current_agency_id() THEN
    RAISE EXCEPTION 'errors.not_found';
  END IF;
  IF p_winner_id = p_loser_id THEN
    RAISE EXCEPTION 'errors.merge_self';
  END IF;

  -- In id order, so two opposite merges can't deadlock.
  PERFORM 1 FROM contacts
  WHERE id IN (p_winner_id, p_loser_id) AND agency_id = p_agency_id
  ORDER BY id
  FOR UPDATE;

  IF NOT EXISTS (SELECT 1 FROM contacts WHERE id = p_winner_id AND agency_id = p_agency_id) THEN
    RAISE EXCEPTION 'errors.not_found';
  END IF;

  SELECT (to_jsonb(c) - 'search_vector') || jsonb_build_object(
    'contact_methods',
    (SELECT COALESCE(jsonb_agg(to_jsonb(m)), '[]'::jsonb) FROM contact_methods m WHERE m.contact_id = c.id)
  )
  INTO v_snapshot
  FROM contacts c
  WHERE c.id = p_loser_id AND c.agency_id = p_agency_id;

  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'errors.not_found';
  END IF;

  -- Contact methods: drop exact duplicates, move the rest
  DELETE FROM contact_methods l
  USING contact_methods w
  WHERE l.contact_id = p_loser_id
    AND l.agency_id = p_agency_id
    AND w.contact_id = p_winner_id
    AND w.agency_id = p_agency_id
    AND w.type = l.type
    AND w.value = l.value;

  UPDATE contact_methods
  SET contact_id = p_winner_id, is_primary = false
  WHERE contact_id = p_loser_id AND agency_id = p_agency_id;

  UPDATE opportunities
  SET primary_contact_id = p_winner_id
  WHERE primary_contact_id = p_loser_id AND agency_id = p_agency_id;

  -- Participants: a deal the winner is already on keeps the winner's row (P1)
  DELETE FROM opportunity_participants l
  USING opportunity_participants w
  WHERE l.contact_id = p_loser_id
    AND l.agency_id = p_agency_id
    AND w.contact_id = p_winner_id
    AND w.agency_id = p_agency_id
    AND w.opportunity_id = l.opportunity_id;

  UPDATE opportunity_participants
  SET contact_id = p_winner_id
  WHERE contact_id = p_loser_id AND agency_id = p_agency_id;

  UPDATE inquiries
  SET contact_id = p_winner_id
  WHERE contact_id = p_loser_id AND agency_id = p_agency_id;

  UPDATE tasks
  SET contact_id = p_winner_id
  WHERE contact_id = p_loser_id AND agency_id = p_agency_id;

  UPDATE contacts
  SET status = 'archived'
  WHERE id = p_loser_id AND agency_id = p_agency_id;

  INSERT INTO merge_history (agency_id, winner_contact_id, loser_contact_id, merged_by, loser_snapshot)
  VALUES (p_agency_id, p_winner_id, p_loser_id, auth.uid(), v_snapshot);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.merge_contacts(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.merge_contacts(UUID, UUID, UUID) TO authenticated;
