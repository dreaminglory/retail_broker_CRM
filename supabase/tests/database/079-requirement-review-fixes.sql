-- spec: requirements, Checkpoint 2 review (AD-059).
-- 1. Types and construction are stored in the list's order, so a save that only re-orders them
--    writes no audit row.
-- 2. save_requirement refuses what the form refuses: a whole settlement with one of its areas,
--    and a newly added inactive area (rule 6). An area deactivated after it was saved stays.
BEGIN;
SELECT plan(10);

-- ── Setup ────────────────────────────────────────────────────────────────────

SELECT set_config('test.a1', gen_random_uuid()::text, true);
SELECT set_config('test.u_broker', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES (current_setting('test.u_broker')::uuid, 'rf-broker@example.com');
INSERT INTO agencies (id, name, slug) VALUES (current_setting('test.a1')::uuid, 'Agency RF1', 'rf1');
INSERT INTO agency_memberships (agency_id, user_id, role, status)
VALUES (current_setting('test.a1')::uuid, current_setting('test.u_broker')::uuid, 'broker', 'active');
SELECT seed_agency_defaults(current_setting('test.a1')::uuid);

SELECT set_config('test.sofia', (SELECT id FROM settlements WHERE ekatte = '68134')::text, true);
SELECT set_config('test.lozenets', gen_random_uuid()::text, true);
SELECT set_config('test.iztok', gen_random_uuid()::text, true);
SELECT set_config('test.old', gen_random_uuid()::text, true);
SELECT set_config('test.opp', gen_random_uuid()::text, true);

INSERT INTO areas (id, agency_id, settlement_id, name, is_active) VALUES
  (current_setting('test.lozenets')::uuid, current_setting('test.a1')::uuid, current_setting('test.sofia')::uuid, 'Лозенец', true),
  (current_setting('test.iztok')::uuid, current_setting('test.a1')::uuid, current_setting('test.sofia')::uuid, 'Изток', true),
  (current_setting('test.old')::uuid, current_setting('test.a1')::uuid, current_setting('test.sofia')::uuid, 'Стар квартал', false);

INSERT INTO opportunities (id, agency_id, title, type, status, stage_id)
VALUES (current_setting('test.opp')::uuid, current_setting('test.a1')::uuid, 'Купувач', 'buyer', 'active',
        (SELECT id FROM stages WHERE agency_id = current_setting('test.a1')::uuid ORDER BY sort_order LIMIT 1));

CREATE FUNCTION pg_temp.locs(VARIADIC p_areas TEXT[]) RETURNS JSONB LANGUAGE sql AS $$
  SELECT jsonb_agg(jsonb_build_object(
    'settlement_id', current_setting('test.sofia'),
    'area_id', CASE WHEN a = 'whole' THEN NULL ELSE current_setting('test.' || a) END))
  FROM unnest(p_areas) a;
$$;

CREATE FUNCTION pg_temp.save(p_fields TEXT, p_locations JSONB) RETURNS TEXT LANGUAGE sql AS $$
  SELECT format($f$ SELECT save_requirement(%L, %L::jsonb, %L::jsonb) $f$,
                current_setting('test.opp'), p_fields, p_locations);
$$;

CREATE FUNCTION pg_temp.audit_count() RETURNS INT LANGUAGE sql AS $$
  SELECT count(*)::int FROM audit_log
  WHERE entity_type = 'opportunity' AND field_name = 'requirement'
    AND entity_id = current_setting('test.opp')::uuid;
$$;

SELECT set_config('request.jwt.claims',
  format('{"sub": "%s", "role": "authenticated"}', current_setting('test.u_broker')), true);
SET ROLE authenticated;

-- ── 1. Lists in canonical order ──────────────────────────────────────────────

SELECT lives_ok(
  pg_temp.save('{"property_types": ["maisonette", "apartment"], "construction": ["panel", "brick"]}', pg_temp.locs('lozenets')),
  'A save with the lists in click order passes'
);
SELECT is(
  (SELECT property_types FROM requirements WHERE opportunity_id = current_setting('test.opp')::uuid),
  ARRAY['apartment', 'maisonette']::text[],
  'property_types is stored in the list''s order'
);
SELECT is(
  (SELECT construction FROM requirements WHERE opportunity_id = current_setting('test.opp')::uuid),
  ARRAY['brick', 'panel']::text[],
  'construction is stored in the list''s order'
);
SELECT lives_ok(
  pg_temp.save('{"property_types": ["apartment", "maisonette"], "construction": ["brick", "panel"]}', pg_temp.locs('lozenets')),
  'The same lists in another order save'
);
SELECT is(pg_temp.audit_count(), 1, 'A save that only re-orders the lists writes no audit row');

-- ── 2. Locations the form refuses ────────────────────────────────────────────

SELECT throws_ok(
  pg_temp.save('{"budget_max": 200000}', pg_temp.locs('whole', 'lozenets')),
  'P0001', 'requirements.errors.locationCovered',
  'A whole settlement with one of its areas is refused'
);
SELECT throws_ok(
  pg_temp.save('{"budget_max": 200000}', pg_temp.locs('lozenets', 'old')),
  'P0001', 'requirements.errors.inactiveArea',
  'A newly added inactive area is refused'
);

-- Iztok is saved, then deactivated: it stays, but another inactive area still can't be added.
SELECT lives_ok(pg_temp.save('{"budget_max": 200000}', pg_temp.locs('lozenets', 'iztok')), 'Iztok is saved');
RESET ROLE;
UPDATE areas SET is_active = false WHERE id = current_setting('test.iztok')::uuid;
SET ROLE authenticated;

SELECT lives_ok(
  pg_temp.save('{"budget_max": 220000}', pg_temp.locs('lozenets', 'iztok')),
  'An area deactivated after it was saved stays on the requirement'
);
SELECT throws_ok(
  pg_temp.save('{"budget_max": 220000}', pg_temp.locs('lozenets', 'iztok', 'old')),
  'P0001', 'requirements.errors.inactiveArea',
  'Keeping a deactivated area doesn''t let another inactive one in'
);

SELECT * FROM finish();
ROLLBACK;
