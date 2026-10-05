-- ============================================================
-- Migration: Add invitation columns to agency_memberships
-- Sprint 4 — Slice 4.4
-- ============================================================

ALTER TABLE agency_memberships
ADD COLUMN invited_by UUID REFERENCES auth.users(id),
ADD COLUMN invitation_email TEXT;

CREATE INDEX idx_memberships_invitation_email 
ON agency_memberships(agency_id, invitation_email) 
WHERE status = 'invited';
