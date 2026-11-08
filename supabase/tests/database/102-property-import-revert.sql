-- spec: property-import, Task 6 (AD-064, AD-036). import_revert for property jobs: one kept
-- case per kind of work, untouched records deleted, pre-existing owners and used areas kept,
-- and contact and inquiry jobs unchanged (their own tests in 063 stay green).
BEGIN;
SELECT plan(22);

SELECT set_config('test.a1', gen_random_uuid()::text, true);
SELECT set_config('test.owner', gen_random_uuid()::text, true);
SELECT set_config('test.job', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES (current_setting('test.owner')::uuid, 'pir-owner@example.com');
INSERT INTO agencies (id, name, slug) VALUES (current_setting('test.a1')::uuid, 'Agency PIR', 'pir1');
INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.owner')::uuid, 'owner', 'active');
SELECT seed_agency_defaults(current_setting('test.a1')::uuid);
SELECT set_config('test.sofia', (SELECT id FROM settlements WHERE ekatte = '68134')::text, true);

-- A contact that existed before the import, matched as an owner.
INSERT INTO contacts (agency_id, type, first_name, display_name)
VALUES (current_setting('test.a1')::uuid, 'person', 'Предишен', 'Предишен');
SELECT set_config('test.prior', (SELECT id FROM contacts WHERE first_name = 'Предишен')::text, true);

-- A row: a garage at p_address, with a sale listing, a new area, and an owner that is either
-- the prior contact or a new one with phone p_phone.
CREATE FUNCTION pg_temp.norm(p_address TEXT, p_area TEXT, p_phone TEXT, p_prior BOOLEAN DEFAULT false)
RETURNS JSONB LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'property', jsonb_build_object('type', 'garage', 'area_m2', 18, 'settlement_id', current_setting('test.sofia'),
      'address', p_address, 'assigned_to', current_setting('test.owner')),
    'new_area', CASE WHEN p_area IS NULL THEN NULL ELSE jsonb_build_object(
      'settlement_id', current_setting('test.sofia'), 'name', p_area, 'key', current_setting('test.sofia') || ':' || lower(p_area)) END,
    'listings', '[{"offer_type":"sale","price":20000,"status":"active"}]'::jsonb,
    'owner_contact_id', CASE WHEN p_prior THEN current_setting('test.prior') END,
    'new_owner', CASE WHEN p_prior OR p_phone IS NULL THEN NULL ELSE jsonb_build_object(
      'first_name', 'Собственик', 'last_name', p_address, 'phone', p_phone, 'email', NULL) END
  );
$$;

INSERT INTO import_jobs (id, agency_id, entity_type, status, file_name, file_sha256, file_size_bytes, options)
VALUES (current_setting('test.job')::uuid, current_setting('test.a1')::uuid, 'property', 'validated',
        'properties-basic.csv', repeat('e', 64), 100, '{"duplicate_strategy": "skip"}');

INSERT INTO import_rows (agency_id, import_job_id, row_number, raw, status, normalized)
SELECT current_setting('test.a1')::uuid, current_setting('test.job')::uuid, n, '{}', 'valid', norm
FROM (VALUES
  (1,  pg_temp.norm('Untouched A', 'Ненужна', '+359888100001')),
  (2,  pg_temp.norm('Untouched B', 'Ненужна', '+359888100001')),
  (3,  pg_temp.norm('Untouched prior', NULL, NULL, true)),
  (4,  pg_temp.norm('Untouched requirement area', 'Търсена', NULL)),
  (5,  pg_temp.norm('Edited', 'Използвана', '+359888100005')),
  (6,  pg_temp.norm('Note', NULL, '+359888100006')),
  (7,  pg_temp.norm('Task', NULL, '+359888100007')),
  (8,  pg_temp.norm('Candidate', NULL, '+359888100008')),
  (9,  pg_temp.norm('New listing', NULL, '+359888100009')),
  (10, pg_temp.norm('Price change', NULL, '+359888100010')),
  (11, pg_temp.norm('Party added', NULL, '+359888100011')),
  (12, pg_temp.norm('Party ended', NULL, '+359888100012')),
  (13, pg_temp.norm('Archived', NULL, '+359888100013'))
) AS rows(n, norm);

