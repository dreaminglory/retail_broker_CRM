BEGIN;
SELECT plan(25);

-- phone-loop (AD-065): tasks.inquiry_id and tasks.channel, inquiries.contacted_at and its
-- triggers. Setup as the superuser. Ids: 106 + kind + n.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-106000000001', 'broker@pl1.example'),
  ('00000000-0000-0000-0000-106000000002', 'broker@pl2.example');

INSERT INTO agencies (id, name, slug) VALUES
  ('00000000-0000-0000-0000-10610000000a', 'Phone 1', 'phone-1'),
  ('00000000-0000-0000-0000-10610000000b', 'Phone 2', 'phone-2');

INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES
  ('00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106000000001', 'broker', 'active'),
  ('00000000-0000-0000-0000-10610000000b', '00000000-0000-0000-0000-106000000002', 'broker', 'active');

-- An insert never carries a contacted_at (the first row tries to).
INSERT INTO inquiries (id, agency_id, status, caller_name, contacted_at) VALUES
  ('00000000-0000-0000-0000-106200000001', '00000000-0000-0000-0000-10610000000a', 'new', 'First call', '2020-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-106200000002', '00000000-0000-0000-0000-10610000000a', 'new', 'Completed later', NULL),
  ('00000000-0000-0000-0000-106200000003', '00000000-0000-0000-0000-10610000000a', 'converted', 'Legacy converted', NULL),
  ('00000000-0000-0000-0000-106200000004', '00000000-0000-0000-0000-10610000000a', 'dismissed', 'Dismissed', NULL),
  ('00000000-0000-0000-0000-106200000005', '00000000-0000-0000-0000-10610000000a', 'new', 'Mark contacted', NULL),
  ('00000000-0000-0000-0000-106200000006', '00000000-0000-0000-0000-10610000000a', 'contacted', 'Legacy contacted', NULL),
  ('00000000-0000-0000-0000-106200000007', '00000000-0000-0000-0000-10610000000a', 'new', 'Converted without call', NULL),
  ('00000000-0000-0000-0000-106200000008', '00000000-0000-0000-0000-10610000000a', 'new', 'Other task types', NULL),
  ('00000000-0000-0000-0000-106200000009', '00000000-0000-0000-0000-10610000000a', 'new', 'Emailed', NULL),
  ('00000000-0000-0000-0000-10620000000b', '00000000-0000-0000-0000-10610000000b', 'new', 'Other agency', NULL);

SELECT has_column('tasks', 'inquiry_id', 'tasks.inquiry_id exists');
SELECT has_column('tasks', 'channel', 'tasks.channel exists');
SELECT is(
  (SELECT contacted_at FROM inquiries WHERE id = '00000000-0000-0000-0000-106200000001'),
  NULL, 'an insert starts with contacted_at NULL'
);

SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-106000000001", "role": "authenticated"}', true);
SET ROLE authenticated;

-- AC-2: the first attempt, answered or not, marks a new inquiry contacted at the call's time
INSERT INTO tasks (agency_id, inquiry_id, title, task_type, channel, status, outcome, completed_at, assigned_to, created_by) VALUES
  ('00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106200000001', 'Call with First call', 'call', 'phone',
   'completed', 'No answer', '2026-11-19T10:00:00Z', '00000000-0000-0000-0000-106000000001', '00000000-0000-0000-0000-106000000001');
SELECT results_eq(
  $$ SELECT status, contacted_at FROM inquiries WHERE id = '00000000-0000-0000-0000-106200000001' $$,
  $$ VALUES ('contacted'::text, '2026-11-19T10:00:00Z'::timestamptz) $$,
  'a broker''s first logged call sets contacted and contacted_at'
);

-- AC-3: a second call doesn't move it
INSERT INTO tasks (agency_id, inquiry_id, title, task_type, channel, status, outcome, completed_at) VALUES
  ('00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106200000001', 'Call with First call', 'call', 'viber',
   'completed', 'Answered', '2026-11-19T12:00:00Z');
SELECT is(
  (SELECT contacted_at FROM inquiries WHERE id = '00000000-0000-0000-0000-106200000001'),
  '2026-11-19T10:00:00Z'::timestamptz, 'a second call does not move contacted_at'
);

