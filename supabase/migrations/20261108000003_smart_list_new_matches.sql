-- smart-lists, Task 3 (AD-062, AD-060): new matches in the deal list.
--
-- deal_match_rows is the one place the "which listings fit this deal" join lives. It is what
-- match_properties used inline, extracted so that match_properties' unlinked_count and the
-- list's new_matches are the same rule. match_evaluate still holds every matching rule.
--
-- It is a view (security_invoker, so RLS applies, AD-050) and not a function because a view is
-- inlined: "has this deal a new match?" asked as `LATERAL (SELECT 1 FROM deal_match_rows WHERE
-- opportunity_id = o.id AND is_new LIMIT 1)` runs per deal and stops at the first match. A SQL
-- function with the required SET search_path cannot be inlined and always computes every row:
-- 39 s against 0.8 s for the count at 2,000 deals (scripts/smart-lists/scale.sql).
--
-- Cost. The join is deals x open listings, so at 2,000 deals it is millions of pairs. Before
-- match_evaluate runs, three necessary conditions drop pairs that cannot be listed: a must-have
-- type, budget or location (match_evaluate lists a pair only if no must-have is close or
-- missed, and a must-have budget is only a "match" inside the range, a must-have type only a
-- "match" in the list, a must-have location is only not-a-"miss" when the settlement or area
-- is in the keys or the area is unknown). They are conditions on the same columns as
-- match_evaluate, never looser, and 092-smart-list-new-matches.sql compares the result with a
-- count made from match_evaluate alone so a drift in either shows up.

-- ── deal_match_rows ──────────────────────────────────────────────────────────

CREATE VIEW public.deal_match_rows WITH (security_invoker = true) AS
  SELECT
    o.id AS opportunity_id,
    p.id AS property_id,
    l.id AS listing_id,
    e.ev,
    op.status AS link_status,
    (op.id IS NULL) AS is_new   -- no link to the property in any status
  FROM opportunities o
  JOIN requirements r
    ON r.opportunity_id = o.id AND r.agency_id = o.agency_id
  JOIN listings l
    ON l.agency_id = o.agency_id
   AND l.status IN ('active', 'reserved')
   AND l.offer_type = CASE o.type WHEN 'buyer' THEN 'sale' ELSE 'rent' END
  JOIN properties p
    ON p.id = l.property_id AND p.agency_id = l.agency_id AND p.status = 'active'
  LEFT JOIN opportunity_properties op
    ON op.opportunity_id = o.id AND op.property_id = p.id AND op.agency_id = o.agency_id
  CROSS JOIN LATERAL (SELECT match_evaluate(r, p, l) AS ev) e
  WHERE o.agency_id = current_agency_id()
    AND o.type IN ('buyer', 'tenant')
    AND o.status IN ('active', 'nurture')
    -- Pre-filter: necessary conditions only (see the header).
    AND (NOT r.type_must OR p.type = ANY (r.property_types))
    AND (NOT r.budget_must
         OR ((r.budget_min IS NULL OR l.price >= r.budget_min)
             AND (r.budget_max IS NULL OR l.price <= r.budget_max)))
    AND (NOT r.location_must
         OR p.settlement_id::TEXT = ANY (r.location_keys)
         OR (p.area_id IS NOT NULL AND p.settlement_id::TEXT || ':' || p.area_id::TEXT = ANY (r.location_keys))
         OR (p.area_id IS NULL AND EXISTS (
               SELECT 1 FROM unnest(r.location_keys) AS k WHERE k LIKE p.settlement_id::TEXT || ':%')))
    AND (e.ev->>'listed')::BOOLEAN;

REVOKE ALL ON public.deal_match_rows FROM PUBLIC, anon;
GRANT SELECT ON public.deal_match_rows TO authenticated;

-- ── match_properties on top of it (output unchanged) ─────────────────────────

