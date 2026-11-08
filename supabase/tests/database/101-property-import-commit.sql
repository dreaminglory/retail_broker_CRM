-- spec: property-import, Task 5 (AD-064). import_commit_properties: per-row atomicity,
-- shared new owners and areas, kept areas, re-check, file-order codes, audit, role and tenancy.
BEGIN;
SELECT plan(26);

SELECT set_config('test.a1', gen_random_uuid()::text, true);
SELECT set_config('test.a2', gen_random_uuid()::text, true);
SELECT set_config('test.owner', gen_random_uuid()::text, true);
SELECT set_config('test.broker', gen_random_uuid()::text, true);
SELECT set_config('test.beta', gen_random_uuid()::text, true);
SELECT set_config('test.job', gen_random_uuid()::text, true);
SELECT set_config('test.job2', gen_random_uuid()::text, true);
SELECT set_config('test.job3', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES
  (current_setting('test.owner')::uuid, 'pic-owner@example.com'),
  (current_setting('test.broker')::uuid, 'pic-broker@example.com'),
  (current_setting('test.beta')::uuid, 'pic-beta@example.com');
INSERT INTO agencies (id, name, slug) VALUES
  (current_setting('test.a1')::uuid, 'Agency PIC', 'pic1'),
  (current_setting('test.a2')::uuid, 'Agency PIC 2', 'pic2');
INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.owner')::uuid, 'owner', 'active'),
  (current_setting('test.a1')::uuid, current_setting('test.broker')::uuid, 'broker', 'active'),
  (current_setting('test.a2')::uuid, current_setting('test.beta')::uuid, 'owner', 'active');
SELECT set_config('test.sofia', (SELECT id FROM settlements WHERE ekatte = '68134')::text, true);

-- A normalized row as validation stores it.
CREATE FUNCTION pg_temp.norm(
  p_type TEXT, p_address TEXT, p_ref TEXT, p_area TEXT, p_owner_phone TEXT, p_listings JSONB
) RETURNS JSONB LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'property', jsonb_build_object(
      'type', p_type, 'rooms', CASE WHEN p_type = 'apartment' THEN 2 END, 'area_m2', 60,
      'settlement_id', current_setting('test.sofia'), 'area_id', NULL, 'address', p_address,
      'assigned_to', current_setting('test.owner'), 'external_ref', p_ref),
    'new_area', CASE WHEN p_area IS NULL THEN NULL ELSE jsonb_build_object(
      'settlement_id', current_setting('test.sofia'), 'name', p_area,
      'key', current_setting('test.sofia') || ':' || lower(p_area)) END,
    'listings', COALESCE(p_listings, '[]'::jsonb),
    'owner_contact_id', NULL,
    'new_owner', CASE WHEN p_owner_phone IS NULL THEN NULL ELSE jsonb_build_object(
      'first_name', 'Собственик', 'last_name', p_owner_phone, 'phone', p_owner_phone, 'email', NULL) END
  );
$$;

CREATE FUNCTION pg_temp.act_as(p_user TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    format('{"sub": "%s", "role": "authenticated"}', current_setting('test.' || p_user)), true);
  SET ROLE authenticated;
END;
$$;

-- An existing property that row 5 re-checks against.
INSERT INTO properties (agency_id, code, type, settlement_id, external_ref)
VALUES (current_setting('test.a1')::uuid, 0, 'garage', current_setting('test.sofia')::uuid, 'EXISTS-1');

INSERT INTO import_jobs (id, agency_id, entity_type, status, file_name, file_sha256, file_size_bytes, options)
VALUES (current_setting('test.job')::uuid, current_setting('test.a1')::uuid, 'property', 'validated',
        'properties-basic.csv', repeat('c', 64), 100,
        jsonb_build_object('duplicate_strategy', 'skip', 'create_areas', jsonb_build_array(
          current_setting('test.sofia') || ':витоша', current_setting('test.sofia') || ':грешка')));

