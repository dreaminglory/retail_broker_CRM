-- spec: requirements, Task 1 (AD-059). Tables, constraints (rules 2–4), the buyer/tenant
-- guards (rule 1), composite foreign keys and RLS (rule 10, AC-7). Rows are inserted as the
-- table owner: members can't write either table (writes come through the Task 2 RPCs).
BEGIN;
SELECT plan(48);

-- ── Setup: agency A (broker) and agency B (broker) ───────────────────────────

SELECT set_config('test.a1', gen_random_uuid()::text, true);
SELECT set_config('test.a2', gen_random_uuid()::text, true);
SELECT set_config('test.u_broker', gen_random_uuid()::text, true);
SELECT set_config('test.u_b_broker', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES
  (current_setting('test.u_broker')::uuid, 'r-broker@example.com'),
  (current_setting('test.u_b_broker')::uuid, 'r-b-broker@example.com');

INSERT INTO agencies (id, name, slug) VALUES
  (current_setting('test.a1')::uuid, 'Agency R1', 'r1'),
  (current_setting('test.a2')::uuid, 'Agency R2', 'r2');

INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.u_broker')::uuid, 'broker', 'active'),
  (current_setting('test.a2')::uuid, current_setting('test.u_b_broker')::uuid, 'broker', 'active');

SELECT seed_agency_defaults(current_setting('test.a1')::uuid);
SELECT seed_agency_defaults(current_setting('test.a2')::uuid);

CREATE FUNCTION pg_temp.act_as(p_user TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    format('{"sub": "%s", "role": "authenticated"}', current_setting('test.' || p_user)), true);
  SET ROLE authenticated;
END;
$$;

SELECT set_config('test.sofia', (SELECT id FROM settlements WHERE ekatte = '68134')::text, true);
SELECT set_config('test.plovdiv', (SELECT id FROM settlements WHERE ekatte = '56784')::text, true);
SELECT set_config('test.area_lozenets', gen_random_uuid()::text, true);
SELECT set_config('test.area_plovdiv', gen_random_uuid()::text, true);
SELECT set_config('test.area_b', gen_random_uuid()::text, true);
SELECT set_config('test.opp_buyer', gen_random_uuid()::text, true);
SELECT set_config('test.opp_buyer2', gen_random_uuid()::text, true);
SELECT set_config('test.opp_tenant', gen_random_uuid()::text, true);
SELECT set_config('test.opp_seller', gen_random_uuid()::text, true);
SELECT set_config('test.opp_b', gen_random_uuid()::text, true);
SELECT set_config('test.req', gen_random_uuid()::text, true);
SELECT set_config('test.req_tenant', gen_random_uuid()::text, true);
SELECT set_config('test.req_b', gen_random_uuid()::text, true);

INSERT INTO areas (id, agency_id, settlement_id, name) VALUES
  (current_setting('test.area_lozenets')::uuid, current_setting('test.a1')::uuid, current_setting('test.sofia')::uuid, 'Лозенец'),
  (current_setting('test.area_plovdiv')::uuid, current_setting('test.a1')::uuid, current_setting('test.plovdiv')::uuid, 'Капана'),
  (current_setting('test.area_b')::uuid, current_setting('test.a2')::uuid, current_setting('test.sofia')::uuid, 'Лозенец');

INSERT INTO opportunities (id, agency_id, title, type, stage_id)
SELECT o.id, o.agency_id, o.title, o.type,
       (SELECT id FROM stages s WHERE s.agency_id = o.agency_id ORDER BY sort_order LIMIT 1)
FROM (VALUES
  (current_setting('test.opp_buyer')::uuid,  current_setting('test.a1')::uuid, 'Купувач',   'buyer'),
  (current_setting('test.opp_buyer2')::uuid, current_setting('test.a1')::uuid, 'Купувач 2', 'buyer'),
  (current_setting('test.opp_tenant')::uuid, current_setting('test.a1')::uuid, 'Наемател',  'tenant'),
  (current_setting('test.opp_seller')::uuid, current_setting('test.a1')::uuid, 'Продавач',  'seller'),
  (current_setting('test.opp_b')::uuid,      current_setting('test.a2')::uuid, 'Купувач Б', 'buyer')
) AS o(id, agency_id, title, type);

-- The message of a named CHECK on requirements, so a test fails if another CHECK refuses the row.
CREATE FUNCTION pg_temp.violates(p_constraint TEXT) RETURNS TEXT LANGUAGE sql AS $$
  SELECT format('new row for relation "requirements" violates check constraint "%s"', p_constraint);
$$;

-- Inserts a row for opp_buyer2 with the given columns; the row is rolled back by throws_ok.
CREATE FUNCTION pg_temp.try_insert(p_columns TEXT, p_values TEXT) RETURNS TEXT LANGUAGE sql AS $$
  SELECT format(
    'INSERT INTO requirements (agency_id, opportunity_id, %s) VALUES (%L, %L, %s)',
    p_columns, current_setting('test.a1'), current_setting('test.opp_buyer2'), p_values
  );
$$;

-- ── Rule 3: ranges and lists ─────────────────────────────────────────────────

SELECT throws_ok(pg_temp.try_insert('budget_min, budget_max', '200000, 150000'), '23514', pg_temp.violates('requirements_budget_range'),
  'budget_min > budget_max is refused');
SELECT throws_ok(pg_temp.try_insert('budget_max', '0'), '23514', NULL, 'A budget of 0 is refused');
SELECT throws_ok(pg_temp.try_insert('rooms_min', '0'), '23514', NULL, 'rooms_min 0 is refused');
SELECT throws_ok(pg_temp.try_insert('rooms_max', '10'), '23514', NULL, 'rooms_max 10 is refused');
SELECT throws_ok(pg_temp.try_insert('rooms_min, rooms_max', '3, 2'), '23514', pg_temp.violates('requirements_rooms_range'),
  'rooms_min > rooms_max is refused');
SELECT throws_ok(pg_temp.try_insert('area_m2_min', '0'), '23514', NULL, 'An area of 0 m² is refused');
SELECT throws_ok(pg_temp.try_insert('area_m2_min, area_m2_max', '90, 60'), '23514', pg_temp.violates('requirements_area_m2_range'),
  'area_m2_min > area_m2_max is refused');
SELECT throws_ok(pg_temp.try_insert('budget_max, floor_min', '100000, -6'), '23514', NULL,
  'A floor below -5 is refused');
SELECT throws_ok(pg_temp.try_insert('budget_max, floor_min, floor_max', '100000, 5, 2'), '23514', pg_temp.violates('requirements_floor_range'),
  'floor_min > floor_max is refused');
SELECT throws_ok(pg_temp.try_insert('property_types', $$'{apartment,castle}'$$), '23514', NULL,
  'A property type outside the property list is refused');
SELECT throws_ok(pg_temp.try_insert('budget_max, construction', $$100000, '{brick,straw}'$$), '23514', NULL,
  'A construction outside the property list is refused');
SELECT throws_ok(pg_temp.try_insert('budget_max, financing', $$100000, 'loan'$$), '23514', NULL,
  'An unknown financing value is refused');
SELECT throws_ok(pg_temp.try_insert('budget_max, wishes', $$100000, repeat('x', 2001)$$), '23514', NULL,
  'Wishes over 2,000 characters are refused');

-- ── Rule 2: at least one criterion ───────────────────────────────────────────

SELECT throws_ok(pg_temp.try_insert('financing, wishes', $$'mortgage', 'паркомясто'$$), '23514', pg_temp.violates('requirements_has_criterion'),
  'Financing and wishes alone are refused (AC-4)');
SELECT throws_ok(pg_temp.try_insert('floor_min, construction', $$2, '{brick}'$$), '23514', pg_temp.violates('requirements_has_criterion'),
  'Floor and construction alone are refused');

-- ── Rule 4: a must-have flag needs its criterion (AC-5) ──────────────────────

SELECT throws_ok(pg_temp.try_insert('rooms_min, budget_must', '2, true'), '23514', pg_temp.violates('requirements_must_has_criterion'),
  'budget_must without a budget is refused');
SELECT throws_ok(pg_temp.try_insert('rooms_min, location_must', '2, true'), '23514', pg_temp.violates('requirements_must_has_criterion'),
  'location_must without a location is refused');
SELECT throws_ok(pg_temp.try_insert('rooms_min, type_must', '2, true'), '23514', pg_temp.violates('requirements_must_has_criterion'),
  'type_must without a type is refused');
SELECT throws_ok(pg_temp.try_insert('budget_max, rooms_must', '100000, true'), '23514', pg_temp.violates('requirements_must_has_criterion'),
  'rooms_must without rooms is refused');
SELECT throws_ok(pg_temp.try_insert('budget_max, area_m2_must', '100000, true'), '23514', pg_temp.violates('requirements_must_has_criterion'),
  'area_m2_must without m² is refused');
SELECT throws_ok(pg_temp.try_insert('budget_max, floor_must', '100000, true'), '23514', pg_temp.violates('requirements_must_has_criterion'),
  'floor_must without a floor is refused');
SELECT throws_ok(pg_temp.try_insert('budget_max, construction_must', '100000, true'), '23514', pg_temp.violates('requirements_must_has_criterion'),
  'construction_must without a construction is refused');

SELECT lives_ok(
  format($$ INSERT INTO requirements (id, agency_id, opportunity_id, location_keys, location_must, not_top_floor, floor_must)
            VALUES (%L, %L, %L, ARRAY[%L || ':' || %L], true, true, true) $$,
         current_setting('test.req'), current_setting('test.a1'), current_setting('test.opp_buyer'),
         current_setting('test.sofia'), current_setting('test.area_lozenets')),
  'A location alone is a criterion, with location_must; not_top_floor carries floor_must'
);

-- ── Rule 1: buyer and tenant deals, one each (AC-3) ──────────────────────────

SELECT throws_ok(
  format($$ INSERT INTO requirements (agency_id, opportunity_id, budget_max) VALUES (%L, %L, 100000) $$,
         current_setting('test.a1'), current_setting('test.opp_seller')),
  'P0001', 'requirements.errors.wrongOpportunityType',
  'A seller deal cannot get a requirement'
);

SELECT throws_ok(
  format($$ INSERT INTO requirements (agency_id, opportunity_id, budget_max) VALUES (%L, %L, 100000) $$,
         current_setting('test.a1'), current_setting('test.opp_buyer')),
  '23505', NULL,
  'A second requirement on one deal is refused'
);

SELECT lives_ok(
  format($$ INSERT INTO requirements (id, agency_id, opportunity_id, budget_max, budget_must) VALUES (%L, %L, %L, 900, true) $$,
         current_setting('test.req_tenant'), current_setting('test.a1'), current_setting('test.opp_tenant')),
  'A tenant deal gets a requirement'
);

SELECT throws_ok(
  format($$ UPDATE opportunities SET type = 'seller' WHERE id = %L $$, current_setting('test.opp_buyer')),
  'P0001', 'opportunities.errors.typeHasRequirement',
  'A buyer deal with a requirement cannot change to seller'
);

SELECT throws_ok(
  format($$ UPDATE opportunities SET type = 'landlord' WHERE id = %L $$, current_setting('test.opp_tenant')),
  'P0001', 'opportunities.errors.typeHasRequirement',
  'A tenant deal with a requirement cannot change to landlord'
);

SELECT lives_ok(
  format($$ UPDATE opportunities SET type = 'tenant' WHERE id = %L $$, current_setting('test.opp_buyer')),
  'Buyer → tenant keeps the requirement'
);

SELECT is(
  (SELECT count(*)::int FROM requirements WHERE opportunity_id = current_setting('test.opp_buyer')::uuid), 1,
  'The requirement is still there after buyer → tenant'
);

SELECT lives_ok(
  format($$ UPDATE opportunities SET type = 'seller' WHERE id = %L $$, current_setting('test.opp_buyer2')),
  'A buyer deal without a requirement can still change to seller'
);

-- ── Locations: area in settlement, own agency (AC-4, AC-7) ───────────────────

INSERT INTO requirements (id, agency_id, opportunity_id, budget_max)
VALUES (current_setting('test.req_b')::uuid, current_setting('test.a2')::uuid, current_setting('test.opp_b')::uuid, 150000);

SELECT lives_ok(
  format($$ INSERT INTO requirement_locations (agency_id, requirement_id, settlement_id, area_id) VALUES (%L, %L, %L, %L) $$,
         current_setting('test.a1'), current_setting('test.req'), current_setting('test.sofia'), current_setting('test.area_lozenets')),
  'An area of the requirement''s settlement is accepted'
);

SELECT lives_ok(
  format($$ INSERT INTO requirement_locations (agency_id, requirement_id, settlement_id) VALUES (%L, %L, %L) $$,
         current_setting('test.a1'), current_setting('test.req'), current_setting('test.plovdiv')),
  'A whole settlement is accepted'
);

SELECT throws_ok(
  format($$ INSERT INTO requirement_locations (agency_id, requirement_id, settlement_id) VALUES (%L, %L, %L) $$,
         current_setting('test.a1'), current_setting('test.req'), current_setting('test.plovdiv')),
  '23505', NULL,
  'The same whole settlement twice is refused (NULLs not distinct)'
);

SELECT throws_ok(
  format($$ INSERT INTO requirement_locations (agency_id, requirement_id, settlement_id, area_id) VALUES (%L, %L, %L, %L) $$,
         current_setting('test.a1'), current_setting('test.req'), current_setting('test.sofia'), current_setting('test.area_plovdiv')),
  '23503', NULL,
  'An area of Plovdiv under Sofia is refused'
);

SELECT throws_ok(
  format($$ INSERT INTO requirement_locations (agency_id, requirement_id, settlement_id, area_id) VALUES (%L, %L, %L, %L) $$,
         current_setting('test.a2'), current_setting('test.req_b'), current_setting('test.sofia'), current_setting('test.area_lozenets')),
  '23503', NULL,
  'An area of agency A on a requirement of agency B is refused'
);

SELECT throws_ok(
  format($$ INSERT INTO requirement_locations (agency_id, requirement_id, settlement_id) VALUES (%L, %L, %L) $$,
         current_setting('test.a2'), current_setting('test.req'), current_setting('test.sofia')),
  '23503', NULL,
  'A location of agency B cannot point at agency A''s requirement'
);

SELECT throws_ok(
  format($$ INSERT INTO requirements (agency_id, opportunity_id, budget_max) VALUES (%L, %L, 100000) $$,
         current_setting('test.a2'), current_setting('test.opp_buyer2')),
  '23503', NULL,
  'A requirement of agency B cannot point at agency A''s opportunity'
);

SELECT throws_ok(
  format($$ DELETE FROM areas WHERE id = %L $$, current_setting('test.area_lozenets')),
  '23503', NULL,
  'An area a requirement uses cannot be deleted'
);

-- ── RLS: own agency only, no direct writes (AC-7) ────────────────────────────

SELECT pg_temp.act_as('u_b_broker');

SELECT is((SELECT count(*)::int FROM requirements WHERE agency_id = current_setting('test.a1')::uuid), 0,
  'B''s broker sees none of A''s requirements');
SELECT is((SELECT count(*)::int FROM requirement_locations), 0,
  'B''s broker sees none of A''s requirement locations');
SELECT is((SELECT count(*)::int FROM requirements), 1, 'B''s broker sees B''s requirement');

SELECT pg_temp.act_as('u_broker');

SELECT is((SELECT count(*)::int FROM requirements), 2, 'A''s broker sees A''s two requirements');
SELECT is((SELECT count(*)::int FROM requirement_locations), 2, 'A''s broker sees A''s two locations');

SELECT throws_ok(
  format($$ INSERT INTO requirements (agency_id, opportunity_id, budget_max) VALUES (%L, %L, 100000) $$,
         current_setting('test.a1'), current_setting('test.opp_buyer2')),
  '42501', NULL,
  'A member cannot insert a requirement directly'
);

SELECT throws_ok(
  $$ UPDATE requirements SET budget_max = 1 $$,
  '42501', NULL,
  'A member cannot update a requirement directly'
);

SELECT throws_ok(
  $$ DELETE FROM requirement_locations $$,
  '42501', NULL,
  'A member cannot delete requirement locations directly'
);

RESET ROLE;
SET ROLE anon;
SELECT throws_ok($$ SELECT count(*) FROM requirements $$, '42501', NULL, 'anon cannot read requirements');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
