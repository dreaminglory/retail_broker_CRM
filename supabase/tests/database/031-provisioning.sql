BEGIN;
SELECT plan(3);

SELECT set_config('test.u1', gen_random_uuid()::text, true);
INSERT INTO auth.users (id, email) VALUES (current_setting('test.u1')::uuid, 'user1@example.com');

SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u1')), true);
SET ROLE authenticated;

-- Test create_agency_with_owner
SELECT lives_ok(
    $$ SELECT create_agency_with_owner('Test Agency', 'bg') $$,
    'Can create agency'
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

SELECT * FROM finish();
ROLLBACK;
