BEGIN;

SELECT plan(3);

-- Setup: Two agencies
SELECT tests.create_user('f1111111-1111-1111-1111-111111111111', 'owner_a@example.com');
SELECT tests.create_user('f2222222-2222-2222-2222-222222222222', 'broker_a@example.com');
SELECT tests.create_user('f3333333-3333-3333-3333-333333333333', 'owner_b@example.com');

INSERT INTO agencies (id, name, slug) VALUES 
  ('faaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Agency A', 'agency-a'),
  ('fbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Agency B', 'agency-b');

INSERT INTO agency_memberships (user_id, agency_id, role, status) VALUES 
  ('f1111111-1111-1111-1111-111111111111', 'faaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', 'active'),
  ('f2222222-2222-2222-2222-222222222222', 'faaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'broker', 'active'),
  ('f3333333-3333-3333-3333-333333333333', 'fbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner', 'active');

-- Add profiles (which happens in trigger normally, but we can do it directly for the test if they don't exist, wait, the trigger handles it on auth.users insert. So profiles should already exist).

SELECT tests.authenticate_as('f1111111-1111-1111-1111-111111111111'); -- owner_a

-- Should see self
SELECT results_eq(
  $$ SELECT id FROM profiles WHERE id = 'f1111111-1111-1111-1111-111111111111' $$,
  $$ VALUES ('f1111111-1111-1111-1111-111111111111'::uuid) $$,
  'F-06: Profile visibility - can see self'
);

-- Should see colleague
SELECT results_eq(
  $$ SELECT id FROM profiles WHERE id = 'f2222222-2222-2222-2222-222222222222' $$,
  $$ VALUES ('f2222222-2222-2222-2222-222222222222'::uuid) $$,
  'F-06: Profile visibility - can see colleague'
);

-- Should NOT see foreign user
SELECT is_empty(
  $$ SELECT id FROM profiles WHERE id = 'f3333333-3333-3333-3333-333333333333' $$,
  'F-06: Profile visibility - cannot see user from another agency'
);

SELECT * FROM finish();
ROLLBACK;
