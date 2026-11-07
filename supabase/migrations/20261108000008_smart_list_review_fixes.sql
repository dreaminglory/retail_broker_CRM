-- smart-lists, Checkpoint 1 review fixes (AD-062). Tested in 095-smart-list-review-fixes.sql.
--
-- 1. Unsharing. The UPDATE policy now says itself that only the creator may leave a list
--    unshared. Before, it relied on the SELECT policy being applied to the new row, which
--    Postgres does only when the UPDATE reads the table (a WHERE or RETURNING): a manager's
--    `UPDATE smart_lists SET shared = false` with no WHERE unshared every shared list.
-- 2. deal_match_rows moves to a `private` schema that the API does not expose. In `public`, a
--    plain GET /rest/v1/deal_match_rows asked for every deal x listing pair of the agency
--    (39-57 s at 2,000 deals). The SECURITY INVOKER functions still read it as the caller, so
--    `authenticated` keeps USAGE on the schema and SELECT on the view.
-- 3. no_touch_days that is not a whole number of at least 1 matches nothing, like any other
--    filter value of the wrong shape (a bad uuid or an unknown next_action matches nothing too).
--    Zod refuses it before saving; this keeps the SQL from widening a stale filter.
-- 4. At most 5 saved opportunity lists with has_new_matches per member: each one is a matching
--    pass over its deals in the overview (~0.9 s at 2,000 deals on Agency scope).

-- ── 1. Unsharing ─────────────────────────────────────────────────────────────

DROP POLICY "own_or_shared_update" ON smart_lists;

-- Target rows: the caller's own personal list, or any shared list when owner/manager.
-- Result rows: shared only by owners and managers; unshared only by the creator.
CREATE POLICY "own_or_shared_update" ON smart_lists
  FOR UPDATE USING (
    agency_id = current_agency_id()
    AND (
      (created_by = (SELECT auth.uid()) AND NOT shared)
      OR (shared AND current_user_role() IN ('owner', 'manager'))
    )
  ) WITH CHECK (
    agency_id = current_agency_id()
    AND (NOT shared OR current_user_role() IN ('owner', 'manager'))
    AND (shared OR created_by = (SELECT auth.uid()))
  );

-- ── 2. deal_match_rows out of the API ────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

ALTER VIEW public.deal_match_rows SET SCHEMA private;
REVOKE ALL ON private.deal_match_rows FROM PUBLIC, anon;
GRANT SELECT ON private.deal_match_rows TO authenticated;

-- Function bodies resolve names when they run, so both readers name the schema now.
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
    FROM private.deal_match_rows d
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

-- ── 3. The deal list reads private.deal_match_rows and checks no_touch_days ─────
-- Same body and return type as 20261108000007 except those two points.

CREATE OR REPLACE FUNCTION smart_list_opportunities_at(
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
      nt.days AS no_touch_days,
      -- Present (not JSON null) but not a whole number >= 1: the list matches nothing.
      (jsonb_typeof(j->'no_touch_days') IS DISTINCT FROM 'null' AND j ? 'no_touch_days' AND nt.days IS NULL) AS no_touch_bad,
      COALESCE(j->'has_new_matches' = 'true'::JSONB, false) AS has_nm,
      NULLIF(btrim(j->>'search'), '') AS search,
      CASE WHEN j->>'sort' IN ('last_touch_asc', 'next_action_asc')
           THEN j->>'sort' ELSE 'created_desc' END AS sort,
      -- Agency midnights as instants: calendar-day arithmetic on the local time, then back.
      (date_trunc('day', p_now AT TIME ZONE tz.name) + INTERVAL '1 day') AT TIME ZONE tz.name AS next_midnight,
      (date_trunc('day', p_now AT TIME ZONE tz.name) + INTERVAL '4 days') AT TIME ZONE tz.name AS upcoming_end,
      CASE WHEN jsonb_typeof(p_after->0) = 'number' THEN (p_after->>0)::NUMERIC END AS after_k,
      smart_list_uuid(p_after->>1) AS after_id
    FROM (SELECT COALESCE(p_filter, '{}'::JSONB) AS j) AS src
    CROSS JOIN tz
    -- Nested CASE so the cast runs only on a JSON number.
    CROSS JOIN LATERAL (
      SELECT CASE WHEN jsonb_typeof(src.j->'no_touch_days') = 'number' THEN
               CASE WHEN (src.j->>'no_touch_days')::NUMERIC >= 1 AND (src.j->>'no_touch_days')::NUMERIC % 1 = 0
                    THEN (src.j->>'no_touch_days')::FLOAT8 END
             END AS days
    ) AS nt
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
      SELECT 1 AS hit FROM private.deal_match_rows d
      WHERE f.has_nm AND d.opportunity_id = o.id AND d.is_new LIMIT 1
    ) m ON true
    WHERE o.agency_id = current_agency_id()
      AND NOT f.no_touch_bad
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
    CASE WHEN c.has_nm THEN (SELECT count(*)::INT FROM private.deal_match_rows d WHERE d.opportunity_id = (c.opp).id AND d.is_new) END,
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

CREATE OR REPLACE FUNCTION smart_list_opportunities(
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

-- ── 4. At most 5 saved has_new_matches lists per member ──────────────────────
-- Checked on insert and when a filter changes. The service checks first for the friendly
-- message; this is the guarantee. Same advisory lock as the 50-list cap.

CREATE FUNCTION enforce_smart_list_match_limit() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.entity <> 'opportunity' OR NEW.filter->'has_new_matches' IS DISTINCT FROM 'true'::JSONB THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.agency_id::text || NEW.created_by::text, 0));
  IF (SELECT count(*) FROM smart_lists
      WHERE agency_id = NEW.agency_id AND created_by = NEW.created_by AND id <> NEW.id
        AND entity = 'opportunity' AND filter->'has_new_matches' = 'true'::JSONB) >= 5 THEN
    RAISE EXCEPTION 'smartLists.errors.matchListLimit';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION enforce_smart_list_match_limit() FROM PUBLIC, anon;

CREATE TRIGGER smart_lists_match_limit
  BEFORE INSERT OR UPDATE OF filter ON smart_lists
  FOR EACH ROW EXECUTE FUNCTION enforce_smart_list_match_limit();
