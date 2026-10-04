-- ============================================================
-- Migration: Enhance tasks for Sprint 2
-- AD-013: Add task_type column for categorizing tasks
-- Adds optimized composite index for Today Screen queries.
-- ============================================================

-- ── task_type column ────────────────────────────────────────
-- Categorizes tasks for UI display and filtering.
-- Uses a CHECK constraint rather than a separate table — the
-- set is small and fixed (AD-013).
ALTER TABLE tasks
  ADD COLUMN task_type TEXT
  CHECK (task_type IN ('call', 'follow_up', 'viewing', 'meeting', 'email', 'other'));

-- Default existing rows to NULL (untyped) — no backfill needed.

-- ── Optimized composite index for Today Screen ──────────────
-- The Today Screen queries filter by (agency_id, assigned_to, status)
-- and then sort by due_at. This composite index covers all those
-- predicates in a single B-tree scan.
CREATE INDEX IF NOT EXISTS idx_tasks_today_screen
  ON tasks(agency_id, assigned_to, status, due_at)
  WHERE status = 'pending';

-- ── Index for at-risk opportunity detection ─────────────────
-- Partial index: only pending tasks, covering opportunity_id.
-- Used by "find active opportunities with no pending task" query.
CREATE INDEX IF NOT EXISTS idx_tasks_pending_by_opportunity
  ON tasks(opportunity_id)
  WHERE status = 'pending';
