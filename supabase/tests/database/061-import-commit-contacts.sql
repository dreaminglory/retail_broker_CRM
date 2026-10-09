BEGIN;

-- Plan the tests
SELECT plan(8);

-- Setup test users and agencies
SELECT set_config('test.u_owner_1', gen_random_uuid()::text, true);
SELECT set_config('test.a1', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES 
  (current_setting('test.u_owner_1')::uuid, 'owner1@example.com');

INSERT INTO agencies (id, name, slug) VALUES 
  (current_setting('test.a1')::uuid, 'Agency 1', 'a1');

INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES 
  (current_setting('test.a1')::uuid, current_setting('test.u_owner_1')::uuid, 'owner', 'active');

SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u_owner_1')), true);
SET ROLE authenticated;

-- Prepare a job
INSERT INTO public.import_jobs (id, agency_id, entity_type, status, file_name, file_sha256, file_size_bytes, options)
VALUES ('00000000-0000-0000-0000-000000000010', current_setting('test.a1')::uuid, 'contact', 'committing', 'test.csv', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 100, '{"duplicate_strategy": "skip", "default_contact_type": "person"}');

-- 1. Create row
INSERT INTO public.import_rows (id, import_job_id, agency_id, row_number, raw, normalized, status)
VALUES ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000010', current_setting('test.a1')::uuid, 1, '{}', '{"first_name": "John", "last_name": "Doe", "contact_type": "person"}', 'valid');

-- 2. Skip duplicate row
INSERT INTO public.import_rows (id, import_job_id, agency_id, row_number, raw, normalized, status)
VALUES ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000010', current_setting('test.a1')::uuid, 2, '{}', '{"first_name": "Jane", "last_name": "Doe", "contact_type": "person"}', 'duplicate');

-- 3. Bad row isolated (fails DB constraint e.g. missing name)
INSERT INTO public.import_rows (id, import_job_id, agency_id, row_number, raw, normalized, status)
VALUES ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000010', current_setting('test.a1')::uuid, 3, '{}', '{"first_name": null, "last_name": null, "contact_type": "person"}', 'valid');

-- Execute the RPC
SELECT results_eq(
  $$ SELECT public.import_commit_contacts('00000000-0000-0000-0000-000000000010', 10) $$,
  $$ VALUES ('{"processed": 2, "remaining": 0}'::jsonb) $$,
  'import_commit_contacts processes all rows'
);

-- Check job counters
SELECT results_eq(
  $$ SELECT created_count, skipped_count, error_count, status FROM public.import_jobs WHERE id = '00000000-0000-0000-0000-000000000010' $$,
  $$ VALUES (1, 0, 1, 'completed'::text) $$,
  'Counters correctly updated and job status completed'
);

-- Check created contact
SELECT results_eq(
  $$ SELECT first_name, last_name, import_job_id FROM public.contacts WHERE first_name = 'John' AND last_name = 'Doe' $$,
  $$ VALUES ('John'::text, 'Doe'::text, '00000000-0000-0000-0000-000000000010'::uuid) $$,
  'Contact 1 was created successfully'
);

-- Check missing contact (duplicate)
SELECT is_empty(
  $$ SELECT first_name FROM public.contacts WHERE first_name = 'Jane' AND last_name = 'Doe' $$,
  'Duplicate contact was skipped and not created'
);

-- Check row 1 status
SELECT results_eq(
  $$ SELECT status FROM public.import_rows WHERE id = '00000000-0000-0000-0000-000000000011' $$,
  $$ VALUES ('created'::text) $$,
  'Row 1 status is created'
);

-- DEBUG
SELECT diag('Row 1 error: ' || COALESCE((SELECT errors::text FROM public.import_rows WHERE id = '00000000-0000-0000-0000-000000000011'), 'no error'));
SELECT diag('Row 3 error: ' || COALESCE((SELECT errors::text FROM public.import_rows WHERE id = '00000000-0000-0000-0000-000000000013'), 'no error'));

-- Check row 2 status
SELECT results_eq(
  $$ SELECT status FROM public.import_rows WHERE id = '00000000-0000-0000-0000-000000000012' $$,
  $$ VALUES ('duplicate'::text) $$,
  'Row 2 status is duplicate'
);

-- Check row 3 status
SELECT results_eq(
  $$ SELECT status FROM public.import_rows WHERE id = '00000000-0000-0000-0000-000000000013' $$,
  $$ VALUES ('error'::text) $$,
  'Row 3 status is error'
);

-- Check audit event created
SELECT results_eq(
  $$ SELECT action FROM public.audit_log WHERE action = 'created' AND entity_type = 'contact' AND (metadata->>'import_job_id') = '00000000-0000-0000-0000-000000000010' $$,
  $$ VALUES ('created'::text) $$,
  'Audit log for created contact contains import_job_id metadata'
);

SELECT * FROM finish();
ROLLBACK;
