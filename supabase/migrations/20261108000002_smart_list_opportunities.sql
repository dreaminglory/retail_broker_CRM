-- smart-lists, Task 2 (AD-062): last touch and the opportunity list function.
--
-- smart_list_opportunities(filter, limit, offset, after) is the only place a deal list is
-- evaluated. It runs as the caller (SECURITY INVOKER, so RLS applies, AD-050) and also filters
-- by the caller's agency on every table it reads. One call returns a page plus `total_count`
-- (rows in the whole list, before paging and before p_after), and each row's `sort_key`, which
-- the work-through queue passes back as p_after to get the row after it, even when the deal
-- itself has left the list.
--
-- Filter keys (unknown keys are ignored; Zod refuses them before saving):
--   status[] (default: active), type[], stage_id[], temperature[], source_id[],
--   assigned_to (me | unassigned | <user id>), next_action (none | overdue | today | upcoming),
--   no_touch_days, search, sort (created_desc | last_touch_asc | next_action_asc).
-- `me` is auth.uid(). Day windows are agency-local and pinned to getTodayWindows
-- (src/lib/time/agency-day.ts): overdue is before now, today runs from now to the next agency
-- midnight, upcoming from that midnight to midnight + 4 days (calendar days, so DST is right).
--
-- The clock is a parameter of smart_list_opportunities_at so tests can fix it; the public
-- function passes now().

-- ── Small helpers (the filter is untrusted JSON) ─────────────────────────────

CREATE FUNCTION smart_list_text_array(p_value JSONB) RETURNS TEXT[]
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN jsonb_typeof(p_value) = 'array'
              THEN ARRAY(SELECT jsonb_array_elements_text(p_value))
              ELSE ARRAY[]::TEXT[] END
$$;

-- A uuid, or NULL for anything that is not one (never an error).
CREATE FUNCTION smart_list_uuid(p_value TEXT) RETURNS UUID
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              THEN p_value::UUID END
$$;

CREATE FUNCTION smart_list_uuid_array(p_value JSONB) RETURNS UUID[]
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT u FROM (SELECT smart_list_uuid(e) AS u FROM unnest(smart_list_text_array(p_value)) AS e) AS x
    WHERE u IS NOT NULL
  )
$$;

-- Microseconds since the epoch: an exact integer sort position (and below 2^53, so a JSON
-- round trip through JavaScript keeps it exact).
CREATE FUNCTION smart_list_us(p_value TIMESTAMPTZ) RETURNS BIGINT
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT (extract(epoch FROM p_value) * 1000000)::BIGINT
$$;

-- ── Last touch ───────────────────────────────────────────────────────────────

-- The latest completed task or note on a deal, else the deal's creation. Never updated_at,
-- which edits and merges move. A cancelled task is not a touch.
CREATE FUNCTION opportunity_last_touch(o opportunities) RETURNS TIMESTAMPTZ
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    GREATEST(
      (SELECT max(t.completed_at) FROM tasks t
        WHERE t.agency_id = o.agency_id AND t.opportunity_id = o.id AND t.status = 'completed'),
      (SELECT max(n.created_at) FROM notes n
        WHERE n.agency_id = o.agency_id AND n.opportunity_id = o.id)
    ),
    o.created_at
  )
$$;

-- ── The list function ────────────────────────────────────────────────────────

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
      NULLIF(btrim(j->>'search'), '') AS search,
      CASE WHEN j->>'sort' IN ('last_touch_asc', 'next_action_asc') THEN j->>'sort' ELSE 'created_desc' END AS sort,
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
      f.after_k,
      f.after_id,
      CASE WHEN f.no_touch_days IS NOT NULL OR f.sort = 'last_touch_asc'
           THEN opportunity_last_touch(o) END AS lt
    FROM opportunities o
    CROSS JOIN f
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
    COALESCE(c.lt, opportunity_last_touch(c.opp)),
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

-- ── Grants: authenticated only (AD-028, AD-050) ──────────────────────────────

REVOKE EXECUTE ON FUNCTION smart_list_text_array(JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION smart_list_uuid(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION smart_list_uuid_array(JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION smart_list_us(TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION opportunity_last_touch(opportunities) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION smart_list_opportunities_at(TIMESTAMPTZ, JSONB, INT, INT, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION smart_list_opportunities(JSONB, INT, INT, JSONB) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION smart_list_text_array(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION smart_list_uuid(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION smart_list_uuid_array(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION smart_list_us(TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION opportunity_last_touch(opportunities) TO authenticated;
GRANT EXECUTE ON FUNCTION smart_list_opportunities_at(TIMESTAMPTZ, JSONB, INT, INT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION smart_list_opportunities(JSONB, INT, INT, JSONB) TO authenticated;
