-- spec: properties. Settlements (Task 1).
BEGIN;
SELECT plan(9);

SELECT set_config('test.a1', gen_random_uuid()::text, true);
SELECT set_config('test.u_owner', gen_random_uuid()::text, true);
SELECT set_config('test.u_manager', gen_random_uuid()::text, true);
SELECT set_config('test.u_broker', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES
  (current_setting('test.u_owner')::uuid, 'p-owner@example.com'),
  (current_setting('test.u_manager')::uuid, 'p-manager@example.com'),
  (current_setting('test.u_broker')::uuid, 'p-broker@example.com');

INSERT INTO agencies (id, name, slug) VALUES (current_setting('test.a1')::uuid, 'Agency P1', 'p1');

INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.u_owner')::uuid, 'owner', 'active'),
  (current_setting('test.a1')::uuid, current_setting('test.u_manager')::uuid, 'manager', 'active'),
  (current_setting('test.a1')::uuid, current_setting('test.u_broker')::uuid, 'broker', 'active');

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

SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u_broker')), true);
SET ROLE authenticated;

SELECT ok((SELECT count(*) FROM settlements) > 5000, 'A broker reads settlements');

SELECT throws_ok(
  $$ INSERT INTO settlements (ekatte, kind, name_bg, name_en, municipality_bg, municipality_en, province_bg, province_en)
     VALUES ('00000', 'city', 'Х', 'H', 'Х', 'H', 'Х', 'H') $$,
  '42501', NULL,
  'A broker cannot insert a settlement'
);

RESET ROLE;
SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u_owner')), true);
SET ROLE authenticated;

SELECT ok((SELECT count(*) FROM settlements) > 5000, 'An owner reads settlements');

SELECT throws_ok(
  $$ UPDATE settlements SET name_en = 'Hacked' WHERE ekatte = '68134' $$,
  '42501', NULL,
  'An owner cannot update a settlement'
);

RESET ROLE;
SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u_manager')), true);
SET ROLE authenticated;

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
SELECT * FROM finish();
ROLLBACK;
