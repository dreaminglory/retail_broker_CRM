BEGIN;
SELECT plan(31);

-- Setup: two agencies, as the superuser. Ids: 82 + kind + n.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-820000000001', 'manager@j1.example'),
  ('00000000-0000-0000-0000-820000000002', 'broker@j1.example'),
  ('00000000-0000-0000-0000-820000000003', 'manager@j2.example');

INSERT INTO agencies (id, name, slug) VALUES
  ('00000000-0000-0000-0000-82100000000a', 'Join 1', 'join-1'),
  ('00000000-0000-0000-0000-82100000000b', 'Join 2', 'join-2');

INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES
  ('00000000-0000-0000-0000-82100000000a', '00000000-0000-0000-0000-820000000001', 'manager', 'active'),
  ('00000000-0000-0000-0000-82100000000a', '00000000-0000-0000-0000-820000000002', 'broker', 'active'),
  ('00000000-0000-0000-0000-82100000000b', '00000000-0000-0000-0000-820000000003', 'manager', 'active');

INSERT INTO stages (id, agency_id, name, sort_order) VALUES
  ('00000000-0000-0000-0000-82200000000a', '00000000-0000-0000-0000-82100000000a', 'New', 1);

INSERT INTO contacts (id, agency_id, type, first_name, display_name) VALUES
  ('00000000-0000-0000-0000-823000000001', '00000000-0000-0000-0000-82100000000a', 'person', 'Primary', 'Primary'),
  ('00000000-0000-0000-0000-823000000002', '00000000-0000-0000-0000-82100000000a', 'person', 'Participant', 'Participant'),
  ('00000000-0000-0000-0000-823000000003', '00000000-0000-0000-0000-82100000000a', 'person', 'Stranger', 'Stranger');

INSERT INTO opportunities (id, agency_id, title, type, stage_id, primary_contact_id, assigned_to, status, closed_at, lost_reason) VALUES
  ('00000000-0000-0000-0000-824000000001', '00000000-0000-0000-0000-82100000000a', 'Active owned', 'buyer', '00000000-0000-0000-0000-82200000000a', '00000000-0000-0000-0000-823000000001', '00000000-0000-0000-0000-820000000001', 'active', NULL, NULL),
  ('00000000-0000-0000-0000-824000000002', '00000000-0000-0000-0000-82100000000a', 'Nurture', 'buyer', '00000000-0000-0000-0000-82200000000a', '00000000-0000-0000-0000-823000000001', '00000000-0000-0000-0000-820000000001', 'nurture', now(), 'no_budget'),
  ('00000000-0000-0000-0000-824000000003', '00000000-0000-0000-0000-82100000000a', 'Ownerless', 'buyer', '00000000-0000-0000-0000-82200000000a', '00000000-0000-0000-0000-823000000001', NULL, 'active', NULL, NULL),
  ('00000000-0000-0000-0000-824000000004', '00000000-0000-0000-0000-82100000000a', 'Won', 'buyer', '00000000-0000-0000-0000-82200000000a', '00000000-0000-0000-0000-823000000001', '00000000-0000-0000-0000-820000000001', 'won', now(), NULL),
  ('00000000-0000-0000-0000-824000000005', '00000000-0000-0000-0000-82100000000a', 'Archived', 'buyer', '00000000-0000-0000-0000-82200000000a', '00000000-0000-0000-0000-823000000001', NULL, 'archived', now(), NULL),
  ('00000000-0000-0000-0000-824000000006', '00000000-0000-0000-0000-82100000000a', 'Lost', 'buyer', '00000000-0000-0000-0000-82200000000a', '00000000-0000-0000-0000-823000000001', NULL, 'lost', now(), 'no_budget'),
  ('00000000-0000-0000-0000-824000000007', '00000000-0000-0000-0000-82100000000a', 'Participant deal', 'buyer', '00000000-0000-0000-0000-82200000000a', '00000000-0000-0000-0000-823000000001', '00000000-0000-0000-0000-820000000001', 'active', NULL, NULL);

