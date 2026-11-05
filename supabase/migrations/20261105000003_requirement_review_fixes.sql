-- 20261105000003_requirement_review_fixes.sql
-- spec: requirements, Checkpoint 2 review (AD-059).
--
-- 1. property_types and construction were stored in the order the broker clicked them, so a
--    save that only re-ordered them wrote a "changed" audit row with the same values, and the
--    summary's order depended on clicks. They are now stored in the list's order (the order of
--    the CHECKs in 20261105000001). No row needs re-ordering: 20261105000001 isn't in
--    production yet, and the seed saves through this function.
-- 2. save_requirement accepted what the form refuses: a whole settlement together with one of
--    its areas, and a newly added inactive area (rule 6). Both are refused now; an area
--    deactivated after it was saved stays on the requirement.
-- New refusal keys:
--   requirements.errors.locationCovered  a whole settlement and one of its areas
--   requirements.errors.inactiveArea     an area the agency has deactivated, not already saved

-- The CHECK lists' order: the order the form shows them in.
CREATE OR REPLACE FUNCTION public.requirement_sorted(p_values TEXT[], p_order TEXT[])
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  -- An unknown value sorts last; the CHECK refuses it.
  SELECT COALESCE(array_agg(v ORDER BY array_position(p_order, v) NULLS LAST, v), '{}')
  FROM (SELECT DISTINCT v FROM unnest(p_values) v) x;
$$;

REVOKE EXECUTE ON FUNCTION public.requirement_sorted(TEXT[], TEXT[]) FROM PUBLIC, anon, authenticated;

-- ── save_requirement ─────────────────────────────────────────────────────────
-- As in 20261105000002, plus the canonical list order and the two location checks.

