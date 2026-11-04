-- spec: properties, Task 16. The property search vector (AD-026) and what keeps it current.
BEGIN;
SELECT plan(9);

SELECT set_config('test.a1', gen_random_uuid()::text, true);
SELECT set_config('test.u_manager', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES (current_setting('test.u_manager')::uuid, 'search-manager@example.com');
INSERT INTO agencies (id, name, slug) VALUES (current_setting('test.a1')::uuid, 'Agency S1', 's1');
INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.u_manager')::uuid, 'manager', 'active');

SELECT set_config('test.sofia', (SELECT id FROM settlements WHERE ekatte = '68134')::text, true);
SELECT set_config('test.plovdiv', (SELECT id FROM settlements WHERE name_bg = 'Пловдив' AND kind = 'city')::text, true);

CREATE FUNCTION pg_temp.act_as(p_user TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    format('{"sub": "%s", "role": "authenticated"}', current_setting('test.' || p_user)), true);
  SET ROLE authenticated;
END;
$$;

-- True when the property's vector matches the query (prefix match, as the app searches).
CREATE FUNCTION pg_temp.finds(p_query TEXT) RETURNS boolean LANGUAGE sql AS $$
  SELECT search_vector @@ to_tsquery('simple', p_query || ':*')
  FROM properties WHERE id = current_setting('test.p')::uuid
$$;

SELECT pg_temp.act_as('u_manager');

SELECT set_config('test.area', gen_random_uuid()::text, true);
INSERT INTO areas (id, agency_id, settlement_id, name) VALUES
  (current_setting('test.area')::uuid, current_setting('test.a1')::uuid, current_setting('test.sofia')::uuid, 'Лозенец');

SELECT set_config('test.p', gen_random_uuid()::text, true);
INSERT INTO properties (id, agency_id, type, rooms, settlement_id, area_id, address) VALUES
  (current_setting('test.p')::uuid, current_setting('test.a1')::uuid, 'apartment', 2,
   current_setting('test.sofia')::uuid, current_setting('test.area')::uuid, 'ул. Кричим 12');

SELECT ok(pg_temp.finds((SELECT code::text FROM properties WHERE id = current_setting('test.p')::uuid)), 'A property is found by its code');
SELECT ok(pg_temp.finds('кричим'), 'and by a word of its address');
SELECT ok(pg_temp.finds('лозенец'), 'and by its area');
SELECT ok(pg_temp.finds('софия') AND pg_temp.finds('sofia'), 'and by its settlement, in both languages');

UPDATE areas SET name = 'Лозенец-север' WHERE id = current_setting('test.area')::uuid;
SELECT ok(pg_temp.finds('север'), 'Renaming the area updates its properties');

UPDATE properties SET address = 'бул. Черни връх 5' WHERE id = current_setting('test.p')::uuid;
SELECT ok(pg_temp.finds('черни') AND NOT pg_temp.finds('кричим'), 'Changing the address updates the vector');

UPDATE properties SET settlement_id = current_setting('test.plovdiv')::uuid, area_id = NULL WHERE id = current_setting('test.p')::uuid;
SELECT ok(pg_temp.finds('plovdiv') AND NOT pg_temp.finds('лозенец'), 'Moving the property to another settlement updates the vector');

SELECT is(
  (SELECT count(*)::int FROM properties WHERE agency_id = current_setting('test.a1')::uuid AND search_vector IS NULL),
  0,
  'Every property has a vector'
);

RESET ROLE;
SELECT ok(
  (SELECT count(*) FROM properties WHERE search_vector IS NULL) = 0,
  'Seeded properties were backfilled'
);

SELECT * FROM finish();
ROLLBACK;
