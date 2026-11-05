-- spec: matching, Task 3 (AD-060). match_properties and match_opportunities: which rows appear,
-- their order, the counts, the linked toggle, paging, tenancy and privileges. The scoring
-- rules themselves are asserted in 080-matching.sql. Rows are inserted as the table owner.
BEGIN;
SELECT plan(33);

-- ── Setup ────────────────────────────────────────────────────────────────────

SELECT set_config('test.a1', gen_random_uuid()::text, true);
SELECT set_config('test.a2', gen_random_uuid()::text, true);
SELECT set_config('test.u1', gen_random_uuid()::text, true);
SELECT set_config('test.u2', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES
  (current_setting('test.u1')::uuid, 'ml-broker@example.com'),
  (current_setting('test.u2')::uuid, 'ml-b-broker@example.com');
INSERT INTO agencies (id, name, slug) VALUES
  (current_setting('test.a1')::uuid, 'Agency ML1', 'ml1'),
  (current_setting('test.a2')::uuid, 'Agency ML2', 'ml2');
INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.u1')::uuid, 'broker', 'active'),
  (current_setting('test.a2')::uuid, current_setting('test.u2')::uuid, 'broker', 'active');
SELECT seed_agency_defaults(current_setting('test.a1')::uuid);
SELECT seed_agency_defaults(current_setting('test.a2')::uuid);

SELECT set_config('test.sofia', (SELECT id FROM settlements WHERE ekatte = '68134')::text, true);
SELECT set_config('test.stage', (SELECT id FROM stages WHERE agency_id = current_setting('test.a1')::uuid ORDER BY sort_order LIMIT 1)::text, true);
SELECT set_config('test.lozenets', gen_random_uuid()::text, true);
SELECT set_config('test.iztok', gen_random_uuid()::text, true);

INSERT INTO areas (id, agency_id, settlement_id, name) VALUES
  (current_setting('test.lozenets')::uuid, current_setting('test.a1')::uuid, current_setting('test.sofia')::uuid, 'Лозенец'),
  (current_setting('test.iztok')::uuid, current_setting('test.a1')::uuid, current_setting('test.sofia')::uuid, 'Изток');

CREATE FUNCTION pg_temp.act_as(p_user TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    format('{"sub": "%s", "role": "authenticated"}', current_setting('test.' || p_user)), true);
  SET ROLE authenticated;
END;
$$;

CREATE FUNCTION pg_temp.id(p_name TEXT) RETURNS uuid LANGUAGE sql AS $$
  SELECT current_setting('test.' || p_name)::uuid;
$$;

-- A property in Sofia with one listing; its id is kept as test.<name>.
CREATE FUNCTION pg_temp.mk(
  p_name TEXT, p_type TEXT, p_rooms INT, p_m2 NUMERIC, p_area TEXT,
  p_offer TEXT, p_price NUMERIC, p_status TEXT, p_listed TIMESTAMPTZ
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO properties (agency_id, code, type, rooms, area_m2, settlement_id, area_id)
  VALUES (current_setting('test.a1')::uuid, 0, p_type, p_rooms, p_m2, current_setting('test.sofia')::uuid,
          current_setting('test.' || p_area)::uuid)
  RETURNING id INTO v_id;
  PERFORM set_config('test.' || p_name, v_id::text, true);
  INSERT INTO listings (agency_id, property_id, offer_type, price, status, listed_at)
  VALUES (current_setting('test.a1')::uuid, v_id, p_offer, p_price, p_status, p_listed);
END;
$$;

-- The seeded buyer's search: apartment, 2–3 rooms, Lozenets, €150–200k, 70–100 m²;
-- type, budget and location are must-haves.
CREATE FUNCTION pg_temp.mk_deal(p_name TEXT, p_type TEXT, p_status TEXT, p_with_requirement BOOLEAN) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO opportunities (id, agency_id, title, type, status, stage_id, assigned_to)
  VALUES (v_id, current_setting('test.a1')::uuid, p_name, p_type, p_status, current_setting('test.stage')::uuid,
          current_setting('test.u1')::uuid);
  PERFORM set_config('test.' || p_name, v_id::text, true);
  IF p_with_requirement AND p_type = 'buyer' THEN
    INSERT INTO requirements (agency_id, opportunity_id, property_types, rooms_min, rooms_max, budget_min, budget_max,
                              area_m2_min, area_m2_max, type_must, budget_must, location_must, location_keys)
    VALUES (current_setting('test.a1')::uuid, v_id, ARRAY['apartment'], 2, 3, 150000, 200000, 70, 100,
            true, true, true, ARRAY[current_setting('test.sofia') || ':' || current_setting('test.lozenets')]);
  ELSIF p_with_requirement THEN
    INSERT INTO requirements (agency_id, opportunity_id, budget_min, budget_max, budget_must, location_keys)
    VALUES (current_setting('test.a1')::uuid, v_id, 800, 1000, true, ARRAY[current_setting('test.sofia')]);
  END IF;
END;
$$;

-- Properties for the buyers
SELECT pg_temp.mk('exact',   'apartment', 2, 85,   'lozenets', 'sale', 185000, 'active',   '2026-01-01');
SELECT pg_temp.mk('exact2',  'apartment', 2, 85,   'lozenets', 'sale', 180000, 'active',   '2026-02-01');
SELECT pg_temp.mk('unknown', 'apartment', 2, NULL, 'lozenets', 'sale', 170000, 'active',   '2026-01-15');
SELECT pg_temp.mk('reserved','apartment', 3, 90,   'lozenets', 'sale', 190000, 'reserved', '2026-03-01');
SELECT pg_temp.mk('linked',  'apartment', 2, 80,   'lozenets', 'sale', 175000, 'active',   '2026-01-10');
SELECT pg_temp.mk('near',    'apartment', 3, 90,   'lozenets', 'sale', 209000, 'active',   '2026-01-20');
SELECT pg_temp.mk('elsewhere','apartment', 2, 85,  'iztok',    'sale', 185000, 'active',   '2026-01-20');
SELECT pg_temp.mk('house',   'house',     NULL, 85, 'lozenets', 'sale', 185000, 'active',  '2026-01-20');
SELECT pg_temp.mk('closed',  'apartment', 2, 85,   'lozenets', 'sale', 185000, 'closed',   '2026-01-20');
SELECT pg_temp.mk('withdrawn','apartment', 2, 85,  'lozenets', 'sale', 185000, 'withdrawn','2026-01-20');
SELECT pg_temp.mk('archived','apartment', 2, 85,   'lozenets', 'sale', 185000, 'active',   '2026-01-20');
UPDATE properties SET status = 'archived' WHERE id = pg_temp.id('archived');
-- A rent-only property that fits the tenant
SELECT pg_temp.mk('rentonly','apartment', 2, 85,   'lozenets', 'rent', 900,    'active',   '2026-01-20');

-- Deals
SELECT pg_temp.mk_deal('Ob',      'buyer',  'active',   true);
SELECT pg_temp.mk_deal('Onurture','buyer',  'nurture',  true);
SELECT pg_temp.mk_deal('Owon',    'buyer',  'won',      true);
SELECT pg_temp.mk_deal('Oarch',   'buyer',  'archived', true);
SELECT pg_temp.mk_deal('Onoreq',  'buyer',  'active',   false);
SELECT pg_temp.mk_deal('Oseller', 'seller', 'active',   false);
SELECT pg_temp.mk_deal('Ot',      'tenant', 'active',   true);

INSERT INTO opportunity_properties (agency_id, opportunity_id, property_id, relation, status)
VALUES (current_setting('test.a1')::uuid, pg_temp.id('Ob'), pg_temp.id('linked'), 'candidate', 'viewed');

-- ── match_properties ─────────────────────────────────────────────────────────

SELECT pg_temp.act_as('u1');

SELECT is(
  (SELECT array_agg(property_id) FROM match_properties(pg_temp.id('Ob'))),
  ARRAY[pg_temp.id('exact2'), pg_temp.id('exact'), pg_temp.id('unknown'), pg_temp.id('reserved')],
  'Buyer matches: score then newest listing, the unrecorded m² below the exact ones, reserved last (AC-1, AC-2, AC-3)'
);
SELECT results_eq(
  $$ SELECT score, link_status FROM match_properties(pg_temp.id('Ob')) $$,
  $$ VALUES (100, NULL::text), (100, NULL), (80, NULL), (100, NULL) $$,
  'Scores: exact 100, unrecorded m² 80, reserved 100 but last'
);
SELECT is(
  (SELECT listing_status FROM match_properties(pg_temp.id('Ob')) OFFSET 3),
  'reserved', 'The reserved listing carries its status'
);
SELECT is(
  (SELECT count(*)::int FROM match_properties(pg_temp.id('Ob'), true, 100)
   WHERE property_id IN (pg_temp.id('near'), pg_temp.id('elsewhere'), pg_temp.id('house'), pg_temp.id('closed'),
                         pg_temp.id('withdrawn'), pg_temp.id('archived'), pg_temp.id('rentonly'))),
  0, 'A close or missed must-have, a closed or withdrawn listing, an archived property and a rent-only property never appear (AC-3)'
);
SELECT results_eq(
  $$ SELECT total_count, unlinked_count FROM match_properties(pg_temp.id('Ob')) LIMIT 1 $$,
  $$ VALUES (4::bigint, 4::bigint) $$,
  'Counts without linked properties: 4 new matches'
);

SELECT is(
  (SELECT count(*)::int FROM match_properties(pg_temp.id('Ob'), true, 100)),
  5, 'With already offered shown there are five rows'
);
SELECT is(
  (SELECT link_status FROM match_properties(pg_temp.id('Ob'), true, 100) WHERE property_id = pg_temp.id('linked')),
  'viewed', 'A linked property comes back with its link status'
);
SELECT results_eq(
  $$ SELECT DISTINCT total_count, unlinked_count FROM match_properties(pg_temp.id('Ob'), true, 100) $$,
  $$ VALUES (5::bigint, 4::bigint) $$,
  'Counts with linked properties: 5 rows, 4 of them new'
);

SELECT is(
  (SELECT array_agg(property_id) FROM match_properties(pg_temp.id('Ob'), false, 2, 0)),
  ARRAY[pg_temp.id('exact2'), pg_temp.id('exact')], 'Paging: the first page of two'
);
SELECT is(
  (SELECT array_agg(property_id) FROM match_properties(pg_temp.id('Ob'), false, 2, 2)),
  ARRAY[pg_temp.id('unknown'), pg_temp.id('reserved')], 'Paging: the second page continues in the same order'
);
SELECT is(
  (SELECT total_count FROM match_properties(pg_temp.id('Ob'), false, 2, 2) LIMIT 1),
  4::bigint, 'Paging: every page carries the full total'
);
SELECT is(
  (SELECT count(*)::int FROM match_properties(pg_temp.id('Ob'), false, 2, 4)),
  0, 'A page past the end is empty'
);

SELECT is(
  (SELECT count(*)::int FROM match_properties(pg_temp.id('Onurture'))),
  5, 'A nurture deal matches; the property linked to another deal is new for it (rule 1)'
);
SELECT is((SELECT count(*)::int FROM match_properties(pg_temp.id('Owon'))), 0, 'A won deal has no matches (rule 8)');
SELECT is((SELECT count(*)::int FROM match_properties(pg_temp.id('Oarch'))), 0, 'An archived deal has no matches (rule 8)');
SELECT is((SELECT count(*)::int FROM match_properties(pg_temp.id('Onoreq'))), 0, 'A deal without a requirement has no matches');
SELECT is((SELECT count(*)::int FROM match_properties(pg_temp.id('Oseller'))), 0, 'A seller deal has no matches');
SELECT is(
  (SELECT array_agg(property_id) FROM match_properties(pg_temp.id('Ot'))),
  ARRAY[pg_temp.id('rentonly')], 'A tenant deal matches rent listings only (rule 1)'
);

-- ── match_opportunities ──────────────────────────────────────────────────────

SELECT is(
  (SELECT array_agg(opportunity_id ORDER BY opportunity_title) FROM match_opportunities(pg_temp.id('exact'))),
  ARRAY[pg_temp.id('Ob'), pg_temp.id('Onurture')],
  'Deals for a sale property: active and nurture buyers; not won, archived, seller, tenant or requirement-less (AC-5)'
);
SELECT is(
  (SELECT opportunity_status FROM match_opportunities(pg_temp.id('exact')) WHERE opportunity_id = pg_temp.id('Onurture')),
  'nurture', 'A nurture deal is marked as such'
);
SELECT is(
  (SELECT assigned_to FROM match_opportunities(pg_temp.id('exact')) WHERE opportunity_id = pg_temp.id('Ob')),
  pg_temp.id('u1'), 'The deal''s broker comes back'
);
SELECT is(
  (SELECT array_agg(opportunity_id) FROM match_opportunities(pg_temp.id('rentonly'))),
  ARRAY[pg_temp.id('Ot')], 'A rent property matches tenant deals'
);
SELECT is(
  (SELECT count(*)::int FROM match_opportunities(pg_temp.id('closed'))), 0, 'A closed listing matches no deal'
);
SELECT is(
  (SELECT count(*)::int FROM match_opportunities(pg_temp.id('archived'))), 0, 'An archived property matches no deal'
);

-- Linking a deal removes it from the new matches and brings it back with its status.
INSERT INTO opportunity_properties (agency_id, opportunity_id, property_id, relation, status, source)
VALUES (current_setting('test.a1')::uuid, pg_temp.id('Onurture'), pg_temp.id('exact'), 'candidate', 'candidate', 'match');

SELECT is(
  (SELECT array_agg(opportunity_id) FROM match_opportunities(pg_temp.id('exact'))),
  ARRAY[pg_temp.id('Ob')], 'A deal already linked to the property is not a new match'
);
SELECT results_eq(
  $$ SELECT total_count, unlinked_count FROM match_opportunities(pg_temp.id('exact'), true) LIMIT 1 $$,
  $$ VALUES (2::bigint, 1::bigint) $$,
  'Counts on the property side with linked deals shown'
);
SELECT is(
  (SELECT link_status FROM match_opportunities(pg_temp.id('exact'), true) WHERE opportunity_id = pg_temp.id('Onurture')),
  'candidate', 'A linked deal comes back with its link status'
);

-- AC-6: a price change is reflected at the next call.
UPDATE listings SET price = 230000 WHERE property_id = pg_temp.id('exact');

SELECT is(
  (SELECT count(*)::int FROM match_properties(pg_temp.id('Ob')) WHERE property_id = pg_temp.id('exact')),
  0, 'A price of €230,000 drops the property from a €150–200k must-have buyer (AC-6)'
);
SELECT is(
  (SELECT count(*)::int FROM match_opportunities(pg_temp.id('exact'), true)), 0,
  'And the buyer drops from the property''s deals'
);

-- ── Tenancy and privileges (AC-7) ────────────────────────────────────────────

SELECT pg_temp.act_as('u2');

SELECT is(
  (SELECT count(*)::int FROM match_properties(pg_temp.id('Ob'), true, 100)), 0,
  'A broker of another agency gets no properties for an Alpha deal'
);
SELECT is(
  (SELECT count(*)::int FROM match_opportunities(pg_temp.id('exact2'), true, 100)), 0,
  'A broker of another agency gets no deals for an Alpha property'
);

RESET ROLE;

SELECT ok(
  has_function_privilege('authenticated', 'match_properties(uuid, boolean, int, int)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'match_opportunities(uuid, boolean, int, int)', 'EXECUTE'),
  'authenticated can execute both lists'
);
SELECT ok(
  NOT has_function_privilege('anon', 'match_properties(uuid, boolean, int, int)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'match_opportunities(uuid, boolean, int, int)', 'EXECUTE'),
  'anon cannot execute either list'
);

SELECT * FROM finish();
ROLLBACK;
