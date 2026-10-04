-- ============================================================
-- Migration: Create agencies table
-- The root tenant entity. Every tenant-owned record references this.
-- ============================================================

CREATE TABLE agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for slug lookups
CREATE INDEX idx_agencies_slug ON agencies(slug);

-- RLS: access controlled via agency_memberships
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agencies FORCE ROW LEVEL SECURITY;

-- Allow insert during signup (user creates their agency)
CREATE POLICY "authenticated_can_create_agency" ON agencies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- (Policies referencing agency_memberships have been moved to the end of 02_create_agency_memberships.sql)

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_agencies_updated_at
  BEFORE UPDATE ON agencies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
