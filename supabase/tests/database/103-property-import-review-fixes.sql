-- spec: property-import, Checkpoint 1 review fixes (20261109000005).
-- 1. Renaming an area refreshes its properties' search_vector without moving updated_at, so a
--    fixed area spelling is not "work" for revert; a real edit still moves it.
-- 2. Revert keeps a property whose imported listing or owner party was deleted by hand.
BEGIN;
SELECT plan(8);

SELECT set_config('test.a1', gen_random_uuid()::text, true);
SELECT set_config('test.owner', gen_random_uuid()::text, true);
SELECT set_config('test.job', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES (current_setting('test.owner')::uuid, 'pirf-owner@example.com');
INSERT INTO agencies (id, name, slug) VALUES (current_setting('test.a1')::uuid, 'Agency PIRF', 'pirf1');
INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.owner')::uuid, 'owner', 'active');
SELECT seed_agency_defaults(current_setting('test.a1')::uuid);
SELECT set_config('test.sofia', (SELECT id FROM settlements WHERE ekatte = '68134')::text, true);

-- A garage at p_address with a sale listing, the new area p_area and a new owner p_phone.
CREATE FUNCTION pg_temp.norm(p_address TEXT, p_area TEXT, p_phone TEXT)
RETURNS JSONB LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'property', jsonb_build_object('type', 'garage', 'area_m2', 18, 'settlement_id', current_setting('test.sofia'),
      'address', p_address, 'assigned_to', current_setting('test.owner')),
    'new_area', CASE WHEN p_area IS NULL THEN NULL ELSE jsonb_build_object(
      'settlement_id', current_setting('test.sofia'), 'name', p_area, 'key', current_setting('test.sofia') || ':' || lower(p_area)) END,
    'listings', '[{"offer_type":"sale","price":20000,"status":"active"}]'::jsonb,
    'owner_contact_id', NULL,
    'new_owner', jsonb_build_object('first_name', 'Собственик', 'last_name', p_address, 'phone', p_phone, 'email', NULL)
  );
$$;

INSERT INTO import_jobs (id, agency_id, entity_type, status, file_name, file_sha256, file_size_bytes, options)
VALUES (current_setting('test.job')::uuid, current_setting('test.a1')::uuid, 'property', 'validated',
        'properties-basic.csv', repeat('f', 64), 100, '{"duplicate_strategy": "skip"}');

INSERT INTO import_rows (agency_id, import_job_id, row_number, raw, status, normalized)
SELECT current_setting('test.a1')::uuid, current_setting('test.job')::uuid, n, '{}', 'valid', norm
FROM (VALUES
  (1, pg_temp.norm('Untouched', 'Витошаа', '+359888200001')),
  (2, pg_temp.norm('Listing deleted', NULL, '+359888200002')),
  (3, pg_temp.norm('Party deleted', NULL, '+359888200003'))
) AS rows(n, norm);

SELECT set_config('request.jwt.claims',
  format('{"sub": "%s", "role": "authenticated"}', current_setting('test.owner')), true);
SET ROLE authenticated;
SELECT import_commit_properties(current_setting('test.job')::uuid, 50);
RESET ROLE;

CREATE FUNCTION pg_temp.prop(p_address TEXT) RETURNS uuid LANGUAGE sql AS $$
  SELECT id FROM properties WHERE agency_id = current_setting('test.a1')::uuid AND address = p_address;
$$;
CREATE FUNCTION pg_temp.updated(p_address TEXT) RETURNS timestamptz LANGUAGE sql AS $$
  SELECT updated_at FROM properties WHERE id = pg_temp.prop(p_address);
$$;

SELECT is(
  (SELECT created_count FROM import_jobs WHERE id = current_setting('test.job')::uuid),
  3, 'Setup: the job committed 3 properties'
);

-- ── 1. updated_at ────────────────────────────────────────────────────────────
-- now() is frozen in this transaction: put updated_at in the past to see whether it moves.

ALTER TABLE properties DISABLE TRIGGER set_properties_updated_at;
UPDATE properties SET updated_at = '2020-01-01' WHERE id = pg_temp.prop('Untouched');
ALTER TABLE properties ENABLE TRIGGER set_properties_updated_at;

UPDATE areas SET name = 'Витоша' WHERE agency_id = current_setting('test.a1')::uuid AND name = 'Витошаа';

SELECT ok(
  (SELECT search_vector::text FROM properties WHERE id = pg_temp.prop('Untouched')) LIKE '%витош%',
  'Renaming the area refreshes the property search vector'
);
SELECT is(pg_temp.updated('Untouched'), '2020-01-01'::timestamptz, 'but does not move updated_at');

UPDATE properties SET description = description WHERE id = pg_temp.prop('Untouched');
SELECT is(pg_temp.updated('Untouched'), '2020-01-01'::timestamptz, 'Nor does an update that changes nothing');

UPDATE properties SET description = 'Real edit' WHERE id = pg_temp.prop('Untouched');
SELECT is(pg_temp.updated('Untouched'), now(), 'A real edit moves updated_at');

-- Back to untouched for the revert below.
ALTER TABLE properties DISABLE TRIGGER set_properties_updated_at;
UPDATE properties SET description = NULL, updated_at = now() WHERE id = pg_temp.prop('Untouched');
ALTER TABLE properties ENABLE TRIGGER set_properties_updated_at;

-- ── 2. Revert sees hand-deleted listings and parties ─────────────────────────

DELETE FROM listings WHERE property_id = pg_temp.prop('Listing deleted');
DELETE FROM property_parties WHERE property_id = pg_temp.prop('Party deleted');

UPDATE import_jobs SET status = 'completed', completed_at = now() WHERE id = current_setting('test.job')::uuid;

SET ROLE authenticated;
SELECT is(
  import_revert(current_setting('test.job')::uuid) -> 'deleted' -> 'properties',
  '1'::jsonb, 'Only the untouched property is deleted'
);
RESET ROLE;

SELECT ok(pg_temp.prop('Listing deleted') IS NOT NULL, 'A property whose imported listing was deleted is kept');
SELECT ok(pg_temp.prop('Party deleted') IS NOT NULL, 'A property whose owner party was deleted is kept');

SELECT * FROM finish();
ROLLBACK;
