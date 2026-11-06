-- 20261107000002_invitation_resend.sql
-- AD-061: resend a pending invitation. invitation_sent_at records the last send. Memberships are
-- owner-only for UPDATE (RLS) while managers resend broker invitations, so the claim is a
-- SECURITY DEFINER function that checks agency and role itself. The service sends the email only
-- after a successful claim, so two clicks can't both send.

ALTER TABLE agency_memberships ADD COLUMN invitation_sent_at TIMESTAMPTZ;

UPDATE agency_memberships
SET invitation_sent_at = invited_at
WHERE status = 'invited';

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

  RETURN jsonb_build_object(
    'email', v_target.invitation_email,
    'role', v_target.role,
    'user_id', v_target.user_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_invitation_resend(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.claim_invitation_resend(UUID) TO authenticated;