-- Completing a pending call task (the update path) counts; the pending task alone doesn't
INSERT INTO tasks (id, agency_id, inquiry_id, title, task_type, due_at) VALUES
  ('00000000-0000-0000-0000-106300000001', '00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106200000002',
   'Call again', 'call', '2026-11-19T11:00:00Z');
SELECT results_eq(
  $$ SELECT status, contacted_at FROM inquiries WHERE id = '00000000-0000-0000-0000-106200000002' $$,
  $$ VALUES ('new'::text, NULL::timestamptz) $$,
  'a pending call does not mark the inquiry'
);
UPDATE tasks SET status = 'completed', outcome = 'Answered', completed_at = '2026-11-19T11:05:00Z', channel = 'phone'
WHERE id = '00000000-0000-0000-0000-106300000001';
SELECT results_eq(
  $$ SELECT status, contacted_at FROM inquiries WHERE id = '00000000-0000-0000-0000-106200000002' $$,
  $$ VALUES ('contacted'::text, '2026-11-19T11:05:00Z'::timestamptz) $$,
  'completing a pending call marks the inquiry at its completed_at'
);

-- A converted or dismissed inquiry keeps its status, and no late stamp is written
INSERT INTO tasks (agency_id, inquiry_id, title, task_type, channel, status, outcome, completed_at) VALUES
  ('00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106200000003', 'Call', 'call', 'phone', 'completed', 'Hi', now()),
  ('00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106200000004', 'Call', 'call', 'phone', 'completed', 'Hi', now()),
  ('00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106200000006', 'Call', 'call', 'phone', 'completed', 'Hi', now());
SELECT results_eq(
  $$ SELECT status, contacted_at FROM inquiries WHERE id = '00000000-0000-0000-0000-106200000003' $$,
  $$ VALUES ('converted'::text, NULL::timestamptz) $$,
  'a call on a converted inquiry leaves it alone'
);
SELECT results_eq(
  $$ SELECT status, contacted_at FROM inquiries WHERE id = '00000000-0000-0000-0000-106200000004' $$,
  $$ VALUES ('dismissed'::text, NULL::timestamptz) $$,
  'a call on a dismissed inquiry leaves it alone'
);
SELECT is(
  (SELECT contacted_at FROM inquiries WHERE id = '00000000-0000-0000-0000-106200000006'),
  NULL, 'an existing contacted inquiry keeps contacted_at NULL (no backfill, no late stamp)'
);

-- Only call and email tasks count; an email marks it too
INSERT INTO tasks (agency_id, inquiry_id, title, task_type, status, outcome, completed_at) VALUES
  ('00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106200000008', 'Meet', 'meeting', 'completed', 'Met', now()),
  ('00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106200000008', 'Misc', NULL, 'completed', 'Done', now());
SELECT is(
  (SELECT status FROM inquiries WHERE id = '00000000-0000-0000-0000-106200000008'),
  'new', 'a completed meeting or untyped task does not mark the inquiry'
);
INSERT INTO tasks (agency_id, inquiry_id, title, task_type, channel, status, outcome, completed_at) VALUES
  ('00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106200000009', 'Email', 'email', 'email', 'completed', 'Sent', '2026-11-19T09:00:00Z');
SELECT results_eq(
  $$ SELECT status, contacted_at FROM inquiries WHERE id = '00000000-0000-0000-0000-106200000009' $$,
  $$ VALUES ('contacted'::text, '2026-11-19T09:00:00Z'::timestamptz) $$,
  'a logged email marks the inquiry'
);

-- AC-6: "Mark contacted" and a conversion without a call stamp now()
UPDATE inquiries SET status = 'contacted' WHERE id = '00000000-0000-0000-0000-106200000005';
SELECT is(
  (SELECT contacted_at FROM inquiries WHERE id = '00000000-0000-0000-0000-106200000005'),
  now(), 'Mark contacted sets contacted_at'
);
UPDATE inquiries SET status = 'converted' WHERE id = '00000000-0000-0000-0000-106200000007';
SELECT is(
  (SELECT contacted_at FROM inquiries WHERE id = '00000000-0000-0000-0000-106200000007'),
  now(), 'a conversion without a logged call sets contacted_at'
);

