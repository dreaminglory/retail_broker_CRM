-- ============================================================
-- Migration: Create opportunity_participants table
-- Contact or user participation in an opportunity with a role.
-- Sprint 1 — FR-OPP-02, FR-OPP-08.
-- ============================================================

CREATE TABLE opportunity_participants (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owning opportunity
  opportunity_id  UUID        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,

  -- Denormalized agency_id for efficient RLS (avoids JOIN in policy)
  agency_id       UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

  -- A participant is EITHER a contact OR an internal user — not both.
  -- contact_id: external party (buyer, seller, landlord, tenant, etc.)
  -- user_id:    internal broker/team member playing a secondary role
  contact_id      UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Role of this participant in the opportunity
  role            TEXT        NOT NULL CHECK (role IN (
                    'buyer', 'seller', 'landlord', 'tenant',
                    'co_owner', 'representative', 'broker', 'other'
                  )),

  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- At least one of contact_id or user_id must be set
  CONSTRAINT participant_has_entity CHECK (
    contact_id IS NOT NULL OR user_id IS NOT NULL
  ),

  -- A contact can appear at most once per opportunity
  CONSTRAINT uq_opportunity_contact UNIQUE (opportunity_id, contact_id),

  -- A user can appear at most once per opportunity
  CONSTRAINT uq_opportunity_user UNIQUE (opportunity_id, user_id)
);

-- Indexes for primary access patterns
CREATE INDEX idx_opp_participants_opportunity_id ON opportunity_participants(opportunity_id);
CREATE INDEX idx_opp_participants_agency_id      ON opportunity_participants(agency_id);
CREATE INDEX idx_opp_participants_contact_id     ON opportunity_participants(contact_id);
CREATE INDEX idx_opp_participants_user_id        ON opportunity_participants(user_id);

-- ── RLS ─────────────────────────────────────────────────────
-- Standard agency-scoped template (see P-001, AD-004)
ALTER TABLE opportunity_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_participants FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON opportunity_participants
  FOR SELECT USING (agency_id = current_agency_id());

CREATE POLICY "tenant_insert" ON opportunity_participants
  FOR INSERT WITH CHECK (agency_id = current_agency_id());

CREATE POLICY "tenant_update" ON opportunity_participants
  FOR UPDATE USING  (agency_id = current_agency_id())
  WITH CHECK        (agency_id = current_agency_id());

CREATE POLICY "tenant_delete" ON opportunity_participants
  FOR DELETE USING (agency_id = current_agency_id());
