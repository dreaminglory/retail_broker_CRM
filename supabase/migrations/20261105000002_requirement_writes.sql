-- 20261105000002_requirement_writes.sql
-- spec: requirements, Task 2 (AD-059). The only writers of requirements and their locations,
-- and the audit trigger that turns each save into one opportunity timeline entry.
--
-- Both RPCs are SECURITY DEFINER because members can't write either table (Task 1), so each
-- checks the agency, the deal type and status itself. Refusals are i18n keys:
--   requirements.errors.notFound              no such opportunity in the caller's agency, or no requirement to remove
--   requirements.errors.wrongOpportunityType  not a buyer or tenant deal (rule 1)
--   requirements.errors.readOnly              the deal is won, lost or archived (rule 7)
--   requirements.errors.invalid               a CHECK refused the row (rules 2–4) or a value doesn't parse
--   requirements.errors.invalidLocation       a settlement or area that doesn't exist, isn't the agency's or isn't in that settlement

-- Locks the caller's opportunity and checks it can carry a writable requirement. The lock
-- serialises saves of one requirement and a concurrent type or status change.
CREATE OR REPLACE FUNCTION public.lock_requirement_opportunity(p_opportunity_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := current_agency_id();
  v_type      TEXT;
  v_status    TEXT;
BEGIN
  SELECT type, status INTO v_type, v_status
  FROM opportunities
  WHERE id = p_opportunity_id AND agency_id = v_agency_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'requirements.errors.notFound';
  END IF;
  IF v_type NOT IN ('buyer', 'tenant') THEN
    RAISE EXCEPTION 'requirements.errors.wrongOpportunityType';
  END IF;
  IF v_status NOT IN ('active', 'nurture') THEN
    RAISE EXCEPTION 'requirements.errors.readOnly';
  END IF;

  RETURN v_agency_id;
END;
$$;

-- Internal: only the two RPCs below call it.
REVOKE EXECUTE ON FUNCTION public.lock_requirement_opportunity(UUID) FROM PUBLIC, anon, authenticated;

-- ── save_requirement ─────────────────────────────────────────────────────────
-- p_fields: the requirement's columns as the form sends them; a missing key is empty (NULL, an
-- empty list or false), so a save replaces the whole requirement. Keys that aren't criteria
-- (id, agency_id, opportunity_id, location_keys, ...) are ignored.
-- p_locations: [{ settlement_id, area_id? }]; an omitted area_id is the whole settlement.

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
  v_new       requirements;
  v_keys      TEXT[];
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

    INSERT INTO requirements AS r (
      agency_id, opportunity_id,
      budget_min, budget_max, property_types, rooms_min, rooms_max, area_m2_min, area_m2_max,
      floor_min, floor_max, not_top_floor, construction, financing, wishes,
      budget_must, location_must, type_must, rooms_must, area_m2_must, floor_must, construction_must,
      location_keys, created_by
    )
    VALUES (
      v_agency_id, p_opportunity_id,
      v_new.budget_min, v_new.budget_max, COALESCE(v_new.property_types, '{}'),
      v_new.rooms_min, v_new.rooms_max, v_new.area_m2_min, v_new.area_m2_max,
      v_new.floor_min, v_new.floor_max, COALESCE(v_new.not_top_floor, false),
      COALESCE(v_new.construction, '{}'), COALESCE(v_new.financing, 'unknown'), NULLIF(trim(v_new.wishes), ''),
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

-- ── remove_requirement ───────────────────────────────────────────────────────
-- Deletes the row; its locations cascade and the timeline keeps the audit entries (rule 8).

CREATE OR REPLACE FUNCTION public.remove_requirement(p_opportunity_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := lock_requirement_opportunity(p_opportunity_id);
BEGIN
  DELETE FROM requirements
  WHERE opportunity_id = p_opportunity_id AND agency_id = v_agency_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'requirements.errors.notFound';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.remove_requirement(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_requirement(UUID) TO authenticated;

-- ── Audit: one opportunity row per save (AD-059) ─────────────────────────────

-- Locations by name in both languages, so an entry keeps the names it had.
CREATE OR REPLACE FUNCTION public.requirement_location_names(p_keys TEXT[])
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'settlement_id', s.id, 'settlement_bg', s.name_bg, 'settlement_en', s.name_en,
      'area_id', a.id, 'area', a.name
    ) ORDER BY s.name_bg, a.name NULLS FIRST
  ), '[]'::jsonb)
  FROM unnest(p_keys) k
  JOIN settlements s ON s.id = split_part(k, ':', 1)::uuid
  LEFT JOIN areas a ON a.id = NULLIF(split_part(k, ':', 2), '')::uuid;
