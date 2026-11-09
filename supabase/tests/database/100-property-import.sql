-- spec: property-import, Tasks 1 and 4 (AD-064). Entity type, job ids, address key, audit
-- metadata, and the address match function used by validation.
BEGIN;
SELECT plan(23);

SELECT set_config('test.a1', gen_random_uuid()::text, true);
SELECT set_config('test.u1', gen_random_uuid()::text, true);
SELECT set_config('test.job', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES (current_setting('test.u1')::uuid, 'pim-owner@example.com');
INSERT INTO agencies (id, name, slug) VALUES (current_setting('test.a1')::uuid, 'Agency PIM', 'pim1');
INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.u1')::uuid, 'owner', 'active');
SELECT seed_agency_defaults(current_setting('test.a1')::uuid);

SELECT set_config('test.sofia', (SELECT id FROM settlements WHERE ekatte = '68134')::text, true);

SELECT set_config('request.jwt.claims',
  format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u1')), true);
SET ROLE authenticated;

-- ── Address key ──────────────────────────────────────────────────────────────

SELECT is(
  property_address_key('ул. "Яворов" № 12, ет. 3'),
  property_address_key('ул Яворов 12 ет 3'),
  'Street word, quotes, № and punctuation do not change the key'
);
SELECT is(property_address_key('ул Яворов 12 ет 3'), 'яворов12ет3', 'The key is lowercase with no spaces');
SELECT is(
  property_address_key('бул. Витоша 5'), property_address_key('Витоша 5'),
  'бул. is removed as a word'
);
SELECT is(
  property_address_key('ж.к. Младост 1, бл. 12'), property_address_key('жк Младост 1 бл 12'),
  'ж.к. and жк give the same key'
);
SELECT is(property_address_key('Улична 4'), 'улична4', 'A street name starting with "ул" is kept');
SELECT is(property_address_key('   '), NULL, 'Blank text gives NULL');
SELECT is(property_address_key(' , . '), NULL, 'Punctuation only gives NULL');
SELECT is(property_address_key(NULL), NULL, 'NULL gives NULL');

-- ── Entity type, job ids and the generated column ────────────────────────────

SELECT lives_ok(
  format($$ INSERT INTO import_jobs (id, agency_id, entity_type, status, file_name, file_sha256, file_size_bytes)
            VALUES (%L, %L, 'property', 'committing', 'properties-basic.csv', repeat('a', 64), 100) $$,
         current_setting('test.job'), current_setting('test.a1')),
  'A property import job can be inserted'
);

INSERT INTO areas (agency_id, settlement_id, name, import_job_id)
VALUES (current_setting('test.a1')::uuid, current_setting('test.sofia')::uuid, 'Витоша', current_setting('test.job')::uuid);

INSERT INTO properties (agency_id, code, type, rooms, settlement_id, address, import_job_id)
VALUES (current_setting('test.a1')::uuid, 0, 'apartment', 2, current_setting('test.sofia')::uuid,
        'ул. Яворов 12', current_setting('test.job')::uuid);
SELECT set_config('test.p_imp', (SELECT id FROM properties WHERE import_job_id = current_setting('test.job')::uuid)::text, true);

INSERT INTO listings (agency_id, property_id, offer_type, price, import_job_id)
VALUES (current_setting('test.a1')::uuid, current_setting('test.p_imp')::uuid, 'sale', 185000, current_setting('test.job')::uuid);

INSERT INTO contacts (agency_id, type, first_name, display_name, import_job_id)
VALUES (current_setting('test.a1')::uuid, 'person', 'Иван', 'Иван', current_setting('test.job')::uuid);
INSERT INTO property_parties (agency_id, property_id, contact_id, role, import_job_id)
SELECT current_setting('test.a1')::uuid, current_setting('test.p_imp')::uuid, c.id, 'owner', current_setting('test.job')::uuid
FROM contacts c WHERE c.import_job_id = current_setting('test.job')::uuid;

SELECT is(
  (SELECT ARRAY[
     (SELECT count(*) FROM areas WHERE import_job_id = current_setting('test.job')::uuid),
     (SELECT count(*) FROM listings WHERE import_job_id = current_setting('test.job')::uuid),
     (SELECT count(*) FROM property_parties WHERE import_job_id = current_setting('test.job')::uuid)
   ]::int[]),
  ARRAY[1, 1, 1],
  'An area, listing and party take import_job_id'
);

SELECT is(
  (SELECT address_key FROM properties WHERE id = current_setting('test.p_imp')::uuid),
  'яворов12', 'The address key fills in on insert'
);
UPDATE properties SET address = 'бул. Витоша 5' WHERE id = current_setting('test.p_imp')::uuid;
SELECT is(
  (SELECT address_key FROM properties WHERE id = current_setting('test.p_imp')::uuid),
  'витоша5', 'The address key follows an update'
);

-- ── Audit metadata ───────────────────────────────────────────────────────────

SELECT is(
  (SELECT metadata ->> 'import_job_id' FROM audit_log
   WHERE entity_type = 'property' AND entity_id = current_setting('test.p_imp')::uuid AND action = 'created'),
  current_setting('test.job'), 'The imported property''s created row carries the job id'
);
SELECT is(
  (SELECT metadata ->> 'import_job_id' FROM audit_log a JOIN listings l ON l.id = a.entity_id
   WHERE a.entity_type = 'listing' AND a.action = 'created' AND l.property_id = current_setting('test.p_imp')::uuid),
  current_setting('test.job'), 'The imported listing''s created row carries the job id'
);

INSERT INTO properties (agency_id, code, type, settlement_id)
VALUES (current_setting('test.a1')::uuid, 0, 'garage', current_setting('test.sofia')::uuid);
SELECT set_config('test.p_hand', (SELECT id FROM properties WHERE import_job_id IS NULL AND agency_id = current_setting('test.a1')::uuid)::text, true);
INSERT INTO listings (agency_id, property_id, offer_type, price)
VALUES (current_setting('test.a1')::uuid, current_setting('test.p_hand')::uuid, 'rent', 300);

SELECT is(
  (SELECT metadata FROM audit_log
   WHERE entity_type = 'property' AND entity_id = current_setting('test.p_hand')::uuid AND action = 'created'),
  jsonb_build_object('code', (SELECT code FROM properties WHERE id = current_setting('test.p_hand')::uuid)),
  'A property made by hand has no job id in its created row'
);
SELECT ok(
  (SELECT NOT (a.metadata ? 'import_job_id') AND a.metadata ? 'property_id' AND a.metadata ? 'offer_type'
   FROM audit_log a JOIN listings l ON l.id = a.entity_id
   WHERE a.entity_type = 'listing' AND a.action = 'created' AND l.property_id = current_setting('test.p_hand')::uuid),
  'A listing made by hand keeps its metadata and has no job id'
);

-- ── import_property_address_matches (Task 4) ─────────────────────────────────

RESET ROLE;
SELECT set_config('test.a2', gen_random_uuid()::text, true);
SELECT set_config('test.u2', gen_random_uuid()::text, true);
INSERT INTO auth.users (id, email) VALUES (current_setting('test.u2')::uuid, 'pim-beta@example.com');
INSERT INTO agencies (id, name, slug) VALUES (current_setting('test.a2')::uuid, 'Agency PIM 2', 'pim2');
INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES
  (current_setting('test.a2')::uuid, current_setting('test.u2')::uuid, 'owner', 'active');
SELECT set_config('test.plovdiv', (SELECT id FROM settlements WHERE ekatte = '56784')::text, true);

-- Alpha and Beta both have "ул. Яворов 12" in Sofia; only Beta has "ул. Шипка 3".
INSERT INTO properties (agency_id, code, type, settlement_id, address) VALUES
  (current_setting('test.a1')::uuid, 0, 'garage', current_setting('test.sofia')::uuid, 'ул. Яворов 12'),
  (current_setting('test.a2')::uuid, 0, 'garage', current_setting('test.sofia')::uuid, 'ул. "Яворов" № 12'),
  (current_setting('test.a2')::uuid, 0, 'garage', current_setting('test.sofia')::uuid, 'ул. Шипка 3');
SELECT set_config('test.p_alpha_yavorov',
  (SELECT id FROM properties WHERE agency_id = current_setting('test.a1')::uuid AND address = 'ул. Яворов 12')::text, true);

SELECT set_config('request.jwt.claims',
  format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u1')), true);
SET ROLE authenticated;

SELECT results_eq(
  format($$ SELECT row_index, address_key, property_id FROM import_property_address_matches(
              jsonb_build_array(jsonb_build_object('row', 1, 'settlement_id', %L, 'address', 'ул Яворов 12'))) $$,
         current_setting('test.sofia')),
  format($$ VALUES (1, 'яворов12'::text, %L::uuid) $$, current_setting('test.p_alpha_yavorov')),
  'The address function finds the caller agency''s property for "ул Яворов 12"'
);

SELECT results_eq(
  format($$ SELECT property_id FROM import_property_address_matches(
              jsonb_build_array(jsonb_build_object('row', 2, 'settlement_id', %L, 'address', 'ул. Шипка 3'))) $$,
         current_setting('test.sofia')),
  $$ VALUES (NULL::uuid) $$,
  'Another agency''s property is never matched; the key is still returned'
);

SELECT results_eq(
  format($$ SELECT property_id FROM import_property_address_matches(
              jsonb_build_array(jsonb_build_object('row', 3, 'settlement_id', %L, 'address', 'ул. Яворов 12'))) $$,
         current_setting('test.plovdiv')),
  $$ VALUES (NULL::uuid) $$,
  'The same address in another settlement is not a match'
);

SELECT is_empty(
  format($$ SELECT * FROM import_property_address_matches(jsonb_build_array(
              jsonb_build_object('row', 4, 'settlement_id', %1$L, 'address', '  '),
              jsonb_build_object('row', 5, 'settlement_id', %1$L))) $$,
         current_setting('test.sofia')),
  'A blank or missing address returns nothing'
);

SELECT is_empty(
  $$ SELECT * FROM import_property_address_matches(NULL) $$,
  'No items return nothing'
);

SELECT set_config('request.jwt.claims',
  format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u2')), true);
SELECT results_eq(
  format($$ SELECT property_id FROM import_property_address_matches(
              jsonb_build_array(jsonb_build_object('row', 1, 'settlement_id', %L, 'address', 'ул Яворов 12'))) $$,
         current_setting('test.sofia')),
  $$ SELECT id FROM properties WHERE address = 'ул. "Яворов" № 12' $$,
  'Beta gets its own property for the same key, never Alpha''s'
);

RESET ROLE;
SET ROLE anon;
SELECT throws_ok(
  $$ SELECT * FROM import_property_address_matches('[]'::jsonb) $$,
  '42501', NULL,
  'anon cannot call the address function'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
