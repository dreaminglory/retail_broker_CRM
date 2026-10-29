BEGIN;
SELECT plan(14);

SELECT set_config('test.u_owner', gen_random_uuid()::text, true);
SELECT set_config('test.u_manager', gen_random_uuid()::text, true);
SELECT set_config('test.u_broker', gen_random_uuid()::text, true);
SELECT set_config('test.u_invitee', gen_random_uuid()::text, true);
SELECT set_config('test.u_invitee_2', gen_random_uuid()::text, true);
SELECT set_config('test.a1', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES 
  (current_setting('test.u_owner')::uuid, 'owner@example.com'),
  (current_setting('test.u_manager')::uuid, 'manager@example.com'),
  (current_setting('test.u_broker')::uuid, 'broker@example.com'),
  (current_setting('test.u_invitee')::uuid, 'invitee@example.com'),
  (current_setting('test.u_invitee_2')::uuid, 'invitee2@example.com');

INSERT INTO agencies (id, name, slug) VALUES (current_setting('test.a1')::uuid, 'Agency 1', 'a1');

INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES 
  (current_setting('test.a1')::uuid, current_setting('test.u_owner')::uuid, 'owner', 'active'),
  (current_setting('test.a1')::uuid, current_setting('test.u_manager')::uuid, 'manager', 'active'),
  (current_setting('test.a1')::uuid, current_setting('test.u_broker')::uuid, 'broker', 'active');

SELECT seed_agency_defaults(current_setting('test.a1')::uuid);

-- Act as Broker
SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u_broker')), true);
SET ROLE authenticated;

SELECT throws_ok(
    $$ INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES (current_setting('test.a1')::uuid, current_setting('test.u_invitee')::uuid, 'broker', 'invited') $$,
    'new row violates row-level security policy for table "agency_memberships"',
    'Broker cannot invite'
);

SELECT is_empty(
    $$ UPDATE agencies SET name = 'Hacked' WHERE id = current_setting('test.a1')::uuid RETURNING id $$,
    'Broker cannot update agency settings (returns 0 rows)'
);

-- Act as Manager
RESET ROLE;
SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u_manager')), true);
SET ROLE authenticated;

SELECT throws_ok(
    $$ INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES (current_setting('test.a1')::uuid, current_setting('test.u_invitee')::uuid, 'manager', 'invited') $$,
    'new row violates row-level security policy for table "agency_memberships"',
    'Manager cannot invite another manager'
);

SELECT lives_ok(
    $$ INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES (current_setting('test.a1')::uuid, current_setting('test.u_invitee')::uuid, 'broker', 'invited') $$,
    'Manager can invite broker'
);

-- Act as Owner
RESET ROLE;
SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u_owner')), true);
SET ROLE authenticated;

SELECT lives_ok(
    $$ INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES (current_setting('test.a1')::uuid, current_setting('test.u_invitee_2')::uuid, 'owner', 'invited') $$,
    'Owner can invite owner'
);

SELECT lives_ok(
    $$ UPDATE agencies SET name = 'Renamed' WHERE id = current_setting('test.a1')::uuid $$,
    'Owner can update agency settings'
);


-- AD-045: stages, lead sources and contact merge are owner/manager only.
RESET ROLE;
SELECT set_config('test.c1', gen_random_uuid()::text, true);
SELECT set_config('test.c2', gen_random_uuid()::text, true);
INSERT INTO contacts (id, agency_id, type, first_name, display_name) VALUES
  (current_setting('test.c1')::uuid, current_setting('test.a1')::uuid, 'person', 'Winner', 'Winner'),
  (current_setting('test.c2')::uuid, current_setting('test.a1')::uuid, 'person', 'Loser', 'Loser');

-- Act as Broker
SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u_broker')), true);
SET ROLE authenticated;

SELECT throws_ok(
    $$ INSERT INTO stages (agency_id, name, sort_order) VALUES (current_setting('test.a1')::uuid, 'Broker stage', 99) $$,
    'new row violates row-level security policy for table "stages"',
    'Broker cannot create a stage'
);

SELECT is_empty(
    $$ UPDATE stages SET name = 'Renamed by broker' WHERE agency_id = current_setting('test.a1')::uuid RETURNING id $$,
    'Broker cannot rename a stage (returns 0 rows)'
);

SELECT throws_ok(
    $$ INSERT INTO lead_sources (agency_id, name, channel) VALUES (current_setting('test.a1')::uuid, 'Broker source', 'other') $$,
    'new row violates row-level security policy for table "lead_sources"',
    'Broker cannot create a lead source'
);

SELECT is_empty(
    $$ UPDATE lead_sources SET name = 'Renamed by broker' WHERE agency_id = current_setting('test.a1')::uuid RETURNING id $$,
    'Broker cannot edit a lead source (returns 0 rows)'
);

SELECT throws_ok(
    $$ INSERT INTO merge_history (agency_id, winner_contact_id, loser_contact_id, merged_by, loser_snapshot)
       VALUES (current_setting('test.a1')::uuid, current_setting('test.c1')::uuid, current_setting('test.c2')::uuid, current_setting('test.u_broker')::uuid, '{}') $$,
    'new row violates row-level security policy for table "merge_history"',
    'Broker cannot record a contact merge'
);

-- Act as Manager
RESET ROLE;
SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u_manager')), true);
SET ROLE authenticated;

SELECT lives_ok(
    $$ INSERT INTO stages (agency_id, name, sort_order) VALUES (current_setting('test.a1')::uuid, 'Manager stage', 99) $$,
    'Manager can create a stage'
);

SELECT lives_ok(
    $$ INSERT INTO lead_sources (agency_id, name, channel) VALUES (current_setting('test.a1')::uuid, 'Manager source', 'other') $$,
    'Manager can create a lead source'
);

SELECT lives_ok(
    $$ INSERT INTO merge_history (agency_id, winner_contact_id, loser_contact_id, merged_by, loser_snapshot)
       VALUES (current_setting('test.a1')::uuid, current_setting('test.c1')::uuid, current_setting('test.c2')::uuid, current_setting('test.u_manager')::uuid, '{}') $$,
    'Manager can record a contact merge'
);

SELECT * FROM finish();
ROLLBACK;
