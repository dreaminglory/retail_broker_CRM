BEGIN;
SELECT plan(10);

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

-- Now act as User 1
SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u1')), true);
SET ROLE authenticated;

-- Test INSERT isolation
-- User 1 should NOT be able to insert into Agency 2's Contacts
SELECT throws_ok(
    $$ INSERT INTO contacts (id, agency_id, display_name, first_name, type) VALUES (gen_random_uuid(), current_setting('test.a2')::uuid, 'Test', 'Test', 'person') $$,
    'new row violates row-level security policy for table "contacts"',
    'Cannot insert contact into foreign agency'
);

-- But User 1 CAN insert into Agency 1's Contacts
SELECT set_config('test.c1', gen_random_uuid()::text, true);
SELECT lives_ok(
    $$ INSERT INTO contacts (id, agency_id, display_name, first_name, type) VALUES (current_setting('test.c1')::uuid, current_setting('test.a1')::uuid, 'Test A1', 'Test A1', 'person') $$,
    'Can insert contact into own agency'
);

-- Test UPDATE isolation
-- User 1 should NOT be able to update Agency 2's Contacts.
-- We must switch to User 2 to create a contact in Agency 2 first.
RESET ROLE;
SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u2')), true);
SET ROLE authenticated;
SELECT set_config('test.c2', gen_random_uuid()::text, true);
INSERT INTO contacts (id, agency_id, display_name, first_name, type) VALUES (current_setting('test.c2')::uuid, current_setting('test.a2')::uuid, 'Test A2', 'Test A2', 'person');

-- Switch back to User 1
RESET ROLE;
SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u1')), true);
SET ROLE authenticated;

SELECT is_empty(
    $$ UPDATE contacts SET display_name = 'Hacked' WHERE id = current_setting('test.c2')::uuid RETURNING id $$,
    'Cannot update contact in foreign agency (returns 0 rows)'
);

-- User 1 CAN update own contact
SELECT results_eq(
    $$ UPDATE contacts SET display_name = 'Legit' WHERE id = current_setting('test.c1')::uuid RETURNING display_name $$,
    $$ VALUES ('Legit'::text) $$,
    'Can update own agency contact'
);

-- Test DELETE isolation
SELECT is_empty(
    $$ DELETE FROM contacts WHERE id = current_setting('test.c2')::uuid RETURNING id $$,
    'Cannot delete contact in foreign agency'
);

SELECT results_eq(
    $$ DELETE FROM contacts WHERE id = current_setting('test.c1')::uuid RETURNING id $$,
    $$ SELECT current_setting('test.c1')::uuid $$,
    'Can delete own agency contact'
);

-- Repeat a few checks for audit_log (tenant_insert)
SELECT throws_ok(
    $$ INSERT INTO audit_log (id, agency_id, performed_by, action, entity_type, entity_id) VALUES (gen_random_uuid(), current_setting('test.a2')::uuid, current_setting('test.u1')::uuid, 'created', 'contact', gen_random_uuid()) $$,
    'new row violates row-level security policy for table "audit_log"',
    'Cannot insert audit log into foreign agency'
);

SELECT lives_ok(
    $$ INSERT INTO audit_log (id, agency_id, performed_by, action, entity_type, entity_id) VALUES (gen_random_uuid(), current_setting('test.a1')::uuid, current_setting('test.u1')::uuid, 'created', 'contact', gen_random_uuid()) $$,
    'Can insert audit log into own agency'
);

-- Test profiles (F-06 check) - user 1 cannot update user 2's profile
SELECT is_empty(
    $$ UPDATE profiles SET display_name = 'Hacked' WHERE id = current_setting('test.u2')::uuid RETURNING id $$,
    'Cannot update foreign profile'
);

SELECT results_eq(
    $$ UPDATE profiles SET display_name = 'User 1 Modified' WHERE id = current_setting('test.u1')::uuid RETURNING id $$,
    $$ SELECT current_setting('test.u1')::uuid $$,
    'Can update own profile'
);

SELECT * FROM finish();
ROLLBACK;
