-- ============================================================
-- Migration: Create stages table
-- Pipeline steps — seeded with defaults, configurable in Sprint 2.
-- Sprint 1 — AD-006: Pipeline configurability deferred to Sprint 2.
-- No pipelines table in Sprint 1: single default pipeline per agency.
-- Sprint 2 will add a pipelines table and pipeline_id FK on stages.
-- ============================================================

CREATE TABLE stages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  sort_order    INT         NOT NULL,
  is_terminal   BOOLEAN     NOT NULL DEFAULT false,
  -- terminal_type is NULL for non-terminal stages; required when is_terminal = true
  terminal_type TEXT        CHECK (terminal_type IN ('won', 'lost', 'nurture')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Enforce: if is_terminal then terminal_type must be set, and vice-versa
  CONSTRAINT terminal_type_consistency CHECK (
    (is_terminal = false AND terminal_type IS NULL) OR
    (is_terminal = true  AND terminal_type IS NOT NULL)
  )
);

-- Indexes for primary access patterns
CREATE INDEX idx_stages_agency_id    ON stages(agency_id);
CREATE INDEX idx_stages_agency_sort  ON stages(agency_id, sort_order);

-- ── RLS ─────────────────────────────────────────────────────
-- Standard agency-scoped template (see P-001, AD-004)
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON stages
  FOR SELECT USING (agency_id = current_agency_id());

CREATE POLICY "tenant_insert" ON stages
  FOR INSERT WITH CHECK (agency_id = current_agency_id());

CREATE POLICY "tenant_update" ON stages
  FOR UPDATE USING  (agency_id = current_agency_id())
  WITH CHECK        (agency_id = current_agency_id());

-- Only owners/managers can delete stages
CREATE POLICY "tenant_delete" ON stages
  FOR DELETE USING (
    agency_id = current_agency_id()
    AND current_user_role() IN ('owner', 'manager')
  );

-- ── updated_at trigger ───────────────────────────────────────
CREATE TRIGGER set_stages_updated_at
  BEFORE UPDATE ON stages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
