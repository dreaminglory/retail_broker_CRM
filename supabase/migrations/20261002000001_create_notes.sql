-- ============================================================
-- Migration: Create Notes table
-- Sprint 3 — Slice 3.1
-- ============================================================

-- 1. Create table
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT notes_parent_check CHECK (contact_id IS NOT NULL OR opportunity_id IS NOT NULL),
  CONSTRAINT notes_content_check CHECK (char_length(trim(content)) > 0)
);

-- 2. Indexes
CREATE INDEX idx_notes_contact ON notes(agency_id, contact_id, created_at DESC);
CREATE INDEX idx_notes_opportunity ON notes(agency_id, opportunity_id, created_at DESC);

-- 3. RLS Policies
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON notes
  FOR SELECT USING (agency_id = current_agency_id());

CREATE POLICY "tenant_insert" ON notes
  FOR INSERT WITH CHECK (agency_id = current_agency_id());

CREATE POLICY "tenant_update" ON notes
  FOR UPDATE USING (agency_id = current_agency_id());

CREATE POLICY "tenant_delete" ON notes
  FOR DELETE USING (agency_id = current_agency_id());

-- 4. Triggers
CREATE TRIGGER set_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Data Migration (contacts.notes -> notes)
INSERT INTO notes (agency_id, contact_id, content, created_by, created_at, updated_at)
SELECT 
  agency_id,
  id AS contact_id,
  notes AS content,
  created_by,
  created_at,
  updated_at
FROM contacts
WHERE notes IS NOT NULL AND trim(notes) != '';

-- 6. Data Migration (opportunities.notes -> notes)
INSERT INTO notes (agency_id, opportunity_id, content, created_by, created_at, updated_at)
SELECT 
  agency_id,
  id AS opportunity_id,
  notes AS content,
  created_by,
  created_at,
  updated_at
FROM opportunities
WHERE notes IS NOT NULL AND trim(notes) != '';
