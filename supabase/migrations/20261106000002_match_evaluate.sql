-- 20261106000002_match_evaluate.sql
-- spec: matching, Task 2 (AD-060). The one place the matching rules live (spec rules 2–4):
-- the result of each criterion the requirement sets, the score, and whether the property is
-- listed. Pure: reads only its three arguments, so both list functions and, later,
-- `smart-lists` call it and nothing else holds a copy of a rule.
--
-- Returns { score, listed, criteria: [{ criterion, result, must }] } with `result` in
-- match | close | miss | unknown | n/a, criteria in the summary's reading order.
-- Tolerances are constants here: 10% on price and m², one room (assumption A2).
-- Financing and wishes are never matched (AD-059).

CREATE OR REPLACE FUNCTION public.match_evaluate(
  r requirements,
  p properties,
  l listings
)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'score', COALESCE(
      round(
        100 * sum(CASE c.result WHEN 'match' THEN 1.0 WHEN 'close' THEN 0.5 ELSE 0.0 END)
          FILTER (WHERE c.result <> 'n/a')
        / NULLIF(count(*) FILTER (WHERE c.result <> 'n/a'), 0)
      )::INT,
      0
    ),
    -- Rule 3 (no must-have is close or miss), rule 4 (an applicable criterion, score above 0).
    'listed', COALESCE(count(*) FILTER (WHERE c.result <> 'n/a'), 0) > 0
              AND COALESCE(sum(CASE c.result WHEN 'match' THEN 1.0 WHEN 'close' THEN 0.5 ELSE 0.0 END), 0) > 0
              AND NOT COALESCE(bool_or(c.must AND c.result IN ('close', 'miss')), false),
    'criteria', COALESCE(
      jsonb_agg(jsonb_build_object('criterion', c.criterion, 'result', c.result, 'must', c.must) ORDER BY c.ord),
      '[]'::JSONB
    )
  )
  FROM (SELECT
          -- m²: the plot's area for a plot.
          CASE WHEN p.type = 'plot' THEN p.plot_m2 ELSE p.area_m2 END AS m2,
          -- Floor, in two parts that combine to the worst result. The range needs a recorded
          -- floor; "not top floor" also needs the floors total, and does not apply to a
          -- garage (no floors total by type).
          CASE
            WHEN r.floor_min IS NULL AND r.floor_max IS NULL THEN NULL
            WHEN p.floor IS NULL THEN 'unknown'
            WHEN (r.floor_min IS NULL OR p.floor >= r.floor_min)
             AND (r.floor_max IS NULL OR p.floor <= r.floor_max) THEN 'match'
            ELSE 'miss'
          END AS floor_range,
          CASE
            WHEN NOT r.not_top_floor OR p.type = 'garage' THEN NULL
            WHEN p.floor IS NULL OR p.floors_total IS NULL THEN 'unknown'
            WHEN p.floor >= p.floors_total THEN 'miss'
            ELSE 'match'
          END AS floor_top
       ) v
  CROSS JOIN LATERAL (VALUES
    (1, 'type', cardinality(r.property_types) > 0,
      CASE WHEN p.type = ANY (r.property_types) THEN 'match' ELSE 'miss' END,
      r.type_must),

    (2, 'rooms', r.rooms_min IS NOT NULL OR r.rooms_max IS NOT NULL,
      CASE
        WHEN p.type <> 'apartment' THEN 'n/a'
        WHEN p.rooms IS NULL THEN 'unknown'
        WHEN (r.rooms_min IS NULL OR p.rooms >= r.rooms_min)
         AND (r.rooms_max IS NULL OR p.rooms <= r.rooms_max) THEN 'match'
        WHEN p.rooms = r.rooms_min - 1 OR p.rooms = r.rooms_max + 1 THEN 'close'
        ELSE 'miss'
      END,
      r.rooms_must),

    (3, 'area_m2', r.area_m2_min IS NOT NULL OR r.area_m2_max IS NOT NULL,
      CASE
        WHEN v.m2 IS NULL THEN 'unknown'
        WHEN (r.area_m2_min IS NULL OR v.m2 >= r.area_m2_min)
         AND (r.area_m2_max IS NULL OR v.m2 <= r.area_m2_max) THEN 'match'
        WHEN (r.area_m2_min IS NOT NULL AND v.m2 < r.area_m2_min AND v.m2 >= r.area_m2_min * 0.9)
          OR (r.area_m2_max IS NOT NULL AND v.m2 > r.area_m2_max AND v.m2 <= r.area_m2_max * 1.1) THEN 'close'
        ELSE 'miss'
      END,
      r.area_m2_must),

    -- AD-059: location_keys holds `settlement_id` (whole settlement) and `settlement_id:area_id`.
    (4, 'location', cardinality(r.location_keys) > 0,
      CASE
        WHEN p.settlement_id::TEXT = ANY (r.location_keys)
          OR (p.area_id IS NOT NULL AND p.settlement_id::TEXT || ':' || p.area_id::TEXT = ANY (r.location_keys)) THEN 'match'
        WHEN p.area_id IS NULL AND EXISTS (
          SELECT 1 FROM unnest(r.location_keys) k WHERE k LIKE p.settlement_id::TEXT || ':%'
        ) THEN 'unknown'
        ELSE 'miss'
      END,
      r.location_must),

    (5, 'budget', r.budget_min IS NOT NULL OR r.budget_max IS NOT NULL,
      CASE
        WHEN (r.budget_min IS NULL OR l.price >= r.budget_min)
         AND (r.budget_max IS NULL OR l.price <= r.budget_max) THEN 'match'
        WHEN (r.budget_min IS NOT NULL AND l.price < r.budget_min AND l.price >= r.budget_min * 0.9)
          OR (r.budget_max IS NOT NULL AND l.price > r.budget_max AND l.price <= r.budget_max * 1.1) THEN 'close'
        ELSE 'miss'
      END,
      r.budget_must),

    (6, 'floor', r.floor_min IS NOT NULL OR r.floor_max IS NOT NULL OR r.not_top_floor,
      CASE
        WHEN p.type IN ('house', 'plot') THEN 'n/a'
        WHEN v.floor_range IS NULL AND v.floor_top IS NULL THEN 'n/a'
        WHEN 'miss' IN (v.floor_range, v.floor_top) THEN 'miss'
        WHEN 'unknown' IN (v.floor_range, v.floor_top) THEN 'unknown'
        ELSE 'match'
      END,
      r.floor_must),

    (7, 'construction', cardinality(r.construction) > 0,
      CASE
        WHEN p.type IN ('plot', 'garage') THEN 'n/a'
        WHEN p.construction IS NULL THEN 'unknown'
        WHEN p.construction = ANY (r.construction) THEN 'match'
        ELSE 'miss'
      END,
      r.construction_must)
  ) AS c (ord, criterion, is_set, result, must)
  WHERE c.is_set;
$$;

REVOKE EXECUTE ON FUNCTION public.match_evaluate(requirements, properties, listings) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_evaluate(requirements, properties, listings) TO authenticated;
