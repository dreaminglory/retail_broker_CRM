BEGIN;
SELECT plan(13);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-830000000001', 'owner@r1.example'),
  ('00000000-0000-0000-0000-830000000002', 'manager@r1.example'),
  ('00000000-0000-0000-0000-830000000003', 'broker@r1.example'),
  ('00000000-0000-0000-0000-830000000004', 'invited-broker@r1.example'),
  ('00000000-0000-0000-0000-830000000005', 'invited-manager@r1.example'),
  ('00000000-0000-0000-0000-830000000006', 'owner@r2.example'),
  ('00000000-0000-0000-0000-830000000007', 'invited-other@r2.example');

INSERT INTO agencies (id, name, slug) VALUES
  ('00000000-0000-0000-0000-83100000000a', 'Resend 1', 'resend-1'),
  ('00000000-0000-0000-0000-83100000000b', 'Resend 2', 'resend-2');

INSERT INTO agency_memberships (id, agency_id, user_id, role, status, invitation_email, invited_at, invitation_sent_at) VALUES
  ('00000000-0000-0000-0000-832000000001', '00000000-0000-0000-0000-83100000000a', '00000000-0000-0000-0000-830000000001', 'owner', 'active', NULL, NULL, NULL),
  ('00000000-0000-0000-0000-832000000002', '00000000-0000-0000-0000-83100000000a', '00000000-0000-0000-0000-830000000002', 'manager', 'active', NULL, NULL, NULL),
  ('00000000-0000-0000-0000-832000000003', '00000000-0000-0000-0000-83100000000a', '00000000-0000-0000-0000-830000000003', 'broker', 'active', NULL, NULL, NULL),
  ('00000000-0000-0000-0000-832000000004', '00000000-0000-0000-0000-83100000000a', '00000000-0000-0000-0000-830000000004', 'broker', 'invited', 'invited-broker@r1.example', now() - interval '1 day', now() - interval '1 day'),
  ('00000000-0000-0000-0000-832000000005', '00000000-0000-0000-0000-83100000000a', '00000000-0000-0000-0000-830000000005', 'manager', 'invited', 'invited-manager@r1.example', now() - interval '1 day', now() - interval '1 day'),
  ('00000000-0000-0000-0000-832000000006', '00000000-0000-0000-0000-83100000000b', '00000000-0000-0000-0000-830000000006', 'owner', 'active', NULL, NULL, NULL),
  ('00000000-0000-0000-0000-832000000007', '00000000-0000-0000-0000-83100000000b', '00000000-0000-0000-0000-830000000007', 'broker', 'invited', 'invited-other@r2.example', now() - interval '1 day', now() - interval '1 day');

-- Backfill: the migration set invitation_sent_at from invited_at for pending rows only
SELECT is(
  (SELECT count(*)::int FROM agency_memberships WHERE status = 'active' AND invitation_sent_at IS NOT NULL
    AND agency_id IN ('00000000-0000-0000-0000-83100000000a', '00000000-0000-0000-0000-83100000000b')),
  0,
  'active (signup) memberships keep invitation_sent_at NULL'
);

-- Owner claims a manager invitation
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-830000000001", "role": "authenticated"}', true);
SET ROLE authenticated;

SELECT is(
  (SELECT public.claim_invitation_resend('00000000-0000-0000-0000-832000000005')->>'email'),
  'invited-manager@r1.example',
  'an owner claims a pending manager invitation'
);
SELECT throws_ok(
  $$ SELECT public.claim_invitation_resend('00000000-0000-0000-0000-832000000005') $$,
  'P0001', 'errors.members.resend_too_soon', 'a second claim within 5 minutes is refused'
);
SELECT is(
  (SELECT public.claim_invitation_resend('00000000-0000-0000-0000-832000000004')->>'email'),
  'invited-broker@r1.example',
  'an owner also claims a broker invitation'
);
SELECT throws_ok(
  $$ SELECT public.claim_invitation_resend('00000000-0000-0000-0000-832000000003') $$,
  'P0001', 'errors.members.only_pending_resend', 'an active membership is refused'
);
SELECT throws_ok(
  $$ SELECT public.claim_invitation_resend('00000000-0000-0000-0000-832000000007') $$,
  'P0001', 'errors.not_found', 'another agency''s invitation is not found'
);

-- Manager: brokers only
RESET ROLE;
UPDATE agency_memberships SET invitation_sent_at = now() - interval '1 day' WHERE id IN
  ('00000000-0000-0000-0000-832000000004', '00000000-0000-0000-0000-832000000005');
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-830000000002", "role": "authenticated"}', true);
SET ROLE authenticated;

SELECT throws_ok(
  $$ SELECT public.claim_invitation_resend('00000000-0000-0000-0000-832000000005') $$,
  'P0001', 'errors.forbidden', 'a manager cannot resend a manager invitation'
);
SELECT is(
  (SELECT public.claim_invitation_resend('00000000-0000-0000-0000-832000000004')->>'email'),
  'invited-broker@r1.example',
  'a manager claims a broker invitation'
);

-- Broker: nothing
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-830000000003", "role": "authenticated"}', true);
SET ROLE authenticated;

SELECT throws_ok(
  $$ SELECT public.claim_invitation_resend('00000000-0000-0000-0000-832000000004') $$,
  'P0001', 'errors.forbidden', 'a broker cannot resend'
);

-- The claim moved the timestamp
RESET ROLE;
SELECT ok(
  (SELECT invitation_sent_at > now() - interval '1 minute' FROM agency_memberships WHERE id = '00000000-0000-0000-0000-832000000004'),
  'a successful claim sets invitation_sent_at to now'
);
SELECT is(
  (SELECT invitation_sent_at FROM agency_memberships WHERE id = '00000000-0000-0000-0000-832000000007'),
  (SELECT invited_at FROM agency_memberships WHERE id = '00000000-0000-0000-0000-832000000007'),
  'the other agency''s invitation was not touched'
);

-- Grants
SELECT is(has_function_privilege('anon', 'public.claim_invitation_resend(uuid)', 'EXECUTE'), false, 'anon cannot execute');
SELECT is(has_function_privilege('authenticated', 'public.claim_invitation_resend(uuid)', 'EXECUTE'), true, 'authenticated can execute');

SELECT * FROM finish();
ROLLBACK;
