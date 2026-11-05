-- Speed check for matching (spec: matching rule 10, AC-8; AD-060).
-- Adds 2,000 properties with listings and 2,000 buyer/tenant requirements to a scratch agency,
-- times match_properties and match_opportunities as that agency's broker (RLS on) for 20
-- different deals and 20 different properties, prints min / median / p95 / max in ms, then
-- EXPLAIN (ANALYZE, BUFFERS) for one call of each. Everything runs in one transaction that is
-- rolled back, so the database is unchanged afterwards.
--
-- LOCAL STACK ONLY. It refuses to run unless the seeded agency 11111111-1111-… exists.
--   docker exec -i supabase_db_retail_broker_crm_application psql -U postgres -d postgres -v ON_ERROR_STOP=1 < scripts/matching/scale.sql
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM agencies WHERE id = '11111111-1111-1111-1111-111111111111') THEN
    RAISE EXCEPTION 'Not the local seeded stack: refusing to add scale data';
  END IF;
END $$;

SELECT set_config('scale.agency', gen_random_uuid()::text, true);
SELECT set_config('scale.user', gen_random_uuid()::text, true);
SELECT set_config('scale.sofia', (SELECT id FROM settlements WHERE ekatte = '68134')::text, true);

INSERT INTO auth.users (id, email) VALUES (current_setting('scale.user')::uuid, 'scale@example.com');
INSERT INTO agencies (id, name, slug) VALUES (current_setting('scale.agency')::uuid, 'Scale', 'scale-agency');
INSERT INTO agency_memberships (agency_id, user_id, role, status)
VALUES (current_setting('scale.agency')::uuid, current_setting('scale.user')::uuid, 'broker', 'active');
SELECT seed_agency_defaults(current_setting('scale.agency')::uuid);
SELECT set_config('scale.stage', (SELECT id FROM stages WHERE agency_id = current_setting('scale.agency')::uuid ORDER BY sort_order LIMIT 1)::text, true);

-- Eight areas of Sofia
INSERT INTO areas (id, agency_id, settlement_id, name)
SELECT ('00000000-0000-0000-0000-00000000000' || n)::uuid, current_setting('scale.agency')::uuid, current_setting('scale.sofia')::uuid, 'Area ' || n
FROM generate_series(1, 8) n;

-- 2,000 properties: mostly apartments, a few of every other type
INSERT INTO properties (agency_id, code, type, rooms, area_m2, plot_m2, floor, floors_total, construction, settlement_id, area_id)
SELECT current_setting('scale.agency')::uuid, 0, t.type,
       CASE WHEN t.type = 'apartment' THEN 1 + (g % 4) END,
       CASE WHEN t.type = 'plot' THEN NULL WHEN g % 11 = 0 THEN NULL ELSE 30 + (g * 7) % 120 END,
       CASE WHEN t.type IN ('plot', 'house') THEN 300 + (g * 13) % 1500 END,
       CASE WHEN t.type IN ('house', 'plot') THEN NULL WHEN g % 9 = 0 THEN NULL ELSE 1 + g % 7 END,
       CASE WHEN t.type = 'plot' THEN NULL ELSE 7 END,
       CASE WHEN t.type IN ('plot', 'garage') THEN NULL WHEN g % 7 = 0 THEN NULL ELSE (ARRAY['brick', 'panel', 'epk'])[1 + g % 3] END,
       current_setting('scale.sofia')::uuid,
       CASE WHEN g % 13 = 0 THEN NULL ELSE ('00000000-0000-0000-0000-00000000000' || (1 + g % 8))::uuid END
FROM generate_series(1, 2000) g
CROSS JOIN LATERAL (SELECT (ARRAY['apartment','apartment','apartment','apartment','apartment','apartment','studio','maisonette','house','house_floor','plot','garage'])[1 + g % 12] AS type) t;

-- One open listing each: 70% sale, 30% rent; a tenth reserved
INSERT INTO listings (agency_id, property_id, offer_type, price, status, listed_at)
SELECT p.agency_id, p.id,
       CASE WHEN n % 10 < 7 THEN 'sale' ELSE 'rent' END,
       CASE WHEN n % 10 < 7 THEN 60000 + (n * 997) % 340000 ELSE 300 + (n * 31) % 1200 END,
       CASE WHEN n % 10 = 0 THEN 'reserved' ELSE 'active' END,
       now() - (n % 120) * interval '1 day'
FROM (SELECT p.*, row_number() OVER (ORDER BY p.code) AS n FROM properties p WHERE p.agency_id = current_setting('scale.agency')::uuid) p;

