BEGIN;
SELECT plan(33);

-- Setup: two agencies, as the superuser

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-700000000001', 'manager@a1.example'),
  ('00000000-0000-0000-0000-700000000002', 'broker@a1.example'),
  ('00000000-0000-0000-0000-700000000003', 'manager@a2.example');

INSERT INTO agencies (id, name, slug) VALUES
  ('00000000-0000-0000-0000-71000000000a', 'Atomic 1', 'atomic-1'),
  ('00000000-0000-0000-0000-71000000000b', 'Atomic 2', 'atomic-2');

INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES
  ('00000000-0000-0000-0000-71000000000a', '00000000-0000-0000-0000-700000000001', 'manager', 'active'),
  ('00000000-0000-0000-0000-71000000000a', '00000000-0000-0000-0000-700000000002', 'broker', 'active'),
  ('00000000-0000-0000-0000-71000000000b', '00000000-0000-0000-0000-700000000003', 'manager', 'active');

INSERT INTO stages (id, agency_id, name, sort_order) VALUES
  ('00000000-0000-0000-0000-72000000000a', '00000000-0000-0000-0000-71000000000a', 'New', 1),
  ('00000000-0000-0000-0000-72000000000b', '00000000-0000-0000-0000-71000000000b', 'New', 1);

INSERT INTO contacts (id, agency_id, type, first_name, display_name) VALUES
  ('00000000-0000-0000-0000-730000000001', '00000000-0000-0000-0000-71000000000a', 'person', 'Winner', 'Winner'),
  ('00000000-0000-0000-0000-730000000002', '00000000-0000-0000-0000-71000000000a', 'person', 'Loser', 'Loser'),
  ('00000000-0000-0000-0000-730000000003', '00000000-0000-0000-0000-71000000000b', 'person', 'Foreign', 'Foreign'),
  ('00000000-0000-0000-0000-730000000004', '00000000-0000-0000-0000-71000000000a', 'person', 'Survivor', 'Survivor'),
  ('00000000-0000-0000-0000-730000000005', '00000000-0000-0000-0000-71000000000a', 'person', 'Doomed', 'Doomed');

INSERT INTO contact_methods (agency_id, contact_id, type, value) VALUES
  ('00000000-0000-0000-0000-71000000000a', '00000000-0000-0000-0000-730000000001', 'phone', '+359888700001'),
  ('00000000-0000-0000-0000-71000000000a', '00000000-0000-0000-0000-730000000002', 'phone', '+359888700001'),
  ('00000000-0000-0000-0000-71000000000a', '00000000-0000-0000-0000-730000000002', 'phone', '+359888700002'),
  ('00000000-0000-0000-0000-71000000000a', '00000000-0000-0000-0000-730000000005', 'phone', '+359888700005');

INSERT INTO opportunities (id, agency_id, title, type, stage_id, primary_contact_id) VALUES
  ('00000000-0000-0000-0000-740000000001', '00000000-0000-0000-0000-71000000000a', 'Loser deal', 'buyer', '00000000-0000-0000-0000-72000000000a', '00000000-0000-0000-0000-730000000002'),
  ('00000000-0000-0000-0000-740000000002', '00000000-0000-0000-0000-71000000000a', 'Doomed deal', 'buyer', '00000000-0000-0000-0000-72000000000a', '00000000-0000-0000-0000-730000000005');

INSERT INTO opportunity_participants (agency_id, opportunity_id, contact_id, role) VALUES
  ('00000000-0000-0000-0000-71000000000a', '00000000-0000-0000-0000-740000000001', '00000000-0000-0000-0000-730000000001', 'buyer'),
  ('00000000-0000-0000-0000-71000000000a', '00000000-0000-0000-0000-740000000001', '00000000-0000-0000-0000-730000000002', 'buyer');

INSERT INTO notes (id, agency_id, contact_id, content, created_by, created_at) VALUES
  ('00000000-0000-0000-0000-760000000001', '00000000-0000-0000-0000-71000000000a', '00000000-0000-0000-0000-730000000002', 'Loser note', '00000000-0000-0000-0000-700000000002', '2026-01-01T09:00:00Z'),
  ('00000000-0000-0000-0000-760000000002', '00000000-0000-0000-0000-71000000000a', '00000000-0000-0000-0000-730000000005', 'Doomed note', '00000000-0000-0000-0000-700000000002', '2026-01-01T09:00:00Z');