CREATE OR REPLACE FUNCTION public.save_requirement(
  p_opportunity_id UUID,
  p_fields         JSONB,
  p_locations      JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := lock_requirement_opportunity(p_opportunity_id);
  v_types     TEXT[] := ARRAY['apartment', 'studio', 'maisonette', 'house', 'house_floor', 'plot', 'garage'];
  v_builds    TEXT[] := ARRAY['brick', 'panel', 'epk', 'timber', 'other'];
  v_new       requirements;
  v_keys      TEXT[];
  v_saved     TEXT[];
  v_id        UUID;
BEGIN
  BEGIN
    v_new := jsonb_populate_record(NULL::requirements, COALESCE(p_fields, '{}'::jsonb));

    SELECT COALESCE(array_agg(k ORDER BY k COLLATE "C"), '{}')
    INTO v_keys
    FROM (
      SELECT DISTINCT (e->>'settlement_id')::uuid::text || COALESCE(':' || (e->>'area_id')::uuid::text, '') AS k
      FROM jsonb_array_elements(COALESCE(p_locations, '[]'::jsonb)) e
    ) x;
  EXCEPTION
    WHEN invalid_text_representation OR numeric_value_out_of_range OR datatype_mismatch
      OR invalid_parameter_value OR string_data_right_truncation THEN
      RAISE EXCEPTION 'requirements.errors.invalid';
  END;

  -- The whole settlement already covers its areas.
  IF EXISTS (
    SELECT 1 FROM unnest(v_keys) k
    WHERE strpos(k, ':') > 0 AND split_part(k, ':', 1) = ANY (v_keys)
  ) THEN
    RAISE EXCEPTION 'requirements.errors.locationCovered';
  END IF;

  -- Rule 6: the picker offers active areas only; one saved before it was deactivated stays.
  SELECT location_keys INTO v_saved FROM requirements WHERE opportunity_id = p_opportunity_id;
  IF EXISTS (
    SELECT 1 FROM unnest(v_keys) k
    JOIN areas a
      ON a.id = NULLIF(split_part(k, ':', 2), '')::uuid
     AND a.agency_id = v_agency_id
     AND a.settlement_id = split_part(k, ':', 1)::uuid
    WHERE NOT a.is_active AND NOT (k = ANY (COALESCE(v_saved, '{}')))
  ) THEN
    RAISE EXCEPTION 'requirements.errors.inactiveArea';
  END IF;

  BEGIN
    INSERT INTO requirements AS r (
      agency_id, opportunity_id,
      budget_min, budget_max, property_types, rooms_min, rooms_max, area_m2_min, area_m2_max,
      floor_min, floor_max, not_top_floor, construction, financing, wishes,
      budget_must, location_must, type_must, rooms_must, area_m2_must, floor_must, construction_must,
      location_keys, created_by
    )
    VALUES (
      v_agency_id, p_opportunity_id,
      v_new.budget_min, v_new.budget_max, requirement_sorted(COALESCE(v_new.property_types, '{}'), v_types),
      v_new.rooms_min, v_new.rooms_max, v_new.area_m2_min, v_new.area_m2_max,
      v_new.floor_min, v_new.floor_max, COALESCE(v_new.not_top_floor, false),
      requirement_sorted(COALESCE(v_new.construction, '{}'), v_builds),
      COALESCE(v_new.financing, 'unknown'), NULLIF(trim(v_new.wishes), ''),
      COALESCE(v_new.budget_must, false), COALESCE(v_new.location_must, false),
      COALESCE(v_new.type_must, false), COALESCE(v_new.rooms_must, false),
      COALESCE(v_new.area_m2_must, false), COALESCE(v_new.floor_must, false),
      COALESCE(v_new.construction_must, false),
      v_keys, (SELECT auth.uid())
    )
    ON CONFLICT (opportunity_id) DO UPDATE SET
      budget_min = EXCLUDED.budget_min, budget_max = EXCLUDED.budget_max,
      property_types = EXCLUDED.property_types,
      rooms_min = EXCLUDED.rooms_min, rooms_max = EXCLUDED.rooms_max,
      area_m2_min = EXCLUDED.area_m2_min, area_m2_max = EXCLUDED.area_m2_max,
      floor_min = EXCLUDED.floor_min, floor_max = EXCLUDED.floor_max,
      not_top_floor = EXCLUDED.not_top_floor, construction = EXCLUDED.construction,
      financing = EXCLUDED.financing, wishes = EXCLUDED.wishes,
      budget_must = EXCLUDED.budget_must, location_must = EXCLUDED.location_must,
      type_must = EXCLUDED.type_must, rooms_must = EXCLUDED.rooms_must,
      area_m2_must = EXCLUDED.area_m2_must, floor_must = EXCLUDED.floor_must,
      construction_must = EXCLUDED.construction_must,
      location_keys = EXCLUDED.location_keys
    -- A save that changes nothing doesn't touch the row: no audit entry, same updated_at.
    WHERE (
      r.budget_min, r.budget_max, r.property_types, r.rooms_min, r.rooms_max, r.area_m2_min,
      r.area_m2_max, r.floor_min, r.floor_max, r.not_top_floor, r.construction, r.financing,
      r.wishes, r.budget_must, r.location_must, r.type_must, r.rooms_must, r.area_m2_must,
      r.floor_must, r.construction_must, r.location_keys
    ) IS DISTINCT FROM (
      EXCLUDED.budget_min, EXCLUDED.budget_max, EXCLUDED.property_types, EXCLUDED.rooms_min,
      EXCLUDED.rooms_max, EXCLUDED.area_m2_min, EXCLUDED.area_m2_max, EXCLUDED.floor_min,
      EXCLUDED.floor_max, EXCLUDED.not_top_floor, EXCLUDED.construction, EXCLUDED.financing,
      EXCLUDED.wishes, EXCLUDED.budget_must, EXCLUDED.location_must, EXCLUDED.type_must,
      EXCLUDED.rooms_must, EXCLUDED.area_m2_must, EXCLUDED.floor_must,
      EXCLUDED.construction_must, EXCLUDED.location_keys
    )
    RETURNING r.id INTO v_id;

    IF v_id IS NULL THEN
      -- Nothing changed: the row and its locations already match.
      SELECT id INTO v_id FROM requirements WHERE opportunity_id = p_opportunity_id;
      RETURN v_id;
    END IF;

    -- Make the location rows match the snapshot just written.
    DELETE FROM requirement_locations l
    WHERE l.requirement_id = v_id
      AND NOT (l.settlement_id::text || COALESCE(':' || l.area_id::text, '') = ANY (v_keys));

    INSERT INTO requirement_locations (agency_id, requirement_id, settlement_id, area_id)
    SELECT v_agency_id, v_id, split_part(k, ':', 1)::uuid, NULLIF(split_part(k, ':', 2), '')::uuid
    FROM unnest(v_keys) k
    ON CONFLICT ON CONSTRAINT uq_requirement_locations DO NOTHING;
  EXCEPTION
    WHEN check_violation OR not_null_violation OR invalid_text_representation
      OR numeric_value_out_of_range OR datatype_mismatch OR invalid_parameter_value
      OR string_data_right_truncation THEN
      RAISE EXCEPTION 'requirements.errors.invalid';
    WHEN foreign_key_violation THEN
      RAISE EXCEPTION 'requirements.errors.invalidLocation';
  END;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_requirement(UUID, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_requirement(UUID, JSONB, JSONB) TO authenticated;
