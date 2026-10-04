-- ============================================================
-- Migration: Create inquiries table
-- Original inbound lead event — immutable source record.
-- Sprint 1 — FR-INQ: Inquiry management requirements.
-- ============================================================

CREATE TABLE inquiries (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id           UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

  -- Source attribution
  source_id           UUID        REFERENCES lead_sources(id) ON DELETE SET NULL,
  source_description  TEXT,   -- free-text for additional source detail

  -- Linkage (populated after matching/conversion — NULL until then)
  contact_id          UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  opportunity_id      UUID,       -- FK added after opportunities table is created (see below)

  -- Assignment
  assigned_to         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Lifecycle status
  status              TEXT        NOT NULL DEFAULT 'new'
                                  CHECK (status IN ('new', 'contacted', 'converted', 'dismissed')),

  -- Caller / lead data captured at intake
  caller_name         TEXT,
  caller_phone        TEXT,
  caller_email        TEXT,
  subject             TEXT,
  description         TEXT,

  -- Original source data preservation (portal payloads, webhooks, etc.)
  raw_payload         JSONB       NOT NULL DEFAULT '{}',

  -- External reference (portal listing ID, ad ID, etc.)
  external_ref        TEXT,

  -- Dismissal metadata
  dismissed_reason    TEXT,

  -- Timestamps
  received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for primary access patterns
CREATE INDEX idx_inquiries_agency_id          ON inquiries(agency_id);
CREATE INDEX idx_inquiries_agency_status      ON inquiries(agency_id, status);
CREATE INDEX idx_inquiries_agency_received_at ON inquiries(agency_id, received_at DESC);
CREATE INDEX idx_inquiries_contact_id         ON inquiries(contact_id);
CREATE INDEX idx_inquiries_opportunity_id     ON inquiries(opportunity_id);
CREATE INDEX idx_inquiries_assigned_to        ON inquiries(assigned_to);

-- ── RLS ─────────────────────────────────────────────────────
-- Standard agency-scoped template (see P-001, AD-004)
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON inquiries
  FOR SELECT USING (agency_id = current_agency_id());

CREATE POLICY "tenant_insert" ON inquiries
  FOR INSERT WITH CHECK (agency_id = current_agency_id());

CREATE POLICY "tenant_update" ON inquiries
  FOR UPDATE USING  (agency_id = current_agency_id())
  WITH CHECK        (agency_id = current_agency_id());

-- Only owners/managers can delete inquiries
-- (Inquiries should be dismissed, not deleted — per domain rules)
CREATE POLICY "tenant_delete" ON inquiries
  FOR DELETE USING (
    agency_id = current_agency_id()
    AND current_user_role() IN ('owner', 'manager')
  );

-- ── updated_at trigger ───────────────────────────────────────
CREATE TRIGGER set_inquiries_updated_at
  BEFORE UPDATE ON inquiries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
