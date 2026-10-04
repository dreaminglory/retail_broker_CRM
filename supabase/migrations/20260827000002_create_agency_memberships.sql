-- ============================================================
-- Migration: Create agency_memberships table
-- Links users to agencies with roles. This is the authorization backbone.
-- ============================================================

CREATE TABLE agency_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'broker')) DEFAULT 'broker',
  status TEXT NOT NULL CHECK (status IN ('active', 'invited', 'deactivated')) DEFAULT 'invited',
  invited_at TIMESTAMPTZ DEFAULT now(),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, agency_id)
);

-- Indexes for common lookups
CREATE INDEX idx_memberships_user_id ON agency_memberships(user_id);
CREATE INDEX idx_memberships_agency_id ON agency_memberships(agency_id);
CREATE INDEX idx_memberships_user_status ON agency_memberships(user_id, status);

-- RLS
ALTER TABLE agency_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_memberships FORCE ROW LEVEL SECURITY;

-- Users can see their own memberships
CREATE POLICY "users_see_own_memberships" ON agency_memberships
  FOR SELECT USING (user_id = (SELECT auth.uid()));

-- Users can see colleagues in their active agencies
CREATE POLICY "members_see_agency_colleagues" ON agency_memberships
  FOR SELECT USING (
    agency_id IN (
      SELECT agency_id FROM agency_memberships
      WHERE user_id = (SELECT auth.uid())
        AND status = 'active'
    )
  );

-- Allow insert during signup (user creates their own membership)
CREATE POLICY "authenticated_can_create_own_membership" ON agency_memberships
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = (SELECT auth.uid())
  );

-- Owners/managers can invite (insert memberships for others)
CREATE POLICY "owners_managers_can_invite" ON agency_memberships
  FOR INSERT WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM agency_memberships
      WHERE user_id = (SELECT auth.uid())
        AND status = 'active'
        AND role IN ('owner', 'manager')
    )
  );

-- Owners can update memberships (role changes, deactivation)
CREATE POLICY "owners_can_update_memberships" ON agency_memberships
  FOR UPDATE USING (
    agency_id IN (
      SELECT agency_id FROM agency_memberships
      WHERE user_id = (SELECT auth.uid())
        AND status = 'active'
        AND role = 'owner'
    )
  );

-- Updated_at trigger
CREATE TRIGGER set_memberships_updated_at
  BEFORE UPDATE ON agency_memberships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Policies for agencies (Moved here because they reference agency_memberships)
-- ============================================================

-- Members can view their own agency
CREATE POLICY "members_can_view_own_agency" ON agencies
  FOR SELECT USING (
    id IN (
      SELECT agency_id FROM agency_memberships
      WHERE user_id = (SELECT auth.uid())
        AND status = 'active'
    )
  );

-- Only owners can update agency settings
CREATE POLICY "owners_can_update_agency" ON agencies
  FOR UPDATE USING (
    id IN (
      SELECT agency_id FROM agency_memberships
      WHERE user_id = (SELECT auth.uid())
        AND status = 'active'
        AND role = 'owner'
    )
  ) WITH CHECK (
    id IN (
      SELECT agency_id FROM agency_memberships
      WHERE user_id = (SELECT auth.uid())
        AND status = 'active'
        AND role = 'owner'
    )
  );
