BEGIN;
SELECT plan(5);

-- Setup
\ir ../000-setup-tests-hooks.sql

-- Get a test agency and user
SELECT id INTO my_agency_id FROM agencies LIMIT 1;
SELECT id INTO my_user_id FROM auth.users LIMIT 1;
SELECT id INTO my_source_id FROM lead_sources WHERE agency_id = my_agency_id LIMIT 1;

-- Seed import job
INSERT INTO import_jobs (id, agency_id, entity_type, status, file_name, file_size_bytes, total_rows)
VALUES ('00000000-0000-0000-0000-000000000001', my_agency_id, 'inquiry', 'validated', 'test.csv', 100, 2);

-- Seed staged rows
INSERT INTO import_staged_rows (id, agency_id, import_job_id, row_number, status, normalized)
VALUES 
  ('00000000-0000-0000-0000-100000000001', my_agency_id, '00000000-0000-0000-0000-000000000001', 1, 'valid', jsonb_build_object(
    'caller_name', 'Test Caller 1',
    'caller_phone', '+359888111222',
    'source_id', my_source_id,
    'status', 'new'
  )),
  ('00000000-0000-0000-0000-100000000002', my_agency_id, '00000000-0000-0000-0000-000000000001', 2, 'valid', jsonb_build_object(
    'caller_name', 'Test Caller 2',
    'caller_phone', '+359888333444',
    'source_id', my_source_id,
    'status', 'new'
  ));

-- Test commit inquiries
SELECT diag('Testing import_commit_inquiries_fn...');

SELECT * FROM commit_inquiries_batch('00000000-0000-0000-0000-000000000001');

SELECT is(
  (SELECT status FROM import_jobs WHERE id = '00000000-0000-0000-0000-000000000001'),
  'completed'::import_job_status,
  'Job status should be completed'
);

SELECT is(
  (SELECT created_count FROM import_jobs WHERE id = '00000000-0000-0000-0000-000000000001'),
  2,
  'Created count should be 2'
);

SELECT is(
  (SELECT count(*)::int FROM inquiries WHERE import_job_id = '00000000-0000-0000-0000-000000000001'),
  2,
  'Should have inserted 2 inquiries'
);

SELECT is(
  (SELECT count(*)::int FROM contacts WHERE import_job_id = '00000000-0000-0000-0000-000000000001'),
  2,
  'Should have created 2 contacts linked to the inquiries'
);

-- Idempotency
SELECT * FROM commit_inquiries_batch('00000000-0000-0000-0000-000000000001');
SELECT is(
  (SELECT count(*)::int FROM inquiries WHERE import_job_id = '00000000-0000-0000-0000-000000000001'),
  2,
  'Re-running commit should be idempotent and not create duplicate inquiries'
);

SELECT * FROM finish();
ROLLBACK;