$$;

REVOKE EXECUTE ON FUNCTION public.requirement_location_names(TEXT[]) FROM PUBLIC, anon, authenticated;

-- created: every criterion that is set (from = its empty value); changed: only what changed;
-- removed: everything that was set (to = its empty value). A save with no change writes nothing.
CREATE OR REPLACE FUNCTION public.audit_requirement_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row     requirements := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  v_empty   JSONB := jsonb_build_object(
                       'property_types', '[]'::jsonb, 'construction', '[]'::jsonb,
                       'not_top_floor', false, 'financing', 'unknown',
                       'budget_must', false, 'location_must', false, 'type_must', false,
                       'rooms_must', false, 'area_m2_must', false, 'floor_must', false,
                       'construction_must', false);
  v_old     JSONB;
  v_new     JSONB;
  v_old_keys TEXT[];
  v_new_keys TEXT[];
  v_field   TEXT;
  v_changes JSONB := '[]'::jsonb;
BEGIN
  -- The agency or the opportunity is being deleted: its history goes with it.
  IF TG_OP = 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM opportunities WHERE id = OLD.opportunity_id AND agency_id = OLD.agency_id
  ) THEN
    RETURN OLD;
  END IF;

  v_old := CASE WHEN TG_OP = 'INSERT' THEN v_empty ELSE to_jsonb(OLD) END;
  v_new := CASE WHEN TG_OP = 'DELETE' THEN v_empty ELSE to_jsonb(NEW) END;
  v_old_keys := CASE WHEN TG_OP = 'INSERT' THEN '{}' ELSE OLD.location_keys END;
  v_new_keys := CASE WHEN TG_OP = 'DELETE' THEN '{}' ELSE NEW.location_keys END;

  FOREACH v_field IN ARRAY ARRAY[
    'budget_min', 'budget_max', 'property_types', 'rooms_min', 'rooms_max', 'area_m2_min',
    'area_m2_max', 'floor_min', 'floor_max', 'not_top_floor', 'construction', 'financing',
    'wishes', 'budget_must', 'location_must', 'type_must', 'rooms_must', 'area_m2_must',
    'floor_must', 'construction_must'
  ] LOOP
    IF COALESCE(v_old->v_field, 'null'::jsonb) IS DISTINCT FROM COALESCE(v_new->v_field, 'null'::jsonb) THEN
      v_changes := v_changes || jsonb_build_array(jsonb_build_object(
        'field', v_field, 'from', v_old->v_field, 'to', v_new->v_field
      ));
    END IF;
  END LOOP;

  IF v_old_keys IS DISTINCT FROM v_new_keys THEN
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'field', 'locations',
      'from', requirement_location_names(v_old_keys),
      'to', requirement_location_names(v_new_keys)
    ));
  END IF;

  IF jsonb_array_length(v_changes) = 0 THEN
    RETURN v_row;
  END IF;

  INSERT INTO audit_log (agency_id, entity_type, entity_id, action, field_name, metadata, performed_by)
  VALUES (
    v_row.agency_id, 'opportunity', v_row.opportunity_id, 'field_change', 'requirement',
    jsonb_build_object(
      'event', CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'UPDATE' THEN 'changed' ELSE 'removed' END,
      'changes', v_changes
    ),
    (SELECT auth.uid())
  );

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_requirement_changes() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_audit_requirement_changes
  AFTER INSERT OR UPDATE OR DELETE ON requirements
  FOR EACH ROW EXECUTE FUNCTION audit_requirement_changes();