INSERT INTO import_rows (agency_id, import_job_id, row_number, raw, status, normalized) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.job')::uuid, 1, '{}', 'valid',
   pg_temp.norm('apartment', 'Ред 1', 'R-1', 'Витоша', '+359888000001',
     '[{"offer_type":"sale","price":185000,"status":"active","listed_at":"2025-03-15T00:00:00Z"},{"offer_type":"rent","price":900,"status":"active","listed_at":null}]')),
  (current_setting('test.a1')::uuid, current_setting('test.job')::uuid, 2, '{}', 'valid',
   pg_temp.norm('garage', 'Ред 2', 'R-2', 'витоша', '+359888000001', NULL)),
  (current_setting('test.a1')::uuid, current_setting('test.job')::uuid, 3, '{}', 'valid',
   pg_temp.norm('garage', 'Ред 3', NULL, 'Незапазена', NULL, NULL)),
  (current_setting('test.a1')::uuid, current_setting('test.job')::uuid, 4, '{}', 'valid',
   pg_temp.norm('garage', 'Ред 4', NULL, 'Грешка', '+359888000002', '[{"offer_type":"sale","price":0,"status":"active"}]')),
  (current_setting('test.a1')::uuid, current_setting('test.job')::uuid, 5, '{}', 'valid',
   pg_temp.norm('garage', 'Ред 5', 'EXISTS-1', NULL, NULL, NULL)),
  (current_setting('test.a1')::uuid, current_setting('test.job')::uuid, 6, '{}', 'valid',
   pg_temp.norm('garage', 'Ред 6', NULL, NULL, NULL, '[{"offer_type":"sale","price":20000,"status":"closed"}]')),
  (current_setting('test.a1')::uuid, current_setting('test.job')::uuid, 7, '{}', 'duplicate',
   pg_temp.norm('garage', 'Ред 7', NULL, NULL, NULL, NULL));

-- ── Role and tenancy ─────────────────────────────────────────────────────────

SELECT pg_temp.act_as('broker');
SELECT throws_ok(
  format('SELECT import_commit_properties(%L)', current_setting('test.job')),
  'Job not found', 'A broker cannot commit: RLS hides import jobs from brokers'
);

SELECT pg_temp.act_as('beta');
SELECT throws_ok(
  format('SELECT import_commit_properties(%L)', current_setting('test.job')),
  'Job not found', 'Another agency cannot see the job'
);

RESET ROLE;
SET ROLE anon;
SELECT throws_ok(
  format('SELECT import_commit_properties(%L)', current_setting('test.job')),
  '42501', NULL, 'anon cannot call the commit'
);

-- ── One call commits the job ─────────────────────────────────────────────────

SELECT pg_temp.act_as('owner');
SELECT is(
  import_commit_properties(current_setting('test.job')::uuid, 50),
  '{"processed": 6, "remaining": 0}'::jsonb,
  'One call processes the six committable rows; the duplicate under skip is left'
);

SELECT results_eq(
  format($$ SELECT status, created_count, skipped_count, error_count, duplicate_count FROM import_jobs WHERE id = %L $$, current_setting('test.job')),
  $$ VALUES ('completed'::text, 4, 1, 1, 1) $$,
  'The job is completed with its counts'
);

SELECT results_eq(
  format($$ SELECT row_number, status FROM import_rows WHERE import_job_id = %L ORDER BY row_number $$, current_setting('test.job')),
  $$ VALUES (1, 'created'::text), (2, 'created'), (3, 'created'), (4, 'error'), (5, 'skipped'), (6, 'created'), (7, 'duplicate') $$,
  'Each row has its outcome'
);

SELECT is(
  (SELECT match_reason FROM import_rows WHERE import_job_id = current_setting('test.job')::uuid AND row_number = 5),
  'db_recheck', 'An external_ref found at commit is skipped as db_recheck'
);

-- Shared new area and owner
SELECT is(
  (SELECT count(*)::int FROM areas WHERE agency_id = current_setting('test.a1')::uuid AND lower(name) = 'витоша' AND import_job_id = current_setting('test.job')::uuid),
  1, 'Two rows with the same new area create one area, marked with the job'
);
SELECT is(
  (SELECT count(*)::int FROM properties p JOIN areas a ON a.id = p.area_id WHERE p.import_job_id = current_setting('test.job')::uuid AND lower(a.name) = 'витоша'),
  2, 'Both rows use it'
);
SELECT is(
  (SELECT count(DISTINCT contact_id)::int FROM contact_methods WHERE agency_id = current_setting('test.a1')::uuid AND value = '+359888000001'),
  1, 'Two rows with the same new owner phone create one contact'
);
SELECT is(
  (SELECT count(*)::int FROM property_parties pp JOIN contact_methods cm ON cm.contact_id = pp.contact_id
   WHERE pp.import_job_id = current_setting('test.job')::uuid AND cm.value = '+359888000001' AND pp.role = 'owner'),
  2, 'That contact is the owner party of both properties'
);
SELECT is(
  (SELECT import_job_id FROM contacts c JOIN contact_methods cm ON cm.contact_id = c.id WHERE cm.value = '+359888000001'),
  current_setting('test.job')::uuid, 'The new owner is marked with the job'
);

-- Unticked area
SELECT is(
  (SELECT area_id FROM properties WHERE import_job_id = current_setting('test.job')::uuid AND address = 'Ред 3'),
  NULL, 'A row whose new area was unticked imports without an area'
);
SELECT is_empty(
  $$ SELECT 1 FROM areas WHERE name = 'Незапазена' $$,
  'An unticked new area is not created'
);

