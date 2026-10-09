BEGIN;

-- Plan the tests
SELECT plan(14);

-- Setup test users and agencies
SELECT set_config('test.u_owner_1', gen_random_uuid()::text, true);
SELECT set_config('test.u_broker_1', gen_random_uuid()::text, true);
SELECT set_config('test.u_owner_2', gen_random_uuid()::text, true);
SELECT set_config('test.a1', gen_random_uuid()::text, true);
SELECT set_config('test.a2', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES 
  (current_setting('test.u_owner_1')::uuid, 'owner1@example.com'),
  (current_setting('test.u_broker_1')::uuid, 'broker1@example.com'),
  (current_setting('test.u_owner_2')::uuid, 'owner2@example.com');

INSERT INTO agencies (id, name, slug) VALUES 
  (current_setting('test.a1')::uuid, 'Agency 1', 'a1'),
  (current_setting('test.a2')::uuid, 'Agency 2', 'a2');

INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES 
  (current_setting('test.a1')::uuid, current_setting('test.u_owner_1')::uuid, 'owner', 'active'),
  (current_setting('test.a1')::uuid, current_setting('test.u_broker_1')::uuid, 'broker', 'active'),
  (current_setting('test.a2')::uuid, current_setting('test.u_owner_2')::uuid, 'owner', 'active');

-- Bypass RLS to insert initial jobs for testing
INSERT INTO public.import_jobs (id, agency_id, entity_type, file_name, file_sha256, file_size_bytes)
VALUES 
  ('00000000-0000-0000-0000-000000000001', current_setting('test.a1')::uuid, 'contact', 'test1.csv', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 100),
  ('00000000-0000-0000-0000-000000000002', current_setting('test.a2')::uuid, 'contact', 'test2.csv', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 100);

-- Act as Owner 1
SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u_owner_1')), true);
SET ROLE authenticated;

-- 1. Test import_jobs RLS
-- Owner can read their own agency's jobs
SELECT results_eq(
  $$ SELECT file_name FROM public.import_jobs WHERE id = '00000000-0000-0000-0000-000000000001' $$,
  $$ VALUES ('test1.csv'::text) $$,
  'Owner can see their own agency import jobs'
);

-- Owner cannot read other agency's jobs
SELECT is_empty(
  $$ SELECT file_name FROM public.import_jobs WHERE id = '00000000-0000-0000-0000-000000000002' $$,
  'Owner cannot see other agency import jobs'
);

-- Owner can insert jobs for their agency
SELECT results_eq(
  $$ INSERT INTO public.import_jobs (agency_id, entity_type, file_name, file_sha256, file_size_bytes)
     VALUES (current_setting('test.a1')::uuid, 'contact', 'test_insert.csv', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 100)
     RETURNING file_name $$,
  $$ VALUES ('test_insert.csv'::text) $$,
  'Owner can insert jobs for their agency'
);

-- Owner cannot insert jobs for other agency
SELECT throws_ok(
  $$ INSERT INTO public.import_jobs (agency_id, entity_type, file_name, file_sha256, file_size_bytes)
     VALUES (current_setting('test.a2')::uuid, 'contact', 'test_insert2.csv', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 100) $$,
  'new row violates row-level security policy for table "import_jobs"',
  'Owner cannot insert jobs for another agency'
);

-- Owner can update jobs for their agency
SELECT results_eq(
  $$ UPDATE public.import_jobs SET status = 'staged' WHERE id = '00000000-0000-0000-0000-000000000001' RETURNING status $$,
  $$ VALUES ('staged'::text) $$,
  'Owner can update jobs for their agency'
);

-- Act as Broker 1
SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u_broker_1')), true);

-- Broker cannot read jobs
SELECT is_empty(
  $$ SELECT file_name FROM public.import_jobs $$,
  'Broker cannot see import jobs even in their agency'
);

-- Broker cannot insert jobs
SELECT throws_ok(
  $$ INSERT INTO public.import_jobs (agency_id, entity_type, file_name, file_sha256, file_size_bytes)
     VALUES (current_setting('test.a1')::uuid, 'contact', 'test_broker.csv', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 100) $$,
  'new row violates row-level security policy for table "import_jobs"',
  'Broker cannot insert import jobs'
);

-- 2. Test import_rows RLS
-- Act as Owner 1 again
SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u_owner_1')), true);

-- Owner can insert rows for their agency's job
SELECT results_eq(
  $$ INSERT INTO public.import_rows (id, import_job_id, agency_id, row_number, raw, status)
     VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', current_setting('test.a1')::uuid, 1, '{"first_name": "Test"}', 'pending')
     RETURNING row_number $$,
  $$ VALUES (1) $$,
  'Owner can insert import rows for their agency'
);

-- Owner cannot insert rows for other agency
SELECT throws_ok(
  $$ INSERT INTO public.import_rows (id, import_job_id, agency_id, row_number, raw, status)
     VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', current_setting('test.a2')::uuid, 2, '{"first_name": "Test"}', 'pending') $$,
  'new row violates row-level security policy for table "import_rows"',
  'Owner cannot insert import rows for another agency'
);

-- Owner can read their rows
SELECT results_eq(
  $$ SELECT row_number FROM public.import_rows WHERE id = '00000000-0000-0000-0000-000000000001' $$,
  $$ VALUES (1) $$,
  'Owner can see their own agency import rows'
);

-- Owner can update their rows
SELECT results_eq(
  $$ UPDATE public.import_rows SET status = 'valid' WHERE id = '00000000-0000-0000-0000-000000000001' RETURNING status $$,
  $$ VALUES ('valid'::text) $$,
  'Owner can update import rows for their agency'
);

-- Owner can delete their rows
SELECT results_eq(
  $$ DELETE FROM public.import_rows WHERE id = '00000000-0000-0000-0000-000000000001' RETURNING row_number $$,
  $$ VALUES (1) $$,
  'Owner can delete import rows'
);

-- Act as Broker 1
SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u_broker_1')), true);

-- Broker cannot read rows
SELECT is_empty(
  $$ SELECT row_number FROM public.import_rows $$,
  'Broker cannot see import rows even in their agency'
);

-- Broker cannot insert rows
SELECT throws_ok(
  $$ INSERT INTO public.import_rows (id, import_job_id, agency_id, row_number, raw, status)
     VALUES ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', current_setting('test.a1')::uuid, 3, '{"first_name": "Test"}', 'pending') $$,
  'new row violates row-level security policy for table "import_rows"',
  'Broker cannot insert import rows'
);

SELECT * FROM finish();
ROLLBACK;
