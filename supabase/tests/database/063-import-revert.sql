BEGIN;
SELECT plan(6);

-- Setup
\ir ../000-setup-tests-hooks.sql

-- Get a test agency and user
SELECT id INTO my_agency_id FROM agencies LIMIT 1;
SELECT id INTO my_source_id FROM lead_sources WHERE agency_id = my_agency_id LIMIT 1;

-- Seed import job
INSERT INTO import_jobs (id, agency_id, entity_type, status, file_name, file_size_bytes, total_rows)
VALUES ('00000000-0000-0000-0000-000000000002', my_agency_id, 'inquiry', 'validated', 'test-revert.csv', 100, 2);

-- Seed staged rows
INSERT INTO import_staged_rows (id, agency_id, import_job_id, row_number, status, normalized)
VALUES 
  ('00000000-0000-0000-0000-200000000001', my_agency_id, '00000000-0000-0000-0000-000000000002', 1, 'valid', jsonb_build_object(
    'caller_name', 'Test Revert 1',
    'caller_phone', '+359888999991',
    'source_id', my_source_id,
    'status', 'new'
  )),
  ('00000000-0000-0000-0000-200000000002', my_agency_id, '00000000-0000-0000-0000-000000000002', 2, 'valid', jsonb_build_object(
    'caller_name', 'Test Revert 2',
    'caller_phone', '+359888999992',
    'source_id', my_source_id,
    'status', 'new'
  ));

-- Commit first
SELECT * FROM commit_inquiries_batch('00000000-0000-0000-0000-000000000002');

SELECT is(
  (SELECT count(*)::int FROM inquiries WHERE import_job_id = '00000000-0000-0000-0000-000000000002'),
  2,
  '2 inquiries committed'
);

-- Modify one inquiry to prevent its deletion
UPDATE inquiries 
SET status = 'contacted'
WHERE caller_name = 'Test Revert 1';

-- Revert job
SELECT * FROM revert_import_job('00000000-0000-0000-0000-000000000002');

SELECT is(
  (SELECT status FROM import_jobs WHERE id = '00000000-0000-0000-0000-000000000002'),
  'reverted'::import_job_status,
  'Job status should be reverted'
);

SELECT is(
  (SELECT count(*)::int FROM inquiries WHERE import_job_id = '00000000-0000-0000-0000-000000000002'),
  1,
  '1 inquiry should remain because it was modified (status changed)'
);

SELECT is(
  (SELECT caller_name FROM inquiries WHERE import_job_id = '00000000-0000-0000-0000-000000000002'),
  'Test Revert 1',
  'The modified inquiry is the one retained'
);

SELECT is(
  (SELECT count(*)::int FROM contacts WHERE import_job_id = '00000000-0000-0000-0000-000000000002'),
  1,
  '1 contact should remain (the one linked to the retained inquiry)'
);

SELECT is(
  (SELECT first_name FROM contacts WHERE import_job_id = '00000000-0000-0000-0000-000000000002'),
  'Test Revert 1',
  'The retained contact corresponds to Test Revert 1'
);

SELECT * FROM finish();
ROLLBACK;
