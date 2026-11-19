BEGIN;
SELECT plan(39);

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
  ('00000000-0000-0000-0000-106200000014', '00000000-0000-0000-0000-10610000000a', 'contacted', 'Contacted earlier', NULL),
  ('00000000-0000-0000-0000-106200000015', '00000000-0000-0000-0000-10610000000a', 'new', 'Dismissed from new', NULL),
  ('00000000-0000-0000-0000-10620000000b', '00000000-0000-0000-0000-10610000000b', 'new', 'Other agency', NULL);

-- Plant a contacted_at the trigger would never accept, to prove a later call can't move it.
ALTER TABLE inquiries DISABLE TRIGGER trg_inquiry_contacted_at;
UPDATE inquiries SET contacted_at = '2026-11-18T10:00:00Z' WHERE id = '00000000-0000-0000-0000-106200000014';
ALTER TABLE inquiries ENABLE TRIGGER trg_inquiry_contacted_at;

SELECT has_column('tasks', 'inquiry_id', 'tasks.inquiry_id exists');
SELECT has_column('tasks', 'channel', 'tasks.channel exists');
SELECT is(
  (SELECT contacted_at FROM inquiries WHERE id = '00000000-0000-0000-0000-106200000001'),
  NULL, 'an insert starts with contacted_at NULL'
);

SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-106000000001", "role": "authenticated"}', true);
SET ROLE authenticated;

-- AC-2: the first attempt, answered or not, marks a new inquiry contacted when it is logged.
-- completed_at is the caller's to write, so it is not trusted: a backdated call stamps now().
INSERT INTO tasks (agency_id, inquiry_id, title, task_type, channel, status, outcome, completed_at, assigned_to, created_by) VALUES
  ('00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106200000001', 'Call with First call', 'call', 'phone',
   'completed', 'No answer', now() - interval '3 days', '00000000-0000-0000-0000-106000000001', '00000000-0000-0000-0000-106000000001');
SELECT results_eq(
  $$ SELECT status, contacted_at FROM inquiries WHERE id = '00000000-0000-0000-0000-106200000001' $$,
  $$ VALUES ('contacted'::text, now()) $$,
  'a broker''s first logged call sets contacted and contacted_at = now(), even backdated'
);

-- AC-3: a second call doesn't move it
INSERT INTO tasks (agency_id, inquiry_id, title, task_type, channel, status, outcome, completed_at) VALUES
  ('00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106200000001', 'Call with First call', 'call', 'viber',
   'completed', 'Answered', '2026-11-19T12:00:00Z');
SELECT is(
  (SELECT status FROM inquiries WHERE id = '00000000-0000-0000-0000-106200000001'),
  'contacted', 'a second call leaves the inquiry contacted'
);
INSERT INTO tasks (agency_id, inquiry_id, title, task_type, channel, status, outcome, completed_at) VALUES
  ('00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106200000014', 'Call', 'call', 'phone', 'completed', 'Hi', now());
