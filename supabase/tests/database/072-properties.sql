-- spec: properties. Settlements (Task 1); tables, RLS and constraints (Task 2).
BEGIN;
SELECT plan(40);

-- ── Setup: agency A (owner, manager, broker) and agency B (broker) ───────────

SELECT set_config('test.a1', gen_random_uuid()::text, true);
SELECT set_config('test.a2', gen_random_uuid()::text, true);
SELECT set_config('test.u_owner', gen_random_uuid()::text, true);
SELECT set_config('test.u_manager', gen_random_uuid()::text, true);
SELECT set_config('test.u_broker', gen_random_uuid()::text, true);
SELECT set_config('test.u_b_broker', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES
  (current_setting('test.u_owner')::uuid, 'p-owner@example.com'),
  (current_setting('test.u_manager')::uuid, 'p-manager@example.com'),
  (current_setting('test.u_broker')::uuid, 'p-broker@example.com'),
  (current_setting('test.u_b_broker')::uuid, 'p-b-broker@example.com');

INSERT INTO agencies (id, name, slug) VALUES
  (current_setting('test.a1')::uuid, 'Agency P1', 'p1'),
  (current_setting('test.a2')::uuid, 'Agency P2', 'p2');

INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.u_owner')::uuid, 'owner', 'active'),
  (current_setting('test.a1')::uuid, current_setting('test.u_manager')::uuid, 'manager', 'active'),
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

-- ── Settlements: data ───────────────────────────────────────────────────────

SELECT ok(
  (SELECT count(*) FROM settlements) BETWEEN 5200 AND 5300,
  'About 5,250 settlements are loaded'
);

SELECT results_eq(
  $$ SELECT name_bg, name_en, kind FROM settlements WHERE ekatte IN ('68134', '56784', '10135') ORDER BY ekatte $$,
  $$ VALUES ('Варна', 'Varna', 'city'), ('Пловдив', 'Plovdiv', 'city'), ('София', 'Sofia', 'city') $$,
  'София, Пловдив and Варна have their English names'
);

SELECT ok(
  EXISTS (SELECT 1 FROM settlements WHERE kind = 'village' AND ekatte = '84067' AND name_bg = 'Щърково' AND name_en = 'Shtarkovo'),
  'A village is present with its transliterated name'
);

-- ── Settlements: every role reads, nobody writes ────────────────────────────

SELECT pg_temp.act_as('u_broker');

SELECT ok((SELECT count(*) FROM settlements) > 5000, 'A broker reads settlements');

SELECT throws_ok(
  $$ INSERT INTO settlements (ekatte, kind, name_bg, name_en, municipality_bg, municipality_en, province_bg, province_en)
     VALUES ('00000', 'city', 'Х', 'H', 'Х', 'H', 'Х', 'H') $$,
  '42501', NULL,
  'A broker cannot insert a settlement'
);

SELECT pg_temp.act_as('u_owner');

SELECT ok((SELECT count(*) FROM settlements) > 5000, 'An owner reads settlements');

SELECT throws_ok(
  $$ UPDATE settlements SET name_en = 'Hacked' WHERE ekatte = '68134' $$,
  '42501', NULL,
  'An owner cannot update a settlement'
);

SELECT pg_temp.act_as('u_manager');

SELECT throws_ok(
  $$ DELETE FROM settlements WHERE ekatte = '68134' $$,
  '42501', NULL,
  'A manager cannot delete a settlement'
);

RESET ROLE;
SET ROLE anon;
SELECT throws_ok(
  $$ SELECT count(*) FROM settlements $$,
  '42501', NULL,
  'anon cannot read settlements'
);
RESET ROLE;

-- ── Fixtures for agency A (as postgres) ─────────────────────────────────────

SELECT set_config('test.sofia', (SELECT id FROM settlements WHERE ekatte = '68134')::text, true);
SELECT set_config('test.plovdiv', (SELECT id FROM settlements WHERE ekatte = '56784')::text, true);
SELECT set_config('test.area_lozenets', gen_random_uuid()::text, true);
SELECT set_config('test.area_b', gen_random_uuid()::text, true);
SELECT set_config('test.prop', gen_random_uuid()::text, true);
SELECT set_config('test.prop2', gen_random_uuid()::text, true);
SELECT set_config('test.listing', gen_random_uuid()::text, true);
SELECT set_config('test.contact', gen_random_uuid()::text, true);
SELECT set_config('test.contact2', gen_random_uuid()::text, true);
SELECT set_config('test.opp', gen_random_uuid()::text, true);

INSERT INTO areas (id, agency_id, settlement_id, name) VALUES
  (current_setting('test.area_lozenets')::uuid, current_setting('test.a1')::uuid, current_setting('test.sofia')::uuid, 'Лозенец'),
  (current_setting('test.area_b')::uuid, current_setting('test.a2')::uuid, current_setting('test.sofia')::uuid, 'Лозенец');

INSERT INTO properties (id, agency_id, code, type, rooms, area_m2, settlement_id, area_id) VALUES
  (current_setting('test.prop')::uuid, current_setting('test.a1')::uuid, 1001, 'apartment', 2, 68,
   current_setting('test.sofia')::uuid, current_setting('test.area_lozenets')::uuid),
  (current_setting('test.prop2')::uuid, current_setting('test.a1')::uuid, 1002, 'house', NULL, 140,
   current_setting('test.plovdiv')::uuid, NULL);

INSERT INTO listings (id, agency_id, property_id, offer_type, price) VALUES
  (current_setting('test.listing')::uuid, current_setting('test.a1')::uuid, current_setting('test.prop')::uuid, 'sale', 185000);

INSERT INTO contacts (id, agency_id, type, first_name, display_name) VALUES
  (current_setting('test.contact')::uuid, current_setting('test.a1')::uuid, 'person', 'Иван', 'Иван'),
  (current_setting('test.contact2')::uuid, current_setting('test.a1')::uuid, 'person', 'Иван Дубликат', 'Иван Дубликат');

INSERT INTO property_parties (agency_id, property_id, contact_id, role) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.prop')::uuid, current_setting('test.contact')::uuid, 'owner');

INSERT INTO opportunities (id, agency_id, title, type, stage_id) VALUES
  (current_setting('test.opp')::uuid, current_setting('test.a1')::uuid, 'Купувач', 'buyer',
   (SELECT id FROM stages WHERE agency_id = current_setting('test.a1')::uuid ORDER BY sort_order LIMIT 1));

INSERT INTO opportunity_properties (agency_id, opportunity_id, property_id, relation, status) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.opp')::uuid, current_setting('test.prop')::uuid, 'candidate', 'selected');

-- ── Tenant isolation (AC-6) ─────────────────────────────────────────────────

SELECT pg_temp.act_as('u_b_broker');

SELECT is((SELECT count(*)::int FROM areas WHERE agency_id = current_setting('test.a1')::uuid), 0,
  'B''s broker sees none of A''s areas');
SELECT is((SELECT count(*)::int FROM properties), 0, 'B''s broker sees none of A''s properties');
SELECT is((SELECT count(*)::int FROM listings), 0, 'B''s broker sees none of A''s listings');
SELECT is((SELECT count(*)::int FROM property_parties), 0, 'B''s broker sees none of A''s parties');
SELECT is((SELECT count(*)::int FROM opportunity_properties), 0, 'B''s broker sees none of A''s links');

SELECT throws_ok(
  format($$ INSERT INTO properties (agency_id, code, type, settlement_id) VALUES ('%s', 9001, 'garage', '%s') $$,
    current_setting('test.a1'), current_setting('test.sofia')),
  '42501', NULL,
  'B''s broker cannot insert a property into A'
);

SELECT is_empty(
  $$ UPDATE properties SET description = 'hacked' WHERE id = current_setting('test.prop')::uuid RETURNING id $$,
  'B''s broker cannot update A''s property'
);

SELECT is_empty(
  $$ UPDATE listings SET price = 1 WHERE id = current_setting('test.listing')::uuid RETURNING id $$,
  'B''s broker cannot update A''s listing'
);

-- A guessed id of another agency's row is refused by the composite foreign keys.
SELECT throws_ok(
  format($$ INSERT INTO listings (agency_id, property_id, offer_type, price) VALUES ('%s', '%s', 'rent', 500) $$,
    current_setting('test.a2'), current_setting('test.prop')),
  '23503', NULL,
  'B''s broker cannot add a listing to A''s property by id'
);

SELECT throws_ok(
  format($$ INSERT INTO notes (agency_id, property_id, content) VALUES ('%s', '%s', 'x') $$,
    current_setting('test.a2'), current_setting('test.prop')),
  '23503', NULL,
  'B''s broker cannot add a note to A''s property by id'
);

-- ── Roles: a broker can't delete or configure areas; a manager can ──────────

SELECT pg_temp.act_as('u_broker');

SELECT is((SELECT count(*)::int FROM properties), 2, 'A''s broker sees A''s properties');

SELECT throws_ok(
  format($$ INSERT INTO areas (agency_id, settlement_id, name) VALUES ('%s', '%s', 'Център') $$,
    current_setting('test.a1'), current_setting('test.sofia')),
  '42501', NULL,
  'A broker cannot add an area'
);

SELECT is_empty($$ DELETE FROM listings RETURNING id $$, 'A broker cannot delete a listing');
SELECT is_empty($$ DELETE FROM properties WHERE id = current_setting('test.prop2')::uuid RETURNING id $$,
  'A broker cannot delete a property');
SELECT is_empty($$ DELETE FROM areas RETURNING id $$, 'A broker cannot delete an area');

SELECT lives_ok(
  format($$ INSERT INTO properties (agency_id, code, type, settlement_id) VALUES ('%s', 1003, 'garage', '%s') $$,
    current_setting('test.a1'), current_setting('test.sofia')),
  'A broker can add a property'
);

SELECT pg_temp.act_as('u_manager');

SELECT isnt_empty($$ DELETE FROM properties WHERE id = current_setting('test.prop2')::uuid RETURNING id $$,
  'A manager can delete an unlinked property');

SELECT throws_ok(
  $$ DELETE FROM properties WHERE id = current_setting('test.prop')::uuid $$,
  '23503', NULL,
  'A linked property cannot be deleted'
);

SELECT lives_ok(
  format($$ INSERT INTO areas (agency_id, settlement_id, name) VALUES ('%s', '%s', 'Център') $$,
    current_setting('test.a1'), current_setting('test.sofia')),
  'A manager can add an area'
);

SELECT throws_ok(
  format($$ INSERT INTO areas (agency_id, settlement_id, name) VALUES ('%s', '%s', 'лозенец') $$,
    current_setting('test.a1'), current_setting('test.sofia')),
  '23505', NULL,
  'An area name is unique per settlement, ignoring case'
);

-- ── Rule 3 and listing constraints ──────────────────────────────────────────

SELECT pg_temp.act_as('u_broker');

SELECT throws_ok(
  format($$ INSERT INTO properties (agency_id, code, type, settlement_id) VALUES ('%s', 1010, 'apartment', '%s') $$,
    current_setting('test.a1'), current_setting('test.sofia')),
  '23514', NULL,
  'An apartment needs rooms'
);

SELECT throws_ok(
  format($$ INSERT INTO properties (agency_id, code, type, plot_m2, floor, settlement_id) VALUES ('%s', 1011, 'plot', 500, 2, '%s') $$,
    current_setting('test.a1'), current_setting('test.sofia')),
  '23514', NULL,
  'A plot has no floor'
);

SELECT throws_ok(
  format($$ INSERT INTO properties (agency_id, code, type, rooms, floor, floors_total, settlement_id) VALUES ('%s', 1012, 'apartment', 2, 9, 8, '%s') $$,
    current_setting('test.a1'), current_setting('test.sofia')),
  '23514', NULL,
  'The floor cannot be above the top floor'
);

SELECT throws_ok(
  format($$ INSERT INTO listings (agency_id, property_id, offer_type, price) VALUES ('%s', '%s', 'rent', 0) $$,
    current_setting('test.a1'), current_setting('test.prop')),
  '23514', NULL,
  'A price must be above zero'
);

SELECT throws_ok(
  format($$ INSERT INTO listings (agency_id, property_id, offer_type, price) VALUES ('%s', '%s', 'sale', 179000) $$,
    current_setting('test.a1'), current_setting('test.prop')),
  '23505', NULL,
  'A second open sale listing is refused'
);

SELECT lives_ok(
  format($$ INSERT INTO listings (agency_id, property_id, offer_type, price) VALUES ('%s', '%s', 'rent', 900) $$,
    current_setting('test.a1'), current_setting('test.prop')),
  'An open sale and an open rent listing can coexist'
);

-- ── Links and areas ─────────────────────────────────────────────────────────

SELECT throws_ok(
  format($$ INSERT INTO opportunity_properties (agency_id, opportunity_id, property_id, relation, status)
            SELECT '%s', '%s', id, 'candidate', 'selected' FROM properties WHERE code = 1003 $$,
    current_setting('test.a1'), current_setting('test.opp')),
  '23505', NULL,
  'A second selected link on one opportunity is refused'
);

SELECT throws_ok(
  format($$ INSERT INTO properties (agency_id, code, type, settlement_id, area_id) VALUES ('%s', 1013, 'garage', '%s', '%s') $$,
    current_setting('test.a1'), current_setting('test.plovdiv'), current_setting('test.area_lozenets')),
  '23503', NULL,
  'An area from another settlement is refused'
);

SELECT throws_ok(
  format($$ INSERT INTO properties (agency_id, code, type, settlement_id, area_id) VALUES ('%s', 1014, 'garage', '%s', '%s') $$,
    current_setting('test.a1'), current_setting('test.sofia'), current_setting('test.area_b')),
  '23503', NULL,
  'An area of another agency is refused'
);

SELECT lives_ok(
  format($$ INSERT INTO notes (agency_id, property_id, content) VALUES ('%s', '%s', 'Огледан от входа') $$,
    current_setting('test.a1'), current_setting('test.prop')),
  'A note can have a property as its only parent'
);

-- ── Merge moves property parties (C4) ───────────────────────────────────────

RESET ROLE;
INSERT INTO property_parties (agency_id, property_id, contact_id, role) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.prop')::uuid, current_setting('test.contact2')::uuid, 'co_owner');

SELECT pg_temp.act_as('u_manager');
SELECT merge_contacts(current_setting('test.a1')::uuid, current_setting('test.contact')::uuid, current_setting('test.contact2')::uuid);

SELECT results_eq(
  $$ SELECT role, ended_at IS NULL FROM property_parties
     WHERE contact_id = current_setting('test.contact')::uuid ORDER BY role DESC $$,
  $$ VALUES ('owner', true), ('co_owner', false) $$,
  'A merge moves the loser''s parties to the winner and ends the overlapping open one'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