SELECT set_config('request.jwt.claims',
  format('{"sub": "%s", "role": "authenticated"}', current_setting('test.owner')), true);
SET ROLE authenticated;
SELECT import_commit_properties(current_setting('test.job')::uuid, 50);
RESET ROLE;

SELECT is(
  (SELECT created_count FROM import_jobs WHERE id = current_setting('test.job')::uuid),
  13, 'Setup: the job committed 13 properties'
);

CREATE FUNCTION pg_temp.prop(p_address TEXT) RETURNS uuid LANGUAGE sql AS $$
  SELECT id FROM properties WHERE agency_id = current_setting('test.a1')::uuid AND address = p_address;
$$;
CREATE FUNCTION pg_temp.owner_of(p_phone TEXT) RETURNS uuid LANGUAGE sql AS $$
  SELECT contact_id FROM contact_methods WHERE agency_id = current_setting('test.a1')::uuid AND value = p_phone;
$$;

-- ── Work done after the commit ───────────────────────────────────────────────
-- now() is frozen inside this transaction, so an edit needs a later updated_at set by hand.

ALTER TABLE properties DISABLE TRIGGER set_properties_updated_at;
ALTER TABLE listings DISABLE TRIGGER set_listings_updated_at;
ALTER TABLE property_parties DISABLE TRIGGER set_property_parties_updated_at;

UPDATE properties SET description = 'Fixed the area', updated_at = now() + INTERVAL '2 minutes' WHERE id = pg_temp.prop('Edited');
UPDATE properties SET status = 'archived', updated_at = now() + INTERVAL '2 minutes' WHERE id = pg_temp.prop('Archived');
UPDATE listings SET price = 19000, updated_at = now() + INTERVAL '2 minutes' WHERE property_id = pg_temp.prop('Price change');
UPDATE property_parties SET ended_at = now(), updated_at = now() + INTERVAL '2 minutes' WHERE property_id = pg_temp.prop('Party ended');

ALTER TABLE properties ENABLE TRIGGER set_properties_updated_at;
ALTER TABLE listings ENABLE TRIGGER set_listings_updated_at;
ALTER TABLE property_parties ENABLE TRIGGER set_property_parties_updated_at;

INSERT INTO notes (agency_id, property_id, content, created_by)
VALUES (current_setting('test.a1')::uuid, pg_temp.prop('Note'), 'Called the owner', current_setting('test.owner')::uuid);
INSERT INTO tasks (agency_id, property_id, title, assigned_to)
VALUES (current_setting('test.a1')::uuid, pg_temp.prop('Task'), 'Photos', current_setting('test.owner')::uuid);
INSERT INTO listings (agency_id, property_id, offer_type, price)
VALUES (current_setting('test.a1')::uuid, pg_temp.prop('New listing'), 'rent', 300);

INSERT INTO contacts (agency_id, type, first_name, display_name)
VALUES (current_setting('test.a1')::uuid, 'person', 'Съсобственик', 'Съсобственик');
INSERT INTO property_parties (agency_id, property_id, contact_id, role)
VALUES (current_setting('test.a1')::uuid, pg_temp.prop('Party added'),
        (SELECT id FROM contacts WHERE first_name = 'Съсобственик'), 'co_owner');

INSERT INTO opportunities (agency_id, title, type, stage_id)
VALUES (current_setting('test.a1')::uuid, 'Buyer', 'buyer',
        (SELECT id FROM stages WHERE agency_id = current_setting('test.a1')::uuid ORDER BY sort_order LIMIT 1));
SELECT set_config('test.opp', (SELECT id FROM opportunities WHERE agency_id = current_setting('test.a1')::uuid AND title = 'Buyer')::text, true);
INSERT INTO opportunity_properties (agency_id, opportunity_id, property_id, relation, status)
VALUES (current_setting('test.a1')::uuid, current_setting('test.opp')::uuid, pg_temp.prop('Candidate'), 'candidate', 'candidate');

