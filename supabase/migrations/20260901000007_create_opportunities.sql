-- ============================================================
-- Migration: Create opportunities table
-- Commercial pursuit — the core CRM business entity.
-- Sprint 1 — AD-009: All four types (buyer/seller/landlord/tenant).
-- ============================================================

CREATE TABLE opportunities (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id           UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

  -- Basic metadata
  title               TEXT        NOT NULL,

  -- AD-009: all four opportunity types from Sprint 1
  type                TEXT        NOT NULL
                                  CHECK (type IN ('buyer', 'seller', 'landlord', 'tenant')),

  -- Pipeline position
  stage_id            UUID        NOT NULL REFERENCES stages(id) ON DELETE RESTRICT,

  -- Source attribution
  source_id           UUID        REFERENCES lead_sources(id) ON DELETE SET NULL,

  -- Origin traceability — immutable once set (inquiry that spawned this opportunity)
  inquiry_id          UUID        REFERENCES inquiries(id) ON DELETE SET NULL,

  -- Primary contact for this opportunity
  primary_contact_id  UUID        REFERENCES contacts(id) ON DELETE SET NULL,

  -- Owning broker
  assigned_to         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Lifecycle
  status              TEXT        NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active', 'won', 'lost', 'nurture', 'archived')),

  -- Temperature indicator (FR-OPP-10)
  temperature         TEXT        DEFAULT 'warm'
                                  CHECK (temperature IN ('hot', 'warm', 'cold')),

  -- Deal value (optional)
  expected_value      NUMERIC,
  currency            TEXT        NOT NULL DEFAULT 'BGN',

  -- Free-form notes
  notes               TEXT,

  -- Denormalized next action timestamp (AD-005, FR-TSK-07)
  -- Updated whenever a task is created or completed on this opportunity.
  -- NULL means no pending task is scheduled (→ "at risk" flag in Today Screen).
  next_action_at      TIMESTAMPTZ,

  -- Closure metadata
  closed_at           TIMESTAMPTZ,
  lost_reason         TEXT,

  -- Audit fields
  created_by          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for primary access patterns (FR-OPP-11: multi-filter support)
CREATE INDEX idx_opportunities_agency_id             ON opportunities(agency_id);
CREATE INDEX idx_opportunities_agency_status         ON opportunities(agency_id, status);
CREATE INDEX idx_opportunities_agency_assigned_to    ON opportunities(agency_id, assigned_to);
CREATE INDEX idx_opportunities_stage_id              ON opportunities(stage_id);
CREATE INDEX idx_opportunities_primary_contact_id    ON opportunities(primary_contact_id);
CREATE INDEX idx_opportunities_agency_next_action_at ON opportunities(agency_id, next_action_at);
CREATE INDEX idx_opportunities_inquiry_id            ON opportunities(inquiry_id);

-- ── RLS ─────────────────────────────────────────────────────
-- Standard agency-scoped template (see P-001, AD-004)
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON opportunities
  FOR SELECT USING (agency_id = current_agency_id());

CREATE POLICY "tenant_insert" ON opportunities
  FOR INSERT WITH CHECK (agency_id = current_agency_id());

CREATE POLICY "tenant_update" ON opportunities
  FOR UPDATE USING  (agency_id = current_agency_id())
  WITH CHECK        (agency_id = current_agency_id());

-- Only owners/managers can delete opportunities
CREATE POLICY "tenant_delete" ON opportunities
  FOR DELETE USING (
    agency_id = current_agency_id()
    AND current_user_role() IN ('owner', 'manager')
  );

-- ── updated_at trigger ───────────────────────────────────────
CREATE TRIGGER set_opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── Back-patch inquiries.opportunity_id FK ───────────────────
-- We deferred this FK in the inquiries migration because opportunities
-- didn't exist yet. Now we add it as an ALTER TABLE.
ALTER TABLE inquiries
  ADD CONSTRAINT fk_inquiries_opportunity_id
    FOREIGN KEY (opportunity_id)
    REFERENCES opportunities(id)
    ON DELETE SET NULL;
