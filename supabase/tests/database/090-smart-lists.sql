-- spec: smart-lists, Task 1 (AD-062). RLS on smart_lists: a personal list belongs to its creator
-- only (a manager can't read or change it), only owners and managers can share, a shared list is
-- visible to the agency and changed by owners and managers only, Beta never sees Alpha. Also the
-- unique name per member, the 50-per-member cap and the immutable columns.
BEGIN;
SELECT plan(32);

-- ── Setup ────────────────────────────────────────────────────────────────────

SELECT set_config('test.a1', gen_random_uuid()::text, true);
SELECT set_config('test.a2', gen_random_uuid()::text, true);
SELECT set_config('test.u_owner', gen_random_uuid()::text, true);
SELECT set_config('test.u_manager', gen_random_uuid()::text, true);
SELECT set_config('test.u_broker', gen_random_uuid()::text, true);
SELECT set_config('test.u_broker2', gen_random_uuid()::text, true);
SELECT set_config('test.u_b_broker', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES
  (current_setting('test.u_owner')::uuid, 'sl-owner@example.com'),
  (current_setting('test.u_manager')::uuid, 'sl-manager@example.com'),
  (current_setting('test.u_broker')::uuid, 'sl-broker@example.com'),
  (current_setting('test.u_broker2')::uuid, 'sl-broker2@example.com'),
  (current_setting('test.u_b_broker')::uuid, 'sl-b-broker@example.com');

INSERT INTO agencies (id, name, slug) VALUES
  (current_setting('test.a1')::uuid, 'Agency SL1', 'sl1'),
  (current_setting('test.a2')::uuid, 'Agency SL2', 'sl2');

INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.u_owner')::uuid, 'owner', 'active'),
  (current_setting('test.a1')::uuid, current_setting('test.u_manager')::uuid, 'manager', 'active'),
  (current_setting('test.a1')::uuid, current_setting('test.u_broker')::uuid, 'broker', 'active'),
  (current_setting('test.a1')::uuid, current_setting('test.u_broker2')::uuid, 'broker', 'active'),
  (current_setting('test.a2')::uuid, current_setting('test.u_b_broker')::uuid, 'broker', 'active');

CREATE FUNCTION pg_temp.act_as(p_user TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    format('{"sub": "%s", "role": "authenticated"}', current_setting('test.' || p_user)), true);
  SET ROLE authenticated;
END;
$$;

CREATE FUNCTION pg_temp.affected(p_sql TEXT) RETURNS int LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

SELECT set_config('test.l_broker', gen_random_uuid()::text, true);
SELECT set_config('test.l_broker2', gen_random_uuid()::text, true);
SELECT set_config('test.l_manager', gen_random_uuid()::text, true);
SELECT set_config('test.l_shared', gen_random_uuid()::text, true);

-- ── Insert ───────────────────────────────────────────────────────────────────

SELECT pg_temp.act_as('u_broker');
SELECT lives_ok(
  $$ INSERT INTO smart_lists (id, agency_id, created_by, name, entity, filter)
     VALUES (current_setting('test.l_broker')::uuid, current_setting('test.a1')::uuid,
             current_setting('test.u_broker')::uuid, 'Моите топли', 'opportunity', '{"temperature":["hot"]}') $$,
  'a broker inserts a personal list');

SELECT throws_ok(
  $$ INSERT INTO smart_lists (agency_id, created_by, name, entity, filter, shared)
     VALUES (current_setting('test.a1')::uuid, current_setting('test.u_broker')::uuid,
             'Споделен', 'opportunity', '{}', true) $$,
  '42501', NULL, 'a broker cannot insert a shared list');

SELECT throws_ok(
  $$ INSERT INTO smart_lists (agency_id, created_by, name, entity, filter)
     VALUES (current_setting('test.a1')::uuid, current_setting('test.u_broker2')::uuid,
             'Чужд', 'opportunity', '{}') $$,
  '42501', NULL, 'a broker cannot insert a list in someone else''s name');

SELECT throws_ok(
  $$ INSERT INTO smart_lists (agency_id, created_by, name, entity, filter)
     VALUES (current_setting('test.a2')::uuid, current_setting('test.u_broker')::uuid,
             'Друга агенция', 'opportunity', '{}') $$,
  '42501', NULL, 'a broker cannot insert a list into another agency');

SELECT throws_ok(
  $$ UPDATE smart_lists SET shared = true WHERE id = current_setting('test.l_broker')::uuid $$,
  '42501', NULL, 'a broker cannot share a list by updating it');

SELECT pg_temp.act_as('u_broker2');
SELECT lives_ok(
  $$ INSERT INTO smart_lists (id, agency_id, created_by, name, entity, filter)
     VALUES (current_setting('test.l_broker2')::uuid, current_setting('test.a1')::uuid,
             current_setting('test.u_broker2')::uuid, 'Моите топли', 'inquiry', '{"status":["new"]}') $$,
  'another broker may use the same name (unique per member)');

SELECT pg_temp.act_as('u_manager');
SELECT lives_ok(
  $$ INSERT INTO smart_lists (id, agency_id, created_by, name, entity, filter)
     VALUES (current_setting('test.l_manager')::uuid, current_setting('test.a1')::uuid,
             current_setting('test.u_manager')::uuid, 'Личен на мениджъра', 'opportunity', '{}') $$,
  'a manager inserts a personal list');

SELECT lives_ok(
  $$ INSERT INTO smart_lists (agency_id, created_by, name, entity, filter, shared)
     VALUES (current_setting('test.a1')::uuid, current_setting('test.u_manager')::uuid,
             'Споделен от мениджъра', 'opportunity', '{}', true) $$,
  'a manager inserts a shared list');

SELECT pg_temp.act_as('u_owner');
SELECT lives_ok(
  $$ INSERT INTO smart_lists (id, agency_id, created_by, name, entity, filter, shared)
     VALUES (current_setting('test.l_shared')::uuid, current_setting('test.a1')::uuid,
             current_setting('test.u_owner')::uuid, 'Споделен от собственика', 'opportunity', '{}', true) $$,
  'an owner inserts a shared list');

-- ── Select ───────────────────────────────────────────────────────────────────

SELECT pg_temp.act_as('u_broker');
SELECT is((SELECT count(*)::int FROM smart_lists), 3,
  'a broker sees own personal + the two shared lists');
SELECT is((SELECT count(*)::int FROM smart_lists WHERE id = current_setting('test.l_broker2')::uuid), 0,
  'a broker does not see another broker''s personal list');
SELECT is((SELECT count(*)::int FROM smart_lists WHERE id = current_setting('test.l_manager')::uuid), 0,
  'a broker does not see a manager''s personal list');

SELECT pg_temp.act_as('u_manager');
SELECT is((SELECT count(*)::int FROM smart_lists WHERE id IN
  (current_setting('test.l_broker')::uuid, current_setting('test.l_broker2')::uuid)), 0,
  'a manager cannot select a broker''s personal list');
SELECT is((SELECT count(*)::int FROM smart_lists), 3,
  'a manager sees own personal + the two shared lists');

-- ── Update and delete ────────────────────────────────────────────────────────

SELECT is(
  pg_temp.affected($$ UPDATE smart_lists SET name = 'Hijacked' WHERE id = current_setting('test.l_broker')::uuid $$), 0,
  'a manager cannot update a broker''s personal list');
SELECT is(
  pg_temp.affected($$ DELETE FROM smart_lists WHERE id = current_setting('test.l_broker')::uuid $$), 0,
  'a manager cannot delete a broker''s personal list');

SELECT pg_temp.act_as('u_broker');
SELECT is(
  pg_temp.affected($$ UPDATE smart_lists SET name = 'Hijacked' WHERE id = current_setting('test.l_shared')::uuid $$), 0,
  'a broker cannot update a shared list');
SELECT is(
  pg_temp.affected($$ DELETE FROM smart_lists WHERE id = current_setting('test.l_shared')::uuid $$), 0,
  'a broker cannot delete a shared list');
SELECT lives_ok(
  $$ UPDATE smart_lists SET name = 'Warm' WHERE id = current_setting('test.l_broker')::uuid $$,
  'a broker renames own personal list');

SELECT pg_temp.act_as('u_manager');
SELECT is(
  pg_temp.affected($$ UPDATE smart_lists SET name = 'Преименуван от мениджър' WHERE id = current_setting('test.l_shared')::uuid $$), 1,
  'a manager updates a shared list made by the owner');
-- Unsharing hands the list back to its creator, who is the only one who can still see it, so
-- only the creator can do it (the new row must pass the SELECT policy). Others delete instead.
SELECT throws_ok(
  $$ UPDATE smart_lists SET shared = false WHERE id = current_setting('test.l_shared')::uuid $$,
  '42501', NULL, 'a manager cannot unshare a list the owner made');

SELECT pg_temp.act_as('u_owner');
SELECT lives_ok(
  $$ UPDATE smart_lists SET shared = false WHERE id = current_setting('test.l_shared')::uuid $$,
  'the creator unshares it');
SELECT is((SELECT count(*)::int FROM smart_lists WHERE id = current_setting('test.l_shared')::uuid), 1,
  'the unshared list is back with its creator');

SELECT pg_temp.act_as('u_manager');
SELECT is((SELECT count(*)::int FROM smart_lists WHERE id = current_setting('test.l_shared')::uuid), 0,
  'and a manager no longer sees it');

-- ── Columns that never change ────────────────────────────────────────────────

SELECT pg_temp.act_as('u_broker');
SELECT throws_ok(
  $$ UPDATE smart_lists SET created_by = current_setting('test.u_broker2')::uuid
     WHERE id = current_setting('test.l_broker')::uuid $$,
  'P0001', 'smartLists.errors.immutable', 'created_by cannot change');
SELECT throws_ok(
  $$ UPDATE smart_lists SET entity = 'inquiry' WHERE id = current_setting('test.l_broker')::uuid $$,
  'P0001', 'smartLists.errors.immutable', 'entity cannot change');

-- ── Names, entity, cap ───────────────────────────────────────────────────────

SELECT throws_ok(
  $$ INSERT INTO smart_lists (agency_id, created_by, name, entity, filter)
     VALUES (current_setting('test.a1')::uuid, current_setting('test.u_broker')::uuid,
             'WARM', 'opportunity', '{}') $$,
  '23505', NULL, 'the same name in another case fails for the same member');

SELECT throws_ok(
  $$ INSERT INTO smart_lists (agency_id, created_by, name, entity, filter)
     VALUES (current_setting('test.a1')::uuid, current_setting('test.u_broker')::uuid,
             'Контакти', 'contact', '{}') $$,
  '23514', NULL, 'an entity outside opportunity and inquiry fails');

INSERT INTO smart_lists (agency_id, created_by, name, entity, filter)
SELECT current_setting('test.a1')::uuid, current_setting('test.u_broker')::uuid,
       'Списък ' || n, 'opportunity', '{}'
FROM generate_series(1, 49) AS n;

SELECT is((SELECT count(*)::int FROM smart_lists WHERE created_by = current_setting('test.u_broker')::uuid), 50,
  'a member can hold 50 lists');
SELECT throws_ok(
  $$ INSERT INTO smart_lists (agency_id, created_by, name, entity, filter)
     VALUES (current_setting('test.a1')::uuid, current_setting('test.u_broker')::uuid,
             'Петдесет и първи', 'opportunity', '{}') $$,
  'P0001', 'smartLists.errors.limit', 'the 51st list fails with the limit key');

-- ── Tenant isolation ─────────────────────────────────────────────────────────

SELECT pg_temp.act_as('u_b_broker');
SELECT is((SELECT count(*)::int FROM smart_lists), 0, 'Beta sees no Alpha list');
SELECT is(
  pg_temp.affected($$ DELETE FROM smart_lists WHERE id = current_setting('test.l_shared')::uuid $$), 0,
  'Beta cannot delete an Alpha list even with its id');

SELECT * FROM finish();
ROLLBACK;
