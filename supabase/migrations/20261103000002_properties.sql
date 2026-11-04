-- 20261103000002_properties.sql
-- spec: properties, Task 2 (AD-056, AD-057). Areas, properties, listings, property
-- parties and opportunity links, with RLS and the constraints from business rules 3–5.
-- Triggers (property code, audit, rules 5, 7 and 8) follow in 20261103000003.
--
-- Every reference between agency rows is a composite (agency_id, x_id) foreign key, so a
-- row can never point at another agency's row even with a guessed id (AD-057).

-- ── Composite keys on existing tables ────────────────────────────────────────

ALTER TABLE contacts      ADD CONSTRAINT uq_contacts_agency_id_id      UNIQUE (agency_id, id);
ALTER TABLE opportunities ADD CONSTRAINT uq_opportunities_agency_id_id UNIQUE (agency_id, id);

-- Per-agency property code counter, used by the code trigger (shown as #1042).
ALTER TABLE agencies ADD COLUMN property_code_seq INT NOT NULL DEFAULT 1000;

-- ── areas ────────────────────────────────────────────────────────────────────

CREATE TABLE areas (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id      UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  settlement_id  UUID        NOT NULL REFERENCES settlements(id) ON DELETE RESTRICT,
  name           TEXT        NOT NULL CHECK (char_length(trim(name)) > 0),
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  sort_order     INT         NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_areas_agency_id_id UNIQUE (agency_id, id),
  -- Target of properties' (agency_id, settlement_id, area_id): the area must be in the
  -- property's settlement.
  CONSTRAINT uq_areas_agency_settlement_id UNIQUE (agency_id, settlement_id, id)
);

CREATE UNIQUE INDEX uq_areas_agency_settlement_name ON areas (agency_id, settlement_id, lower(name));
CREATE INDEX idx_areas_agency_id ON areas (agency_id);

CREATE TRIGGER set_areas_updated_at
  BEFORE UPDATE ON areas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON areas
  FOR SELECT USING (agency_id = current_agency_id());

-- Configured like lead sources: owner/manager only (T6).
CREATE POLICY "tenant_insert" ON areas
  FOR INSERT WITH CHECK (
    agency_id = current_agency_id()
    AND current_user_role() IN ('owner', 'manager')
  );

CREATE POLICY "tenant_update" ON areas
  FOR UPDATE USING (
    agency_id = current_agency_id()
    AND current_user_role() IN ('owner', 'manager')
  )
  WITH CHECK (
    agency_id = current_agency_id()
    AND current_user_role() IN ('owner', 'manager')
  );

CREATE POLICY "tenant_delete" ON areas
  FOR DELETE USING (
    agency_id = current_agency_id()
    AND current_user_role() IN ('owner', 'manager')
  );

-- ── properties ───────────────────────────────────────────────────────────────

CREATE TABLE properties (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id      UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  code           INT         NOT NULL,
  type           TEXT        NOT NULL CHECK (type IN (
                   'apartment', 'studio', 'maisonette', 'house', 'house_floor', 'plot', 'garage'
                 )),
  rooms          SMALLINT    CHECK (rooms >= 1),
  area_m2        NUMERIC(10, 2) CHECK (area_m2 > 0),
  plot_m2        NUMERIC(12, 2) CHECK (plot_m2 > 0),
  floor          SMALLINT    CHECK (floor BETWEEN -5 AND 200),
  floors_total   SMALLINT    CHECK (floors_total BETWEEN 1 AND 200),
  construction   TEXT        CHECK (construction IN ('brick', 'panel', 'epk', 'timber', 'other')),
  year_built     SMALLINT    CHECK (year_built BETWEEN 1800 AND 2100),
  settlement_id  UUID        NOT NULL REFERENCES settlements(id) ON DELETE RESTRICT,
  area_id        UUID,
  address        TEXT,
  location_note  TEXT,
  assigned_to    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  description    TEXT,
  status         TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  external_ref   TEXT,
  created_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Rule 3
  CONSTRAINT properties_apartment_rooms CHECK (
    type <> 'apartment' OR (rooms IS NOT NULL AND rooms BETWEEN 1 AND 9)
  ),
  CONSTRAINT properties_plot_fields CHECK (
    type <> 'plot' OR (plot_m2 IS NOT NULL AND rooms IS NULL AND floor IS NULL)
  ),
  CONSTRAINT properties_floor_within_total CHECK (
    floor IS NULL OR floors_total IS NULL OR floor <= floors_total
  ),

  CONSTRAINT uq_properties_agency_code UNIQUE (agency_id, code),
  CONSTRAINT uq_properties_agency_id_id UNIQUE (agency_id, id),
  -- An area is optional; when set it must be the agency's and in the same settlement.
  -- Deleting a used area is refused: deactivate it instead.
  CONSTRAINT fk_properties_area FOREIGN KEY (agency_id, settlement_id, area_id)
    REFERENCES areas (agency_id, settlement_id, id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX uq_properties_agency_external_ref
  ON properties (agency_id, external_ref) WHERE external_ref IS NOT NULL;
CREATE INDEX idx_properties_agency_status     ON properties (agency_id, status);
CREATE INDEX idx_properties_agency_location   ON properties (agency_id, settlement_id, area_id);
CREATE INDEX idx_properties_agency_assigned   ON properties (agency_id, assigned_to);
CREATE INDEX idx_properties_area_id           ON properties (area_id);

CREATE TRIGGER set_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON properties
  FOR SELECT USING (agency_id = current_agency_id());

CREATE POLICY "tenant_insert" ON properties
  FOR INSERT WITH CHECK (agency_id = current_agency_id());

CREATE POLICY "tenant_update" ON properties
  FOR UPDATE USING (agency_id = current_agency_id())
  WITH CHECK (agency_id = current_agency_id());

CREATE POLICY "tenant_delete" ON properties
  FOR DELETE USING (
    agency_id = current_agency_id()
    AND current_user_role() IN ('owner', 'manager')
  );

-- ── listings ─────────────────────────────────────────────────────────────────

CREATE TABLE listings (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id    UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  property_id  UUID        NOT NULL,
  offer_type   TEXT        NOT NULL CHECK (offer_type IN ('sale', 'rent')),
  price        NUMERIC(14, 2) NOT NULL CHECK (price > 0),
  -- Rule 4, AD-037
  currency     TEXT        NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  status       TEXT        NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'reserved', 'closed', 'withdrawn')),
  listed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at    TIMESTAMPTZ,
  created_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_listings_property FOREIGN KEY (agency_id, property_id)
    REFERENCES properties (agency_id, id) ON DELETE CASCADE
);

-- At most one open listing per property and offer type.
CREATE UNIQUE INDEX uq_listings_open_per_offer_type
  ON listings (property_id, offer_type) WHERE status IN ('active', 'reserved');
CREATE INDEX idx_listings_agency_status ON listings (agency_id, status, offer_type, price);
CREATE INDEX idx_listings_property_id   ON listings (property_id);

CREATE TRIGGER set_listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON listings
  FOR SELECT USING (agency_id = current_agency_id());

CREATE POLICY "tenant_insert" ON listings
  FOR INSERT WITH CHECK (agency_id = current_agency_id());

CREATE POLICY "tenant_update" ON listings
  FOR UPDATE USING (agency_id = current_agency_id())
  WITH CHECK (agency_id = current_agency_id());

CREATE POLICY "tenant_delete" ON listings
  FOR DELETE USING (
    agency_id = current_agency_id()
    AND current_user_role() IN ('owner', 'manager')
  );

-- ── property_parties ─────────────────────────────────────────────────────────

CREATE TABLE property_parties (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id    UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  property_id  UUID        NOT NULL,
  contact_id   UUID        NOT NULL,
  role         TEXT        NOT NULL CHECK (role IN ('owner', 'co_owner', 'representative', 'occupant')),
  ended_at     TIMESTAMPTZ,
  created_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_property_parties_property FOREIGN KEY (agency_id, property_id)
    REFERENCES properties (agency_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_property_parties_contact FOREIGN KEY (agency_id, contact_id)
    REFERENCES contacts (agency_id, id) ON DELETE CASCADE
);

-- One open party row per contact and property; ended rows are the ownership history.
CREATE UNIQUE INDEX uq_property_parties_open
  ON property_parties (property_id, contact_id) WHERE ended_at IS NULL;
CREATE INDEX idx_property_parties_agency_contact ON property_parties (agency_id, contact_id);
CREATE INDEX idx_property_parties_property_id    ON property_parties (property_id);

CREATE TRIGGER set_property_parties_updated_at
  BEFORE UPDATE ON property_parties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE property_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_parties FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON property_parties
  FOR SELECT USING (agency_id = current_agency_id());

CREATE POLICY "tenant_insert" ON property_parties
  FOR INSERT WITH CHECK (agency_id = current_agency_id());

CREATE POLICY "tenant_update" ON property_parties
  FOR UPDATE USING (agency_id = current_agency_id())
  WITH CHECK (agency_id = current_agency_id());

-- Members end a party rather than delete it; a hard delete is owner/manager only.
CREATE POLICY "tenant_delete" ON property_parties
  FOR DELETE USING (
    agency_id = current_agency_id()
    AND current_user_role() IN ('owner', 'manager')
  );

-- ── opportunity_properties ───────────────────────────────────────────────────

CREATE TABLE opportunity_properties (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id        UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  opportunity_id   UUID        NOT NULL,
  property_id      UUID        NOT NULL,
  relation         TEXT        NOT NULL CHECK (relation IN ('subject', 'candidate')),
  status           TEXT        CHECK (status IN ('candidate', 'viewed', 'offered', 'rejected', 'selected')),
  rejected_reason  TEXT,
  created_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A status only on candidates; a reason only on rejected ones.
  CONSTRAINT opportunity_properties_status_by_relation CHECK ((relation = 'candidate') = (status IS NOT NULL)),
  CONSTRAINT opportunity_properties_reason_when_rejected CHECK (rejected_reason IS NULL OR status = 'rejected'),
  CONSTRAINT uq_opportunity_properties_pair UNIQUE (opportunity_id, property_id),
  CONSTRAINT fk_opportunity_properties_opportunity FOREIGN KEY (agency_id, opportunity_id)
    REFERENCES opportunities (agency_id, id) ON DELETE CASCADE,
  -- A linked property can't be deleted: archive it.
  CONSTRAINT fk_opportunity_properties_property FOREIGN KEY (agency_id, property_id)
    REFERENCES properties (agency_id, id) ON DELETE RESTRICT
);

-- Rule 5: one selected candidate and one subject per opportunity.
CREATE UNIQUE INDEX uq_opportunity_properties_one_selected
  ON opportunity_properties (opportunity_id) WHERE status = 'selected';
CREATE UNIQUE INDEX uq_opportunity_properties_one_subject
  ON opportunity_properties (opportunity_id) WHERE relation = 'subject';
CREATE INDEX idx_opportunity_properties_agency_property ON opportunity_properties (agency_id, property_id);

CREATE TRIGGER set_opportunity_properties_updated_at
  BEFORE UPDATE ON opportunity_properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE opportunity_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_properties FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON opportunity_properties
  FOR SELECT USING (agency_id = current_agency_id());

CREATE POLICY "tenant_insert" ON opportunity_properties
  FOR INSERT WITH CHECK (agency_id = current_agency_id());

CREATE POLICY "tenant_update" ON opportunity_properties
  FOR UPDATE USING (agency_id = current_agency_id())
  WITH CHECK (agency_id = current_agency_id());

-- Like participants: any member can remove a link added by mistake (the audit keeps it).
CREATE POLICY "tenant_delete" ON opportunity_properties
  FOR DELETE USING (agency_id = current_agency_id());

-- ── tasks.property_id, notes.property_id ─────────────────────────────────────

ALTER TABLE tasks ADD COLUMN property_id UUID;
ALTER TABLE tasks ADD CONSTRAINT fk_tasks_property FOREIGN KEY (agency_id, property_id)
  REFERENCES properties (agency_id, id) ON DELETE SET NULL (property_id);
CREATE INDEX idx_tasks_property_id ON tasks (property_id) WHERE property_id IS NOT NULL;

ALTER TABLE notes ADD COLUMN property_id UUID;
ALTER TABLE notes ADD CONSTRAINT fk_notes_property FOREIGN KEY (agency_id, property_id)
  REFERENCES properties (agency_id, id) ON DELETE CASCADE;
CREATE INDEX idx_notes_property ON notes (agency_id, property_id, created_at DESC)
  WHERE property_id IS NOT NULL;

-- N1 with a third parent.
ALTER TABLE notes DROP CONSTRAINT notes_parent_check;
ALTER TABLE notes ADD CONSTRAINT notes_parent_check
  CHECK (contact_id IS NOT NULL OR opportunity_id IS NOT NULL OR property_id IS NOT NULL);

-- ── merge_contacts moves property parties (C4) ───────────────────────────────
-- Body as in 20261102000009 plus the property_parties block. Grants carry over.

CREATE OR REPLACE FUNCTION public.merge_contacts(
  p_agency_id UUID,
  p_winner_id UUID,
  p_loser_id  UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_snapshot JSONB;
BEGIN
  IF COALESCE(current_user_role(), '') NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'errors.forbidden';
  END IF;
  IF p_agency_id IS DISTINCT FROM current_agency_id() THEN
    RAISE EXCEPTION 'errors.not_found';
  END IF;
  IF p_winner_id = p_loser_id THEN
    RAISE EXCEPTION 'errors.merge_self';
  END IF;

  -- In id order, so two opposite merges can't deadlock.
  PERFORM 1 FROM contacts
  WHERE id IN (p_winner_id, p_loser_id) AND agency_id = p_agency_id
  ORDER BY id
  FOR UPDATE;

  IF NOT EXISTS (SELECT 1 FROM contacts WHERE id = p_winner_id AND agency_id = p_agency_id) THEN
    RAISE EXCEPTION 'errors.not_found';
  END IF;

  SELECT (to_jsonb(c) - 'search_vector') || jsonb_build_object(
    'contact_methods',
    (SELECT COALESCE(jsonb_agg(to_jsonb(m)), '[]'::jsonb) FROM contact_methods m WHERE m.contact_id = c.id)
  )
  INTO v_snapshot
  FROM contacts c
  WHERE c.id = p_loser_id AND c.agency_id = p_agency_id;

  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'errors.not_found';
  END IF;

  -- Contact methods: drop exact duplicates, move the rest
  DELETE FROM contact_methods l
  USING contact_methods w
  WHERE l.contact_id = p_loser_id
    AND l.agency_id = p_agency_id
    AND w.contact_id = p_winner_id
    AND w.agency_id = p_agency_id
    AND w.type = l.type
    AND w.value = l.value;

  UPDATE contact_methods
  SET contact_id = p_winner_id, is_primary = false
  WHERE contact_id = p_loser_id AND agency_id = p_agency_id;

  UPDATE opportunities
  SET primary_contact_id = p_winner_id
  WHERE primary_contact_id = p_loser_id AND agency_id = p_agency_id;

  -- Participants: a deal the winner is already on keeps the winner's row (P1)
  DELETE FROM opportunity_participants l
  USING opportunity_participants w
  WHERE l.contact_id = p_loser_id
    AND l.agency_id = p_agency_id
    AND w.contact_id = p_winner_id
    AND w.agency_id = p_agency_id
    AND w.opportunity_id = l.opportunity_id;

  UPDATE opportunity_participants
  SET contact_id = p_winner_id
  WHERE contact_id = p_loser_id AND agency_id = p_agency_id;

  -- Property parties: where both are open parties of one property, the loser's row ends
  -- and stays as history; everything else moves (one open party per contact).
  UPDATE property_parties l
  SET ended_at = now()
  FROM property_parties w
  WHERE l.contact_id = p_loser_id
    AND l.agency_id = p_agency_id
    AND l.ended_at IS NULL
    AND w.contact_id = p_winner_id
    AND w.agency_id = p_agency_id
    AND w.property_id = l.property_id
    AND w.ended_at IS NULL;

  UPDATE property_parties
  SET contact_id = p_winner_id
  WHERE contact_id = p_loser_id AND agency_id = p_agency_id;

  UPDATE inquiries
  SET contact_id = p_winner_id
  WHERE contact_id = p_loser_id AND agency_id = p_agency_id;

  UPDATE tasks
  SET contact_id = p_winner_id
  WHERE contact_id = p_loser_id AND agency_id = p_agency_id;

  UPDATE notes
  SET contact_id = p_winner_id
  WHERE contact_id = p_loser_id AND agency_id = p_agency_id;

  UPDATE contacts
  SET status = 'archived'
  WHERE id = p_loser_id AND agency_id = p_agency_id;

  INSERT INTO merge_history (agency_id, winner_contact_id, loser_contact_id, merged_by, loser_snapshot)
  VALUES (p_agency_id, p_winner_id, p_loser_id, auth.uid(), v_snapshot);
END;
$$;