INSERT INTO opportunity_participants (agency_id, opportunity_id, contact_id, role) VALUES
  ('00000000-0000-0000-0000-82100000000a', '00000000-0000-0000-0000-824000000007', '00000000-0000-0000-0000-823000000002', 'buyer');

INSERT INTO inquiries (id, agency_id, status, caller_name, assigned_to) VALUES
  ('00000000-0000-0000-0000-825000000001', '00000000-0000-0000-0000-82100000000a', 'new', 'I1', '00000000-0000-0000-0000-820000000002'),
  ('00000000-0000-0000-0000-825000000002', '00000000-0000-0000-0000-82100000000a', 'contacted', 'I2', '00000000-0000-0000-0000-820000000002'),
  ('00000000-0000-0000-0000-825000000003', '00000000-0000-0000-0000-82100000000a', 'new', 'I3', '00000000-0000-0000-0000-820000000002'),
  ('00000000-0000-0000-0000-825000000004', '00000000-0000-0000-0000-82100000000a', 'new', 'I4', '00000000-0000-0000-0000-820000000002'),
  ('00000000-0000-0000-0000-825000000005', '00000000-0000-0000-0000-82100000000a', 'dismissed', 'I5', NULL),
  ('00000000-0000-0000-0000-825000000006', '00000000-0000-0000-0000-82100000000a', 'new', 'I6', NULL);

SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-820000000002", "role": "authenticated"}', true);
SET ROLE authenticated;

-- AC-1: a new inquiry joins an active deal with a call-back task
SELECT is(
  (SELECT public.join_inquiry(
    '00000000-0000-0000-0000-82100000000a', '00000000-0000-0000-0000-825000000001',
    '00000000-0000-0000-0000-823000000001', '00000000-0000-0000-0000-824000000001',
    '{"title": "Call back", "due_at": "2026-12-01T10:00:00Z"}'::jsonb)->>'owner_id'),
  '00000000-0000-0000-0000-820000000001',
  'join returns the deal owner'
);
SELECT results_eq(
  $$ SELECT status, contact_id, opportunity_id FROM inquiries WHERE id = '00000000-0000-0000-0000-825000000001' $$,
  $$ VALUES ('converted'::text, '00000000-0000-0000-0000-823000000001'::uuid, '00000000-0000-0000-0000-824000000001'::uuid) $$,
  'the inquiry is converted onto the deal and contact'
);
SELECT is((SELECT count(*)::int FROM opportunities), 7, 'no new opportunity');
SELECT results_eq(
  $$ SELECT task_type, assigned_to, title, status FROM tasks WHERE opportunity_id = '00000000-0000-0000-0000-824000000001' $$,
  $$ VALUES ('call'::text, '00000000-0000-0000-0000-820000000001'::uuid, 'Call back'::text, 'pending'::text) $$,
  'a call task exists for the deal owner'
);
SELECT is(
  (SELECT next_action_at FROM opportunities WHERE id = '00000000-0000-0000-0000-824000000001'),
  '2026-12-01T10:00:00Z'::timestamptz,
  'next_action_at follows the task'
);

-- A contacted inquiry joins through a participant; no task when p_task is NULL
SELECT is(
  (SELECT public.join_inquiry(
    '00000000-0000-0000-0000-82100000000a', '00000000-0000-0000-0000-825000000002',
    '00000000-0000-0000-0000-823000000002', '00000000-0000-0000-0000-824000000007', NULL)->>'task_id'),
  NULL,
  'a contacted inquiry joins through a participant, without a task'
);
SELECT is((SELECT count(*)::int FROM tasks WHERE opportunity_id = '00000000-0000-0000-0000-824000000007'), 0, 'p_task NULL creates no task');

