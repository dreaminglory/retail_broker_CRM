BEGIN;
SELECT plan(6);

-- Setup

-- Get a test agency and user

SELECT set_config('test.a1', (SELECT id FROM agencies LIMIT 1)::text, true);
SELECT set_config('test.s1', (SELECT id FROM lead_sources WHERE agency_id = current_setting('test.a1')::uuid LIMIT 1)::text, true);

-- Seed import job
INSERT INTO import_jobs (id, agency_id, entity_type, status, file_name, file_sha256, file_size_bytes, total_rows, options)
VALUES ('00000000-0000-0000-0000-000000000002', current_setting('test.a1')::uuid, 'inquiry', 'validated', 'test-revert.csv', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 100, 2, '{"create_missing_contacts": true}');

-- Seed staged rows
INSERT INTO import_rows (id, agency_id, import_job_id, row_number, status, raw, normalized)
VALUES 
  ('00000000-0000-0000-0000-200000000001', current_setting('test.a1')::uuid, '00000000-0000-0000-0000-000000000002', 1, 'valid', '{}', jsonb_build_object(
    'caller_name', 'Test Revert 1',
    'caller_phone', '+359888999991',
    'source_id', current_setting('test.s1')::uuid,
    'status', 'new'
  )),
  ('00000000-0000-0000-0000-200000000002', current_setting('test.a1')::uuid, '00000000-0000-0000-0000-000000000002', 2, 'valid', '{}', jsonb_build_object(
    'caller_name', 'Test Revert 2',
    'caller_phone', '+359888999992',
    'source_id', current_setting('test.s1')::uuid,
    'status', 'new'
  ));

-- Commit first
SELECT * FROM import_commit_inquiries('00000000-0000-0000-0000-000000000002');

SELECT is(
  (SELECT count(*)::int FROM inquiries WHERE import_job_id = '00000000-0000-0000-0000-000000000002'),
  2,
  '2 inquiries committed'
);

-- Modify one inquiry to prevent its deletion
ALTER TABLE inquiries DISABLE TRIGGER set_inquiries_updated_at;
UPDATE inquiries SET status = 'contacted', updated_at = now() + INTERVAL '2 minutes' WHERE caller_name = 'Test Revert 1';
ALTER TABLE inquiries ENABLE TRIGGER set_inquiries_updated_at;

-- Revert job
SELECT * FROM import_revert('00000000-0000-0000-0000-000000000002');

SELECT is(
  (SELECT status FROM import_jobs WHERE id = '00000000-0000-0000-0000-000000000002'),
  'reverted'::text,
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
