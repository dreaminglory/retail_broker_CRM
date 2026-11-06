-- 20261107000001_join_inquiry.sql
-- AD-061: an inquiry can join an open deal of its contact instead of creating a second one.
-- SECURITY INVOKER like convert_inquiry, so RLS and the audit and task triggers apply. Lock order is
-- always the inquiry, then the opportunity. Refusals are raised as i18n keys (AD-032).

CREATE OR REPLACE FUNCTION public.join_inquiry(
  p_agency_id      UUID,
  p_inquiry_id     UUID,
  p_contact_id     UUID,
  p_opportunity_id UUID,
  p_task           JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status      TEXT;
  v_assignee    UUID;
  v_opp_status  TEXT;
  v_owner       UUID;
  v_primary     UUID;
  v_reactivated BOOLEAN := false;
  v_task_id     UUID;
BEGIN
  IF p_agency_id IS DISTINCT FROM current_agency_id() THEN
    RAISE EXCEPTION 'errors.not_found';
  END IF;

  SELECT status, assigned_to INTO v_status, v_assignee
  FROM inquiries
  WHERE id = p_inquiry_id AND agency_id = p_agency_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'errors.not_found';
  END IF;
  IF v_status NOT IN ('new', 'contacted') THEN
    RAISE EXCEPTION 'errors.inquiries.invalid_transition';
  END IF;

  SELECT status, assigned_to, primary_contact_id INTO v_opp_status, v_owner, v_primary
  FROM opportunities
  WHERE id = p_opportunity_id AND agency_id = p_agency_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'errors.not_found';
  END IF;
  IF v_opp_status NOT IN ('active', 'nurture') THEN
    RAISE EXCEPTION 'errors.inquiries.join_closed_opportunity';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM contacts WHERE id = p_contact_id AND agency_id = p_agency_id) THEN
    RAISE EXCEPTION 'errors.not_found';
  END IF;
  IF v_primary IS DISTINCT FROM p_contact_id AND NOT EXISTS (
    SELECT 1 FROM opportunity_participants
    WHERE opportunity_id = p_opportunity_id AND agency_id = p_agency_id AND contact_id = p_contact_id
  ) THEN
    RAISE EXCEPTION 'errors.inquiries.join_contact_not_on_opportunity';
  END IF;

  -- Same update as OpportunityRepository.reactivate; the audit trigger records it.
  IF v_opp_status = 'nurture' THEN
    UPDATE opportunities
    SET status = 'active', closed_at = NULL, lost_reason = NULL
    WHERE id = p_opportunity_id AND agency_id = p_agency_id;
    v_reactivated := true;
  END IF;

  IF v_owner IS NULL AND v_assignee IS NOT NULL THEN
    UPDATE opportunities SET assigned_to = v_assignee
    WHERE id = p_opportunity_id AND agency_id = p_agency_id;
    v_owner := v_assignee;
  END IF;

  UPDATE inquiries
  SET status = 'converted', contact_id = p_contact_id, opportunity_id = p_opportunity_id
  WHERE id = p_inquiry_id AND agency_id = p_agency_id;

  IF p_task IS NOT NULL THEN
    INSERT INTO tasks (agency_id, opportunity_id, contact_id, title, due_at, task_type, assigned_to, created_by)
    VALUES (
      p_agency_id, p_opportunity_id, p_contact_id,
      p_task->>'title', (p_task->>'due_at')::timestamptz, 'call',
      COALESCE(v_owner, auth.uid()), auth.uid()
    )
    RETURNING id INTO v_task_id;
  END IF;

  RETURN jsonb_build_object(
    'opportunity_id', p_opportunity_id,
    'owner_id', v_owner,
    'reactivated', v_reactivated,
    'task_id', v_task_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.join_inquiry(UUID, UUID, UUID, UUID, JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.join_inquiry(UUID, UUID, UUID, UUID, JSONB) TO authenticated;
