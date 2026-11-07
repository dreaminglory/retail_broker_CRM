-- spec: smart-lists, Task 3 (AD-062, AD-060). `new_matches` on smart_list_opportunities: a deal's
-- unlinked matches, counted by the same rule as match_properties' unlinked_count (both read
-- deal_match_rows), and the has_new_matches filter built on it.
-- Also pins the pre-filter inside deal_match_rows: on a generated set of requirements and
-- properties the count equals a count made straight from match_evaluate with no pre-filter.
BEGIN;
SELECT plan(21);

-- ── Setup ────────────────────────────────────────────────────────────────────

SELECT set_config('test.now', '2026-06-15 12:00:00+00', true);
SELECT set_config('test.a1', gen_random_uuid()::text, true);
SELECT set_config('test.a2', gen_random_uuid()::text, true);
SELECT set_config('test.u_broker', gen_random_uuid()::text, true);
SELECT set_config('test.u_b_broker', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES
  (current_setting('test.u_broker')::uuid, 'nm-broker@example.com'),
  (current_setting('test.u_b_broker')::uuid, 'nm-b-broker@example.com');
INSERT INTO agencies (id, name, slug) VALUES
  (current_setting('test.a1')::uuid, 'Agency NM1', 'nm1'),
  (current_setting('test.a2')::uuid, 'Agency NM2', 'nm2');
INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.u_broker')::uuid, 'broker', 'active'),
  (current_setting('test.a2')::uuid, current_setting('test.u_b_broker')::uuid, 'broker', 'active');
SELECT seed_agency_defaults(current_setting('test.a1')::uuid);
SELECT seed_agency_defaults(current_setting('test.a2')::uuid);
SELECT set_config('test.stage', (SELECT id FROM stages WHERE agency_id = current_setting('test.a1')::uuid ORDER BY sort_order LIMIT 1)::text, true);
SELECT set_config('test.stage_b', (SELECT id FROM stages WHERE agency_id = current_setting('test.a2')::uuid ORDER BY sort_order LIMIT 1)::text, true);
SELECT set_config('test.sofia', (SELECT id FROM settlements WHERE ekatte = '68134')::text, true);
SELECT set_config('test.plovdiv', (SELECT id FROM settlements WHERE ekatte = '56784')::text, true);

CREATE FUNCTION pg_temp.act_as(p_user TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    format('{"sub": "%s", "role": "authenticated"}', current_setting('test.' || p_user)), true);
  SET ROLE authenticated;
END;
$$;

-- Deals: b1 and b2 buyers, t1 tenant, n1 nurture buyer, s1 seller, c1 closed buyer, plus a
-- buyer in agency B. All are assigned to the broker.
SELECT set_config('test.' || n, gen_random_uuid()::text, true)
FROM unnest(ARRAY['b1','b2','t1','n1','s1','c1','bb']) AS n;
INSERT INTO opportunities (id, agency_id, title, type, status, stage_id, assigned_to)
SELECT current_setting('test.' || v.n)::uuid, v.ag::uuid, v.n || ' deal', v.type, v.status,
       CASE WHEN v.ag = current_setting('test.a2') THEN current_setting('test.stage_b')::uuid ELSE current_setting('test.stage')::uuid END,
       CASE WHEN v.ag = current_setting('test.a2') THEN current_setting('test.u_b_broker')::uuid ELSE current_setting('test.u_broker')::uuid END
FROM (VALUES
  ('b1', current_setting('test.a1'), 'buyer',    'active'),
  ('b2', current_setting('test.a1'), 'buyer',    'active'),
  ('t1', current_setting('test.a1'), 'tenant',   'active'),
  ('n1', current_setting('test.a1'), 'buyer',    'nurture'),
  ('s1', current_setting('test.a1'), 'seller',   'active'),
  ('c1', current_setting('test.a1'), 'buyer',    'won'),
  ('bb', current_setting('test.a2'), 'buyer',    'active')
) AS v(n, ag, type, status);

-- Distinct last touches (their creation dates) so the list order is fixed.
UPDATE opportunities SET created_at = v.at::timestamptz
FROM (VALUES ('b1', '2026-01-01'), ('b2', '2026-01-02'), ('n1', '2026-01-03'), ('t1', '2026-01-04')) AS v(n, at)
WHERE id = current_setting('test.' || v.n)::uuid;

-- Properties p1..p5 in Sofia, each with one listing: p1 sale 150k, p2 sale 160k (reserved),
-- p3 sale 900k (far over every budget), p4 rent 600, p5 sale 155k but archived.
SELECT set_config('test.' || n, gen_random_uuid()::text, true) FROM unnest(ARRAY['p1','p2','p3','p4','p5','pb']) AS n;
INSERT INTO properties (id, agency_id, code, type, rooms, area_m2, floor, floors_total, construction, settlement_id, status)
SELECT current_setting('test.' || v.n)::uuid, v.ag::uuid, 0, 'apartment', 2, 70, 3, 6, 'brick',
       current_setting('test.sofia')::uuid, v.status
FROM (VALUES
  ('p1', current_setting('test.a1'), 'active'), ('p2', current_setting('test.a1'), 'active'),
  ('p3', current_setting('test.a1'), 'active'), ('p4', current_setting('test.a1'), 'active'),
  ('p5', current_setting('test.a1'), 'active'), ('pb', current_setting('test.a2'), 'active')
) AS v(n, ag, status);
INSERT INTO listings (agency_id, property_id, offer_type, price, status)
SELECT p.agency_id, p.id, v.offer, v.price, v.status
FROM (VALUES
  ('p1', 'sale', 150000, 'active'), ('p2', 'sale', 160000, 'reserved'), ('p3', 'sale', 900000, 'active'),
  ('p4', 'rent', 600, 'active'), ('p5', 'sale', 155000, 'active'), ('pb', 'sale', 150000, 'active')
) AS v(n, offer, price, status)
JOIN properties p ON p.id = current_setting('test.' || v.n)::uuid;
UPDATE properties SET status = 'archived' WHERE id = current_setting('test.p5')::uuid;

-- Requirements (written as the table owner): budget and type must-haves.
INSERT INTO requirements (agency_id, opportunity_id, budget_min, budget_max, property_types, budget_must, type_must)
SELECT o.agency_id, o.id,
       CASE o.type WHEN 'tenant' THEN 400 ELSE 100000 END,
       CASE o.type WHEN 'tenant' THEN 800 ELSE 200000 END,
       ARRAY['apartment'], true, true
FROM opportunities o
WHERE o.id IN (current_setting('test.b1')::uuid, current_setting('test.b2')::uuid, current_setting('test.t1')::uuid,
               current_setting('test.n1')::uuid, current_setting('test.c1')::uuid, current_setting('test.bb')::uuid);

-- b1 sees p1 and p2 (p3 is over budget, p4 is a rental, p5 is archived); t1 sees p4; the nurture
-- buyer sees p1 and p2 and the closed buyer is never matched.
-- A deal's new_matches through the list (only deals with at least one are listed, so 0 otherwise).
CREATE FUNCTION pg_temp.nm(p_deal TEXT) RETURNS INT LANGUAGE sql AS $$
  SELECT COALESCE((SELECT new_matches FROM smart_list_opportunities_at(current_setting('test.now')::timestamptz,
    '{"status": ["active","nurture","won"], "has_new_matches": true, "type": ["buyer","tenant","seller"]}'::jsonb, 100, 0, NULL)
  WHERE id = current_setting('test.' || p_deal)::uuid), 0)
$$;
CREATE FUNCTION pg_temp.unlinked(p_deal TEXT) RETURNS BIGINT LANGUAGE sql AS $$
  SELECT max(unlinked_count) FROM match_properties(current_setting('test.' || p_deal)::uuid, true, 100, 0)
$$;

SELECT pg_temp.act_as('u_broker');

-- ── new_matches against match_properties ─────────────────────────────────────

SELECT is(pg_temp.nm('b1'), 2, 'a buyer''s new matches: the two open listings that fit');
SELECT is(pg_temp.nm('t1'), 1, 'a tenant''s new matches: the rental that fits');
SELECT is(pg_temp.nm('n1'), 2, 'a nurture buyer has new matches too');
SELECT is(pg_temp.nm('s1'), 0, 'a seller has none');
SELECT is(pg_temp.nm('c1'), 0, 'a closed buyer has none');
SELECT is(pg_temp.nm('b1')::bigint, pg_temp.unlinked('b1'), 'b1: new_matches = match_properties unlinked_count');
SELECT is(pg_temp.nm('t1')::bigint, pg_temp.unlinked('t1'), 't1: new_matches = match_properties unlinked_count');
SELECT is(pg_temp.nm('n1')::bigint, pg_temp.unlinked('n1'), 'n1: new_matches = match_properties unlinked_count');

-- A candidate link and a not-suitable link both take a match off the count.
RESET ROLE;
INSERT INTO opportunity_properties (agency_id, opportunity_id, property_id, relation, status)
VALUES (current_setting('test.a1')::uuid, current_setting('test.b1')::uuid, current_setting('test.p1')::uuid, 'candidate', 'candidate');
INSERT INTO opportunity_properties (agency_id, opportunity_id, property_id, relation, status, rejected_reason)
VALUES (current_setting('test.a1')::uuid, current_setting('test.n1')::uuid, current_setting('test.p2')::uuid, 'candidate', 'rejected', 'noisy');
SELECT pg_temp.act_as('u_broker');
SELECT is(pg_temp.nm('b1'), 1, 'a candidate link lowers new_matches');
SELECT is(pg_temp.nm('n1'), 1, 'a not-suitable link lowers new_matches');
SELECT is(pg_temp.nm('b1')::bigint, pg_temp.unlinked('b1'), 'b1 after linking: still equals unlinked_count');
SELECT is(pg_temp.nm('n1')::bigint, pg_temp.unlinked('n1'), 'n1 after rejecting: still equals unlinked_count');

-- ── The filter and the sort ──────────────────────────────────────────────────

SELECT is(
  (SELECT array_agg(split_part(title, ' ', 1) ORDER BY title)
   FROM smart_list_opportunities_at(current_setting('test.now')::timestamptz,
     '{"status": ["active","nurture"], "has_new_matches": true}', 100, 0, NULL)),
  ARRAY['b1','b2','n1','t1'], 'has_new_matches keeps the deals with at least one new match');

SELECT is(
  (SELECT array_agg(split_part(title, ' ', 1) ORDER BY ord)
   FROM smart_list_opportunities_at(current_setting('test.now')::timestamptz,
     '{"status": ["active","nurture"], "has_new_matches": true, "sort": "last_touch_asc"}', 100, 0, NULL)
   WITH ORDINALITY AS r(id, agency_id, title, type, stage_id, source_id, inquiry_id, primary_contact_id,
     assigned_to, status, temperature, expected_value, currency, notes, next_action_at, closed_at,
     lost_reason, created_by, created_at, updated_at, last_touch, new_matches, sort_key, total_count, ord)),
  ARRAY['b1', 'b2', 'n1', 't1'], 'the new-matches list is ordered by oldest last touch');

SELECT is(
  (SELECT array_agg(new_matches ORDER BY ord)
   FROM smart_list_opportunities_at(current_setting('test.now')::timestamptz,
     '{"status": ["active","nurture"], "has_new_matches": true, "sort": "last_touch_asc"}', 100, 0, NULL)
   WITH ORDINALITY AS r(id, agency_id, title, type, stage_id, source_id, inquiry_id, primary_contact_id,
     assigned_to, status, temperature, expected_value, currency, notes, next_action_at, closed_at,
     lost_reason, created_by, created_at, updated_at, last_touch, new_matches, sort_key, total_count, ord)),
  ARRAY[1, 2, 1, 1], 'and each row carries its new_matches count');

SELECT is(
  (SELECT new_matches FROM smart_list_opportunities_at(current_setting('test.now')::timestamptz, '{}', 100, 0, NULL) LIMIT 1),
  NULL, 'new_matches is null when the list does not filter by has_new_matches');

SELECT is(
  (SELECT total_count FROM smart_list_opportunities_at(current_setting('test.now')::timestamptz,
     '{"status": ["active","nurture"], "has_new_matches": true}', 1, 0, NULL)),
  4::bigint, 'total_count counts the deals with new matches');

SELECT is(
  (SELECT count(*)::int FROM smart_list_opportunities_at(current_setting('test.now')::timestamptz,
     '{"status": ["active"], "has_new_matches": true, "type": ["tenant"]}', 100, 0, NULL)),
  1, 'has_new_matches combines with the other filters');

-- ── Tenancy ──────────────────────────────────────────────────────────────────

SELECT pg_temp.act_as('u_b_broker');
SELECT is(
  (SELECT array_agg(split_part(title, ' ', 1)) FROM smart_list_opportunities_at(current_setting('test.now')::timestamptz,
     '{"status": ["active","nurture"], "has_new_matches": true}', 100, 0, NULL)),
  ARRAY['bb'], 'a Beta broker gets only Beta''s deals with new matches (and none of Alpha''s listings count)');

-- ── The pre-filter is only an optimization ───────────────────────────────────

RESET ROLE;
-- 60 properties and 60 requirements spread over types, prices, places and every must-have mix.
SELECT set_config('test.pa', gen_random_uuid()::text, true);
INSERT INTO agencies (id, name, slug) VALUES (current_setting('test.pa')::uuid, 'Agency NMP', 'nmp');
SELECT seed_agency_defaults(current_setting('test.pa')::uuid);
SELECT set_config('test.pa_user', gen_random_uuid()::text, true);
INSERT INTO auth.users (id, email) VALUES (current_setting('test.pa_user')::uuid, 'nm-gen@example.com');
INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES
  (current_setting('test.pa')::uuid, current_setting('test.pa_user')::uuid, 'broker', 'active');
SELECT set_config('test.pa_area1', gen_random_uuid()::text, true);
SELECT set_config('test.pa_area2', gen_random_uuid()::text, true);
INSERT INTO areas (id, agency_id, settlement_id, name) VALUES
  (current_setting('test.pa_area1')::uuid, current_setting('test.pa')::uuid, current_setting('test.sofia')::uuid, 'Gen 1'),
  (current_setting('test.pa_area2')::uuid, current_setting('test.pa')::uuid, current_setting('test.sofia')::uuid, 'Gen 2');

INSERT INTO properties (agency_id, code, type, rooms, area_m2, plot_m2, floor, floors_total, construction, settlement_id, area_id)
SELECT current_setting('test.pa')::uuid, 0, t.type,
       CASE WHEN t.type = 'apartment' THEN 1 + g % 4 END,
       CASE WHEN t.type = 'plot' OR g % 11 = 0 THEN NULL ELSE 30 + (g * 7) % 120 END,
       CASE WHEN t.type IN ('plot', 'house') THEN 300 + (g * 13) % 900 END,
       CASE WHEN t.type IN ('house', 'plot') OR g % 9 = 0 THEN NULL ELSE 1 + g % 6 END,
       CASE WHEN t.type = 'plot' THEN NULL ELSE 6 END,
       CASE WHEN t.type IN ('plot', 'garage') OR g % 7 = 0 THEN NULL ELSE (ARRAY['brick', 'panel', 'epk'])[1 + g % 3] END,
       CASE WHEN g % 5 = 0 THEN current_setting('test.plovdiv')::uuid ELSE current_setting('test.sofia')::uuid END,
       CASE WHEN g % 5 = 0 THEN NULL WHEN g % 3 = 0 THEN NULL WHEN g % 3 = 1 THEN current_setting('test.pa_area1')::uuid ELSE current_setting('test.pa_area2')::uuid END
FROM generate_series(1, 60) g
CROSS JOIN LATERAL (SELECT (ARRAY['apartment','apartment','apartment','studio','maisonette','house','plot','garage'])[1 + g % 8] AS type) t;

INSERT INTO listings (agency_id, property_id, offer_type, price, status)
SELECT p.agency_id, p.id, CASE WHEN n % 3 < 2 THEN 'sale' ELSE 'rent' END,
       CASE WHEN n % 3 < 2 THEN 50000 + (n * 7919) % 250000 ELSE 250 + (n * 31) % 900 END,
       CASE WHEN n % 10 = 0 THEN 'reserved' WHEN n % 13 = 0 THEN 'withdrawn' ELSE 'active' END
FROM (SELECT p.*, row_number() OVER (ORDER BY p.code) AS n FROM properties p WHERE p.agency_id = current_setting('test.pa')::uuid) p;

INSERT INTO opportunities (agency_id, title, type, status, stage_id, assigned_to)
SELECT current_setting('test.pa')::uuid, 'gen ' || lpad(g::text, 2, '0'),
       CASE WHEN g % 10 < 7 THEN 'buyer' ELSE 'tenant' END,
       CASE WHEN g % 8 = 0 THEN 'nurture' ELSE 'active' END,
       (SELECT id FROM stages WHERE agency_id = current_setting('test.pa')::uuid ORDER BY sort_order LIMIT 1),
       current_setting('test.pa_user')::uuid
FROM generate_series(1, 60) g;

INSERT INTO requirements (agency_id, opportunity_id, budget_min, budget_max, property_types, rooms_min, rooms_max,
                          area_m2_min, area_m2_max, floor_min, not_top_floor, construction,
                          type_must, budget_must, location_must, rooms_must, area_m2_must, floor_must, construction_must,
                          location_keys)
SELECT o.agency_id, o.id,
       CASE WHEN n % 6 = 5 THEN NULL WHEN o.type = 'buyer' THEN 40000 + (n * 1009) % 120000 ELSE 200 + (n * 17) % 300 END,
       CASE WHEN o.type = 'buyer' THEN 150000 + (n * 1009) % 180000 ELSE 600 + (n * 17) % 500 END,
       CASE WHEN n % 4 = 0 THEN '{}'::text[] ELSE ARRAY['apartment', 'studio'] END,
       1 + n % 3, 3 + n % 2,
       CASE WHEN n % 3 = 0 THEN 40 END, CASE WHEN n % 3 = 0 THEN 110 END,
       CASE WHEN n % 4 = 0 THEN 2 END, n % 5 = 0,
       CASE WHEN n % 2 = 0 THEN ARRAY['brick', 'epk'] ELSE '{}'::text[] END,
       n % 4 <> 0 AND n % 3 <> 0, n % 6 <> 5 AND n % 3 <> 1, n % 4 <> 1, n % 3 = 1, n % 3 = 0, n % 4 = 0, n % 2 = 0,
       CASE n % 4
         WHEN 0 THEN ARRAY[current_setting('test.sofia') || ':' || current_setting('test.pa_area1')]
         WHEN 1 THEN ARRAY[current_setting('test.sofia')]
         WHEN 2 THEN ARRAY[current_setting('test.plovdiv'), current_setting('test.sofia') || ':' || current_setting('test.pa_area2')]
         ELSE ARRAY[current_setting('test.sofia') || ':' || current_setting('test.pa_area1'), current_setting('test.sofia') || ':' || current_setting('test.pa_area2')]
       END
FROM (SELECT o.*, row_number() OVER (ORDER BY o.title) AS n FROM opportunities o WHERE o.agency_id = current_setting('test.pa')::uuid) o;

-- Reference: the count taken straight from match_evaluate, with no pre-filter.
CREATE FUNCTION pg_temp.reference() RETURNS TEXT[] LANGUAGE sql AS $$
  SELECT array_agg(o.title || '=' || COALESCE((
    SELECT count(*) FROM listings l
    JOIN properties p ON p.id = l.property_id AND p.agency_id = l.agency_id AND p.status = 'active'
    WHERE l.agency_id = o.agency_id AND l.status IN ('active', 'reserved')
      AND l.offer_type = CASE o.type WHEN 'buyer' THEN 'sale' ELSE 'rent' END
      AND (match_evaluate(r, p, l)->>'listed')::boolean
      AND NOT EXISTS (SELECT 1 FROM opportunity_properties op WHERE op.opportunity_id = o.id AND op.property_id = p.id)
  ), 0) ORDER BY o.title)
  FROM opportunities o JOIN requirements r ON r.opportunity_id = o.id
  WHERE o.agency_id = current_setting('test.pa')::uuid AND o.status IN ('active', 'nurture')
$$;

SELECT ok(EXISTS (SELECT 1 FROM unnest(pg_temp.reference()) AS x WHERE split_part(x, '=', 2)::int > 0),
  'the generated set has deals with matches (the comparison is not vacuous)');

SELECT pg_temp.act_as('pa_user');
SELECT is(
  (SELECT array_agg(title || '=' || new_matches ORDER BY title)
   FROM smart_list_opportunities_at(current_setting('test.now')::timestamptz,
     '{"status": ["active","nurture"], "has_new_matches": true}', 100, 0, NULL)),
  (SELECT array_agg(x ORDER BY x) FROM unnest(pg_temp.reference()) AS x WHERE x NOT LIKE '%=0'),
  'with the pre-filter, new_matches equals the count made from match_evaluate alone for 60 generated deals');

SELECT * FROM finish();
ROLLBACK;
