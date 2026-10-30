BEGIN;
SELECT plan(6);

SELECT set_config('test.u1', gen_random_uuid()::text, true);
INSERT INTO auth.users (id, email) VALUES (current_setting('test.u1')::uuid, 'user1@example.com');

SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u1')), true);
SET ROLE authenticated;

-- Test create_agency_with_owner
SELECT lives_ok(
    $$ SELECT create_agency_with_owner('Test Agency', 'bg') $$,
    'Can create agency'
);

-- Test it seeds BG locale
SELECT is(
    (SELECT count(*)::int FROM lead_sources WHERE name = 'Сайт на агенцията'),
    1,
    'Seeds BG lead sources'
);

SELECT is(
    (SELECT count(*)::int FROM stages WHERE name = 'Нов'),
    1,
    'Seeds BG stages'
);

-- Test cannot create second agency
SELECT throws_ok(
    $$ SELECT create_agency_with_owner('Another Agency', 'bg') $$,
    'already_member',
    'Cannot create second agency'
);


-- Test prevent_membership_identity_change trigger
SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u1')), true);
SET ROLE authenticated;

-- Get user 1's membership
SELECT set_config('test.m1', (SELECT id FROM agency_memberships WHERE user_id = current_setting('test.u1')::uuid LIMIT 1)::text, true);

SELECT throws_ok(
    $$ UPDATE agency_memberships SET user_id = gen_random_uuid() WHERE id = current_setting('test.m1')::uuid $$,
    'membership_identity_immutable',
    'prevent_membership_identity_change trigger works'
);

-- handle_new_user: display_name, then full_name, then first + last, then the email prefix.
RESET ROLE;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000f001', 'both@example.com', '{"display_name": "Display", "full_name": "Full Name"}'),
  ('00000000-0000-0000-0000-00000000f002', 'full@example.com', '{"full_name": "  Иван Петров "}'),
  ('00000000-0000-0000-0000-00000000f003', 'parts@example.com', '{"first_name": "Мария", "last_name": "Иванова"}'),
  ('00000000-0000-0000-0000-00000000f004', 'first@example.com', '{"first_name": "Мария"}'),
  ('00000000-0000-0000-0000-00000000f005', 'blank@example.com', '{"display_name": " ", "full_name": ""}'),
  ('00000000-0000-0000-0000-00000000f006', 'none@example.com', NULL);

SELECT results_eq(
  $$ SELECT display_name FROM profiles WHERE id::text LIKE '00000000-0000-0000-0000-00000000f00%' ORDER BY id $$,
  $$ VALUES ('Display'::text), ('Иван Петров'), ('Мария Иванова'), ('Мария'), ('blank'), ('none') $$,
  'A new profile name falls back from display_name to full_name, first + last, then the email prefix'
);

SELECT * FROM finish();
ROLLBACK;