CREATE OR REPLACE FUNCTION public.match_properties(
  p_opportunity_id UUID,
  p_include_linked BOOLEAN DEFAULT false,
  p_limit          INT     DEFAULT 20,
  p_offset         INT     DEFAULT 0
)
RETURNS TABLE (
  property_id     UUID,
  code            INT,
  property_type   TEXT,
  rooms           SMALLINT,
  area_m2         NUMERIC,
  plot_m2         NUMERIC,
  floor           SMALLINT,
  floors_total    SMALLINT,
  construction    TEXT,
  settlement_id   UUID,
  area_id         UUID,
  listing_id      UUID,
  offer_type      TEXT,
  price           NUMERIC,
  listing_status  TEXT,
  listed_at       TIMESTAMPTZ,
  score           INT,
  criteria        JSONB,
  link_status     TEXT,
  total_count     BIGINT,
  unlinked_count  BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH m AS (
    SELECT
      p.id AS property_id, p.code, p.type AS property_type, p.rooms, p.area_m2, p.plot_m2,
      p.floor, p.floors_total, p.construction, p.settlement_id, p.area_id,
      l.id AS listing_id, l.offer_type, l.price, l.status AS listing_status, l.listed_at,
      (d.ev->>'score')::INT AS score,
      d.ev->'criteria' AS criteria,
      d.link_status,
      count(*) FILTER (WHERE d.is_new) OVER () AS unlinked_count
    FROM deal_match_rows d
    JOIN properties p ON p.id = d.property_id AND p.agency_id = current_agency_id()
    JOIN listings l ON l.id = d.listing_id AND l.agency_id = current_agency_id()
    WHERE d.opportunity_id = p_opportunity_id
  ),
  shown AS (
    SELECT m.*, count(*) OVER () AS total_count
    FROM m
    WHERE p_include_linked OR m.link_status IS NULL
  )
  SELECT
    s.property_id, s.code, s.property_type, s.rooms, s.area_m2, s.plot_m2,
    s.floor, s.floors_total, s.construction, s.settlement_id, s.area_id,
    s.listing_id, s.offer_type, s.price, s.listing_status, s.listed_at,
    s.score, s.criteria, s.link_status, s.total_count, s.unlinked_count
  FROM shown s
  ORDER BY (s.listing_status = 'reserved'), s.score DESC, s.listed_at DESC, s.property_id
  LIMIT LEAST(GREATEST(p_limit, 0), 100)
  OFFSET GREATEST(p_offset, 0);
$$;

-- ── The deal list gains new_matches, has_new_matches and new_matches_desc ────
-- The return type changes, so the two functions are dropped and created again.

DROP FUNCTION smart_list_opportunities(JSONB, INT, INT, JSONB);
DROP FUNCTION smart_list_opportunities_at(TIMESTAMPTZ, JSONB, INT, INT, JSONB);

CREATE FUNCTION smart_list_opportunities_at(
  p_now     TIMESTAMPTZ,
  p_filter  JSONB,
  p_limit   INT   DEFAULT 20,
  p_offset  INT   DEFAULT 0,
  p_after   JSONB DEFAULT NULL
)
RETURNS TABLE (
  id                 UUID,
  agency_id          UUID,
  title              TEXT,
  type               TEXT,
  stage_id           UUID,
  source_id          UUID,
  inquiry_id         UUID,
  primary_contact_id UUID,
  assigned_to        UUID,
  status             TEXT,
  temperature        TEXT,
  expected_value     NUMERIC,
  currency           TEXT,
  notes              TEXT,
  next_action_at     TIMESTAMPTZ,
  closed_at          TIMESTAMPTZ,
  lost_reason        TEXT,
  created_by         UUID,
  created_at         TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ,
  last_touch         TIMESTAMPTZ,
  new_matches        INT,       -- only when the sort is new_matches_desc, else NULL
  sort_key           JSONB,
  total_count        BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH tz AS (
    SELECT COALESCE(
      (SELECT NULLIF(a.settings->>'timezone', '') FROM agencies a WHERE a.id = current_agency_id()),
      'Europe/Sofia'
    ) AS name
  ),
  f AS (
    SELECT
      COALESCE(NULLIF(smart_list_text_array(j->'status'), ARRAY[]::TEXT[]), ARRAY['active']) AS statuses,
      smart_list_text_array(j->'type') AS types,
      smart_list_text_array(j->'stage_id') AS stage_txt,
      smart_list_uuid_array(j->'stage_id') AS stage_ids,
      smart_list_text_array(j->'temperature') AS temps,
      smart_list_text_array(j->'source_id') AS source_txt,
      smart_list_uuid_array(j->'source_id') AS source_ids,
      j->>'assigned_to' AS assigned,
      j->>'next_action' AS next_action,
      CASE WHEN jsonb_typeof(j->'no_touch_days') = 'number' THEN (j->>'no_touch_days')::FLOAT8 END AS no_touch_days,
      COALESCE(j->'has_new_matches' = 'true'::JSONB, false) AS has_nm,
      NULLIF(btrim(j->>'search'), '') AS search,
      CASE WHEN j->>'sort' IN ('last_touch_asc', 'next_action_asc', 'new_matches_desc')
           THEN j->>'sort' ELSE 'created_desc' END AS sort,
      -- Agency midnights as instants: calendar-day arithmetic on the local time, then back.
      (date_trunc('day', p_now AT TIME ZONE tz.name) + INTERVAL '1 day') AT TIME ZONE tz.name AS next_midnight,
      (date_trunc('day', p_now AT TIME ZONE tz.name) + INTERVAL '4 days') AT TIME ZONE tz.name AS upcoming_end,
      CASE WHEN jsonb_typeof(p_after->0) = 'number' THEN (p_after->>0)::NUMERIC END AS after_k,
      smart_list_uuid(p_after->>1) AS after_id
    FROM (SELECT COALESCE(p_filter, '{}'::JSONB) AS j) AS src, tz
  ),
  base AS (
    SELECT
      o AS opp,
      f.sort,
      f.no_touch_days,
      f.has_nm,
      f.after_k,
      f.after_id,
      CASE WHEN f.no_touch_days IS NOT NULL OR f.sort = 'last_touch_asc'
           THEN opportunity_last_touch(o) END AS lt,
      -- The count is needed only to sort by it; has_new_matches alone stops at the first match.
      CASE WHEN f.sort = 'new_matches_desc'
           THEN (SELECT count(*)::INT FROM deal_match_rows d WHERE d.opportunity_id = o.id AND d.is_new) END AS nm
    FROM opportunities o
    CROSS JOIN f
    -- LIMIT 1 keeps this a per-deal lookup that stops at the first new match.
    LEFT JOIN LATERAL (
      SELECT 1 AS hit FROM deal_match_rows d
      WHERE f.has_nm AND d.opportunity_id = o.id AND d.is_new LIMIT 1
    ) m ON true
    WHERE o.agency_id = current_agency_id()
      AND o.status = ANY (f.statuses)
      AND (cardinality(f.types) = 0 OR o.type = ANY (f.types))
      AND (cardinality(f.stage_txt) = 0 OR o.stage_id = ANY (f.stage_ids))
      AND (cardinality(f.temps) = 0 OR o.temperature = ANY (f.temps))
      AND (cardinality(f.source_txt) = 0 OR o.source_id = ANY (f.source_ids))
      AND (f.assigned IS NULL
           OR (f.assigned = 'me' AND o.assigned_to = (SELECT auth.uid()))
           OR (f.assigned = 'unassigned' AND o.assigned_to IS NULL)
           OR (f.assigned NOT IN ('me', 'unassigned') AND o.assigned_to = smart_list_uuid(f.assigned)))
      AND (f.next_action IS NULL
           OR (f.next_action = 'none' AND o.next_action_at IS NULL)
           OR (f.next_action = 'overdue' AND o.next_action_at < p_now)
           OR (f.next_action = 'today' AND o.next_action_at >= p_now AND o.next_action_at < f.next_midnight)
           OR (f.next_action = 'upcoming' AND o.next_action_at >= f.next_midnight AND o.next_action_at < f.upcoming_end))
      -- LIKE wildcards in the search are literal characters.
      AND (f.search IS NULL
           OR o.title ILIKE '%' || replace(replace(replace(f.search, '\', '\\'), '%', '\%'), '_', '\_') || '%')
      -- Only buyers and tenants can have matches: skip the rest before the expensive part.
      AND (NOT f.has_nm OR (o.type IN ('buyer', 'tenant') AND o.status IN ('active', 'nurture') AND m.hit IS NOT NULL))
  ),
  keyed AS (
    SELECT
      b.*,
      -- Everything sorts ascending on k1; a descending sort stores the negated position.
      -- 9e15 (below 2^53) puts a deal with no next action after every real instant.
      CASE b.sort
        WHEN 'last_touch_asc'  THEN smart_list_us(b.lt)
        WHEN 'next_action_asc' THEN COALESCE(smart_list_us((b.opp).next_action_at), 9000000000000000)
        WHEN 'new_matches_desc' THEN -b.nm::BIGINT
        ELSE -smart_list_us((b.opp).created_at)
      END AS k1,
      -- created_desc breaks ties by id descending (as the opportunity list always has).
      b.sort = 'created_desc' AS id_desc
    FROM base b
    WHERE b.no_touch_days IS NULL OR b.lt <= p_now - b.no_touch_days * INTERVAL '1 day'
  ),
  counted AS (
    SELECT k.*, count(*) OVER () AS total
    FROM keyed k
  )
  SELECT
    (c.opp).id, (c.opp).agency_id, (c.opp).title, (c.opp).type, (c.opp).stage_id, (c.opp).source_id,
    (c.opp).inquiry_id, (c.opp).primary_contact_id, (c.opp).assigned_to, (c.opp).status,
    (c.opp).temperature, (c.opp).expected_value, (c.opp).currency, (c.opp).notes,
    (c.opp).next_action_at, (c.opp).closed_at, (c.opp).lost_reason, (c.opp).created_by,
    (c.opp).created_at, (c.opp).updated_at,
    COALESCE(c.lt, opportunity_last_touch(c.opp)),
    c.nm,
    jsonb_build_array(c.k1, (c.opp).id),
    c.total
  FROM counted c
  WHERE p_after IS NULL
     OR (c.k1 > c.after_k
         OR (c.k1 = c.after_k
             AND CASE WHEN c.id_desc THEN (c.opp).id < c.after_id ELSE (c.opp).id > c.after_id END))
  ORDER BY
    c.k1,
    CASE WHEN c.id_desc THEN NULL ELSE (c.opp).id END ASC,
    CASE WHEN c.id_desc THEN (c.opp).id END DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
$$;

CREATE FUNCTION smart_list_opportunities(
  p_filter  JSONB,
  p_limit   INT   DEFAULT 20,
  p_offset  INT   DEFAULT 0,
  p_after   JSONB DEFAULT NULL
)
RETURNS TABLE (
  id                 UUID,
  agency_id          UUID,
  title              TEXT,
  type               TEXT,
  stage_id           UUID,
  source_id          UUID,
  inquiry_id         UUID,
  primary_contact_id UUID,
  assigned_to        UUID,
  status             TEXT,
  temperature        TEXT,
  expected_value     NUMERIC,
  currency           TEXT,
  notes              TEXT,
  next_action_at     TIMESTAMPTZ,
  closed_at          TIMESTAMPTZ,
  lost_reason        TEXT,
  created_by         UUID,
  created_at         TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ,
  last_touch         TIMESTAMPTZ,
  new_matches        INT,
  sort_key           JSONB,
  total_count        BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT * FROM smart_list_opportunities_at(now(), p_filter, p_limit, p_offset, p_after)
$$;

REVOKE EXECUTE ON FUNCTION smart_list_opportunities_at(TIMESTAMPTZ, JSONB, INT, INT, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION smart_list_opportunities(JSONB, INT, INT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION smart_list_opportunities_at(TIMESTAMPTZ, JSONB, INT, INT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION smart_list_opportunities(JSONB, INT, INT, JSONB) TO authenticated;
