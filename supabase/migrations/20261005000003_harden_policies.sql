-- audit_log (F-02): tenant-scoped insert (keeps trigger inserts working); helper-based select
DROP POLICY IF EXISTS "authenticated_can_insert_audit_logs" ON audit_log;
DROP POLICY IF EXISTS "users_see_own_agency_audit_logs"    ON audit_log;
CREATE POLICY "tenant_insert" ON audit_log FOR INSERT WITH CHECK (agency_id = current_agency_id());
CREATE POLICY "tenant_select" ON audit_log FOR SELECT USING     (agency_id = current_agency_id());

-- agencies: replace inline subquery with helper (L-003)
DROP POLICY IF EXISTS "members_can_view_own_agency" ON agencies;
CREATE POLICY "members_can_view_own_agency" ON agencies FOR SELECT USING (id = current_agency_id());

-- profiles (F-06): self or colleagues only (revises AD-023)
CREATE OR REPLACE FUNCTION public.shares_agency_with(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM agency_memberships me
    JOIN agency_memberships them ON them.agency_id = me.agency_id
    WHERE me.user_id = (SELECT auth.uid()) AND me.status = 'active'
      AND them.user_id = p_user);
$$;

-- Since shares_agency_with is new, we need to apply privileges manually as per 000002 rules
GRANT EXECUTE ON FUNCTION shares_agency_with(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION shares_agency_with(uuid) FROM PUBLIC, anon;

DROP POLICY IF EXISTS "authenticated_can_view_profiles" ON profiles;
CREATE POLICY "profiles_select_self_or_colleague" ON profiles FOR SELECT
  USING (id = (SELECT auth.uid()) OR shares_agency_with(id));
