-- ============================================================
-- Migration: seed_agency_defaults function + signup trigger
-- Creates default lead sources and pipeline stages for every
-- new agency. Called after agency creation during signup.
-- Sprint 1 — AD-006, AD-007
-- ============================================================

-- ── seed_agency_defaults() ───────────────────────────────────
-- Inserts default lead sources and stages for a given agency.
-- Called explicitly from the signup Server Action after the
-- agency row is created.
CREATE OR REPLACE FUNCTION seed_agency_defaults(p_agency_id UUID)
RETURNS VOID AS $$
BEGIN
  -- ── Default Lead Sources (AD-007, FR-SRC-02) ──────────────
  INSERT INTO lead_sources (agency_id, name, channel, sort_order) VALUES
    (p_agency_id, 'Imot.bg',         'portal',   1),
    (p_agency_id, 'OLX',             'portal',   2),
    (p_agency_id, 'Agency Website',  'website',  3),
    (p_agency_id, 'Phone Call',      'phone',    4),
    (p_agency_id, 'Walk-in',         'walk_in',  5),
    (p_agency_id, 'Referral',        'referral', 6),
    (p_agency_id, 'Social Media',    'social',   7),
    (p_agency_id, 'Email',           'email',    8),
    (p_agency_id, 'Other',           'other',    9);

  -- ── Default Pipeline Stages (AD-006, FR-OPP-03) ──────────
  -- Stage order mirrors the CRM domain model stage lifecycle:
  -- New → Attempting Contact → Qualified → Active → Viewing →
  -- Offer → Negotiation → Won (terminal) / Lost (terminal)
  -- Plus Nurture (terminal) as a holding state.
  INSERT INTO stages (agency_id, name, sort_order, is_terminal, terminal_type) VALUES
    (p_agency_id, 'New',                 1,  false, NULL),
    (p_agency_id, 'Attempting Contact',  2,  false, NULL),
    (p_agency_id, 'Qualified',           3,  false, NULL),
    (p_agency_id, 'Active',              4,  false, NULL),
    (p_agency_id, 'Viewing',             5,  false, NULL),
    (p_agency_id, 'Offer',               6,  false, NULL),
    (p_agency_id, 'Negotiation',         7,  false, NULL),
    (p_agency_id, 'Won',                 8,  true,  'won'),
    (p_agency_id, 'Lost',                9,  true,  'lost'),
    (p_agency_id, 'Nurture',             10, true,  'nurture');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute to authenticated users so the signup Server Action
-- (running with the user's JWT / anon key) can call this function.
GRANT EXECUTE ON FUNCTION seed_agency_defaults(UUID) TO authenticated;
