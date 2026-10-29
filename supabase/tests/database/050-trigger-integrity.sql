BEGIN;
SELECT plan(9);

SELECT set_config('test.u1', gen_random_uuid()::text, true);
SELECT set_config('test.a1', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES (current_setting('test.u1')::uuid, 'owner@example.com');
INSERT INTO agencies (id, name, slug) VALUES (current_setting('test.a1')::uuid, 'Agency 1', 'a1');
INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES 
  (current_setting('test.a1')::uuid, current_setting('test.u1')::uuid, 'owner', 'active');

SELECT seed_agency_defaults(current_setting('test.a1')::uuid);

SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u1')), true);
SET ROLE authenticated;

-- Test audit contact status changes
SELECT set_config('test.c1', gen_random_uuid()::text, true);
INSERT INTO contacts (id, agency_id, display_name, first_name, type, status) VALUES (current_setting('test.c1')::uuid, current_setting('test.a1')::uuid, 'Test', 'Test', 'person', 'active');

-- initial count of audit_log
SELECT set_config('test.audit_cnt', (SELECT count(*) FROM audit_log)::text, true);

UPDATE contacts SET status = 'archived' WHERE id = current_setting('test.c1')::uuid;

SELECT results_eq(
    $$ SELECT count(*)::int FROM audit_log $$,
    $$ VALUES (current_setting('test.audit_cnt')::int + 1) $$,
    'Contact status change creates audit log'
);

-- Test audit opportunity changes
SELECT set_config('test.o1', gen_random_uuid()::text, true);
SELECT set_config('test.stage_id', (SELECT id FROM stages WHERE agency_id = current_setting('test.a1')::uuid LIMIT 1)::text, true);
INSERT INTO opportunities (id, agency_id, title, type, status, stage_id) VALUES (current_setting('test.o1')::uuid, current_setting('test.a1')::uuid, 'Test Opp', 'buyer', 'active', current_setting('test.stage_id')::uuid);

SELECT set_config('test.audit_cnt', (SELECT count(*) FROM audit_log)::text, true);

UPDATE opportunities SET status = 'won' WHERE id = current_setting('test.o1')::uuid;

SELECT results_eq(
    $$ SELECT count(*)::int FROM audit_log $$,
    $$ VALUES (current_setting('test.audit_cnt')::int + 1) $$,
    'Opportunity status change creates audit log'
);

-- Test sync_opportunity_next_action
SELECT is_empty(
    $$ SELECT next_action_at FROM opportunities WHERE id = current_setting('test.o1')::uuid AND next_action_at IS NOT NULL $$,
    'next_action_at is initially null'
);

SELECT set_config('test.t1', gen_random_uuid()::text, true);
INSERT INTO tasks (id, agency_id, title, due_at, opportunity_id) VALUES (current_setting('test.t1')::uuid, current_setting('test.a1')::uuid, 'Task 1', now() + interval '1 day', current_setting('test.o1')::uuid);

SELECT results_eq(
    $$ SELECT next_action_at::date FROM opportunities WHERE id = current_setting('test.o1')::uuid $$,
    $$ SELECT (now() + interval '1 day')::date $$,
    'next_action_at synced on task insert'
);

UPDATE tasks SET due_at = now() + interval '2 days' WHERE id = current_setting('test.t1')::uuid;

SELECT results_eq(
    $$ SELECT next_action_at::date FROM opportunities WHERE id = current_setting('test.o1')::uuid $$,
    $$ SELECT (now() + interval '2 days')::date $$,
    'next_action_at synced on task update'
);

-- Sprint 6.2: reschedule and cancel recompute next_action_at through the trigger (AC-6.2-3)
UPDATE opportunities SET status = 'active' WHERE id = current_setting('test.o1')::uuid;
SELECT set_config('test.t2', gen_random_uuid()::text, true);
INSERT INTO tasks (id, agency_id, title, due_at, opportunity_id) VALUES (current_setting('test.t2')::uuid, current_setting('test.a1')::uuid, 'Task 2', now() + interval '1 day', current_setting('test.o1')::uuid);

UPDATE tasks SET due_at = now() + interval '5 days' WHERE id = current_setting('test.t2')::uuid;

SELECT results_eq(
    $$ SELECT next_action_at FROM opportunities WHERE id = current_setting('test.o1')::uuid $$,
    $$ SELECT due_at FROM tasks WHERE id = current_setting('test.t1')::uuid $$,
    'rescheduling the earliest task later moves next_action_at to the next earliest'
);

UPDATE tasks SET status = 'cancelled', outcome = 'Client bought elsewhere' WHERE id = current_setting('test.t1')::uuid;

SELECT results_eq(
    $$ SELECT next_action_at FROM opportunities WHERE id = current_setting('test.o1')::uuid $$,
    $$ SELECT due_at FROM tasks WHERE id = current_setting('test.t2')::uuid $$,
    'cancelling a task drops it from next_action_at'
);

UPDATE tasks SET status = 'cancelled' WHERE id = current_setting('test.t2')::uuid;

SELECT results_eq(
    $$ SELECT id FROM opportunities WHERE id = current_setting('test.o1')::uuid AND status = 'active' AND next_action_at IS NULL $$,
    $$ VALUES (current_setting('test.o1')::uuid) $$,
    'cancelling the last pending task leaves the opportunity at risk'
);

UPDATE tasks SET status = 'pending' WHERE id = current_setting('test.t1')::uuid;

DELETE FROM tasks WHERE id = current_setting('test.t1')::uuid;

SELECT is_empty(
    $$ SELECT next_action_at FROM opportunities WHERE id = current_setting('test.o1')::uuid AND next_action_at IS NOT NULL $$,
    'next_action_at cleared on task delete'
);

SELECT * FROM finish();
ROLLBACK;
