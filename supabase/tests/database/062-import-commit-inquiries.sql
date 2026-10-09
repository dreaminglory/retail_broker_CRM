BEGIN;
SELECT plan(5);

-- Setup

-- Get a test agency and user

SELECT set_config('test.a1', (SELECT id FROM agencies LIMIT 1)::text, true);
SELECT set_config('test.u1', (SELECT id FROM auth.users LIMIT 1)::text, true);
SELECT set_config('test.s1', (SELECT id FROM lead_sources WHERE agency_id = current_setting('test.a1')::uuid LIMIT 1)::text, true);

-- Seed import job
INSERT INTO import_jobs (id, agency_id, entity_type, status, file_name, file_sha256, file_size_bytes, total_rows, options)
VALUES ('00000000-0000-0000-0000-000000000001', current_setting('test.a1')::uuid, 'inquiry', 'validated', 'test.csv', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 100, 2, '{"create_missing_contacts": true}');

-- Seed staged rows
INSERT INTO import_rows (id, agency_id, import_job_id, row_number, status, raw, normalized)
VALUES 
  ('00000000-0000-0000-0000-100000000001', current_setting('test.a1')::uuid, '00000000-0000-0000-0000-000000000001', 1, 'valid', '{}', jsonb_build_object(
    'caller_name', 'Test Caller 1',
    'caller_phone', '+359888111999',
    'source_id', current_setting('test.s1')::uuid,
    'status', 'new'
  )),
  ('00000000-0000-0000-0000-100000000002', current_setting('test.a1')::uuid, '00000000-0000-0000-0000-000000000001', 2, 'valid', '{}', jsonb_build_object(
    'caller_name', 'Test Caller 2',
    'caller_phone', '+359888333444',
    'source_id', current_setting('test.s1')::uuid,
    'status', 'new'
  ));

-- Test commit inquiries
SELECT diag('Testing import_commit_inquiries_fn...');

SELECT * FROM import_commit_inquiries('00000000-0000-0000-0000-000000000001');

SELECT is(
  (SELECT status FROM import_jobs WHERE id = '00000000-0000-0000-0000-000000000001'),
  'completed'::text,
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
SELECT throws_ok(
  $$ SELECT * FROM import_commit_inquiries('00000000-0000-0000-0000-000000000001') $$,
  'Job is not in a committable state',
  'Re-running commit throws because job is completed'
);

SELECT diag('Contacts count: ' || (SELECT count(*) FROM contacts WHERE import_job_id = '00000000-0000-0000-0000-000000000001'));
SELECT diag('All Contacts: ' || COALESCE((SELECT json_agg(row_to_json(c)) FROM contacts c)::text, 'none'));
SELECT diag('All Contact Methods: ' || COALESCE((SELECT json_agg(row_to_json(m)) FROM contact_methods m)::text, 'none'));
SELECT diag('Import Rows: ' || (SELECT json_agg(row_to_json(r)) FROM import_rows r WHERE import_job_id = '00000000-0000-0000-0000-000000000001'));
SELECT * FROM finish();
ROLLBACK;
