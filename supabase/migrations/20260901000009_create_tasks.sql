-- ============================================================
-- Migration: Create tasks table
-- Minimal follow-up actions linked to opportunities.
-- Sprint 1 — AD-005: Minimal tasks pulled into Sprint 1.
-- Full task workflows (completion rules, Today Screen, action
-- plan templates) remain Sprint 2 scope.
-- ============================================================

CREATE TABLE tasks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

  -- Context links
  opportunity_id  UUID        REFERENCES opportunities(id) ON DELETE CASCADE,
  contact_id      UUID        REFERENCES contacts(id) ON DELETE SET NULL,

  -- Task content
  title           TEXT        NOT NULL,
  description     TEXT,

  -- Scheduling
  due_at          TIMESTAMPTZ,

  -- Lifecycle
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'completed', 'cancelled')),

  -- Completion data
  outcome         TEXT,       -- notes on what happened (required in Sprint 2 workflows)
  completed_at    TIMESTAMPTZ,

  -- Owner
  assigned_to     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Audit
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for primary access patterns
-- Today Screen queries (Sprint 2) rely on (agency_id, assigned_to, status) and (agency_id, due_at)
CREATE INDEX idx_tasks_agency_id               ON tasks(agency_id);
CREATE INDEX idx_tasks_agency_status           ON tasks(agency_id, status);
CREATE INDEX idx_tasks_agency_assigned_status  ON tasks(agency_id, assigned_to, status);
CREATE INDEX idx_tasks_opportunity_status      ON tasks(opportunity_id, status);
CREATE INDEX idx_tasks_agency_due_at           ON tasks(agency_id, due_at);
CREATE INDEX idx_tasks_contact_id              ON tasks(contact_id);

-- ── RLS ─────────────────────────────────────────────────────
-- Standard agency-scoped template (see P-001, AD-004)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON tasks
  FOR SELECT USING (agency_id = current_agency_id());

CREATE POLICY "tenant_insert" ON tasks
  FOR INSERT WITH CHECK (agency_id = current_agency_id());

CREATE POLICY "tenant_update" ON tasks
  FOR UPDATE USING  (agency_id = current_agency_id())
  WITH CHECK        (agency_id = current_agency_id());

CREATE POLICY "tenant_delete" ON tasks
  FOR DELETE USING (
    agency_id = current_agency_id()
    AND current_user_role() IN ('owner', 'manager')
  );

-- ── updated_at trigger ───────────────────────────────────────
CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── next_action_at sync function ────────────────────────────
-- FR-TSK-07: When a task is created, completed, or cancelled on
-- an opportunity, update opportunities.next_action_at with the
-- earliest pending task's due_at for that opportunity.
-- This runs as a trigger after INSERT/UPDATE/DELETE on tasks.
CREATE OR REPLACE FUNCTION sync_opportunity_next_action()
RETURNS TRIGGER AS $$
DECLARE
  v_opportunity_id UUID;
BEGIN
  -- Determine which opportunity to update
  IF TG_OP = 'DELETE' THEN
    v_opportunity_id := OLD.opportunity_id;
  ELSE
    v_opportunity_id := NEW.opportunity_id;
  END IF;

  -- Nothing to update if no opportunity is linked
  IF v_opportunity_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Update the denormalized field with the nearest pending due date
  UPDATE opportunities
  SET next_action_at = (
    SELECT MIN(due_at)
    FROM tasks
    WHERE opportunity_id = v_opportunity_id
      AND status = 'pending'
      AND due_at IS NOT NULL
  )
  WHERE id = v_opportunity_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER sync_next_action_on_task_change
  AFTER INSERT OR UPDATE OF status, due_at OR DELETE
  ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION sync_opportunity_next_action();