-- Atomicity of the failed row
SELECT is_empty($$ SELECT 1 FROM properties WHERE address = 'Ред 4' $$, 'The failed row leaves no property');
SELECT is_empty($$ SELECT 1 FROM areas WHERE name = 'Грешка' $$, 'The failed row leaves no area');
SELECT is_empty($$ SELECT 1 FROM contact_methods WHERE value = '+359888000002' $$, 'The failed row leaves no contact');
SELECT is(
  (SELECT errors -> 0 ->> 'code' FROM import_rows WHERE import_job_id = current_setting('test.job')::uuid AND row_number = 4),
  'import.errors.dbWrite', 'The failed row carries the i18n error code'
);

-- Listings, codes, audit
SELECT results_eq(
  format($$ SELECT l.offer_type, l.price, l.status, l.listed_at FROM listings l JOIN properties p ON p.id = l.property_id
            WHERE p.import_job_id = %L AND p.address = 'Ред 1' AND l.offer_type = 'sale' $$, current_setting('test.job')),
  $$ VALUES ('sale'::text, 185000.00::numeric, 'active'::text, '2025-03-15T00:00:00Z'::timestamptz) $$,
  'The sale listing has its price, status and listing date'
);
SELECT ok(
  (SELECT l.closed_at IS NOT NULL AND l.import_job_id = current_setting('test.job')::uuid
   FROM listings l JOIN properties p ON p.id = l.property_id WHERE p.address = 'Ред 6'),
  'A closed listing gets closed_at and the job id'
);
SELECT ok(
  (SELECT array_agg(p.code ORDER BY r.row_number) = array_agg(p.code ORDER BY p.code)
   FROM import_rows r JOIN properties p ON p.id = r.entity_id
   WHERE r.import_job_id = current_setting('test.job')::uuid AND r.status = 'created'),
  'Property codes follow file order'
);
SELECT is(
  (SELECT count(*)::int FROM audit_log a JOIN properties p ON p.id = a.entity_id
   WHERE a.entity_type = 'property' AND a.action = 'created' AND p.import_job_id = current_setting('test.job')::uuid
     AND a.metadata ->> 'import_job_id' = current_setting('test.job')),
  4, 'Every imported property has a created audit row with the job id'
);
SELECT is(
  (SELECT count(*)::int FROM audit_log a JOIN listings l ON l.id = a.entity_id
   WHERE a.entity_type = 'listing' AND l.import_job_id = current_setting('test.job')::uuid
     AND a.metadata ->> 'import_job_id' = current_setting('test.job')),
  3, 'Every imported listing has one audit row, with the job id (no price change rows)'
);

-- ── A second commit of the same file creates nothing ─────────────────────────

INSERT INTO import_jobs (id, agency_id, entity_type, status, file_name, file_sha256, file_size_bytes, options)
VALUES (current_setting('test.job2')::uuid, current_setting('test.a1')::uuid, 'property', 'validated',
        'properties-basic.csv', repeat('c', 64), 100, '{"duplicate_strategy": "skip"}');
INSERT INTO import_rows (agency_id, import_job_id, row_number, raw, status, normalized) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.job2')::uuid, 1, '{}', 'valid', pg_temp.norm('garage', 'Ред 1', 'R-1', NULL, NULL, NULL)),
  (current_setting('test.a1')::uuid, current_setting('test.job2')::uuid, 2, '{}', 'valid', pg_temp.norm('garage', 'Ред 3', NULL, NULL, NULL, NULL));

SELECT is(
  import_commit_properties(current_setting('test.job2')::uuid),
  '{"processed": 2, "remaining": 0}'::jsonb, 'The second commit processes its rows'
);
SELECT results_eq(
  format($$ SELECT status, created_count, skipped_count FROM import_jobs WHERE id = %L $$, current_setting('test.job2')),
  $$ VALUES ('completed'::text, 0, 2) $$,
  'and creates nothing: the external_ref and the address are found again'
);

-- ── Duplicates are created under `create` ────────────────────────────────────

INSERT INTO import_jobs (id, agency_id, entity_type, status, file_name, file_sha256, file_size_bytes, options)
VALUES (current_setting('test.job3')::uuid, current_setting('test.a1')::uuid, 'property', 'validated',
        'dups.csv', repeat('d', 64), 100, '{"duplicate_strategy": "create"}');
INSERT INTO import_rows (agency_id, import_job_id, row_number, raw, status, match_reason, normalized) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.job3')::uuid, 1, '{}', 'duplicate', 'address', pg_temp.norm('garage', 'Ред 3', NULL, NULL, NULL, NULL));

SELECT import_commit_properties(current_setting('test.job3')::uuid);
SELECT is(
  (SELECT count(*)::int FROM properties WHERE agency_id = current_setting('test.a1')::uuid AND address_key = property_address_key('Ред 3')),
  2, 'Under create, an address duplicate is imported as a second property'
);

SELECT * FROM finish();
ROLLBACK;