SELECT is(
  (SELECT contacted_at FROM inquiries WHERE id = '00000000-0000-0000-0000-106200000014'),
  '2026-11-18T10:00:00Z'::timestamptz, 'a later call does not move a set contacted_at'
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
UPDATE tasks SET status = 'completed', outcome = 'Answered', completed_at = now() + interval '1 day', channel = 'phone'
WHERE id = '00000000-0000-0000-0000-106300000001';
SELECT results_eq(
  $$ SELECT status, contacted_at FROM inquiries WHERE id = '00000000-0000-0000-0000-106200000002' $$,
  $$ VALUES ('contacted'::text, now()) $$,
  'completing a pending call marks the inquiry at now(), not a future completed_at'
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
  $$ VALUES ('contacted'::text, now()) $$,
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
  now(), 'a direct write does not move a set contacted_at'
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

-- A dismissal straight from new never stamps a contact time
UPDATE inquiries SET status = 'dismissed', dismissed_reason = 'spam' WHERE id = '00000000-0000-0000-0000-106200000015';
SELECT results_eq(
  $$ SELECT status, contacted_at FROM inquiries WHERE id = '00000000-0000-0000-0000-106200000015' $$,
  $$ VALUES ('dismissed'::text, NULL::timestamptz) $$,
  'dismissing a new inquiry leaves contacted_at NULL'
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

-- ── T3: an inquiry's tasks follow conversion, join and dismissal ─────────────
-- Still the superuser here.
INSERT INTO stages (id, agency_id, name, sort_order) VALUES
  ('00000000-0000-0000-0000-106400000001', '00000000-0000-0000-0000-10610000000a', 'New', 1);
INSERT INTO contacts (id, agency_id, type, first_name, display_name) VALUES
  ('00000000-0000-0000-0000-106500000001', '00000000-0000-0000-0000-10610000000a', 'person', 'Caller', 'Caller');
INSERT INTO opportunities (id, agency_id, title, type, stage_id, primary_contact_id, assigned_to, status) VALUES
  ('00000000-0000-0000-0000-106600000001', '00000000-0000-0000-0000-10610000000a', 'Join target', 'buyer', '00000000-0000-0000-0000-106400000001', '00000000-0000-0000-0000-106500000001', '00000000-0000-0000-0000-106000000001', 'active'),
  ('00000000-0000-0000-0000-106600000002', '00000000-0000-0000-0000-10610000000a', 'Other deal', 'buyer', '00000000-0000-0000-0000-106400000001', '00000000-0000-0000-0000-106500000001', '00000000-0000-0000-0000-106000000001', 'active'),
  ('00000000-0000-0000-0000-106600000003', '00000000-0000-0000-0000-10610000000a', 'Third deal', 'buyer', '00000000-0000-0000-0000-106400000001', '00000000-0000-0000-0000-106500000001', '00000000-0000-0000-0000-106000000001', 'active');
INSERT INTO inquiries (id, agency_id, status, caller_name) VALUES
  ('00000000-0000-0000-0000-106200000010', '00000000-0000-0000-0000-10610000000a', 'new', 'Convert me'),
  ('00000000-0000-0000-0000-106200000011', '00000000-0000-0000-0000-10610000000a', 'new', 'Join me'),
  ('00000000-0000-0000-0000-106200000012', '00000000-0000-0000-0000-10610000000a', 'new', 'Dismiss me'),
  ('00000000-0000-0000-0000-106200000016', '00000000-0000-0000-0000-10610000000a', 'new', 'Matched later');

SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-106000000001", "role": "authenticated"}', true);
SET ROLE authenticated;

-- A no-answer call and its retry on each inquiry, plus one task already on another deal
INSERT INTO tasks (id, agency_id, inquiry_id, opportunity_id, title, task_type, channel, status, outcome, completed_at, due_at) VALUES
  ('00000000-0000-0000-0000-106300000010', '00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106200000010', NULL, 'Call', 'call', 'phone', 'completed', 'No answer', '2026-11-19T08:00:00Z', NULL),
  ('00000000-0000-0000-0000-106300000011', '00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106200000010', NULL, 'Call again', 'call', NULL, 'pending', NULL, NULL, '2026-11-20T09:00:00Z'),
  ('00000000-0000-0000-0000-106300000012', '00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106200000010', '00000000-0000-0000-0000-106600000002', 'On another deal', 'call', NULL, 'pending', NULL, NULL, '2026-11-25T09:00:00Z'),
  ('00000000-0000-0000-0000-106300000020', '00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106200000011', NULL, 'Call', 'call', 'viber', 'completed', 'No answer', '2026-11-19T08:30:00Z', NULL),
  ('00000000-0000-0000-0000-106300000021', '00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106200000011', NULL, 'Call again', 'call', NULL, 'pending', NULL, NULL, '2026-11-21T09:00:00Z'),
  ('00000000-0000-0000-0000-106300000030', '00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106200000012', NULL, 'Call', 'call', 'phone', 'completed', 'No answer', '2026-11-19T08:45:00Z', NULL),
  ('00000000-0000-0000-0000-106300000031', '00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106200000012', NULL, 'Call again', 'call', NULL, 'pending', NULL, NULL, '2026-11-22T09:00:00Z');

-- AC-4: conversion
SELECT isnt(
  (SELECT public.convert_inquiry(
    '00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106200000010', 'Converted deal', 'buyer',
    '00000000-0000-0000-0000-106400000001', NULL, '00000000-0000-0000-0000-106500000001', NULL, '[]')->>'opportunity_id'),
  NULL, 'convert_inquiry still converts'
);
SELECT results_eq(
  $$ SELECT t.id, t.opportunity_id, t.contact_id FROM tasks t
     WHERE t.id IN ('00000000-0000-0000-0000-106300000010', '00000000-0000-0000-0000-106300000011') ORDER BY t.id $$,
  $$ SELECT t.id, i.opportunity_id, '00000000-0000-0000-0000-106500000001'::uuid
     FROM tasks t JOIN inquiries i ON i.id = '00000000-0000-0000-0000-106200000010'
     WHERE t.id IN ('00000000-0000-0000-0000-106300000010', '00000000-0000-0000-0000-106300000011') ORDER BY t.id $$,
  'conversion gives the inquiry''s call and retry the new deal and contact'
);
SELECT is(
  (SELECT o.next_action_at FROM opportunities o JOIN inquiries i ON i.opportunity_id = o.id
   WHERE i.id = '00000000-0000-0000-0000-106200000010'),
  '2026-11-20T09:00:00Z'::timestamptz, 'the pending retry sets the new deal''s next_action_at'
);
SELECT is(
  (SELECT opportunity_id FROM tasks WHERE id = '00000000-0000-0000-0000-106300000012'),
  '00000000-0000-0000-0000-106600000002'::uuid, 'a task already on a deal keeps it'
);
SELECT is(
  (SELECT contacted_at FROM inquiries WHERE id = '00000000-0000-0000-0000-106200000010'),
  now(), 'conversion keeps the first call''s contacted_at'
);

-- AC-4: join
SELECT isnt(
  (SELECT public.join_inquiry(
    '00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106200000011',
    '00000000-0000-0000-0000-106500000001', '00000000-0000-0000-0000-106600000001', NULL)->>'owner_id'),
  NULL, 'join_inquiry still joins'
);
SELECT results_eq(
  $$ SELECT opportunity_id, contact_id FROM tasks
     WHERE id IN ('00000000-0000-0000-0000-106300000020', '00000000-0000-0000-0000-106300000021') $$,
  $$ VALUES ('00000000-0000-0000-0000-106600000001'::uuid, '00000000-0000-0000-0000-106500000001'::uuid),
            ('00000000-0000-0000-0000-106600000001'::uuid, '00000000-0000-0000-0000-106500000001'::uuid) $$,
  'a join gives the inquiry''s call and retry the joined deal and contact'
);
SELECT is(
  (SELECT next_action_at FROM opportunities WHERE id = '00000000-0000-0000-0000-106600000001'),
  '2026-11-21T09:00:00Z'::timestamptz, 'the pending retry sets the joined deal''s next_action_at'
);

-- AC-4: dismissal cancels pending tasks only
UPDATE inquiries SET status = 'dismissed', dismissed_reason = 'spam' WHERE id = '00000000-0000-0000-0000-106200000012';
SELECT results_eq(
  $$ SELECT status, outcome FROM tasks WHERE id = '00000000-0000-0000-0000-106300000031' $$,
  $$ VALUES ('cancelled'::text, 'phoneLoop.cancelledByDismiss'::text) $$,
  'dismissing cancels the pending retry with an i18n key'
);
SELECT results_eq(
  $$ SELECT status, outcome FROM tasks WHERE id = '00000000-0000-0000-0000-106300000030' $$,
  $$ VALUES ('completed'::text, 'No answer'::text) $$,
  'dismissing leaves the logged call alone'
);

-- O3: a task that changes deal recomputes both deals
UPDATE tasks SET opportunity_id = '00000000-0000-0000-0000-106600000003' WHERE id = '00000000-0000-0000-0000-106300000012';
SELECT results_eq(
  $$ SELECT id, next_action_at FROM opportunities
     WHERE id IN ('00000000-0000-0000-0000-106600000002', '00000000-0000-0000-0000-106600000003') ORDER BY id $$,
  $$ VALUES ('00000000-0000-0000-0000-106600000002'::uuid, NULL::timestamptz),
            ('00000000-0000-0000-0000-106600000003'::uuid, '2026-11-25T09:00:00Z'::timestamptz) $$,
  'moving a task between deals recomputes the deal it left and the one it joined'
);

-- A contact alone (a match, or a contact merge) fills the tasks' empty contact, not a deal
INSERT INTO tasks (id, agency_id, inquiry_id, title, task_type, due_at) VALUES
  ('00000000-0000-0000-0000-106300000040', '00000000-0000-0000-0000-10610000000a', '00000000-0000-0000-0000-106200000016',
   'Call again', 'call', '2026-11-23T09:00:00Z');
UPDATE inquiries SET contact_id = '00000000-0000-0000-0000-106500000001' WHERE id = '00000000-0000-0000-0000-106200000016';
SELECT results_eq(
  $$ SELECT opportunity_id, contact_id FROM tasks WHERE id = '00000000-0000-0000-0000-106300000040' $$,
  $$ VALUES (NULL::uuid, '00000000-0000-0000-0000-106500000001'::uuid) $$,
  'giving the inquiry a contact fills its tasks'' empty contact'
);

SELECT * FROM finish();
ROLLBACK;
