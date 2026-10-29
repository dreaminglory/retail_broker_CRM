-- 20261102000002_config_role_policies.sql
-- Sprint 6, slice 6.0 (AD-045): creating and editing stages and lead sources,
-- and recording a contact merge, are owner/manager only. Reads stay agency-wide
-- (AD-001). DELETE on stages and lead_sources was already owner/manager only.

-- stages
DROP POLICY IF EXISTS "tenant_insert" ON stages;
DROP POLICY IF EXISTS "tenant_update" ON stages;

CREATE POLICY "tenant_insert" ON stages
  FOR INSERT WITH CHECK (
    agency_id = current_agency_id()
    AND current_user_role() IN ('owner', 'manager')
  );

CREATE POLICY "tenant_update" ON stages
  FOR UPDATE USING (
    agency_id = current_agency_id()
    AND current_user_role() IN ('owner', 'manager')
  )
  WITH CHECK (
    agency_id = current_agency_id()
    AND current_user_role() IN ('owner', 'manager')
  );

-- lead_sources
DROP POLICY IF EXISTS "tenant_insert" ON lead_sources;
DROP POLICY IF EXISTS "tenant_update" ON lead_sources;

CREATE POLICY "tenant_insert" ON lead_sources
  FOR INSERT WITH CHECK (
    agency_id = current_agency_id()
    AND current_user_role() IN ('owner', 'manager')
  );

CREATE POLICY "tenant_update" ON lead_sources
  FOR UPDATE USING (
    agency_id = current_agency_id()
    AND current_user_role() IN ('owner', 'manager')
  )
  WITH CHECK (
    agency_id = current_agency_id()
    AND current_user_role() IN ('owner', 'manager')
  );

-- merge_history
DROP POLICY IF EXISTS "Agency users can insert merge history" ON merge_history;

CREATE POLICY "Owners and managers can insert merge history" ON merge_history
  FOR INSERT TO authenticated
  WITH CHECK (
    agency_id = current_agency_id()
    AND current_user_role() IN ('owner', 'manager')
  );
