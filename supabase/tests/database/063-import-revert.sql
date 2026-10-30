BEGIN;
SELECT plan(14);

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

SELECT is(
  (SELECT status FROM import_rows WHERE id = '00000000-0000-0000-0000-200000000001'),
  'revert_skipped'::text,
  'The row of the kept inquiry is revert_skipped'
);

SELECT is(
  (SELECT status FROM import_rows WHERE id = '00000000-0000-0000-0000-200000000002'),
  'reverted'::text,
  'The row of the deleted inquiry is reverted'
);

-- Contact import, reverted as a signed-in owner: each row tests one guard.

SELECT set_config('test.u_owner', gen_random_uuid()::text, true);
SELECT set_config('test.a2', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES (current_setting('test.u_owner')::uuid, 'revert-owner@example.com');
INSERT INTO agencies (id, name, slug) VALUES (current_setting('test.a2')::uuid, 'Revert Agency', 'revert-agency');
INSERT INTO agency_memberships (agency_id, user_id, role, status)
VALUES (current_setting('test.a2')::uuid, current_setting('test.u_owner')::uuid, 'owner', 'active');

SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u_owner')), true);
SET ROLE authenticated;

INSERT INTO import_jobs (id, agency_id, entity_type, status, file_name, file_sha256, file_size_bytes, total_rows, options)
VALUES ('00000000-0000-0000-0000-000000000003', current_setting('test.a2')::uuid, 'contact', 'validated', 'test-contacts.csv', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 100, 4, '{"duplicate_strategy": "skip"}');

INSERT INTO import_rows (id, agency_id, import_job_id, row_number, status, raw, normalized)
SELECT
  ('00000000-0000-0000-0000-30000000000' || n)::uuid,
  current_setting('test.a2')::uuid,
  '00000000-0000-0000-0000-000000000003',
  n,
  'valid',
  '{}',
  jsonb_build_object('first_name', first_name, 'contact_type', 'person', 'note', note)
FROM (VALUES
  (1, 'Untouched', 'From the file'),
  (2, 'Noted', NULL),
  (3, 'Edited note', 'Original text'),
  (4, 'Tasked', NULL)
) AS t(n, first_name, note);

SELECT import_commit_contacts('00000000-0000-0000-0000-000000000003');

-- A broker works on rows 2-4 after the import.
INSERT INTO notes (agency_id, contact_id, content)
SELECT current_setting('test.a2')::uuid, id, 'Called, wants a viewing'
FROM contacts WHERE first_name = 'Noted' AND agency_id = current_setting('test.a2')::uuid;

UPDATE notes SET content = 'Original text, and a correction'
WHERE content = 'Original text' AND agency_id = current_setting('test.a2')::uuid;

INSERT INTO tasks (agency_id, contact_id, title, due_at, assigned_to)
SELECT current_setting('test.a2')::uuid, id, 'Call back', now() + INTERVAL '1 day', current_setting('test.u_owner')::uuid
FROM contacts WHERE first_name = 'Tasked' AND agency_id = current_setting('test.a2')::uuid;

SELECT is(
  import_revert('00000000-0000-0000-0000-000000000003'),
  '{"deleted": {"contacts": 1, "inquiries": 0}, "kept": {"contacts": 3, "inquiries": 0}}'::jsonb,
  'Revert deletes the untouched contact and reports the three it kept'
);

SELECT is_empty(
  $$ SELECT 1 FROM contacts WHERE first_name = 'Untouched' $$,
  'A contact with only the note from its import row is deleted'
);

SELECT is(
  (SELECT content FROM notes n JOIN contacts c ON c.id = n.contact_id WHERE c.first_name = 'Noted'),
  'Called, wants a viewing',
  'A contact that gained a note keeps the contact and the note (AC-8)'
);

SELECT is(
  (SELECT content FROM notes n JOIN contacts c ON c.id = n.contact_id WHERE c.first_name = 'Edited note'),
  'Original text, and a correction',
  'A contact whose imported note was edited is kept'
);

SELECT is(
  (SELECT count(*)::int FROM tasks t JOIN contacts c ON c.id = t.contact_id WHERE c.first_name = 'Tasked'),
  1,
  'A contact that gained a task is kept'
);

SELECT results_eq(
  $$ SELECT status FROM import_rows WHERE import_job_id = '00000000-0000-0000-0000-000000000003' ORDER BY row_number $$,
  $$ VALUES ('reverted'::text), ('revert_skipped'), ('revert_skipped'), ('revert_skipped') $$,
  'Every row that created a contact is reverted or revert_skipped'
);

SELECT * FROM finish();
ROLLBACK;
