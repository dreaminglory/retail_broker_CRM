-- spec: properties, Checkpoint 3 review. Deleting an agency with links, links and listings
-- that can't move to another row, and party history that a contact delete can't erase.
BEGIN;
SELECT plan(10);

SELECT set_config('test.a1', gen_random_uuid()::text, true);
SELECT set_config('test.u_owner', gen_random_uuid()::text, true);
SELECT set_config('test.u_broker', gen_random_uuid()::text, true);
SELECT set_config('test.buyer', gen_random_uuid()::text, true);
SELECT set_config('test.contact', gen_random_uuid()::text, true);
SELECT set_config('test.imported', gen_random_uuid()::text, true);
SELECT set_config('test.job', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES
  (current_setting('test.u_owner')::uuid, 'r-owner@example.com'),
  (current_setting('test.u_broker')::uuid, 'r-broker@example.com');
INSERT INTO agencies (id, name, slug) VALUES (current_setting('test.a1')::uuid, 'Agency R1', 'r1');
INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.u_owner')::uuid, 'owner', 'active'),
  (current_setting('test.a1')::uuid, current_setting('test.u_broker')::uuid, 'broker', 'active');
SELECT seed_agency_defaults(current_setting('test.a1')::uuid);

SELECT set_config('test.sofia', (SELECT id FROM settlements WHERE ekatte = '68134')::text, true);
SELECT set_config('test.stage', (SELECT id FROM stages WHERE agency_id = current_setting('test.a1')::uuid ORDER BY sort_order LIMIT 1)::text, true);

CREATE FUNCTION pg_temp.act_as(p_user TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    format('{"sub": "%s", "role": "authenticated"}', current_setting('test.' || p_user)), true);
  SET ROLE authenticated;
END;
$$;

CREATE FUNCTION pg_temp.add_property() RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO properties (agency_id, code, type, settlement_id)
  VALUES (current_setting('test.a1')::uuid, 0, 'garage', current_setting('test.sofia')::uuid)
  RETURNING id;
$$;

SELECT pg_temp.act_as('u_broker');
SELECT set_config('test.p1', pg_temp.add_property()::text, true);
SELECT set_config('test.p2', pg_temp.add_property()::text, true);

INSERT INTO opportunities (id, agency_id, title, type, stage_id) VALUES
  (current_setting('test.buyer')::uuid, current_setting('test.a1')::uuid, 'Купувач', 'buyer', current_setting('test.stage')::uuid);
INSERT INTO opportunity_properties (agency_id, opportunity_id, property_id, relation, status) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.buyer')::uuid, current_setting('test.p1')::uuid, 'candidate', 'candidate');
INSERT INTO listings (agency_id, property_id, offer_type, price) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.p1')::uuid, 'sale', 100000);

-- ── Links and listings stay on their property ────────────────────────────────

SELECT throws_ok(
  $$ UPDATE opportunity_properties SET property_id = current_setting('test.p2')::uuid
     WHERE opportunity_id = current_setting('test.buyer')::uuid $$,
  '42501', NULL,
  'A link cannot be moved to another property'
);

SELECT throws_ok(
  $$ UPDATE listings SET property_id = current_setting('test.p2')::uuid
     WHERE property_id = current_setting('test.p1')::uuid $$,
  '42501', NULL,
  'A listing cannot be moved to another property'
);

SELECT throws_ok(
  $$ UPDATE listings SET offer_type = 'rent' WHERE property_id = current_setting('test.p1')::uuid $$,
  '42501', NULL,
  'A listing cannot change its offer type'
);

SELECT lives_ok(
  $$ UPDATE opportunity_properties SET status = 'rejected', rejected_reason = 'Далеко'
     WHERE opportunity_id = current_setting('test.buyer')::uuid $$,
  'A link status and reason can still change'
);

SELECT lives_ok(
  $$ UPDATE listings SET price = 95000 WHERE property_id = current_setting('test.p1')::uuid $$,
  'A listing price can still change'
);

SELECT lives_ok(
  $$ UPDATE properties SET status = 'archived' WHERE id = current_setting('test.p1')::uuid $$,
  'Archiving still withdraws the listing (a status update as the caller)'
);

-- ── Party history survives contact deletes ───────────────────────────────────

INSERT INTO contacts (id, agency_id, type, first_name, display_name) VALUES
  (current_setting('test.contact')::uuid, current_setting('test.a1')::uuid, 'person', 'Мария', 'Мария');
INSERT INTO property_parties (agency_id, property_id, contact_id, role, ended_at) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.p2')::uuid, current_setting('test.contact')::uuid, 'owner', now());

SELECT pg_temp.act_as('u_owner');
SELECT throws_ok(
  $$ DELETE FROM contacts WHERE id = current_setting('test.contact')::uuid $$,
  '23503', NULL,
  'A contact with property parties, even ended ones, cannot be deleted'
);

-- An imported contact who became a party is work, so the revert keeps it (AD-036).
RESET ROLE;
INSERT INTO import_jobs (id, agency_id, entity_type, status, file_name, file_sha256, file_size_bytes, total_rows, options, completed_at)
VALUES (current_setting('test.job')::uuid, current_setting('test.a1')::uuid, 'contact', 'completed', 'r.csv',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 100, 1, '{}', now());
INSERT INTO contacts (id, agency_id, type, first_name, display_name, import_job_id) VALUES
  (current_setting('test.imported')::uuid, current_setting('test.a1')::uuid, 'person', 'Внесен', 'Внесен', current_setting('test.job')::uuid);
INSERT INTO property_parties (agency_id, property_id, contact_id, role) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.p2')::uuid, current_setting('test.imported')::uuid, 'co_owner');

SELECT pg_temp.act_as('u_owner');
SELECT lives_ok(
  $$ SELECT import_revert(current_setting('test.job')::uuid) $$,
  'Reverting an import whose contact is a property party succeeds'
);
SELECT ok(
  EXISTS (SELECT 1 FROM contacts WHERE id = current_setting('test.imported')::uuid),
  'The revert keeps an imported contact who is a property party'
);

-- ── Deleting an agency with property links ───────────────────────────────────

RESET ROLE;
SELECT lives_ok(
  $$ DELETE FROM agencies WHERE id = current_setting('test.a1')::uuid $$,
  'An agency with property links can be deleted'
);

SELECT * FROM finish();
ROLLBACK;
