-- smart-lists, Checkpoint 1 decision (founder, 2026-11-07; AD-062): the new-matches list is ordered
-- by oldest last touch like the other lists, and shows each deal's new-match count for the rows
-- of the page only. Sorting by the exact count needed the count of every deal (57 s at 2,000 deals,
-- 1.7-4.6 s even when capped), so the new_matches_desc sort is removed. has_new_matches still
-- stops at each deal's first match (~0.9 s over 2,000 deals); the count is computed for the
-- <= 100 rows returned. An unknown sort falls back to created_desc, as before.
-- The return type is unchanged; the function body is replaced.

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
  new_matches        INT,       -- with has_new_matches: the deal's new matches (page rows only); else NULL
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
      CASE WHEN j->>'sort' IN ('last_touch_asc', 'next_action_asc')
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
      -- Last touch only when the filter or the sort needs it (CASE evaluates lazily).
      CASE WHEN f.no_touch_days IS NOT NULL OR f.sort = 'last_touch_asc'
           THEN (SELECT d.last_touch FROM deal_last_touch d WHERE d.opportunity_id = o.id) END AS lt
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
    COALESCE(c.lt, (SELECT d.last_touch FROM deal_last_touch d WHERE d.opportunity_id = (c.opp).id)),
    -- The exact count is worth its cost only for the rows shown: counting every deal to sort by it
    -- took 57 s at 2,000 deals (AD-062).
    CASE WHEN c.has_nm THEN (SELECT count(*)::INT FROM deal_match_rows d WHERE d.opportunity_id = (c.opp).id AND d.is_new) END,
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
