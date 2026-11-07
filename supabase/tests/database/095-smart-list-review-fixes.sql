-- spec: smart-lists, Checkpoint 1 review fixes (AD-062).
--   * Unsharing is refused for anyone but the creator by the UPDATE policy itself, not only by
--     the SELECT policy on the new row (which Postgres applies only when the UPDATE reads the
--     table, e.g. through a WHERE): an UPDATE with no WHERE must not unshare a manager's list.
--   * deal_match_rows lives in the `private` schema, which the API does not expose, so a client
--     can't ask for every deal x listing pair at once; the functions built on it still work.
--   * A `no_touch_days` that is not a whole number of at least 1 matches nothing, like any other
--     filter value of the wrong shape.
--   * At most 5 saved opportunity lists with has_new_matches per member (each costs a matching
--     pass in the overview).
-- Needs `supabase db reset` (the seed).
BEGIN;
SELECT plan(14);

CREATE FUNCTION pg_temp.act_as(p_user UUID) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', p_user), true);
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

CREATE FUNCTION pg_temp.total(p_filter JSONB) RETURNS BIGINT LANGUAGE sql AS $$
  SELECT COALESCE(max(total_count), 0) FROM smart_list_opportunities(p_filter, 1, 0, NULL)
$$;

SELECT set_config('test.owner', (SELECT id::text FROM auth.users WHERE email = 'owner@alpha.bg'), true);
SELECT set_config('test.manager', (SELECT id::text FROM auth.users WHERE email = 'manager@alpha.bg'), true);
SELECT set_config('test.broker', (SELECT id::text FROM auth.users WHERE email = 'broker@alpha.bg'), true);
SELECT set_config('test.alpha',
  (SELECT agency_id::text FROM agency_memberships WHERE user_id = current_setting('test.owner')::uuid LIMIT 1), true);
SELECT set_config('test.l_shared', gen_random_uuid()::text, true);

-- ── Unshare: only the creator, whatever the shape of the UPDATE ──────────────

SELECT pg_temp.act_as(current_setting('test.owner')::uuid);
INSERT INTO smart_lists (id, agency_id, created_by, name, entity, filter, shared)
VALUES (current_setting('test.l_shared')::uuid, current_setting('test.alpha')::uuid,
        current_setting('test.owner')::uuid, 'Review shared', 'opportunity', '{}', true);

SELECT pg_temp.act_as(current_setting('test.manager')::uuid);
SELECT throws_ok(
  $$ UPDATE smart_lists SET shared = false $$,
  '42501', NULL, 'a manager cannot unshare another member''s list with an UPDATE that has no WHERE');
SELECT throws_ok(
  $$ UPDATE smart_lists SET shared = false WHERE id = current_setting('test.l_shared')::uuid $$,
  '42501', NULL, 'nor with a WHERE');
SELECT is(
  pg_temp.affected($$ UPDATE smart_lists SET name = 'Review shared, renamed' WHERE id = current_setting('test.l_shared')::uuid $$), 1,
  'a manager still edits the shared list');

SELECT pg_temp.act_as(current_setting('test.owner')::uuid);
SELECT is(
  pg_temp.affected($$ UPDATE smart_lists SET shared = false WHERE id = current_setting('test.l_shared')::uuid $$), 1,
  'the creator still unshares it');

-- ── deal_match_rows is not exposed ───────────────────────────────────────────

RESET ROLE;
SELECT hasnt_view('public', 'deal_match_rows', 'deal_match_rows is not in the exposed public schema');
SELECT has_view('private', 'deal_match_rows', 'deal_match_rows lives in private');
SELECT ok(NOT has_schema_privilege('anon', 'private', 'USAGE'), 'anon has no usage on private');

SELECT pg_temp.act_as(current_setting('test.broker')::uuid);
SELECT ok(pg_temp.total('{"status":["active","nurture"],"type":["buyer","tenant"],"has_new_matches":true}') > 0,
  'has_new_matches still finds the seeded deals');

-- ── no_touch_days of the wrong shape matches nothing ─────────────────────────

SELECT is(pg_temp.total('{"no_touch_days": -1}'), 0::bigint, 'a negative no_touch_days matches nothing');
SELECT is(pg_temp.total('{"no_touch_days": 2.5}'), 0::bigint, 'a fractional no_touch_days matches nothing');
SELECT is(pg_temp.total('{"no_touch_days": "3"}'), 0::bigint, 'a no_touch_days that is not a number matches nothing');

-- ── At most 5 has_new_matches lists per member ───────────────────────────────

INSERT INTO smart_lists (agency_id, created_by, name, entity, filter)
SELECT current_setting('test.alpha')::uuid, current_setting('test.broker')::uuid,
       'Review matches ' || n, 'opportunity', '{"has_new_matches": true}'
FROM generate_series(1, 5) AS n;

SELECT throws_ok(
  $$ INSERT INTO smart_lists (agency_id, created_by, name, entity, filter)
     VALUES (current_setting('test.alpha')::uuid, current_setting('test.broker')::uuid,
             'Review matches 6', 'opportunity', '{"has_new_matches": true}') $$,
  'P0001', 'smartLists.errors.matchListLimit', 'the 6th has_new_matches list fails');

INSERT INTO smart_lists (agency_id, created_by, name, entity, filter)
VALUES (current_setting('test.alpha')::uuid, current_setting('test.broker')::uuid,
        'Review plain', 'opportunity', '{}');
SELECT throws_ok(
  $$ UPDATE smart_lists SET filter = '{"has_new_matches": true}'
     WHERE created_by = current_setting('test.broker')::uuid AND name = 'Review plain' $$,
  'P0001', 'smartLists.errors.matchListLimit', 'editing a 6th list into has_new_matches fails');
SELECT is(
  pg_temp.affected($$ UPDATE smart_lists SET name = 'Review matches 1b'
     WHERE created_by = current_setting('test.broker')::uuid AND name = 'Review matches 1' $$), 1,
  'renaming one of the five still works');

SELECT * FROM finish();
ROLLBACK;
