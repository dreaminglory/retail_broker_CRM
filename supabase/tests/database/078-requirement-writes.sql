-- spec: requirements, Task 2 (AD-059). save_requirement and remove_requirement are the only
-- writers; each save is one audit row on the opportunity (AC-2), closed and seller deals are
-- refused (AC-3, AC-6), constraints come back as keys (AC-4, AC-5), and agency B can't touch
-- agency A's rows (AC-7).
BEGIN;
SELECT plan(43);

-- ── Setup ────────────────────────────────────────────────────────────────────

SELECT set_config('test.a1', gen_random_uuid()::text, true);
SELECT set_config('test.a2', gen_random_uuid()::text, true);
SELECT set_config('test.u_broker', gen_random_uuid()::text, true);
SELECT set_config('test.u_b_broker', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES
  (current_setting('test.u_broker')::uuid, 'rw-broker@example.com'),
  (current_setting('test.u_b_broker')::uuid, 'rw-b-broker@example.com');

INSERT INTO agencies (id, name, slug) VALUES
  (current_setting('test.a1')::uuid, 'Agency RW1', 'rw1'),
  (current_setting('test.a2')::uuid, 'Agency RW2', 'rw2');

INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.u_broker')::uuid, 'broker', 'active'),
  (current_setting('test.a2')::uuid, current_setting('test.u_b_broker')::uuid, 'broker', 'active');

SELECT seed_agency_defaults(current_setting('test.a1')::uuid);
SELECT seed_agency_defaults(current_setting('test.a2')::uuid);

CREATE FUNCTION pg_temp.act_as(p_user TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    format('{"sub": "%s", "role": "authenticated"}', current_setting('test.' || p_user)), true);
  SET ROLE authenticated;
END;
$$;

SELECT set_config('test.sofia', (SELECT id FROM settlements WHERE ekatte = '68134')::text, true);
SELECT set_config('test.plovdiv', (SELECT id FROM settlements WHERE ekatte = '56784')::text, true);
SELECT set_config('test.lozenets', gen_random_uuid()::text, true);
SELECT set_config('test.iztok', gen_random_uuid()::text, true);
SELECT set_config('test.mladost', gen_random_uuid()::text, true);
SELECT set_config('test.kapana', gen_random_uuid()::text, true);
SELECT set_config('test.area_b', gen_random_uuid()::text, true);
SELECT set_config('test.opp', gen_random_uuid()::text, true);
SELECT set_config('test.opp_seller', gen_random_uuid()::text, true);
SELECT set_config('test.opp_won', gen_random_uuid()::text, true);
SELECT set_config('test.opp_nurture', gen_random_uuid()::text, true);
SELECT set_config('test.opp_b', gen_random_uuid()::text, true);

INSERT INTO areas (id, agency_id, settlement_id, name) VALUES
  (current_setting('test.lozenets')::uuid, current_setting('test.a1')::uuid, current_setting('test.sofia')::uuid, 'Лозенец'),
  (current_setting('test.iztok')::uuid, current_setting('test.a1')::uuid, current_setting('test.sofia')::uuid, 'Изток'),
  (current_setting('test.mladost')::uuid, current_setting('test.a1')::uuid, current_setting('test.sofia')::uuid, 'Младост 1'),
  (current_setting('test.kapana')::uuid, current_setting('test.a1')::uuid, current_setting('test.plovdiv')::uuid, 'Капана'),
  (current_setting('test.area_b')::uuid, current_setting('test.a2')::uuid, current_setting('test.sofia')::uuid, 'Лозенец');

INSERT INTO opportunities (id, agency_id, title, type, status, stage_id)
SELECT o.id, o.agency_id, o.title, o.type, o.status,
       (SELECT id FROM stages s WHERE s.agency_id = o.agency_id ORDER BY sort_order LIMIT 1)
FROM (VALUES
  (current_setting('test.opp')::uuid,         current_setting('test.a1')::uuid, 'Купувач',   'buyer',  'active'),
  (current_setting('test.opp_seller')::uuid,  current_setting('test.a1')::uuid, 'Продавач',  'seller', 'active'),
  (current_setting('test.opp_won')::uuid,     current_setting('test.a1')::uuid, 'Спечелена', 'buyer',  'won'),
  (current_setting('test.opp_nurture')::uuid, current_setting('test.a1')::uuid, 'Задържана', 'tenant', 'nurture'),
  (current_setting('test.opp_b')::uuid,       current_setting('test.a2')::uuid, 'Купувач Б', 'buyer',  'active')
) AS o(id, agency_id, title, type, status);

-- AC-1's requirement (fields as the form sends them) and its locations.
SELECT set_config('test.fields', $${
  "budget_min": 150000, "budget_max": 200000,
  "property_types": ["apartment", "maisonette"],
  "rooms_min": 2, "rooms_max": 3,
  "not_top_floor": true, "construction": ["brick"], "financing": "mortgage", "wishes": "паркомясто",
  "budget_must": true, "location_must": true, "type_must": true
}$$, true);

CREATE FUNCTION pg_temp.locs(VARIADIC p_areas TEXT[]) RETURNS JSONB LANGUAGE sql AS $$
  SELECT jsonb_agg(jsonb_build_object('settlement_id', current_setting('test.sofia'), 'area_id', current_setting('test.' || a)))
  FROM unnest(p_areas) a;
$$;

-- What the row's snapshot should be: its location rows, as keys, sorted.
CREATE FUNCTION pg_temp.keys_of(p_opp TEXT) RETURNS TEXT[] LANGUAGE sql AS $$
  SELECT COALESCE(array_agg(k ORDER BY k COLLATE "C"), '{}')
  FROM (SELECT l.settlement_id::text || COALESCE(':' || l.area_id::text, '') AS k
  FROM requirement_locations l JOIN requirements r ON r.id = l.requirement_id
  WHERE r.opportunity_id = current_setting('test.' || p_opp)::uuid) x;
$$;

CREATE FUNCTION pg_temp.audits(p_opp TEXT) RETURNS SETOF audit_log LANGUAGE sql AS $$
  SELECT * FROM audit_log
  WHERE entity_type = 'opportunity' AND field_name = 'requirement'
    AND entity_id = current_setting('test.' || p_opp)::uuid
  ORDER BY id;
$$;

-- Every row of a test shares one performed_at (transaction time), so the AC-2 edit is found by
-- what it holds: the one change of the budget max.
CREATE FUNCTION pg_temp.edit_row() RETURNS SETOF audit_log LANGUAGE sql AS $$
  SELECT * FROM pg_temp.audits('opp')
  WHERE metadata->>'event' = 'changed' AND metadata->'changes' @> '[{"field": "budget_max"}]';
$$;

-- ── Create (AC-1) ────────────────────────────────────────────────────────────

SELECT pg_temp.act_as('u_broker');

SELECT lives_ok(
  format($$ SELECT save_requirement(%L, %L::jsonb, %L::jsonb) $$,
         current_setting('test.opp'), current_setting('test.fields'), pg_temp.locs('lozenets', 'iztok')),
  'A broker saves AC-1''s requirement on a buyer deal'
);

RESET ROLE;

SELECT is((SELECT count(*)::int FROM requirements WHERE opportunity_id = current_setting('test.opp')::uuid), 1,
  'The requirement exists');
SELECT is((SELECT count(*)::int FROM requirement_locations), 2, 'With its two locations');
SELECT is(
  (SELECT location_keys FROM requirements WHERE opportunity_id = current_setting('test.opp')::uuid),
  pg_temp.keys_of('opp'),
  'location_keys matches the locations after create'
);
SELECT is(
  (SELECT created_by FROM requirements WHERE opportunity_id = current_setting('test.opp')::uuid),
  current_setting('test.u_broker')::uuid,
  'created_by is the caller'
);
SELECT is((SELECT count(*)::int FROM pg_temp.audits('opp')), 1, 'Create writes one audit row');
SELECT is(
  (SELECT metadata->>'event' || '/' || action || '/' || performed_by::text FROM pg_temp.audits('opp')),
  'created/field_change/' || current_setting('test.u_broker'),
  'The row is a created field_change by the caller'
);
SELECT is(
  (SELECT jsonb_array_length(c->'to') FROM pg_temp.audits('opp'), jsonb_array_elements(metadata->'changes') c
   WHERE c->>'field' = 'locations'),
  2,
  'The created row lists both locations'
);

-- ── Edit: one save, one entry (AC-2) ─────────────────────────────────────────

SELECT pg_temp.act_as('u_broker');

SELECT lives_ok(
  format($$ SELECT save_requirement(%L, %L::jsonb || '{"budget_max": 220000}', %L::jsonb) $$,
         current_setting('test.opp'), current_setting('test.fields'), pg_temp.locs('lozenets', 'iztok', 'mladost')),
  'The broker raises the budget max and adds Mladost 1'
);

RESET ROLE;

SELECT is((SELECT count(*)::int FROM pg_temp.audits('opp')), 2, 'The edit writes exactly one more audit row');
SELECT results_eq(
  $$ SELECT c->>'field' FROM pg_temp.edit_row() a, jsonb_array_elements(a.metadata->'changes') c ORDER BY 1 $$,
  $$ VALUES ('budget_max'), ('locations') $$,
  'It holds only the two changes'
);
SELECT is(
  (SELECT (c->>'from')::numeric || ' → ' || (c->>'to')::numeric
   FROM pg_temp.edit_row() a, jsonb_array_elements(a.metadata->'changes') c
   WHERE c->>'field' = 'budget_max'),
  '200000.00 → 220000.00',
  'The budget change keeps its old value'
);
SELECT is(
  (SELECT jsonb_array_length(c->'from') || ' → ' || jsonb_array_length(c->'to')
   FROM pg_temp.edit_row() a, jsonb_array_elements(a.metadata->'changes') c
   WHERE c->>'field' = 'locations'),
  '2 → 3',
  'The location change keeps the old list'
);
SELECT ok(
  (SELECT c->'to' @> '[{"settlement_bg": "София", "settlement_en": "Sofia", "area": "Младост 1"}]'
   FROM pg_temp.edit_row() a, jsonb_array_elements(a.metadata->'changes') c
   WHERE c->>'field' = 'locations'),
  'Locations are recorded by name in both languages'
);
SELECT is(
  (SELECT location_keys FROM requirements WHERE opportunity_id = current_setting('test.opp')::uuid),
  pg_temp.keys_of('opp'),
  'location_keys matches the locations after the edit'
);

SELECT pg_temp.act_as('u_broker');
SELECT lives_ok(
  format($$ SELECT save_requirement(%L, %L::jsonb || '{"budget_max": 220000}', %L::jsonb) $$,
         current_setting('test.opp'), current_setting('test.fields'), pg_temp.locs('mladost', 'iztok', 'lozenets')),
  'Saving the same requirement again (locations in another order) succeeds'
);
RESET ROLE;
SELECT is((SELECT count(*)::int FROM pg_temp.audits('opp')), 2, 'A save with no change writes no audit row');

SELECT pg_temp.act_as('u_broker');
SELECT lives_ok(
  format($$ SELECT save_requirement(%L, '{"budget_max": 220000}'::jsonb, '[]'::jsonb) $$, current_setting('test.opp')),
  'A save can clear every location'
);
RESET ROLE;
SELECT is(
  (SELECT location_keys FROM requirements WHERE opportunity_id = current_setting('test.opp')::uuid),
  '{}'::text[],
  'location_keys is empty once the locations are cleared'
);
SELECT is((SELECT count(*)::int FROM requirement_locations), 0, 'No location rows are left');

-- ── Refusals come back as keys (AC-3, AC-4, AC-5, AC-6) ──────────────────────

SELECT pg_temp.act_as('u_broker');

SELECT throws_ok(
  format($$ SELECT save_requirement(%L, '{"financing": "cash", "wishes": "асансьор"}'::jsonb, '[]'::jsonb) $$, current_setting('test.opp')),
  'P0001', 'requirements.errors.invalid',
  'A save with no criterion is refused (AC-4)'
);
SELECT throws_ok(
  format($$ SELECT save_requirement(%L, '{"rooms_min": 3, "rooms_max": 2}'::jsonb, '[]'::jsonb) $$, current_setting('test.opp')),
  'P0001', 'requirements.errors.invalid',
  'rooms_min > rooms_max is refused (AC-4)'
);
SELECT throws_ok(
  format($$ SELECT save_requirement(%L, '{"budget_max": 1, "location_must": true}'::jsonb, '[]'::jsonb) $$, current_setting('test.opp')),
  'P0001', 'requirements.errors.invalid',
  'location_must with no location is refused (AC-5)'
);
SELECT throws_ok(
  format($$ SELECT save_requirement(%L, '{"budget_max": 1}'::jsonb, %L::jsonb) $$,
         current_setting('test.opp'),
         jsonb_build_array(jsonb_build_object('settlement_id', current_setting('test.sofia'), 'area_id', current_setting('test.kapana')))),
  'P0001', 'requirements.errors.invalidLocation',
  'An area of Plovdiv under Sofia is refused (AC-4)'
);
SELECT throws_ok(
  format($$ SELECT save_requirement(%L, '{"budget_max": 1}'::jsonb, %L::jsonb) $$,
         current_setting('test.opp'),
         jsonb_build_array(jsonb_build_object('settlement_id', current_setting('test.sofia'), 'area_id', current_setting('test.area_b')))),
  'P0001', 'requirements.errors.invalidLocation',
  'Agency B''s area is refused on agency A''s requirement (AC-7)'
);
SELECT throws_ok(
  format($$ SELECT save_requirement(%L, '{"budget_max": 1}'::jsonb, '[]'::jsonb) $$, current_setting('test.opp_seller')),
  'P0001', 'requirements.errors.wrongOpportunityType',
  'A seller deal is refused (AC-3)'
);
SELECT throws_ok(
  format($$ SELECT save_requirement(%L, '{"budget_max": 1}'::jsonb, '[]'::jsonb) $$, current_setting('test.opp_won')),
  'P0001', 'requirements.errors.readOnly',
  'A won deal is read-only (AC-6)'
);
SELECT throws_ok(
  format($$ SELECT remove_requirement(%L) $$, current_setting('test.opp_won')),
  'P0001', 'requirements.errors.readOnly',
  'A won deal''s requirement cannot be removed (AC-6)'
);
SELECT lives_ok(
  format($$ SELECT save_requirement(%L, '{"budget_max": 900}'::jsonb, '[]'::jsonb) $$, current_setting('test.opp_nurture')),
  'A nurture deal is writable'
);

RESET ROLE;
UPDATE opportunities SET status = 'active' WHERE id = current_setting('test.opp_won')::uuid;
SELECT pg_temp.act_as('u_broker');

SELECT lives_ok(
  format($$ SELECT save_requirement(%L, '{"budget_max": 1}'::jsonb, '[]'::jsonb) $$, current_setting('test.opp_won')),
  'Reopened, the deal is writable again (AC-6)'
);

-- ── Agency B (AC-7) ──────────────────────────────────────────────────────────

SELECT pg_temp.act_as('u_b_broker');

SELECT throws_ok(
  format($$ SELECT save_requirement(%L, '{"budget_max": 1}'::jsonb, '[]'::jsonb) $$, current_setting('test.opp')),
  'P0001', 'requirements.errors.notFound',
  'B''s broker cannot save on A''s deal'
);
SELECT throws_ok(
  format($$ SELECT remove_requirement(%L) $$, current_setting('test.opp')),
  'P0001', 'requirements.errors.notFound',
  'B''s broker cannot remove A''s requirement'
);
SELECT lives_ok(
  format($$ SELECT save_requirement(%L, %L::jsonb, '[]'::jsonb) $$,
         current_setting('test.opp_b'),
         jsonb_build_object('budget_max', 1, 'agency_id', current_setting('test.a1'), 'opportunity_id', current_setting('test.opp'),
                            'location_keys', ARRAY['x'], 'id', gen_random_uuid())),
  'B''s broker saves on B''s deal with A''s ids smuggled into the fields'
);

RESET ROLE;

SELECT is(
  (SELECT agency_id::text || '/' || opportunity_id::text || '/' || cardinality(location_keys)
   FROM requirements WHERE opportunity_id = current_setting('test.opp_b')::uuid),
  current_setting('test.a2') || '/' || current_setting('test.opp_b') || '/0',
  'The smuggled ids are ignored'
);
SELECT is(
  (SELECT budget_max FROM requirements WHERE opportunity_id = current_setting('test.opp')::uuid),
  220000.00::numeric,
  'A''s requirement is unchanged'
);
SELECT is((SELECT count(*)::int FROM pg_temp.audits('opp')), 3, 'A''s audit has only A''s three saves');

-- ── Remove ───────────────────────────────────────────────────────────────────

SELECT pg_temp.act_as('u_broker');
SELECT lives_ok(
  format($$ SELECT save_requirement(%L, '{"budget_max": 220000}'::jsonb, %L::jsonb) $$,
         current_setting('test.opp'), pg_temp.locs('lozenets')),
  'The broker adds a location back'
);
SELECT lives_ok(format($$ SELECT remove_requirement(%L) $$, current_setting('test.opp')), 'The broker removes the requirement');
SELECT throws_ok(
  format($$ SELECT remove_requirement(%L) $$, current_setting('test.opp')),
  'P0001', 'requirements.errors.notFound',
  'Removing it twice is refused'
);
RESET ROLE;

SELECT is(
  (SELECT count(*)::int FROM requirements WHERE opportunity_id = current_setting('test.opp')::uuid)
  + (SELECT count(*)::int FROM requirement_locations l JOIN requirements r ON r.id = l.requirement_id
     WHERE r.opportunity_id = current_setting('test.opp')::uuid),
  0,
  'The requirement and its locations are gone'
);
SELECT is(
  (SELECT count(*)::int FROM pg_temp.audits('opp') WHERE metadata->>'event' = 'removed'),
  1,
  'Removing writes a removed row; the earlier entries stay'
);

-- ── Deleting the opportunity (rule 9) ────────────────────────────────────────

DELETE FROM opportunities WHERE id = current_setting('test.opp_nurture')::uuid;

SELECT is(
  (SELECT count(*)::int FROM requirements WHERE opportunity_id = current_setting('test.opp_nurture')::uuid),
  0,
  'Deleting an opportunity deletes its requirement'
);
SELECT is(
  (SELECT count(*)::int FROM pg_temp.audits('opp_nurture') WHERE metadata->>'event' = 'removed'),
  0,
  'and writes no removed row for a deal that is gone'
);

SELECT * FROM finish();
ROLLBACK;
