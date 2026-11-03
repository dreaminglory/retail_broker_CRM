-- spec: properties, Task 3. Property code, audit, and rules 4, 5, 7 and 8.
BEGIN;
SELECT plan(27);

SELECT set_config('test.a1', gen_random_uuid()::text, true);
SELECT set_config('test.a2', gen_random_uuid()::text, true);
SELECT set_config('test.u1', gen_random_uuid()::text, true);
SELECT set_config('test.u1b', gen_random_uuid()::text, true);
SELECT set_config('test.u2', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES
  (current_setting('test.u1')::uuid, 't-broker@example.com'),
  (current_setting('test.u1b')::uuid, 't-broker2@example.com'),
  (current_setting('test.u2')::uuid, 't-b-broker@example.com');
INSERT INTO agencies (id, name, slug) VALUES
  (current_setting('test.a1')::uuid, 'Agency T1', 't1'),
  (current_setting('test.a2')::uuid, 'Agency T2', 't2');
INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.u1')::uuid, 'broker', 'active'),
  (current_setting('test.a1')::uuid, current_setting('test.u1b')::uuid, 'broker', 'active'),
  (current_setting('test.a2')::uuid, current_setting('test.u2')::uuid, 'broker', 'active');
SELECT seed_agency_defaults(current_setting('test.a1')::uuid);
SELECT seed_agency_defaults(current_setting('test.a2')::uuid);

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

-- Adds a garage in the caller's agency and returns its id.
CREATE FUNCTION pg_temp.add_property(p_agency TEXT) RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO properties (agency_id, code, type, settlement_id)
  VALUES (current_setting('test.' || p_agency)::uuid, 0, 'garage', current_setting('test.sofia')::uuid)
  RETURNING id;
$$;

-- ── Property code ────────────────────────────────────────────────────────────

SELECT pg_temp.act_as('u1');
SELECT set_config('test.p1', pg_temp.add_property('a1')::text, true);
SELECT set_config('test.p2', pg_temp.add_property('a1')::text, true);
SELECT set_config('test.p3', pg_temp.add_property('a1')::text, true);
SELECT set_config('test.p4', pg_temp.add_property('a1')::text, true);

SELECT results_eq(
  $$ SELECT code FROM properties WHERE id IN (current_setting('test.p1')::uuid, current_setting('test.p2')::uuid) ORDER BY code $$,
  $$ VALUES (1001), (1002) $$,
  'Codes are assigned in order from 1001; a code passed by the caller is ignored'
);

UPDATE properties SET code = 5 WHERE id = current_setting('test.p1')::uuid;
SELECT is((SELECT code FROM properties WHERE id = current_setting('test.p1')::uuid), 1001, 'A code cannot be changed');

SELECT pg_temp.act_as('u2');
SELECT set_config('test.pb', pg_temp.add_property('a2')::text, true);
SELECT is((SELECT code FROM properties WHERE id = current_setting('test.pb')::uuid), 1001, 'Codes are per agency');

-- ── Audit ────────────────────────────────────────────────────────────────────

SELECT pg_temp.act_as('u1');

SELECT is(
  (SELECT count(*)::int FROM audit_log WHERE entity_type = 'property' AND entity_id = current_setting('test.p1')::uuid AND action = 'created'),
  1, 'Creating a property writes one audit row'
);

UPDATE properties SET assigned_to = current_setting('test.u1b')::uuid WHERE id = current_setting('test.p1')::uuid;
SELECT is(
  (SELECT count(*)::int FROM audit_log WHERE entity_id = current_setting('test.p1')::uuid AND action = 'assignment_change'),
  1, 'A reassignment writes one audit row'
);

INSERT INTO listings (agency_id, property_id, offer_type, price)
VALUES (current_setting('test.a1')::uuid, current_setting('test.p1')::uuid, 'sale', 185000);
SELECT set_config('test.l1', (SELECT id FROM listings WHERE property_id = current_setting('test.p1')::uuid)::text, true);

UPDATE listings SET price = 179000 WHERE id = current_setting('test.l1')::uuid;
SELECT results_eq(
  $$ SELECT old_value, new_value, metadata->>'property_id' FROM audit_log
     WHERE entity_type = 'listing' AND entity_id = current_setting('test.l1')::uuid AND field_name = 'price' $$,
  $$ VALUES ('185000.00', '179000.00', current_setting('test.p1')) $$,
  'A price change writes one audit row with both values and the property (AC-5)'
);

SELECT throws_ok(
  format($$ INSERT INTO audit_log (agency_id, entity_type, entity_id, action) VALUES ('%s', 'property', '%s', 'created') $$,
    current_setting('test.a1'), current_setting('test.p1')),
  '42501', NULL,
  'Members still cannot insert into audit_log'
);

-- ── Rule 5: relation vs opportunity type ─────────────────────────────────────

RESET ROLE;
SELECT set_config('test.buyer', gen_random_uuid()::text, true);
SELECT set_config('test.seller', gen_random_uuid()::text, true);
SELECT set_config('test.buyer2', gen_random_uuid()::text, true);
INSERT INTO opportunities (id, agency_id, title, type, stage_id) VALUES
  (current_setting('test.buyer')::uuid, current_setting('test.a1')::uuid, 'Купувач', 'buyer', current_setting('test.stage')::uuid),
  (current_setting('test.buyer2')::uuid, current_setting('test.a1')::uuid, 'Купувач 2', 'buyer', current_setting('test.stage')::uuid),
  (current_setting('test.seller')::uuid, current_setting('test.a1')::uuid, 'Продавач', 'seller', current_setting('test.stage')::uuid);

SELECT pg_temp.act_as('u1');

SELECT throws_ok(
  format($$ INSERT INTO opportunity_properties (agency_id, opportunity_id, property_id, relation) VALUES ('%s', '%s', '%s', 'subject') $$,
    current_setting('test.a1'), current_setting('test.buyer'), current_setting('test.p4')),
  'P0001', 'properties.errors.relationNotAllowed',
  'A subject link on a buyer opportunity is refused'
);

SELECT throws_ok(
  format($$ INSERT INTO opportunity_properties (agency_id, opportunity_id, property_id, relation, status) VALUES ('%s', '%s', '%s', 'candidate', 'candidate') $$,
    current_setting('test.a1'), current_setting('test.seller'), current_setting('test.p4')),
  'P0001', 'properties.errors.relationNotAllowed',
  'A candidate link on a seller opportunity is refused'
);

SELECT lives_ok(
  format($$ INSERT INTO opportunity_properties (agency_id, opportunity_id, property_id, relation) VALUES ('%s', '%s', '%s', 'subject') $$,
    current_setting('test.a1'), current_setting('test.seller'), current_setting('test.p4')),
  'A subject link on a seller opportunity is allowed'
);

INSERT INTO opportunity_properties (agency_id, opportunity_id, property_id, relation, status) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.buyer')::uuid, current_setting('test.p1')::uuid, 'candidate', 'candidate'),
  (current_setting('test.a1')::uuid, current_setting('test.buyer')::uuid, current_setting('test.p2')::uuid, 'candidate', 'candidate'),
  (current_setting('test.a1')::uuid, current_setting('test.buyer')::uuid, current_setting('test.p3')::uuid, 'candidate', 'offered');

SELECT throws_ok(
  $$ UPDATE opportunities SET type = 'seller' WHERE id = current_setting('test.buyer')::uuid $$,
  'P0001', 'opportunities.errors.typeHasProperties',
  'A buyer → seller change with candidates is refused'
);

SELECT lives_ok(
  $$ UPDATE opportunities SET type = 'tenant' WHERE id = current_setting('test.buyer')::uuid $$,
  'A buyer → tenant change keeps candidates valid'
);

-- ── Link audit ───────────────────────────────────────────────────────────────

UPDATE opportunity_properties SET status = 'rejected', rejected_reason = 'Далече от метрото'
WHERE opportunity_id = current_setting('test.buyer')::uuid AND property_id = current_setting('test.p2')::uuid;

SELECT results_eq(
  $$ SELECT entity_type, old_value, new_value, metadata->>'property_id', metadata->>'rejected_reason' FROM audit_log
     WHERE entity_id = current_setting('test.buyer')::uuid AND field_name = 'property_link'
       AND metadata->>'property_id' = current_setting('test.p2') AND old_value IS NOT NULL $$,
  $$ VALUES ('opportunity', 'candidate', 'rejected', current_setting('test.p2'), 'Далече от метрото') $$,
  'A link status change writes one opportunity audit row with the property'
);

SELECT is(
  (SELECT count(*)::int FROM audit_log WHERE entity_id = current_setting('test.buyer')::uuid AND field_name = 'property_link' AND old_value IS NULL),
  3, 'Adding a link writes one audit row per link'
);

-- ── Rule 7: completing a viewing ─────────────────────────────────────────────

UPDATE opportunity_properties SET status = 'candidate', rejected_reason = NULL
WHERE opportunity_id = current_setting('test.buyer')::uuid AND property_id = current_setting('test.p2')::uuid;

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

SELECT pg_temp.complete_viewing('p1');

SELECT results_eq(
  $$ SELECT property_id::text, status FROM opportunity_properties
     WHERE opportunity_id = current_setting('test.buyer')::uuid AND property_id IN (current_setting('test.p1')::uuid, current_setting('test.p2')::uuid)
     ORDER BY property_id = current_setting('test.p1')::uuid DESC $$,
  $$ VALUES (current_setting('test.p1'), 'viewed'), (current_setting('test.p2'), 'candidate') $$,
  'Completing a viewing moves that candidate to viewed and leaves the other alone (AC-3)'
);

SELECT pg_temp.complete_viewing('p3');
SELECT is(
  (SELECT status FROM opportunity_properties WHERE opportunity_id = current_setting('test.buyer')::uuid AND property_id = current_setting('test.p3')::uuid),
  'offered', 'Completing a viewing leaves an offered link offered (AC-3)'
);

SELECT set_config('test.p5', pg_temp.add_property('a1')::text, true);
SELECT pg_temp.complete_viewing('p5');
SELECT is(
  (SELECT status FROM opportunity_properties WHERE opportunity_id = current_setting('test.buyer')::uuid AND property_id = current_setting('test.p5')::uuid),
  'viewed', 'Completing a viewing of an unlinked property creates the link as viewed'
);

SELECT is(
  (SELECT count(*)::int FROM audit_log WHERE entity_id = current_setting('test.buyer')::uuid AND field_name = 'property_link'
     AND metadata->>'property_id' = current_setting('test.p1') AND new_value = 'viewed'),
  1, 'The viewed change is audited once'
);

-- ── Rule 4: closed and withdrawn listings are read-only ──────────────────────

UPDATE listings SET status = 'closed' WHERE id = current_setting('test.l1')::uuid;
SELECT isnt((SELECT closed_at FROM listings WHERE id = current_setting('test.l1')::uuid), NULL, 'Closing a listing sets closed_at');

SELECT throws_ok(
  $$ UPDATE listings SET price = 170000 WHERE id = current_setting('test.l1')::uuid $$,
  'P0001', 'listings.errors.readOnly',
  'A closed listing cannot be edited'
);

-- ── Rule 8: archiving ────────────────────────────────────────────────────────

INSERT INTO listings (agency_id, property_id, offer_type, price, status) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.p1')::uuid, 'sale', 175000, 'reserved'),
  (current_setting('test.a1')::uuid, current_setting('test.p1')::uuid, 'rent', 900, 'active');

UPDATE properties SET status = 'archived' WHERE id = current_setting('test.p1')::uuid;

SELECT is(
  (SELECT count(*)::int FROM listings WHERE property_id = current_setting('test.p1')::uuid AND status IN ('active', 'reserved')),
  0, 'Archiving withdraws the open listings'
);

SELECT is(
  (SELECT count(*)::int FROM audit_log WHERE entity_id = current_setting('test.p1')::uuid AND action = 'archived'),
  1, 'Archiving writes an archived audit row'
);

SELECT throws_ok(
  format($$ INSERT INTO listings (agency_id, property_id, offer_type, price) VALUES ('%s', '%s', 'sale', 100000) $$,
    current_setting('test.a1'), current_setting('test.p1')),
  'P0001', 'properties.errors.archived',
  'An archived property gets no new listing'
);

SELECT throws_ok(
  format($$ INSERT INTO opportunity_properties (agency_id, opportunity_id, property_id, relation, status) VALUES ('%s', '%s', '%s', 'candidate', 'candidate') $$,
    current_setting('test.a1'), current_setting('test.buyer2'), current_setting('test.p1')),
  'P0001', 'properties.errors.archived',
  'An archived property gets no new link'
);

SELECT throws_ok(
  format($$ INSERT INTO tasks (agency_id, opportunity_id, property_id, title, task_type) VALUES ('%s', '%s', '%s', 'Оглед', 'viewing') $$,
    current_setting('test.a1'), current_setting('test.buyer'), current_setting('test.p1')),
  'P0001', 'properties.errors.archived',
  'An archived property gets no new viewing task'
);

SELECT lives_ok(
  $$ UPDATE opportunity_properties SET status = 'rejected'
     WHERE opportunity_id = current_setting('test.buyer')::uuid AND property_id = current_setting('test.p1')::uuid $$,
  'An existing link on an archived property can still change status'
);

SELECT lives_ok(
  $$ UPDATE properties SET status = 'active' WHERE id = current_setting('test.p1')::uuid $$,
  'An archived property can be unarchived'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