-- contacted_at is trigger-owned: a direct write is ignored, set or not
UPDATE inquiries SET contacted_at = '2020-01-01T00:00:00Z' WHERE id = '00000000-0000-0000-0000-106200000001';
SELECT is(
  (SELECT contacted_at FROM inquiries WHERE id = '00000000-0000-0000-0000-106200000001'),
  '2026-11-19T10:00:00Z'::timestamptz, 'a direct write does not move a set contacted_at'
);
UPDATE inquiries SET contacted_at = '2020-01-01T00:00:00Z' WHERE id = '00000000-0000-0000-0000-106200000008';
SELECT is(
  (SELECT contacted_at FROM inquiries WHERE id = '00000000-0000-0000-0000-106200000008'),
  NULL, 'a direct write does not set contacted_at on a new inquiry'
);
UPDATE inquiries SET status = 'contacted', contacted_at = '2020-01-01T00:00:00Z' WHERE id = '00000000-0000-0000-0000-106200000008';
SELECT is(
  (SELECT contacted_at FROM inquiries WHERE id = '00000000-0000-0000-0000-106200000008'),
  now(), 'a direct write with Mark contacted gets now(), not the written time'
);

-- channel goes with the task type
SELECT throws_ok(
  $$ INSERT INTO tasks (agency_id, title, task_type, channel) VALUES ('00000000-0000-0000-0000-10610000000a', 'x', 'email', 'viber') $$,
  '23514', NULL, 'a messenger channel needs a call task'
);
SELECT throws_ok(
  $$ INSERT INTO tasks (agency_id, title, task_type, channel) VALUES ('00000000-0000-0000-0000-10610000000a', 'x', 'call', 'sms') $$,
  '23514', NULL, 'an unknown channel is refused'
);
SELECT throws_ok(
  $$ INSERT INTO tasks (agency_id, title, task_type, channel) VALUES ('00000000-0000-0000-0000-10610000000a', 'x', NULL, 'phone') $$,
  '23514', NULL, 'a channel on an untyped task is refused'
);

-- AC-7: an inquiry of another agency can't be set on a task
SELECT throws_ok(
  $$ INSERT INTO tasks (agency_id, inquiry_id, title, task_type) VALUES
     ('00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-10620000000b', 'x', 'call') $$,
  '23503', NULL, 'a task can''t point at another agency''s inquiry'
);
SELECT throws_ok(
  $$ UPDATE tasks SET inquiry_id = '00000000-0000-0000-0000-10620000000b' WHERE id = '00000000-0000-0000-0000-106300000001' $$,
  '23503', NULL, 'a task can''t be moved to another agency''s inquiry'
);

RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-106000000002", "role": "authenticated"}', true);
SET ROLE authenticated;

SELECT throws_ok(
  $$ INSERT INTO tasks (agency_id, inquiry_id, title, task_type, channel, status, outcome, completed_at) VALUES
     ('00000000-0000-0000-0000-10610000000b', '00000000-0000-0000-0000-106200000005', 'x', 'call', 'phone', 'completed', 'Hi', now()) $$,
  '23503', NULL, 'a Beta broker can''t log a call on an Alpha inquiry'
);
SELECT throws_ok(
  $$ INSERT INTO tasks (agency_id, inquiry_id, title, task_type) VALUES
     ('00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106200000005', 'x', 'call') $$,
  '42501', NULL, 'a Beta broker can''t write an Alpha task'
);

-- Deleting the inquiry keeps its calls in their agency
RESET ROLE;
DELETE FROM inquiries WHERE id = '00000000-0000-0000-0000-106200000002';
SELECT results_eq(
  $$ SELECT agency_id, inquiry_id FROM tasks WHERE id = '00000000-0000-0000-0000-106300000001' $$,
  $$ VALUES ('00000000-0000-0000-0000-10610000000a'::uuid, NULL::uuid) $$,
  'deleting the inquiry nulls inquiry_id only'
);

SELECT * FROM finish();
ROLLBACK;
