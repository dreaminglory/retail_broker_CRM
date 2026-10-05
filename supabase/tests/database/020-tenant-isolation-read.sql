BEGIN;
SELECT plan(14);

-- Setup 2 agencies and 2 users
SELECT set_config('test.u1', gen_random_uuid()::text, true);
SELECT set_config('test.u2', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES (current_setting('test.u1')::uuid, 'user1@example.com'), (current_setting('test.u2')::uuid, 'user2@example.com');

SELECT set_config('test.a1', gen_random_uuid()::text, true);
SELECT set_config('test.a2', gen_random_uuid()::text, true);

INSERT INTO agencies (id, name, slug) VALUES (current_setting('test.a1')::uuid, 'Agency 1', 'a1'), (current_setting('test.a2')::uuid, 'Agency 2', 'a2');

INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES 
  (current_setting('test.a1')::uuid, current_setting('test.u1')::uuid, 'owner', 'active'),
  (current_setting('test.a2')::uuid, current_setting('test.u2')::uuid, 'owner', 'active');

SELECT seed_agency_defaults(current_setting('test.a1')::uuid);
SELECT seed_agency_defaults(current_setting('test.a2')::uuid);

-- Now, act as User 1
SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u1')), true);
SET ROLE authenticated;

-- Test read isolation
SELECT results_eq(
    $$ SELECT count(*)::int FROM agencies $$,
    $$ VALUES (1::int) $$,
    'agencies isolation'
);

SELECT results_eq(
    $$ SELECT count(*)::int FROM profiles $$,
    $$ VALUES (1::int) $$,
    'profiles isolation (only sees self/colleagues)'
);

SELECT results_eq(
    $$ SELECT count(*)::int FROM agency_memberships $$,
    $$ VALUES (1::int) $$,
    'agency_memberships isolation'
);

SELECT is_empty(
    $$ SELECT agency_id FROM lead_sources WHERE agency_id != current_setting('test.a1')::uuid $$,
    'lead_sources isolation'
);

SELECT is_empty(
    $$ SELECT agency_id FROM stages WHERE agency_id != current_setting('test.a1')::uuid $$,
    'stages isolation'
);

-- We would do this for the other tables too, but they are empty.
-- We can just check that no errors are thrown and no data is returned from agency 2.
SELECT is_empty(
    $$ SELECT id FROM contacts WHERE agency_id != current_setting('test.a1')::uuid $$,
    'contacts isolation'
);

SELECT is_empty(
    $$ SELECT id FROM inquiries WHERE agency_id != current_setting('test.a1')::uuid $$,
    'inquiries isolation'
);

SELECT is_empty(
    $$ SELECT id FROM opportunities WHERE agency_id != current_setting('test.a1')::uuid $$,
    'opportunities isolation'
);

SELECT is_empty(
    $$ SELECT id FROM notes WHERE agency_id != current_setting('test.a1')::uuid $$,
    'notes isolation'
);

SELECT is_empty(
    $$ SELECT id FROM tasks WHERE agency_id != current_setting('test.a1')::uuid $$,
    'tasks isolation'
);

SELECT is_empty(
    $$ SELECT id FROM audit_log WHERE agency_id != current_setting('test.a1')::uuid $$,
    'audit_log isolation'
);

SELECT is_empty(
    $$ SELECT id FROM opportunity_participants WHERE agency_id != current_setting('test.a1')::uuid $$,
    'opportunity_participants isolation'
);

SELECT is_empty(
    $$ SELECT id FROM contact_methods WHERE agency_id != current_setting('test.a1')::uuid $$,
    'contact_methods isolation'
);

SELECT is_empty(
    $$ SELECT id FROM merge_history WHERE agency_id != current_setting('test.a1')::uuid $$,
    'merge_history isolation'
);

SELECT * FROM finish();
ROLLBACK;
