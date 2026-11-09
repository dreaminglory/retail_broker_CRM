-- spec: property-import, rule 7 and Task 11 (20261109000006). An imported property's `created`
-- audit row names the file, so every role sees "Imported from <file>": brokers can't read
-- import_jobs (owner/manager only), as with imported contacts (20261102000001).
BEGIN;
SELECT plan(4);

SELECT set_config('test.a1', gen_random_uuid()::text, true);
SELECT set_config('test.a2', gen_random_uuid()::text, true);
SELECT set_config('test.job', gen_random_uuid()::text, true);
SELECT set_config('test.job_other', gen_random_uuid()::text, true);

INSERT INTO agencies (id, name, slug) VALUES
  (current_setting('test.a1')::uuid, 'Agency PIAF 1', 'piaf1'),
  (current_setting('test.a2')::uuid, 'Agency PIAF 2', 'piaf2');
SELECT set_config('test.sofia', (SELECT id FROM settlements WHERE ekatte = '68134')::text, true);

INSERT INTO import_jobs (id, agency_id, entity_type, status, file_name, file_sha256, file_size_bytes) VALUES
  (current_setting('test.job')::uuid, current_setting('test.a1')::uuid, 'property', 'committing',
   'properties-basic.csv', repeat('f', 64), 100),
  (current_setting('test.job_other')::uuid, current_setting('test.a2')::uuid, 'property', 'committing',
   'other-agency.csv', repeat('e', 64), 100);

INSERT INTO properties (agency_id, code, type, settlement_id, address, import_job_id) VALUES
  (current_setting('test.a1')::uuid, 1, 'garage', current_setting('test.sofia')::uuid, 'Imported', current_setting('test.job')::uuid),
  (current_setting('test.a1')::uuid, 2, 'garage', current_setting('test.sofia')::uuid, 'By hand', NULL),
  -- A forged job id from another agency: no file name leaks.
  (current_setting('test.a1')::uuid, 3, 'garage', current_setting('test.sofia')::uuid, 'Forged', current_setting('test.job_other')::uuid);

CREATE FUNCTION pg_temp.created_meta(p_address TEXT) RETURNS JSONB LANGUAGE sql AS $$
  SELECT a.metadata FROM audit_log a JOIN properties p ON p.id = a.entity_id
  WHERE a.entity_type = 'property' AND a.action = 'created' AND p.address = p_address;
$$;

SELECT is(pg_temp.created_meta('Imported') ->> 'file_name', 'properties-basic.csv',
  'An imported property''s created row names the file');
SELECT is(pg_temp.created_meta('Imported') ->> 'import_job_id', current_setting('test.job'),
  'It keeps the job id');
SELECT ok(NOT (pg_temp.created_meta('By hand') ?| ARRAY['file_name', 'import_job_id']),
  'A property made by hand names no file');
SELECT ok(pg_temp.created_meta('Forged') ->> 'file_name' IS NULL,
  'Another agency''s job never lends its file name');

SELECT * FROM finish();
ROLLBACK;
