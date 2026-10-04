-- ============================================================
-- Migration: Fix RLS Infinite Recursion
-- agency_memberships policies were querying agency_memberships directly,
-- causing infinite recursion. We fix this by using SECURITY DEFINER functions.
-- ============================================================

-- 1. Helper function for role (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
  SELECT role
  FROM agency_memberships
  WHERE user_id = (SELECT auth.uid())
    AND status = 'active'
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 2. Fix agency_memberships policies
DROP POLICY IF EXISTS "members_see_agency_colleagues" ON agency_memberships;
CREATE POLICY "members_see_agency_colleagues" ON agency_memberships
  FOR SELECT USING (
    agency_id = current_agency_id()
  );

DROP POLICY IF EXISTS "owners_managers_can_invite" ON agency_memberships;
CREATE POLICY "owners_managers_can_invite" ON agency_memberships
  FOR INSERT WITH CHECK (
    agency_id = current_agency_id()
    AND current_user_role() IN ('owner', 'manager')
  );

DROP POLICY IF EXISTS "owners_can_update_memberships" ON agency_memberships;
CREATE POLICY "owners_can_update_memberships" ON agency_memberships
  FOR UPDATE USING (
    agency_id = current_agency_id()
    AND current_user_role() = 'owner'
  );

-- 3. Fix agencies policies
DROP POLICY IF EXISTS "owners_can_update_agency" ON agencies;
CREATE POLICY "owners_can_update_agency" ON agencies
  FOR UPDATE USING (
    id = current_agency_id()
    AND current_user_role() = 'owner'
  ) WITH CHECK (
    id = current_agency_id()
    AND current_user_role() = 'owner'
  );
