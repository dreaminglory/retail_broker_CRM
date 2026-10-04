-- ============================================================
-- Migration: Create contact_methods table
-- Phones, emails, and other identifiers linked to a contact.
-- Sprint 1 — AD-011: Unique constraint provides basic duplicate
-- protection (full duplicate detection deferred to Sprint 2).
-- ============================================================

CREATE TABLE contact_methods (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- FK to the owning contact (cascade delete — contact methods die with the contact)
  contact_id  UUID        NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  -- Denormalized agency_id for efficient RLS filtering (avoids JOIN in policy)
  agency_id   UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

  -- Type of contact method
  type        TEXT        NOT NULL CHECK (type IN ('phone', 'email', 'viber', 'whatsapp', 'other')),

  -- The actual value: phone number, email address, username, etc.
  -- AD-010: phone stored as free text — no E.164 enforcement in Sprint 1
  value       TEXT        NOT NULL,

  -- Optional human label (e.g., "home", "work", "mobile", "main")
  label       TEXT,

  -- At most one method per contact should be marked primary per type
  is_primary  BOOLEAN     NOT NULL DEFAULT false,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- AD-011: Unique constraint on (agency_id, type, value) prevents exact duplicates
  -- within the same agency across all contacts.
  CONSTRAINT uq_contact_method_per_agency UNIQUE (agency_id, type, value)
);

-- Indexes for primary access patterns
CREATE INDEX idx_contact_methods_contact_id  ON contact_methods(contact_id);
CREATE INDEX idx_contact_methods_agency_id   ON contact_methods(agency_id);
CREATE INDEX idx_contact_methods_type_value  ON contact_methods(agency_id, type, value);

-- ── RLS ─────────────────────────────────────────────────────
-- Standard agency-scoped template (see P-001, AD-004)
ALTER TABLE contact_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_methods FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON contact_methods
  FOR SELECT USING (agency_id = current_agency_id());

CREATE POLICY "tenant_insert" ON contact_methods
  FOR INSERT WITH CHECK (agency_id = current_agency_id());

CREATE POLICY "tenant_update" ON contact_methods
  FOR UPDATE USING  (agency_id = current_agency_id())
  WITH CHECK        (agency_id = current_agency_id());

CREATE POLICY "tenant_delete" ON contact_methods
  FOR DELETE USING (agency_id = current_agency_id());
