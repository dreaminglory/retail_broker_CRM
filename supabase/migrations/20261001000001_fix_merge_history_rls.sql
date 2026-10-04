-- ============================================================
-- Migration: Fix merge_history RLS — add FORCE ROW LEVEL SECURITY
-- Sprint 3 — Slice 3.0
--
-- The original migration (20260924000003) only had ENABLE ROW
-- LEVEL SECURITY. Per P-001 and G-002, every tenant-scoped table
-- must also have FORCE ROW LEVEL SECURITY so that policies apply
-- even when queries run as the table owner.
-- ============================================================

ALTER TABLE merge_history FORCE ROW LEVEL SECURITY;