-- A requirement uses the area of an untouched property.
INSERT INTO requirements (agency_id, opportunity_id, budget_max) VALUES (current_setting('test.a1')::uuid, current_setting('test.opp')::uuid, 30000);
INSERT INTO requirement_locations (agency_id, requirement_id, settlement_id, area_id)
SELECT current_setting('test.a1')::uuid, r.id, current_setting('test.sofia')::uuid,
       (SELECT id FROM areas WHERE agency_id = current_setting('test.a1')::uuid AND name = 'Търсена')
FROM requirements r WHERE r.opportunity_id = current_setting('test.opp')::uuid;

UPDATE import_jobs SET status = 'completed', completed_at = now() WHERE id = current_setting('test.job')::uuid;

-- ── Revert ───────────────────────────────────────────────────────────────────

SELECT set_config('request.jwt.claims',
  format('{"sub": "%s", "role": "authenticated"}', current_setting('test.owner')), true);
SET ROLE authenticated;

SELECT is(
  import_revert(current_setting('test.job')::uuid),
  '{"deleted": {"contacts": 1, "inquiries": 0, "properties": 4, "areas": 1},
    "kept": {"contacts": 9, "inquiries": 0, "properties": 9, "areas": 2}}'::jsonb,
  'The result counts deleted and kept properties, contacts and areas'
);
RESET ROLE;

-- Kept, one per kind of work, each with its owner.
SELECT ok(pg_temp.prop(a) IS NOT NULL AND pg_temp.owner_of(phone) IS NOT NULL, format('%s keeps the property and its owner', a))
FROM (VALUES
  ('Edited', '+359888100005'),
  ('Note', '+359888100006'),
  ('Task', '+359888100007'),
  ('Candidate', '+359888100008'),
  ('New listing', '+359888100009'),
  ('Price change', '+359888100010'),
  ('Party added', '+359888100011'),
  ('Archived', '+359888100013')
) AS kept(a, phone);

SELECT ok(pg_temp.prop('Party ended') IS NOT NULL, 'An ended party keeps the property');
SELECT ok(
  (SELECT count(*) FROM property_parties WHERE property_id = pg_temp.prop('Party ended')) = 1,
  'and its ended party, the ownership history'
);

-- Deleted
SELECT ok(
  pg_temp.prop('Untouched A') IS NULL AND pg_temp.prop('Untouched B') IS NULL
  AND pg_temp.prop('Untouched prior') IS NULL AND pg_temp.prop('Untouched requirement area') IS NULL,
  'Untouched properties are deleted'
);
SELECT is_empty(
  format($$ SELECT 1 FROM listings WHERE import_job_id = %L AND property_id NOT IN (SELECT id FROM properties) $$, current_setting('test.job')),
  'Their listings go with them'
);
SELECT is(pg_temp.owner_of('+359888100001'), NULL, 'Their imported owner, shared by two rows, is deleted');
SELECT is_empty($$ SELECT 1 FROM areas WHERE name = 'Ненужна' $$, 'An area only untouched properties used is deleted');

-- Kept for other reasons
SELECT ok(
  EXISTS (SELECT 1 FROM contacts WHERE id = current_setting('test.prior')::uuid),
  'An owner that existed before the import is never deleted'
);
SELECT ok(EXISTS (SELECT 1 FROM areas WHERE name = 'Използвана'), 'An area a kept property uses is kept');
SELECT ok(EXISTS (SELECT 1 FROM areas WHERE name = 'Търсена'), 'An area a requirement uses is kept');
SELECT ok(EXISTS (SELECT 1 FROM notes WHERE content = 'Called the owner'), 'The note is still there');

-- Rows and job
SELECT results_eq(
  format($$ SELECT status, count(*)::int FROM import_rows WHERE import_job_id = %L GROUP BY status ORDER BY status $$, current_setting('test.job')),
  $$ VALUES ('revert_skipped'::text, 9), ('reverted'::text, 4) $$,
  'Rows are reverted or revert_skipped'
);
SELECT is(
  (SELECT status FROM import_jobs WHERE id = current_setting('test.job')::uuid),
  'reverted', 'The job is reverted'
);

SELECT * FROM finish();
ROLLBACK;
