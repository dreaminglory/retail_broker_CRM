-- spec: matching, Tasks 1–2 (AD-060). `opportunity_properties.source` and `match_evaluate`.
BEGIN;
SELECT plan(7);

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

SELECT * FROM finish();
ROLLBACK;
