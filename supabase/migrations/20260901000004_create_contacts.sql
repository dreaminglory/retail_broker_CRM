-- ============================================================
-- Migration: Create contacts table
-- Durable person or organization — core CRM entity.
-- Sprint 1 — AD-008: Person + Organization types.
-- ============================================================

CREATE TABLE contacts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

  -- AD-008: both person and organization supported from Sprint 1
  type          TEXT        NOT NULL CHECK (type IN ('person', 'organization')),

  -- Person fields (required when type = 'person')
  first_name    TEXT,
  last_name     TEXT,

  -- Organization field (required when type = 'organization'; optional affiliation for persons)
  company_name  TEXT,

  -- Generated display name:
  --   person: first_name || ' ' || last_name (or whichever is set)
  --   organization: company_name
  -- Maintained by the application layer on create/update.
  -- See contacts service: generateDisplayName()
  display_name  TEXT        NOT NULL,

  notes         TEXT,
  status        TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),

  created_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Enforce: person must have at least a first or last name
  CONSTRAINT person_requires_name CHECK (
    type <> 'person' OR (first_name IS NOT NULL OR last_name IS NOT NULL)
  ),
  -- Enforce: organization must have a company name
  CONSTRAINT organization_requires_company CHECK (
    type <> 'organization' OR company_name IS NOT NULL
  )
);

-- Indexes for primary access patterns (search, filter, sort)
CREATE INDEX idx_contacts_agency_id           ON contacts(agency_id);
CREATE INDEX idx_contacts_agency_status       ON contacts(agency_id, status);
CREATE INDEX idx_contacts_agency_display_name ON contacts(agency_id, display_name);
CREATE INDEX idx_contacts_agency_type         ON contacts(agency_id, type);
CREATE INDEX idx_contacts_created_by          ON contacts(created_by);

-- ── RLS ─────────────────────────────────────────────────────
-- Standard agency-scoped template (see P-001, AD-004)
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON contacts
  FOR SELECT USING (agency_id = current_agency_id());

CREATE POLICY "tenant_insert" ON contacts
  FOR INSERT WITH CHECK (agency_id = current_agency_id());

CREATE POLICY "tenant_update" ON contacts
  FOR UPDATE USING  (agency_id = current_agency_id())
  WITH CHECK        (agency_id = current_agency_id());

-- Only owners/managers can delete contacts (soft-delete via status preferred)
CREATE POLICY "tenant_delete" ON contacts
  FOR DELETE USING (
    agency_id = current_agency_id()
    AND current_user_role() IN ('owner', 'manager')
  );

-- ── updated_at trigger ───────────────────────────────────────
CREATE TRIGGER set_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