INSERT INTO inquiries (id, agency_id, status, caller_name) VALUES
  ('00000000-0000-0000-0000-750000000001', '00000000-0000-0000-0000-71000000000a', 'new', 'Good'),
  ('00000000-0000-0000-0000-750000000002', '00000000-0000-0000-0000-71000000000a', 'new', 'Bad method'),
  ('00000000-0000-0000-0000-750000000003', '00000000-0000-0000-0000-71000000000a', 'new', 'Fails last'),
  ('00000000-0000-0000-0000-750000000004', '00000000-0000-0000-0000-71000000000a', 'new', 'No name');

-- ── merge_contacts ──────────────────────────────────────────

SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-700000000002", "role": "authenticated"}', true);
SET ROLE authenticated;

SELECT throws_ok(
  $$ SELECT merge_contacts('00000000-0000-0000-0000-71000000000a', '00000000-0000-0000-0000-730000000001', '00000000-0000-0000-0000-730000000002') $$,
  'P0001', 'errors.forbidden', 'a broker cannot merge'
);

RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-700000000001", "role": "authenticated"}', true);
SET ROLE authenticated;

SELECT throws_ok(
  $$ SELECT merge_contacts('00000000-0000-0000-0000-71000000000b', '00000000-0000-0000-0000-730000000001', '00000000-0000-0000-0000-730000000002') $$,
  'P0001', 'errors.not_found', 'a merge in another agency is refused'
);
SELECT throws_ok(
  $$ SELECT merge_contacts('00000000-0000-0000-0000-71000000000a', '00000000-0000-0000-0000-730000000001', '00000000-0000-0000-0000-730000000003') $$,
  'P0001', 'errors.not_found', 'a foreign loser is refused'
);
SELECT throws_ok(
  $$ SELECT merge_contacts('00000000-0000-0000-0000-71000000000a', '00000000-0000-0000-0000-730000000003', '00000000-0000-0000-0000-730000000002') $$,
  'P0001', 'errors.not_found', 'a foreign winner is refused'
);
SELECT throws_ok(
  $$ SELECT merge_contacts('00000000-0000-0000-0000-71000000000a', '00000000-0000-0000-0000-730000000001', '00000000-0000-0000-0000-730000000001') $$,
  'P0001', 'errors.merge_self', 'a contact cannot merge with itself'
);

-- A failure at the very last write undoes every earlier one

RESET ROLE;
CREATE FUNCTION pg_temp.fail_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'simulated failure';
END;
$$;
CREATE TRIGGER fail_merge_history BEFORE INSERT ON merge_history
  FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_write();
SET ROLE authenticated;

SELECT throws_ok(
  $$ SELECT merge_contacts('00000000-0000-0000-0000-71000000000a', '00000000-0000-0000-0000-730000000001', '00000000-0000-0000-0000-730000000005') $$,
  'P0001', 'simulated failure', 'a merge that fails on its last write reports it'
);
SELECT is((SELECT status FROM contacts WHERE id = '00000000-0000-0000-0000-730000000005'), 'active', 'the failed merge left the loser active');
SELECT is(
  (SELECT primary_contact_id FROM opportunities WHERE id = '00000000-0000-0000-0000-740000000002'),
  '00000000-0000-0000-0000-730000000005'::uuid,
  'the failed merge left the deal on the loser'
);
SELECT is(
  (SELECT contact_id FROM contact_methods WHERE value = '+359888700005'),
  '00000000-0000-0000-0000-730000000005'::uuid,
  'the failed merge left the phone on the loser'
);
SELECT is(
  (SELECT contact_id FROM notes WHERE id = '00000000-0000-0000-0000-760000000002'),
  '00000000-0000-0000-0000-730000000005'::uuid,
  'the failed merge left the note on the loser'
);

