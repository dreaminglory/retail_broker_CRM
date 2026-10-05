-- 1. Single active agency per user (makes current_agency_id() deterministic — F-10)
CREATE UNIQUE INDEX uq_one_active_membership_per_user
  ON agency_memberships(user_id) WHERE status = 'active';

-- 2. Atomic, server-side agency provisioning (replaces client-side 3-step signup, L-005)
CREATE OR REPLACE FUNCTION public.create_agency_with_owner(
  p_agency_name text, p_locale text DEFAULT 'bg'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    uuid := (SELECT auth.uid());
  v_agency uuid;
  v_base   text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF EXISTS (SELECT 1 FROM agency_memberships WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'already_member' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(trim(p_agency_name)) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'invalid_agency_name' USING ERRCODE = '22023';
  END IF;
  -- Cyrillic names strip to '' → fall back to 'agency'
  v_base := coalesce(nullif(trim(both '-' from regexp_replace(lower(p_agency_name), '[^a-z0-9]+', '-', 'g')), ''), 'agency');
  INSERT INTO agencies (name, slug)
    VALUES (trim(p_agency_name), v_base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
    RETURNING id INTO v_agency;
  INSERT INTO agency_memberships (user_id, agency_id, role, status, joined_at)
    VALUES (v_uid, v_agency, 'owner', 'active', now());
  PERFORM seed_agency_defaults(v_agency);
  RETURN v_agency;
END $$;

-- 3. Invitation acceptance without the service-role client (F-09)
CREATE OR REPLACE FUNCTION public.accept_pending_invitations()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := (SELECT auth.uid()); v_count integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF EXISTS (SELECT 1 FROM agency_memberships WHERE user_id = v_uid AND status = 'active') THEN
    RAISE EXCEPTION 'multi_agency_unsupported' USING ERRCODE = 'P0001';
  END IF;
  -- Activate the most recent invitation only (single-agency rule)
  UPDATE agency_memberships SET status = 'active', joined_at = now()
   WHERE id = (SELECT id FROM agency_memberships
                WHERE user_id = v_uid AND status = 'invited'
                ORDER BY invited_at DESC LIMIT 1);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- 4. Remove the takeover vectors (F-01, F-05)
DROP POLICY IF EXISTS "authenticated_can_create_own_membership" ON agency_memberships;
DROP POLICY IF EXISTS "owners_managers_can_invite"              ON agency_memberships;
DROP POLICY IF EXISTS "authenticated_can_create_agency"         ON agencies;

CREATE POLICY "invite_insert" ON agency_memberships FOR INSERT WITH CHECK (
  agency_id = current_agency_id()
  AND status = 'invited'
  AND (current_user_role() = 'owner'
       OR (current_user_role() = 'manager' AND role = 'broker'))
);
CREATE POLICY "invite_delete_pending" ON agency_memberships FOR DELETE USING (
  agency_id = current_agency_id() AND status = 'invited'
  AND current_user_role() IN ('owner', 'manager')
);
DROP POLICY IF EXISTS "owners_can_update_memberships" ON agency_memberships;
CREATE POLICY "owners_can_update_memberships" ON agency_memberships FOR UPDATE
  USING      (agency_id = current_agency_id() AND current_user_role() = 'owner')
  WITH CHECK (agency_id = current_agency_id() AND current_user_role() = 'owner');

-- 5. Membership identity is immutable (owner cannot re-point user_id/agency_id)
CREATE OR REPLACE FUNCTION prevent_membership_identity_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.user_id <> OLD.user_id OR NEW.agency_id <> OLD.agency_id THEN
    RAISE EXCEPTION 'membership_identity_immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_membership_identity BEFORE UPDATE ON agency_memberships
  FOR EACH ROW EXECUTE FUNCTION prevent_membership_identity_change();
