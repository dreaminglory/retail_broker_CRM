-- 20261105000001_requirements.sql
-- spec: requirements, Task 1 (AD-059). The client's search on a buyer or tenant opportunity
-- and its locations, with the constraints from business rules 1–4 and 10.
-- The only writers, save_requirement and remove_requirement, and the audit trigger follow in
-- 20261105000002. Members read both tables and write neither directly.

-- ── requirements ─────────────────────────────────────────────────────────────

CREATE TABLE requirements (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id          UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  opportunity_id     UUID        NOT NULL,

  -- EUR (AD-037): the price on a buyer deal, the monthly rent on a tenant deal.
  budget_min         NUMERIC(14, 2) CHECK (budget_min > 0),
  budget_max         NUMERIC(14, 2) CHECK (budget_max > 0),
  -- Same lists as properties.type and properties.construction; empty = any.
  property_types     TEXT[]      NOT NULL DEFAULT '{}' CHECK (property_types <@ ARRAY[
                       'apartment', 'studio', 'maisonette', 'house', 'house_floor', 'plot', 'garage'
                     ]::TEXT[]),
  rooms_min          SMALLINT    CHECK (rooms_min BETWEEN 1 AND 9),
  rooms_max          SMALLINT    CHECK (rooms_max BETWEEN 1 AND 9),
  area_m2_min        NUMERIC(10, 2) CHECK (area_m2_min > 0),
  area_m2_max        NUMERIC(10, 2) CHECK (area_m2_max > 0),
  -- Same range as properties.floor; the ground floor (партер) is floor 1.
  floor_min          SMALLINT    CHECK (floor_min BETWEEN -5 AND 200),
  floor_max          SMALLINT    CHECK (floor_max BETWEEN -5 AND 200),
  not_top_floor      BOOLEAN     NOT NULL DEFAULT false,
  construction       TEXT[]      NOT NULL DEFAULT '{}' CHECK (construction <@ ARRAY[
                       'brick', 'panel', 'epk', 'timber', 'other'
                     ]::TEXT[]),
  -- Shown, never matched.
  financing          TEXT        NOT NULL DEFAULT 'unknown'
                                 CHECK (financing IN ('cash', 'mortgage', 'mixed', 'unknown')),
  wishes             TEXT        CHECK (char_length(wishes) <= 2000),

  budget_must        BOOLEAN     NOT NULL DEFAULT false,
  location_must      BOOLEAN     NOT NULL DEFAULT false,
  type_must          BOOLEAN     NOT NULL DEFAULT false,
  rooms_must         BOOLEAN     NOT NULL DEFAULT false,
  area_m2_must       BOOLEAN     NOT NULL DEFAULT false,
  floor_must         BOOLEAN     NOT NULL DEFAULT false,
  construction_must  BOOLEAN     NOT NULL DEFAULT false,

  -- Sorted `settlement_id` / `settlement_id:area_id` of the requirement_locations rows, written
  -- with them by save_requirement (AD-059), so the CHECKs below and the audit see locations.
  location_keys      TEXT[]      NOT NULL DEFAULT '{}',

  created_by         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Rule 3
  CONSTRAINT requirements_budget_range  CHECK (budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max),
  CONSTRAINT requirements_rooms_range   CHECK (rooms_min IS NULL OR rooms_max IS NULL OR rooms_min <= rooms_max),
  CONSTRAINT requirements_area_m2_range CHECK (area_m2_min IS NULL OR area_m2_max IS NULL OR area_m2_min <= area_m2_max),
  CONSTRAINT requirements_floor_range   CHECK (floor_min IS NULL OR floor_max IS NULL OR floor_min <= floor_max),

  -- Rule 2: a budget bound, a location, a type, a rooms bound or an m² bound. Financing and
  -- wishes alone don't count.
  CONSTRAINT requirements_has_criterion CHECK (
    budget_min IS NOT NULL OR budget_max IS NOT NULL
    OR cardinality(location_keys) > 0
    OR cardinality(property_types) > 0
    OR rooms_min IS NOT NULL OR rooms_max IS NOT NULL
    OR area_m2_min IS NOT NULL OR area_m2_max IS NOT NULL
  ),

  -- Rule 4: a must-have flag only on a criterion that is set.
  CONSTRAINT requirements_must_has_criterion CHECK (
        (NOT budget_must       OR budget_min IS NOT NULL OR budget_max IS NOT NULL)
    AND (NOT location_must     OR cardinality(location_keys) > 0)
    AND (NOT type_must         OR cardinality(property_types) > 0)
    AND (NOT rooms_must        OR rooms_min IS NOT NULL OR rooms_max IS NOT NULL)
    AND (NOT area_m2_must      OR area_m2_min IS NOT NULL OR area_m2_max IS NOT NULL)
    AND (NOT floor_must        OR floor_min IS NOT NULL OR floor_max IS NOT NULL OR not_top_floor)
    AND (NOT construction_must OR cardinality(construction) > 0)
  ),

  -- Rule 1: at most one per opportunity.
  CONSTRAINT uq_requirements_opportunity UNIQUE (opportunity_id),
  CONSTRAINT uq_requirements_agency_id_id UNIQUE (agency_id, id),
  CONSTRAINT fk_requirements_opportunity FOREIGN KEY (agency_id, opportunity_id)
    REFERENCES opportunities (agency_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_requirements_agency_id ON requirements (agency_id);

CREATE TRIGGER set_requirements_updated_at
  BEFORE UPDATE ON requirements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirements FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON requirements
  FOR SELECT USING (agency_id = current_agency_id());

-- No write policy and no write grant: only the AD-059 RPCs write (E2 pattern).
REVOKE ALL ON requirements FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON requirements FROM authenticated;

-- ── requirement_locations ────────────────────────────────────────────────────

CREATE TABLE requirement_locations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  requirement_id  UUID        NOT NULL,
  settlement_id   UUID        NOT NULL REFERENCES settlements(id) ON DELETE RESTRICT,
  -- NULL = the whole settlement.
  area_id         UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_requirement_locations UNIQUE NULLS NOT DISTINCT (requirement_id, settlement_id, area_id),
  CONSTRAINT fk_requirement_locations_requirement FOREIGN KEY (agency_id, requirement_id)
    REFERENCES requirements (agency_id, id) ON DELETE CASCADE,
  -- The area is the agency's and in this settlement (like L4); a used area can't be deleted
  -- (like L8): deactivate it.
  CONSTRAINT fk_requirement_locations_area FOREIGN KEY (agency_id, settlement_id, area_id)
    REFERENCES areas (agency_id, settlement_id, id) ON DELETE RESTRICT
);

-- uq_requirement_locations serves lookups by requirement; this one serves the area FK and
-- `matching`.
CREATE INDEX idx_requirement_locations_agency_location
  ON requirement_locations (agency_id, settlement_id, area_id);

ALTER TABLE requirement_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirement_locations FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON requirement_locations
  FOR SELECT USING (agency_id = current_agency_id());

REVOKE ALL ON requirement_locations FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON requirement_locations FROM authenticated;

-- ── Rule 1: buyer and tenant deals only ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_requirement_opportunity_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_type TEXT;
BEGIN
  SELECT type INTO v_type
  FROM opportunities
  WHERE id = NEW.opportunity_id AND agency_id = NEW.agency_id;

  -- A missing opportunity is left to the foreign key.
  IF v_type IS NOT NULL AND v_type NOT IN ('buyer', 'tenant') THEN
    RAISE EXCEPTION 'requirements.errors.wrongOpportunityType';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_requirement_opportunity_type() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_check_requirement_opportunity_type
  BEFORE INSERT OR UPDATE OF opportunity_id ON requirements
  FOR EACH ROW EXECUTE FUNCTION check_requirement_opportunity_type();

-- The opportunity type is editable: buyer ↔ tenant keeps the requirement, seller or landlord
-- is refused while it exists (like L10).
CREATE OR REPLACE FUNCTION public.check_opportunity_type_vs_requirement()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.type NOT IN ('buyer', 'tenant') AND EXISTS (
    SELECT 1 FROM requirements
    WHERE opportunity_id = NEW.id AND agency_id = NEW.agency_id
  ) THEN
    RAISE EXCEPTION 'opportunities.errors.typeHasRequirement';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_opportunity_type_vs_requirement() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_check_opportunity_type_vs_requirement
  BEFORE UPDATE OF type ON opportunities
  FOR EACH ROW
  WHEN (NEW.type IS DISTINCT FROM OLD.type)
  EXECUTE FUNCTION check_opportunity_type_vs_requirement();