RESET ROLE;
DROP TRIGGER fail_merge_history ON merge_history;
SET ROLE authenticated;

-- A merge that succeeds

SELECT lives_ok(
  $$ SELECT merge_contacts('00000000-0000-0000-0000-71000000000a', '00000000-0000-0000-0000-730000000001', '00000000-0000-0000-0000-730000000002') $$,
  'a manager can merge'
);
SELECT results_eq(
  $$ SELECT value FROM contact_methods WHERE contact_id = '00000000-0000-0000-0000-730000000001' ORDER BY value $$,
  $$ VALUES ('+359888700001'), ('+359888700002') $$,
  'the winner keeps its phone and gains the new one, once each'
);
SELECT is_empty($$ SELECT 1 FROM contact_methods WHERE contact_id = '00000000-0000-0000-0000-730000000002' $$, 'the loser has no phones left');
SELECT is(
  (SELECT primary_contact_id FROM opportunities WHERE id = '00000000-0000-0000-0000-740000000001'),
  '00000000-0000-0000-0000-730000000001'::uuid,
  'the deal moves to the winner'
);
SELECT results_eq(
  $$ SELECT contact_id FROM opportunity_participants WHERE opportunity_id = '00000000-0000-0000-0000-740000000001' $$,
  $$ VALUES ('00000000-0000-0000-0000-730000000001'::uuid) $$,
  'a deal both were on keeps only the winner'
);
SELECT is(
  (SELECT contact_id || '/' || created_by || '/' || (created_at = '2026-01-01T09:00:00Z') FROM notes WHERE id = '00000000-0000-0000-0000-760000000001'),
  '00000000-0000-0000-0000-730000000001/00000000-0000-0000-0000-700000000002/true',
  'the note moves to the winner, keeping its author and date'
);
SELECT is((SELECT status FROM contacts WHERE id = '00000000-0000-0000-0000-730000000002'), 'archived', 'the loser is archived');
SELECT is(
  (SELECT merged_by FROM merge_history WHERE loser_contact_id = '00000000-0000-0000-0000-730000000002'),
  '00000000-0000-0000-0000-700000000001'::uuid,
  'the history row names the signed-in user'
);
SELECT is(
  (SELECT jsonb_array_length(loser_snapshot->'contact_methods') FROM merge_history WHERE loser_contact_id = '00000000-0000-0000-0000-730000000002'),
  2,
  'the snapshot holds the loser as it was, with its phones'
);

-- ── convert_inquiry ─────────────────────────────────────────

RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-700000000002", "role": "authenticated"}', true);
CREATE TEMP TABLE before_counts AS
  SELECT
    (SELECT count(*) FROM contacts WHERE agency_id = '00000000-0000-0000-0000-71000000000a') AS contacts,
    (SELECT count(*) FROM opportunities WHERE agency_id = '00000000-0000-0000-0000-71000000000a') AS opportunities;
GRANT SELECT ON before_counts TO authenticated;
SET ROLE authenticated;

SELECT throws_ok(
  $$ SELECT convert_inquiry('00000000-0000-0000-0000-71000000000a', '00000000-0000-0000-0000-750000000001', 'Deal', 'buyer', '00000000-0000-0000-0000-72000000000b', NULL, NULL, NULL, '[]') $$,
  'P0001', 'errors.not_found', 'another agency''s stage is refused'
);
SELECT throws_ok(
  $$ SELECT convert_inquiry('00000000-0000-0000-0000-71000000000a', '00000000-0000-0000-0000-750000000001', 'Deal', 'buyer', '00000000-0000-0000-0000-72000000000a', NULL, '00000000-0000-0000-0000-730000000003', NULL, '[]') $$,
  'P0001', 'errors.not_found', 'another agency''s contact is refused'
);
SELECT throws_ok(
  $$ SELECT convert_inquiry('00000000-0000-0000-0000-71000000000b', '00000000-0000-0000-0000-750000000001', 'Deal', 'buyer', '00000000-0000-0000-0000-72000000000a', NULL, NULL, NULL, '[]') $$,
  'P0001', 'errors.not_found', 'converting in another agency is refused'
);

-- A contact the database rejects keeps its own message

