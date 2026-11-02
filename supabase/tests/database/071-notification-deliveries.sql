-- notification_deliveries (AD-042, AD-051): who reads the delivery log, that clients cannot
-- write it, that a send can only be claimed once, and the per-user digest switch.
BEGIN;
SELECT plan(13);

SELECT tests.create_user('00000000-0000-0000-0000-810000000001', 'owner@n1.example');
SELECT tests.create_user('00000000-0000-0000-0000-810000000002', 'manager@n1.example');
SELECT tests.create_user('00000000-0000-0000-0000-810000000003', 'broker@n1.example');
SELECT tests.create_user('00000000-0000-0000-0000-810000000004', 'colleague@n1.example');
SELECT tests.create_user('00000000-0000-0000-0000-810000000005', 'owner@n2.example');

INSERT INTO agencies (id, name, slug) VALUES
  ('00000000-0000-0000-0000-81000000000a', 'Notify 1', 'notify-1'),
  ('00000000-0000-0000-0000-81000000000b', 'Notify 2', 'notify-2');

INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES
  ('00000000-0000-0000-0000-81000000000a', '00000000-0000-0000-0000-810000000001', 'owner', 'active'),
  ('00000000-0000-0000-0000-81000000000a', '00000000-0000-0000-0000-810000000002', 'manager', 'active'),
  ('00000000-0000-0000-0000-81000000000a', '00000000-0000-0000-0000-810000000003', 'broker', 'active'),
  ('00000000-0000-0000-0000-81000000000a', '00000000-0000-0000-0000-810000000004', 'broker', 'active'),
  ('00000000-0000-0000-0000-81000000000b', '00000000-0000-0000-0000-810000000005', 'owner', 'active');

-- As the service role would write them: bypassing RLS, as the superuser here.
INSERT INTO notification_deliveries (id, agency_id, user_id, kind, period_key, status) VALUES
  ('00000000-0000-0000-0000-820000000001', '00000000-0000-0000-0000-81000000000a', '00000000-0000-0000-0000-810000000003', 'daily_digest', '2026-11-02', 'sent'),
  ('00000000-0000-0000-0000-820000000002', '00000000-0000-0000-0000-81000000000a', '00000000-0000-0000-0000-810000000004', 'daily_digest', '2026-11-02', 'sent'),
  ('00000000-0000-0000-0000-820000000003', '00000000-0000-0000-0000-81000000000b', '00000000-0000-0000-0000-810000000005', 'daily_digest', '2026-11-02', 'sent');

-- 1. The same (user, kind, period_key) can't be claimed twice, which is what makes a send idempotent.
SELECT throws_ok(
  $$ INSERT INTO notification_deliveries (agency_id, user_id, kind, period_key)
     VALUES ('00000000-0000-0000-0000-81000000000a', '00000000-0000-0000-0000-810000000003', 'daily_digest', '2026-11-02') $$,
  '23505',
  NULL,
  'A second row with the same (user, kind, period_key) is rejected'
);

-- 2. ... and ON CONFLICT DO NOTHING tells the loser it lost.
SELECT is_empty(
  $$ INSERT INTO notification_deliveries (agency_id, user_id, kind, period_key)
     VALUES ('00000000-0000-0000-0000-81000000000a', '00000000-0000-0000-0000-810000000003', 'daily_digest', '2026-11-02')
     ON CONFLICT DO NOTHING RETURNING id $$,
  'A lost claim returns no row'
);

-- 3. A new row starts pending.
SELECT results_eq(
  $$ INSERT INTO notification_deliveries (id, agency_id, user_id, kind, period_key)
     VALUES ('00000000-0000-0000-0000-820000000004', '00000000-0000-0000-0000-81000000000a', '00000000-0000-0000-0000-810000000001', 'daily_digest', '2026-11-02')
     RETURNING status $$,
  $$ VALUES ('pending'::text) $$,
  'A claim starts as pending'
);

-- Broker
SELECT tests.authenticate_as('00000000-0000-0000-0000-810000000003');

SELECT results_eq(
  $$ SELECT id FROM notification_deliveries ORDER BY id $$,
  $$ VALUES ('00000000-0000-0000-0000-820000000001'::uuid) $$,
  'A broker reads only their own deliveries'
);

SELECT throws_ok(
  $$ INSERT INTO notification_deliveries (agency_id, user_id, kind, period_key)
     VALUES ('00000000-0000-0000-0000-81000000000a', '00000000-0000-0000-0000-810000000003', 'daily_digest', '2026-11-03') $$,
  '42501', NULL, 'A member cannot insert a delivery'
);

SELECT throws_ok(
  $$ UPDATE notification_deliveries SET status = 'failed' $$,
  '42501', NULL, 'A member cannot update a delivery'
);

SELECT throws_ok(
  $$ DELETE FROM notification_deliveries $$,
  '42501', NULL, 'A member cannot delete a delivery'
);

-- The digest switch: default on, a user changes their own, and nobody else's.
SELECT is(
  (SELECT digest_enabled FROM profiles WHERE id = '00000000-0000-0000-0000-810000000003'),
  true,
  'digest_enabled defaults to true'
);

UPDATE profiles SET digest_enabled = false WHERE id = '00000000-0000-0000-0000-810000000003';
SELECT is(
  (SELECT digest_enabled FROM profiles WHERE id = '00000000-0000-0000-0000-810000000003'),
  false,
  'A user can turn their own digest off'
);

UPDATE profiles SET digest_enabled = false WHERE id = '00000000-0000-0000-0000-810000000004';
SELECT is(
  (SELECT digest_enabled FROM profiles WHERE id = '00000000-0000-0000-0000-810000000004'),
  true,
  'A user cannot change a colleague''s digest switch'
);

-- Manager: the agency's rows, not another agency's.
SELECT tests.authenticate_as('00000000-0000-0000-0000-810000000002');

SELECT results_eq(
  $$ SELECT id FROM notification_deliveries ORDER BY id $$,
  $$ VALUES ('00000000-0000-0000-0000-820000000001'::uuid), ('00000000-0000-0000-0000-820000000002'::uuid),
            ('00000000-0000-0000-0000-820000000004'::uuid) $$,
  'A manager reads the agency''s deliveries and not another agency''s'
);

-- Owner of the other agency
SELECT tests.authenticate_as('00000000-0000-0000-0000-810000000005');

SELECT results_eq(
  $$ SELECT id FROM notification_deliveries ORDER BY id $$,
  $$ VALUES ('00000000-0000-0000-0000-820000000003'::uuid) $$,
  'Another agency''s owner sees only their own agency''s deliveries'
);

-- Anon
SELECT tests.clear_auth();

SELECT throws_ok(
  $$ SELECT id FROM notification_deliveries $$,
  '42501', NULL, 'anon cannot read deliveries'
);

SELECT * FROM finish();
ROLLBACK;
