-- spec: matching, Tasks 1–2 (AD-060). `opportunity_properties.source` and `match_evaluate`.
BEGIN;
SELECT plan(75);

-- ── Setup ────────────────────────────────────────────────────────────────────

SELECT set_config('test.a1', gen_random_uuid()::text, true);
SELECT set_config('test.u1', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES (current_setting('test.u1')::uuid, 'm-broker@example.com');
INSERT INTO agencies (id, name, slug) VALUES (current_setting('test.a1')::uuid, 'Agency M1', 'm1');
INSERT INTO agency_memberships (agency_id, user_id, role, status)
VALUES (current_setting('test.a1')::uuid, current_setting('test.u1')::uuid, 'broker', 'active');
SELECT seed_agency_defaults(current_setting('test.a1')::uuid);

SELECT set_config('test.sofia', (SELECT id FROM settlements WHERE ekatte = '68134')::text, true);
SELECT set_config('test.stage', (SELECT id FROM stages WHERE agency_id = current_setting('test.a1')::uuid ORDER BY sort_order LIMIT 1)::text, true);
SELECT set_config('test.buyer', gen_random_uuid()::text, true);

INSERT INTO opportunities (id, agency_id, title, type, status, stage_id)
VALUES (current_setting('test.buyer')::uuid, current_setting('test.a1')::uuid, 'Купувач', 'buyer', 'active',
        current_setting('test.stage')::uuid);

CREATE FUNCTION pg_temp.act_as(p_user TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    format('{"sub": "%s", "role": "authenticated"}', current_setting('test.' || p_user)), true);
  SET ROLE authenticated;
END;
$$;

CREATE FUNCTION pg_temp.add_property(p_agency TEXT) RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO properties (agency_id, code, type, settlement_id)
  VALUES (current_setting('test.' || p_agency)::uuid, 0, 'garage', current_setting('test.sofia')::uuid)
  RETURNING id;
$$;

SELECT pg_temp.act_as('u1');
SELECT set_config('test.p1', pg_temp.add_property('a1')::text, true);
SELECT set_config('test.p2', pg_temp.add_property('a1')::text, true);
SELECT set_config('test.p3', pg_temp.add_property('a1')::text, true);

-- ── opportunity_properties.source ────────────────────────────────────────────

INSERT INTO opportunity_properties (agency_id, opportunity_id, property_id, relation, status)
VALUES (current_setting('test.a1')::uuid, current_setting('test.buyer')::uuid, current_setting('test.p1')::uuid, 'candidate', 'candidate');

SELECT is(
  (SELECT source FROM opportunity_properties WHERE property_id = current_setting('test.p1')::uuid),
  'manual', 'A link inserted without a source is manual'
);

INSERT INTO opportunity_properties (agency_id, opportunity_id, property_id, relation, status, source)
VALUES (current_setting('test.a1')::uuid, current_setting('test.buyer')::uuid, current_setting('test.p2')::uuid, 'candidate', 'candidate', 'match');

SELECT is(
  (SELECT source FROM opportunity_properties WHERE property_id = current_setting('test.p2')::uuid),
  'match', 'A link can be inserted from a match list'
);

SELECT throws_ok(
  $$ INSERT INTO opportunity_properties (agency_id, opportunity_id, property_id, relation, status, source)
     VALUES (current_setting('test.a1')::uuid, current_setting('test.buyer')::uuid, current_setting('test.p3')::uuid, 'candidate', 'candidate', 'email') $$,
  '23514', NULL, 'An unknown source is refused'
);

SELECT throws_ok(
  $$ UPDATE opportunity_properties SET source = 'match' WHERE property_id = current_setting('test.p1')::uuid $$,
  '42501', NULL, 'A member cannot update the source (column privilege, AD-058)'
);

SELECT lives_ok(
  $$ UPDATE opportunity_properties SET status = 'viewed' WHERE property_id = current_setting('test.p1')::uuid $$,
  'The status is still updatable'
);

-- A completed viewing that creates the link marks it 'viewing'; an existing link keeps its source.
CREATE FUNCTION pg_temp.complete_viewing(p_property TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO tasks (agency_id, opportunity_id, property_id, title, task_type, assigned_to)
  VALUES (current_setting('test.a1')::uuid, current_setting('test.buyer')::uuid, current_setting('test.' || p_property)::uuid,
          'Оглед', 'viewing', current_setting('test.u1')::uuid)
  RETURNING id INTO v_id;
  UPDATE tasks SET status = 'completed', outcome = 'Огледан', completed_at = now() WHERE id = v_id;
END;
$$;

SELECT set_config('test.p4', pg_temp.add_property('a1')::text, true);
SELECT pg_temp.complete_viewing('p4');
SELECT is(
  (SELECT source FROM opportunity_properties WHERE property_id = current_setting('test.p4')::uuid),
  'viewing', 'A link created by a completed viewing has source viewing'
);

SELECT pg_temp.complete_viewing('p2');
SELECT is(
  (SELECT source FROM opportunity_properties WHERE property_id = current_setting('test.p2')::uuid),
  'match', 'A viewing of an already linked property keeps the link''s source'
);

-- ── match_evaluate ───────────────────────────────────────────────────────────
-- Rows are built with jsonb_populate_record, so the rules are tested without table writes.

RESET ROLE;

SELECT set_config('test.other', (SELECT id FROM settlements WHERE ekatte <> '68134' ORDER BY ekatte LIMIT 1)::text, true);
SELECT set_config('test.lozenets', gen_random_uuid()::text, true);
SELECT set_config('test.iztok', gen_random_uuid()::text, true);

-- A requirement, property and listing from the defaults plus the overrides given.
CREATE FUNCTION pg_temp.ev(p_req jsonb, p_prop jsonb DEFAULT '{}', p_lst jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE sql AS $$
  SELECT match_evaluate(
    jsonb_populate_record(NULL::requirements, jsonb_build_object(
      'property_types', '[]'::jsonb, 'construction', '[]'::jsonb, 'location_keys', '[]'::jsonb,
      'not_top_floor', false, 'budget_must', false, 'location_must', false, 'type_must', false,
      'rooms_must', false, 'area_m2_must', false, 'floor_must', false, 'construction_must', false
    ) || p_req),
    jsonb_populate_record(NULL::properties, jsonb_build_object(
      'type', 'apartment', 'rooms', 2, 'area_m2', 80, 'floor', 3, 'floors_total', 6,
      'construction', 'brick', 'settlement_id', current_setting('test.sofia')
    ) || p_prop),
    jsonb_populate_record(NULL::listings, '{"price": 185000}'::jsonb || p_lst)
  );
$$;

-- The result of one criterion.
CREATE FUNCTION pg_temp.r(p_criterion text, p_req jsonb, p_prop jsonb DEFAULT '{}', p_lst jsonb DEFAULT '{}')
RETURNS text LANGUAGE sql AS $$
  SELECT e->>'result' FROM jsonb_array_elements(pg_temp.ev(p_req, p_prop, p_lst)->'criteria') e
  WHERE e->>'criterion' = p_criterion;
$$;

-- Budget 150,000–200,000: the 10% edges are exact.
SELECT is(pg_temp.r('budget', '{"budget_min":150000,"budget_max":200000}', '{}', '{"price":185000}'), 'match', 'Budget: inside the range matches');
SELECT is(pg_temp.r('budget', '{"budget_min":150000,"budget_max":200000}', '{}', '{"price":200000}'), 'match', 'Budget: exactly the max matches');
SELECT is(pg_temp.r('budget', '{"budget_min":150000,"budget_max":200000}', '{}', '{"price":150000}'), 'match', 'Budget: exactly the min matches');
SELECT is(pg_temp.r('budget', '{"budget_min":150000,"budget_max":200000}', '{}', '{"price":220000}'), 'close', 'Budget: exactly 10% over the max is close');
SELECT is(pg_temp.r('budget', '{"budget_min":150000,"budget_max":200000}', '{}', '{"price":220000.01}'), 'miss', 'Budget: just past 10% over is a miss');
SELECT is(pg_temp.r('budget', '{"budget_min":150000,"budget_max":200000}', '{}', '{"price":135000}'), 'close', 'Budget: exactly 10% under the min is close');
SELECT is(pg_temp.r('budget', '{"budget_min":150000,"budget_max":200000}', '{}', '{"price":134999.99}'), 'miss', 'Budget: just past 10% under is a miss');
SELECT is(pg_temp.r('budget', '{"budget_max":200000}', '{}', '{"price":50000}'), 'match', 'Budget: a max alone has no lower bound');

-- Rooms 2–3, apartments only.
SELECT is(pg_temp.r('rooms', '{"rooms_min":2,"rooms_max":3}', '{"rooms":3}'), 'match', 'Rooms: inside the range matches');
SELECT is(pg_temp.r('rooms', '{"rooms_min":2,"rooms_max":3}', '{"rooms":1}'), 'close', 'Rooms: one under the min is close');
SELECT is(pg_temp.r('rooms', '{"rooms_min":2,"rooms_max":3}', '{"rooms":4}'), 'close', 'Rooms: one over the max is close');
SELECT is(pg_temp.r('rooms', '{"rooms_min":2,"rooms_max":3}', '{"rooms":5}'), 'miss', 'Rooms: two over is a miss');
SELECT is(pg_temp.r('rooms', '{"rooms_min":3,"rooms_max":3}', '{"rooms":1}'), 'miss', 'Rooms: two under is a miss');
SELECT is(pg_temp.r('rooms', '{"rooms_min":2,"rooms_max":3}', '{"type":"house","rooms":null}'), 'n/a', 'Rooms: not applicable to a house');
SELECT is(pg_temp.r('rooms', '{"rooms_min":2,"rooms_max":3}', '{"type":"studio","rooms":null}'), 'n/a', 'Rooms: not applicable to a studio');

-- m² 80–100, the plot's area for a plot.
SELECT is(pg_temp.r('area_m2', '{"area_m2_min":80,"area_m2_max":100}', '{"area_m2":90}'), 'match', 'm²: inside the range matches');
SELECT is(pg_temp.r('area_m2', '{"area_m2_min":80,"area_m2_max":100}', '{"area_m2":72}'), 'close', 'm²: exactly 10% under the min is close');
SELECT is(pg_temp.r('area_m2', '{"area_m2_min":80,"area_m2_max":100}', '{"area_m2":71.9}'), 'miss', 'm²: just past 10% under is a miss');
SELECT is(pg_temp.r('area_m2', '{"area_m2_min":80,"area_m2_max":100}', '{"area_m2":110}'), 'close', 'm²: exactly 10% over the max is close');
SELECT is(pg_temp.r('area_m2', '{"area_m2_min":80,"area_m2_max":100}', '{"area_m2":110.1}'), 'miss', 'm²: just past 10% over is a miss');
SELECT is(pg_temp.r('area_m2', '{"area_m2_min":80,"area_m2_max":100}', '{"area_m2":null}'), 'unknown', 'm²: not recorded is unknown');
SELECT is(pg_temp.r('area_m2', '{"area_m2_min":80,"area_m2_max":100}', '{"type":"plot","rooms":null,"area_m2":null,"plot_m2":90,"floor":null,"floors_total":null,"construction":null}'), 'match', 'm²: a plot uses its plot m²');
SELECT is(pg_temp.r('area_m2', '{"area_m2_min":80,"area_m2_max":100}', '{"type":"plot","rooms":null,"area_m2":90,"plot_m2":500,"floor":null,"floors_total":null,"construction":null}'), 'miss', 'm²: a plot ignores its built-up m²');

-- Location: Sofia as a whole, or only the Lozenets area.
SELECT is(pg_temp.r('location', jsonb_build_object('location_keys', jsonb_build_array(current_setting('test.sofia')))), 'match', 'Location: the whole settlement matches a property without an area');
SELECT is(pg_temp.r('location', jsonb_build_object('location_keys', jsonb_build_array(current_setting('test.sofia'))), jsonb_build_object('area_id', current_setting('test.iztok'))), 'match', 'Location: the whole settlement matches any of its areas');
SELECT is(pg_temp.r('location', jsonb_build_object('location_keys', jsonb_build_array(current_setting('test.sofia')))::jsonb, jsonb_build_object('settlement_id', current_setting('test.other'))), 'miss', 'Location: another settlement is a miss');
SELECT is(pg_temp.r('location', jsonb_build_object('location_keys', jsonb_build_array(current_setting('test.sofia') || ':' || current_setting('test.lozenets'))), jsonb_build_object('area_id', current_setting('test.lozenets'))), 'match', 'Location: a listed area matches');
SELECT is(pg_temp.r('location', jsonb_build_object('location_keys', jsonb_build_array(current_setting('test.sofia') || ':' || current_setting('test.lozenets'))), jsonb_build_object('area_id', current_setting('test.iztok'))), 'miss', 'Location: another area of the settlement is a miss');
SELECT is(pg_temp.r('location', jsonb_build_object('location_keys', jsonb_build_array(current_setting('test.sofia') || ':' || current_setting('test.lozenets')))), 'unknown', 'Location: no area on the property is unknown when only areas are listed');
SELECT is(pg_temp.r('location', jsonb_build_object('location_keys', jsonb_build_array(current_setting('test.sofia') || ':' || current_setting('test.lozenets'))), jsonb_build_object('settlement_id', current_setting('test.other'))), 'miss', 'Location: another settlement is a miss even with areas listed');

-- Type
SELECT is(pg_temp.r('type', '{"property_types":["apartment","maisonette"]}'), 'match', 'Type: in the list matches');
SELECT is(pg_temp.r('type', '{"property_types":["apartment","maisonette"]}', '{"type":"house","rooms":null}'), 'miss', 'Type: outside the list is a miss');

-- Floor 2–5, and "not top floor"
SELECT is(pg_temp.r('floor', '{"floor_min":2,"floor_max":5}', '{"floor":3}'), 'match', 'Floor: inside the range matches');
SELECT is(pg_temp.r('floor', '{"floor_min":2,"floor_max":5}', '{"floor":1}'), 'miss', 'Floor: outside the range is a miss, never close');
SELECT is(pg_temp.r('floor', '{"floor_min":2,"floor_max":5}', '{"floor":null}'), 'unknown', 'Floor: not recorded is unknown');
SELECT is(pg_temp.r('floor', '{"floor_min":2,"floor_max":5}', '{"type":"house","floor":null}'), 'n/a', 'Floor: not applicable to a house');
SELECT is(pg_temp.r('floor', '{"floor_min":2,"floor_max":5}', '{"type":"plot","rooms":null,"floor":null,"floors_total":null,"construction":null,"plot_m2":500}'), 'n/a', 'Floor: not applicable to a plot');
SELECT is(pg_temp.r('floor', '{"floor_min":2,"floor_max":5}', '{"type":"garage","rooms":null,"floor":-1,"floors_total":null,"construction":null}'), 'miss', 'Floor: a garage has a floor');
SELECT is(pg_temp.r('floor', '{"not_top_floor":true}', '{"floor":3,"floors_total":6}'), 'match', 'Not top floor: a floor below the top matches');
SELECT is(pg_temp.r('floor', '{"not_top_floor":true}', '{"floor":6,"floors_total":6}'), 'miss', 'Not top floor: the top floor is a miss');
SELECT is(pg_temp.r('floor', '{"not_top_floor":true}', '{"floor":3,"floors_total":null}'), 'unknown', 'Not top floor: without the floors total is unknown');
SELECT is(pg_temp.r('floor', '{"not_top_floor":true}', '{"type":"garage","rooms":null,"floor":-1,"floors_total":null,"construction":null}'), 'n/a', 'Not top floor alone: not applicable to a garage');
SELECT is(pg_temp.r('floor', '{"floor_min":2,"floor_max":6,"not_top_floor":true}', '{"floor":6,"floors_total":6}'), 'miss', 'Floor range and not top floor: the worst result wins');
SELECT is(pg_temp.r('floor', '{"floor_min":-5,"floor_max":5,"not_top_floor":true}', '{"type":"garage","rooms":null,"floor":-1,"floors_total":null,"construction":null}'), 'match', 'Floor range with not top floor: a garage is judged by the range only');

-- Construction
SELECT is(pg_temp.r('construction', '{"construction":["brick","epk"]}'), 'match', 'Construction: in the list matches');
SELECT is(pg_temp.r('construction', '{"construction":["brick","epk"]}', '{"construction":"panel"}'), 'miss', 'Construction: outside the list is a miss');
SELECT is(pg_temp.r('construction', '{"construction":["brick","epk"]}', '{"construction":null}'), 'unknown', 'Construction: not recorded is unknown');
SELECT is(pg_temp.r('construction', '{"construction":["brick"]}', '{"type":"plot","rooms":null,"floor":null,"floors_total":null,"construction":null,"plot_m2":500}'), 'n/a', 'Construction: not applicable to a plot');
SELECT is(pg_temp.r('construction', '{"construction":["brick"]}', '{"type":"garage","rooms":null,"floors_total":null,"construction":null}'), 'n/a', 'Construction: not applicable to a garage');

-- Score (rule 4) and listing (rules 3, 4)
-- Three criteria: type, rooms 2–3, budget 150–200k.
SELECT is((pg_temp.ev('{"property_types":["apartment"],"rooms_min":2,"rooms_max":3,"budget_min":150000,"budget_max":200000}')->>'score')::int, 100, 'Score: all criteria matching is 100');
SELECT is((pg_temp.ev('{"property_types":["apartment"],"rooms_min":2,"rooms_max":3,"budget_min":150000,"budget_max":200000}', '{"rooms":4}')->>'score')::int, 83, 'Score: one close of three is 83 (half credit)');
SELECT is((pg_temp.ev('{"property_types":["apartment"],"rooms_min":2,"rooms_max":3,"budget_min":150000,"budget_max":200000}', '{"rooms":6}')->>'score')::int, 67, 'Score: one miss of three is 67');
SELECT is((pg_temp.ev('{"budget_min":150000,"budget_max":200000}', '{}', '{"price":210000}')->>'score')::int, 50, 'Score: a single close criterion is 50');
SELECT is((pg_temp.ev('{"rooms_min":2,"rooms_max":3,"budget_min":150000,"budget_max":200000}', '{"type":"house","rooms":null}')->>'score')::int, 100, 'Score: a not applicable criterion is left out of the denominator');
SELECT is((pg_temp.ev('{"budget_min":150000,"budget_max":200000,"budget_must":true}', '{}', '{"price":210000}')->>'listed')::boolean, false, 'Listing: a close must-have excludes the property');
SELECT is((pg_temp.ev('{"budget_min":150000,"budget_max":200000,"budget_must":true}', '{}', '{"price":500000}')->>'listed')::boolean, false, 'Listing: a missed must-have excludes the property');
SELECT is((pg_temp.ev('{"budget_min":150000,"budget_max":200000,"budget_must":false,"rooms_min":2,"rooms_max":3}', '{}', '{"price":210000}')->>'listed')::boolean, true, 'Listing: a close criterion that is not a must-have keeps the property');
SELECT is((pg_temp.ev('{"area_m2_min":80,"area_m2_max":100,"area_m2_must":true,"budget_min":150000,"budget_max":200000}', '{"area_m2":null}')->>'listed')::boolean, true, 'Listing: an unrecorded must-have keeps the property');
SELECT is((pg_temp.ev('{"area_m2_min":80,"area_m2_max":100,"area_m2_must":true,"budget_min":150000,"budget_max":200000}', '{"area_m2":null}')->>'score')::int, 50, 'Score: an unrecorded value scores 0 for that criterion');
SELECT cmp_ok(
  (pg_temp.ev('{"area_m2_min":80,"area_m2_max":100,"area_m2_must":true,"budget_min":150000,"budget_max":200000}', '{"area_m2":null}')->>'score')::int,
  '<',
  (pg_temp.ev('{"area_m2_min":80,"area_m2_max":100,"area_m2_must":true,"budget_min":150000,"budget_max":200000}', '{"area_m2":90}')->>'score')::int,
  'An unrecorded must-have scores below the same property with the value recorded (AC-2)'
);
SELECT is((pg_temp.ev('{"rooms_min":2,"rooms_max":3}', '{"type":"house","rooms":null}')->>'listed')::boolean, false, 'Listing: a rooms-only requirement against a house has no applicable criterion');
SELECT is((pg_temp.ev('{"budget_min":150000,"budget_max":200000}', '{}', '{"price":500000}')->>'listed')::boolean, false, 'Listing: a score of 0 is not listed');
SELECT is((pg_temp.ev('{"budget_min":150000,"budget_max":200000,"budget_must":true}', '{}', '{"price":185000}')->>'listed')::boolean, true, 'Listing: a matching must-have is listed');

-- Shape
SELECT is(
  (SELECT jsonb_agg(e->>'criterion') FROM jsonb_array_elements(pg_temp.ev(jsonb_build_object(
    'property_types', '["apartment"]'::jsonb, 'rooms_min', 2, 'area_m2_min', 50,
    'location_keys', jsonb_build_array(current_setting('test.sofia')), 'budget_max', 200000,
    'floor_min', 1, 'construction', '["brick"]'::jsonb))->'criteria') e),
  '["type", "rooms", "area_m2", "location", "budget", "floor", "construction"]'::jsonb,
  'Criteria come in the summary''s reading order'
);
SELECT is(
  pg_temp.ev('{"budget_max":200000,"budget_must":true,"financing":"cash","wishes":"балкон"}')->'criteria',
  '[{"criterion":"budget","result":"match","must":true}]'::jsonb,
  'Only criteria the requirement sets appear, with their must-have flag; financing and wishes never do'
);
SELECT is(
  pg_temp.ev('{"financing":"cash","wishes":"балкон"}'),
  '{"score":0,"listed":false,"criteria":[]}'::jsonb,
  'Financing and wishes alone give no criteria, score 0 and are not listed'
);

SELECT ok(has_function_privilege('authenticated', 'match_evaluate(requirements, properties, listings)', 'EXECUTE'), 'authenticated can execute match_evaluate');
SELECT ok(NOT has_function_privilege('anon', 'match_evaluate(requirements, properties, listings)', 'EXECUTE'), 'anon cannot execute match_evaluate');

SELECT * FROM finish();
ROLLBACK;