SELECT throws_ok(
  $$ SELECT convert_inquiry('00000000-0000-0000-0000-71000000000a', '00000000-0000-0000-0000-750000000004', 'Deal', 'buyer', '00000000-0000-0000-0000-72000000000a', NULL, NULL, '{"type": "organization", "display_name": "Nameless"}', '[]') $$,
  'P0001', 'errors.inquiries.contact_creation_failed', 'an invalid new contact is reported as such'
);

-- Losing the caller's phone or email fails the whole conversion

SELECT throws_ok(
  $$ SELECT convert_inquiry('00000000-0000-0000-0000-71000000000a', '00000000-0000-0000-0000-750000000002', 'Deal', 'buyer', '00000000-0000-0000-0000-72000000000a', NULL, NULL, '{"type": "person", "first_name": "Bad", "display_name": "Bad"}', '[{"type": "pigeon", "value": "x", "label": null, "is_primary": true}]') $$,
  '23514', NULL, 'a contact method that cannot be saved fails the conversion'
);
SELECT is((SELECT status FROM inquiries WHERE id = '00000000-0000-0000-0000-750000000002'), 'new', 'the failed conversion left the inquiry new');
SELECT is((SELECT count(*) FROM contacts), (SELECT contacts FROM before_counts), 'the failed conversion left no contact behind');

-- A failure at the very last write undoes every earlier one

RESET ROLE;
CREATE TRIGGER fail_inquiry_update BEFORE UPDATE ON inquiries
  FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_write();
SET ROLE authenticated;

SELECT throws_ok(
  $$ SELECT convert_inquiry('00000000-0000-0000-0000-71000000000a', '00000000-0000-0000-0000-750000000003', 'Deal', 'buyer', '00000000-0000-0000-0000-72000000000a', NULL, NULL, '{"type": "person", "first_name": "Late", "display_name": "Late"}', '[{"type": "phone", "value": "+359888700003", "label": null, "is_primary": true}]') $$,
  'P0001', 'simulated failure', 'a conversion that fails on its last write reports it'
);
SELECT is((SELECT count(*) FROM opportunities), (SELECT opportunities FROM before_counts), 'the failed conversion left no opportunity behind');
SELECT is_empty($$ SELECT 1 FROM contact_methods WHERE value = '+359888700003' $$, 'the failed conversion left no phone behind');

RESET ROLE;
DROP TRIGGER fail_inquiry_update ON inquiries;
SET ROLE authenticated;

-- A conversion that succeeds, as a broker

SELECT lives_ok(
  $$ SELECT convert_inquiry('00000000-0000-0000-0000-71000000000a', '00000000-0000-0000-0000-750000000001', 'Deal', 'buyer', '00000000-0000-0000-0000-72000000000a', '00000000-0000-0000-0000-700000000002', NULL, '{"type": "person", "first_name": "Good", "display_name": "Good"}', '[{"type": "phone", "value": "+359888700004", "label": null, "is_primary": true}]') $$,
  'a broker can convert'
);
SELECT is(
  (SELECT i.status || '/' || o.title || '/' || c.display_name || '/' || (o.primary_contact_id = c.id)
   FROM inquiries i
   JOIN opportunities o ON o.id = i.opportunity_id AND o.inquiry_id = i.id
   JOIN contacts c ON c.id = i.contact_id
   WHERE i.id = '00000000-0000-0000-0000-750000000001'),
  'converted/Deal/Good/true',
  'the inquiry, deal and contact are linked'
);
SELECT is(
  (SELECT c.display_name FROM contact_methods m JOIN contacts c ON c.id = m.contact_id WHERE m.value = '+359888700004'),
  'Good',
  'the caller''s phone is on the new contact'
);
SELECT throws_ok(
  $$ SELECT convert_inquiry('00000000-0000-0000-0000-71000000000a', '00000000-0000-0000-0000-750000000001', 'Twice', 'buyer', '00000000-0000-0000-0000-72000000000a', NULL, NULL, NULL, '[]') $$,
  'P0001', 'errors.inquiries.invalid_transition', 'a converted inquiry cannot convert again'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