-- 2,000 buyer (70%) and tenant (30%) deals, active or nurture
INSERT INTO opportunities (id, agency_id, title, type, status, stage_id, assigned_to)
SELECT gen_random_uuid(), current_setting('scale.agency')::uuid, 'Deal ' || g,
       CASE WHEN g % 10 < 7 THEN 'buyer' ELSE 'tenant' END,
       CASE WHEN g % 8 = 0 THEN 'nurture' ELSE 'active' END,
       current_setting('scale.stage')::uuid, current_setting('scale.user')::uuid
FROM generate_series(1, 2000) g;

-- Their requirements: budget, rooms, one or two areas; budget, location and type are must-haves
-- on most, m² and floor on some (written as the table owner, like the pgTAP fixtures)
INSERT INTO requirements (agency_id, opportunity_id, budget_min, budget_max, property_types, rooms_min, rooms_max,
                          area_m2_min, area_m2_max, floor_min, not_top_floor, construction,
                          type_must, budget_must, location_must, rooms_must, area_m2_must, floor_must, location_keys)
SELECT o.agency_id, o.id,
       CASE WHEN o.type = 'buyer' THEN 80000 + (n * 1009) % 150000 ELSE 300 + (n * 17) % 400 END,
       CASE WHEN o.type = 'buyer' THEN 180000 + (n * 1009) % 200000 ELSE 700 + (n * 17) % 500 END,
       ARRAY['apartment', 'studio'],
       1 + n % 3, 3 + n % 2,
       CASE WHEN n % 3 = 0 THEN 40 END, CASE WHEN n % 3 = 0 THEN 110 END,
       CASE WHEN n % 4 = 0 THEN 2 END, n % 5 = 0,
       CASE WHEN n % 2 = 0 THEN ARRAY['brick', 'epk'] ELSE '{}' END,
       true, n % 10 <> 0, n % 10 <> 1, n % 3 = 1, n % 3 = 0, n % 4 = 0,
       (SELECT array_agg(k ORDER BY k) FROM (VALUES
          (current_setting('scale.sofia') || ':00000000-0000-0000-0000-00000000000' || (1 + n % 8)),
          (current_setting('scale.sofia') || ':00000000-0000-0000-0000-00000000000' || (1 + (n + 3) % 8))
        ) v(k))
FROM (SELECT o.*, row_number() OVER (ORDER BY o.title) AS n FROM opportunities o WHERE o.agency_id = current_setting('scale.agency')::uuid) o;

ANALYZE properties; ANALYZE listings; ANALYZE opportunities; ANALYZE requirements; ANALYZE opportunity_properties;

SELECT count(*) AS properties FROM properties WHERE agency_id = current_setting('scale.agency')::uuid;
SELECT count(*) AS requirements FROM requirements WHERE agency_id = current_setting('scale.agency')::uuid;

-- Timings, as the scratch broker (RLS on)
CREATE TEMP TABLE scale_timing (fn TEXT, ms NUMERIC, matches INT);
GRANT ALL ON scale_timing TO authenticated;

SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('scale.user'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_id UUID;
  v_start TIMESTAMPTZ;
  v_n INT;
BEGIN
  FOR v_id IN SELECT o.id FROM opportunities o JOIN requirements r ON r.opportunity_id = o.id ORDER BY o.title LIMIT 20 LOOP
    v_start := clock_timestamp();
    SELECT count(*) INTO v_n FROM match_properties(v_id, true, 20, 0);
    INSERT INTO scale_timing VALUES ('match_properties', extract(epoch FROM clock_timestamp() - v_start) * 1000, v_n);
  END LOOP;
  FOR v_id IN SELECT p.id FROM properties p ORDER BY p.code LIMIT 20 LOOP
    v_start := clock_timestamp();
    SELECT count(*) INTO v_n FROM match_opportunities(v_id, true, 20, 0);
    INSERT INTO scale_timing VALUES ('match_opportunities', extract(epoch FROM clock_timestamp() - v_start) * 1000, v_n);
  END LOOP;
END $$;

SELECT fn,
       count(*) AS runs,
       round(min(ms), 1) AS min_ms,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY ms))::numeric, 1) AS median_ms,
       round((percentile_cont(0.95) WITHIN GROUP (ORDER BY ms))::numeric, 1) AS p95_ms,
       round(max(ms), 1) AS max_ms,
       max(matches) AS max_page_rows
FROM scale_timing GROUP BY fn ORDER BY fn;

SELECT id AS deal FROM opportunities WHERE agency_id = current_setting('scale.agency')::uuid AND title = 'Deal 1' \gset
SELECT id AS prop FROM properties WHERE agency_id = current_setting('scale.agency')::uuid ORDER BY code LIMIT 1 \gset

EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM match_properties(:'deal', true, 20, 0);
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM match_opportunities(:'prop', true, 20, 0);

ROLLBACK;