-- AC-2: nurture is reactivated
SELECT is(
  (SELECT public.join_inquiry(
    '00000000-0000-0000-0000-82100000000a', '00000000-0000-0000-0000-825000000003',
    '00000000-0000-0000-0000-823000000001', '00000000-0000-0000-0000-824000000002', NULL)->>'reactivated'),
  'true',
  'joining a nurture deal reports reactivated'
);
SELECT results_eq(
  $$ SELECT status, closed_at, lost_reason FROM opportunities WHERE id = '00000000-0000-0000-0000-824000000002' $$,
  $$ VALUES ('active'::text, NULL::timestamptz, NULL::text) $$,
  'the nurture deal is active with closed_at and lost_reason cleared'
);
SELECT is(
  (SELECT count(*)::int FROM audit_log WHERE entity_id = '00000000-0000-0000-0000-824000000002' AND action = 'status_change'),
  1,
  'the reactivation is audited'
);

-- An ownerless deal takes the assignee of the inquiry
SELECT is(
  (SELECT public.join_inquiry(
    '00000000-0000-0000-0000-82100000000a', '00000000-0000-0000-0000-825000000004',
    '00000000-0000-0000-0000-823000000001', '00000000-0000-0000-0000-824000000003',
    '{"title": "Call", "due_at": "2026-12-02T10:00:00Z"}'::jsonb)->>'owner_id'),
  '00000000-0000-0000-0000-820000000002',
  'a deal with no owner takes the inquiry assignee'
);
SELECT is(
  (SELECT assigned_to FROM opportunities WHERE id = '00000000-0000-0000-0000-824000000003'),
  '00000000-0000-0000-0000-820000000002'::uuid,
  'and is saved on the deal'
);

-- Refusals change nothing
SELECT throws_ok(
  $$ SELECT public.join_inquiry('00000000-0000-0000-0000-82100000000a', '00000000-0000-0000-0000-825000000001',
       '00000000-0000-0000-0000-823000000001', '00000000-0000-0000-0000-824000000001', NULL) $$,
  'P0001', 'errors.inquiries.invalid_transition', 'a converted inquiry is refused'
);
SELECT throws_ok(
  $$ SELECT public.join_inquiry('00000000-0000-0000-0000-82100000000a', '00000000-0000-0000-0000-825000000005',
       '00000000-0000-0000-0000-823000000001', '00000000-0000-0000-0000-824000000001', NULL) $$,
  'P0001', 'errors.inquiries.invalid_transition', 'a dismissed inquiry is refused'
);
SELECT throws_ok(
  $$ SELECT public.join_inquiry('00000000-0000-0000-0000-82100000000a', '00000000-0000-0000-0000-825000000006',
       '00000000-0000-0000-0000-823000000001', '00000000-0000-0000-0000-824000000004', NULL) $$,
  'P0001', 'errors.inquiries.join_closed_opportunity', 'a won deal is refused'
);
SELECT throws_ok(
  $$ SELECT public.join_inquiry('00000000-0000-0000-0000-82100000000a', '00000000-0000-0000-0000-825000000006',
       '00000000-0000-0000-0000-823000000001', '00000000-0000-0000-0000-824000000005', NULL) $$,
  'P0001', 'errors.inquiries.join_closed_opportunity', 'an archived deal is refused'
);
SELECT throws_ok(
  $$ SELECT public.join_inquiry('00000000-0000-0000-0000-82100000000a', '00000000-0000-0000-0000-825000000006',
       '00000000-0000-0000-0000-823000000001', '00000000-0000-0000-0000-824000000006', NULL) $$,
  'P0001', 'errors.inquiries.join_closed_opportunity', 'a lost deal is refused'
);
SELECT throws_ok(
  $$ SELECT public.join_inquiry('00000000-0000-0000-0000-82100000000a', '00000000-0000-0000-0000-825000000006',
       '00000000-0000-0000-0000-823000000003', '00000000-0000-0000-0000-824000000001', NULL) $$,
  'P0001', 'errors.inquiries.join_contact_not_on_opportunity', 'a contact that is not on the deal is refused'
);
SELECT is(
  (SELECT status FROM inquiries WHERE id = '00000000-0000-0000-0000-825000000006'),
  'new',
  'a refused join leaves the inquiry untouched'
);

