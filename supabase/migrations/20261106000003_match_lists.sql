-- 20261106000003_match_lists.sql
-- spec: matching, Task 3 (AD-060). The two lists built on match_evaluate: the properties that
-- fit one buyer or tenant deal, and the deals that fit one property. Both run as the caller
-- (SECURITY INVOKER, so RLS applies, AD-050) and also filter by the caller's agency on every
-- table they read. Names (settlement, area, contact, broker) are resolved in the service.
--
-- One call returns a page plus `total_count` (rows in this view, before the page) and
-- `unlinked_count` (new matches, whether or not linked ones are shown), so the header count,
-- the "show already offered" toggle and the pager need no second query. A page past the end
-- returns no rows, so no counts.
--
-- Order (rule 5): reserved listings after all active ones, then score, then the newest listing
-- (deal side) or the most recently updated deal (property side), then id so paging is stable.
-- A property already linked to the deal, in any status, is not a new match (rule 6).

-- ── match_properties ─────────────────────────────────────────────────────────

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
      (e.ev->>'score')::INT AS score,
      e.ev->'criteria' AS criteria,
      op.status AS link_status,
      count(*) FILTER (WHERE op.id IS NULL) OVER () AS unlinked_count
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
    WHERE o.id = p_opportunity_id
      AND o.agency_id = current_agency_id()
      AND o.type IN ('buyer', 'tenant')
      AND o.status IN ('active', 'nurture')
      AND (e.ev->>'listed')::BOOLEAN
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

REVOKE EXECUTE ON FUNCTION public.match_properties(UUID, BOOLEAN, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_properties(UUID, BOOLEAN, INT, INT) TO authenticated;

-- ── match_opportunities ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.match_opportunities(
  p_property_id    UUID,
  p_include_linked BOOLEAN DEFAULT false,
  p_limit          INT     DEFAULT 20,
  p_offset         INT     DEFAULT 0
)
RETURNS TABLE (
  opportunity_id      UUID,
  opportunity_title   TEXT,
  opportunity_type    TEXT,
  opportunity_status  TEXT,
  primary_contact_id  UUID,
  assigned_to         UUID,
  listing_id          UUID,
  offer_type          TEXT,
  price               NUMERIC,
  listing_status      TEXT,
  score               INT,
  criteria            JSONB,
  link_status         TEXT,
  total_count         BIGINT,
  unlinked_count      BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH m AS (
    SELECT
      o.id AS opportunity_id, o.title AS opportunity_title, o.type AS opportunity_type,
      o.status AS opportunity_status, o.primary_contact_id, o.assigned_to,
      o.updated_at AS opportunity_updated_at,
      l.id AS listing_id, l.offer_type, l.price, l.status AS listing_status,
      (e.ev->>'score')::INT AS score,
      e.ev->'criteria' AS criteria,
      op.status AS link_status,
      count(*) FILTER (WHERE op.id IS NULL) OVER () AS unlinked_count
    FROM properties p
    JOIN listings l
      ON l.property_id = p.id AND l.agency_id = p.agency_id AND l.status IN ('active', 'reserved')
    JOIN opportunities o
      ON o.agency_id = p.agency_id
     AND o.status IN ('active', 'nurture')
     AND o.type = CASE l.offer_type WHEN 'sale' THEN 'buyer' ELSE 'tenant' END
    JOIN requirements r
      ON r.opportunity_id = o.id AND r.agency_id = o.agency_id
    LEFT JOIN opportunity_properties op
      ON op.opportunity_id = o.id AND op.property_id = p.id AND op.agency_id = p.agency_id
    CROSS JOIN LATERAL (SELECT match_evaluate(r, p, l) AS ev) e
    WHERE p.id = p_property_id
      AND p.agency_id = current_agency_id()
      AND p.status = 'active'
      AND (e.ev->>'listed')::BOOLEAN
  ),
  shown AS (
    SELECT m.*, count(*) OVER () AS total_count
    FROM m
    WHERE p_include_linked OR m.link_status IS NULL
  )
  SELECT
    s.opportunity_id, s.opportunity_title, s.opportunity_type, s.opportunity_status,
    s.primary_contact_id, s.assigned_to,
    s.listing_id, s.offer_type, s.price, s.listing_status,
    s.score, s.criteria, s.link_status, s.total_count, s.unlinked_count
  FROM shown s
  ORDER BY (s.listing_status = 'reserved'), s.score DESC, s.opportunity_updated_at DESC, s.opportunity_id
  LIMIT LEAST(GREATEST(p_limit, 0), 100)
  OFFSET GREATEST(p_offset, 0);
$$;

REVOKE EXECUTE ON FUNCTION public.match_opportunities(UUID, BOOLEAN, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_opportunities(UUID, BOOLEAN, INT, INT) TO authenticated;
