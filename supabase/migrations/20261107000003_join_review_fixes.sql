-- 20261107000003_join_review_fixes.sql
-- AD-061 review fixes.
-- 1. inquiries.joined_at: when an inquiry joined a deal. updated_at moves on a contact merge (C4),
--    so it can't date the join. NULL for an inquiry that never joined (or started its deal).
-- 2. join_inquiry validates the call back itself (the RPC is callable directly): a JSON null is
--    "no task", a blank title or a bad due date is refused with a key, not a Postgres error.
-- 3. claim_invitation_resend returns only the email, the one thing the service reads.

ALTER TABLE inquiries ADD COLUMN joined_at TIMESTAMPTZ;

UPDATE inquiries i
SET joined_at = i.updated_at
FROM opportunities o
WHERE i.opportunity_id = o.id
  AND i.status = 'converted'
  AND o.inquiry_id IS DISTINCT FROM i.id;

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
  v_title       TEXT;
  v_due         TIMESTAMPTZ;
BEGIN
  IF p_agency_id IS DISTINCT FROM current_agency_id() THEN
    RAISE EXCEPTION 'errors.not_found';
  END IF;

  -- A JSON null arrives as jsonb 'null', not SQL NULL: both mean no call back.
  IF p_task IS NOT NULL AND jsonb_typeof(p_task) = 'null' THEN
    p_task := NULL;
  END IF;
  IF p_task IS NOT NULL THEN
    IF jsonb_typeof(p_task) <> 'object' THEN
      RAISE EXCEPTION 'errors.inquiries.join_invalid_task';
    END IF;
    v_title := btrim(COALESCE(p_task->>'title', ''));
    IF v_title = '' OR char_length(v_title) > 300 THEN
      RAISE EXCEPTION 'errors.inquiries.join_invalid_task';
    END IF;
    BEGIN
      v_due := (p_task->>'due_at')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'errors.inquiries.join_invalid_task';
    END;
    IF v_due IS NULL THEN
      RAISE EXCEPTION 'errors.inquiries.join_invalid_task';
    END IF;
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
  SET status = 'converted', contact_id = p_contact_id, opportunity_id = p_opportunity_id,
      joined_at = now()
  WHERE id = p_inquiry_id AND agency_id = p_agency_id;

  IF p_task IS NOT NULL THEN
    INSERT INTO tasks (agency_id, opportunity_id, contact_id, title, due_at, task_type, assigned_to, created_by)
    VALUES (
      p_agency_id, p_opportunity_id, p_contact_id,
      v_title, v_due, 'call',
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

CREATE OR REPLACE FUNCTION public.claim_invitation_resend(p_membership_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role    TEXT := current_user_role();
  v_agency  UUID := current_agency_id();
  v_target  agency_memberships%ROWTYPE;
  v_sent_at TIMESTAMPTZ;
BEGIN
  IF v_agency IS NULL OR COALESCE(v_role, '') NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'errors.forbidden';
  END IF;

  SELECT * INTO v_target
  FROM agency_memberships
  WHERE id = p_membership_id AND agency_id = v_agency
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'errors.not_found';
  END IF;
  IF v_target.status <> 'invited' THEN
    RAISE EXCEPTION 'errors.members.only_pending_resend';
  END IF;
  IF v_role = 'manager' AND v_target.role <> 'broker' THEN
    RAISE EXCEPTION 'errors.forbidden';
  END IF;

  UPDATE agency_memberships
  SET invitation_sent_at = now()
  WHERE id = p_membership_id
    AND status = 'invited'
    AND (invitation_sent_at IS NULL OR invitation_sent_at < now() - interval '5 minutes')
  RETURNING invitation_sent_at INTO v_sent_at;

  IF v_sent_at IS NULL THEN
    -- DETAIL carries when it can be sent again, for the toast.
    RAISE EXCEPTION 'errors.members.resend_too_soon'
      USING DETAIL = (v_target.invitation_sent_at + interval '5 minutes')::text;
  END IF;

  RETURN jsonb_build_object('email', v_target.invitation_email);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_invitation_resend(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.claim_invitation_resend(UUID) TO authenticated;