-- AC-5: a caller from the other agency
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-820000000003", "role": "authenticated"}', true);
SET ROLE authenticated;

SELECT throws_ok(
  $$ SELECT public.join_inquiry('00000000-0000-0000-0000-82100000000a', '00000000-0000-0000-0000-825000000006',
       '00000000-0000-0000-0000-823000000001', '00000000-0000-0000-0000-824000000001', NULL) $$,
  'P0001', 'errors.not_found', 'the other agency cannot use agency 1 as p_agency_id'
);
SELECT throws_ok(
  $$ SELECT public.join_inquiry('00000000-0000-0000-0000-82100000000b', '00000000-0000-0000-0000-825000000006',
       '00000000-0000-0000-0000-823000000001', '00000000-0000-0000-0000-824000000001', NULL) $$,
  'P0001', 'errors.not_found', 'nor its own agency id with foreign ids'
);

RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM tasks WHERE agency_id = '00000000-0000-0000-0000-82100000000a'), 2,
  'the refusals created no tasks'
);

-- Review fixes: the RPC validates the call back itself; joined_at dates the join
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-820000000002", "role": "authenticated"}', true);
SET ROLE authenticated;

SELECT throws_ok(
  $$ SELECT public.join_inquiry('00000000-0000-0000-0000-82100000000a', '00000000-0000-0000-0000-825000000006',
       '00000000-0000-0000-0000-823000000001', '00000000-0000-0000-0000-824000000001',
       '{"title": "   ", "due_at": "2026-12-01T10:00:00Z"}'::jsonb) $$,
  'P0001', 'errors.inquiries.join_invalid_task', 'a blank call-back title is refused with a key'
);
SELECT throws_ok(
  $$ SELECT public.join_inquiry('00000000-0000-0000-0000-82100000000a', '00000000-0000-0000-0000-825000000006',
       '00000000-0000-0000-0000-823000000001', '00000000-0000-0000-0000-824000000001',
       '{"title": "Call", "due_at": "not a date"}'::jsonb) $$,
  'P0001', 'errors.inquiries.join_invalid_task', 'a bad call-back date is refused with a key'
);
SELECT throws_ok(
  $$ SELECT public.join_inquiry('00000000-0000-0000-0000-82100000000a', '00000000-0000-0000-0000-825000000006',
       '00000000-0000-0000-0000-823000000001', '00000000-0000-0000-0000-824000000001',
       '{"title": "Call"}'::jsonb) $$,
  'P0001', 'errors.inquiries.join_invalid_task', 'a missing call-back date is refused with a key'
);
SELECT is(
  (SELECT status FROM inquiries WHERE id = '00000000-0000-0000-0000-825000000006'),
  'new', 'a refused call back leaves the inquiry untouched'
);
SELECT is(
  (SELECT (public.join_inquiry('00000000-0000-0000-0000-82100000000a', '00000000-0000-0000-0000-825000000006',
       '00000000-0000-0000-0000-823000000001', '00000000-0000-0000-0000-824000000001',
       'null'::jsonb)->>'task_id') IS NULL),
  true, 'a JSON null call back means no task'
);
SELECT ok(
  (SELECT joined_at IS NOT NULL AND joined_at > now() - interval '1 minute'
   FROM inquiries WHERE id = '00000000-0000-0000-0000-825000000006'),
  'a join stamps joined_at'
);
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM inquiries WHERE agency_id = '00000000-0000-0000-0000-82100000000a'
     AND status <> 'converted' AND joined_at IS NOT NULL),
  0, 'only joined inquiries have joined_at'
);

-- Grants
SELECT is(has_function_privilege('anon', 'public.join_inquiry(uuid,uuid,uuid,uuid,jsonb)', 'EXECUTE'), false, 'anon cannot execute');
SELECT is(has_function_privilege('authenticated', 'public.join_inquiry(uuid,uuid,uuid,uuid,jsonb)', 'EXECUTE'), true, 'authenticated can execute');

SELECT * FROM finish();
ROLLBACK;
