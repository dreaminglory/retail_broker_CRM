-- ============================================================
-- Migration: Create lead_sources table
-- Configurable origin taxonomy per agency.
-- Sprint 1 — AD-007: Fully configurable from Sprint 1.
-- ============================================================

CREATE TABLE lead_sources (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  channel     TEXT        NOT NULL CHECK (channel IN (
                'portal', 'referral', 'website', 'phone',
                'social', 'email', 'walk_in', 'other'
              )),
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  sort_order  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for primary access patterns
CREATE INDEX idx_lead_sources_agency_id     ON lead_sources(agency_id);
CREATE INDEX idx_lead_sources_agency_active ON lead_sources(agency_id, is_active);
CREATE INDEX idx_lead_sources_agency_sort   ON lead_sources(agency_id, sort_order);

-- ── RLS ─────────────────────────────────────────────────────
-- Standard agency-scoped template (see P-001, AD-004)
ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_sources FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON lead_sources
  FOR SELECT USING (agency_id = current_agency_id());

CREATE POLICY "tenant_insert" ON lead_sources
  FOR INSERT WITH CHECK (agency_id = current_agency_id());

CREATE POLICY "tenant_update" ON lead_sources
  FOR UPDATE USING  (agency_id = current_agency_id())
  WITH CHECK        (agency_id = current_agency_id());

-- Only owners/managers can delete lead sources
CREATE POLICY "tenant_delete" ON lead_sources
  FOR DELETE USING (
    agency_id = current_agency_id()
    AND current_user_role() IN ('owner', 'manager')
  );

-- ── updated_at trigger ───────────────────────────────────────
CREATE TRIGGER set_lead_sources_updated_at
  BEFORE UPDATE ON lead_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
