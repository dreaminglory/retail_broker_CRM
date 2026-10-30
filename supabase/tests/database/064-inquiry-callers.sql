BEGIN;
SELECT plan(13);

-- Setup: one legacy row per format, in the first agency

SELECT set_config('test.a1', (SELECT id FROM agencies LIMIT 1)::text, true);

INSERT INTO inquiries (id, agency_id, status, caller_name, caller_phone, caller_email, raw_payload)
VALUES
  ('00000000-0000-0000-0000-300000000001', current_setting('test.a1')::uuid, 'new', 'Local mobile', '0888 123 456', 'Ivan@Example.BG', '{"phone": "0888 123 456", "Email": "Ivan@Example.BG"}'),
  ('00000000-0000-0000-0000-300000000002', current_setting('test.a1')::uuid, 'new', 'No plus', '359-888-123-457', NULL, '{}'),
  ('00000000-0000-0000-0000-300000000003', current_setting('test.a1')::uuid, 'new', 'Spaced plus', '+359 (888) 123.458', ' Padded@example.bg ', '{}'),
  ('00000000-0000-0000-0000-300000000004', current_setting('test.a1')::uuid, 'new', 'Sofia landline', '02 987 6543', NULL, '{}'),
  ('00000000-0000-0000-0000-300000000005', current_setting('test.a1')::uuid, 'new', 'Not a number', 'call after 5', NULL, '{}'),
  ('00000000-0000-0000-0000-300000000006', current_setting('test.a1')::uuid, 'new', 'International prefix', '0044770090', NULL, '{}'),
  ('00000000-0000-0000-0000-300000000007', current_setting('test.a1')::uuid, 'new', 'Foreign', '+447700900123', 'ok@example.co.uk', '{}'),
  ('00000000-0000-0000-0000-300000000008', current_setting('test.a1')::uuid, 'new', 'No details', NULL, NULL, '{}');

SELECT set_config('test.raw_before', (SELECT raw_payload::text FROM inquiries WHERE id = '00000000-0000-0000-0000-300000000001'), true);

SELECT set_config('test.received_before', (SELECT received_at::text FROM inquiries WHERE id = '00000000-0000-0000-0000-300000000001'), true);

-- ctid, not updated_at: now() doesn't move inside this transaction, but any UPDATE moves the row.
SELECT set_config('test.untouched_before', (SELECT ctid::text FROM inquiries WHERE id = '00000000-0000-0000-0000-300000000007'), true);

-- Backfill

SELECT is(
  (SELECT row(phones_updated, emails_updated, phones_left_as_typed)::text FROM backfill_inquiry_callers()),
  '(3,2,3)',
  'reports 3 phones and 2 emails updated, 3 phones left as typed'
);

SELECT is((SELECT caller_phone FROM inquiries WHERE id = '00000000-0000-0000-0000-300000000001'), '+359888123456', 'local mobile becomes E.164');
SELECT is((SELECT caller_email FROM inquiries WHERE id = '00000000-0000-0000-0000-300000000001'), 'ivan@example.bg', 'email is lowercased');
SELECT is((SELECT caller_phone FROM inquiries WHERE id = '00000000-0000-0000-0000-300000000002'), '+359888123457', '359 without a plus becomes E.164');
SELECT is((SELECT caller_phone FROM inquiries WHERE id = '00000000-0000-0000-0000-300000000003'), '+359888123458', 'formatted +359 becomes E.164');
SELECT is((SELECT caller_email FROM inquiries WHERE id = '00000000-0000-0000-0000-300000000003'), 'padded@example.bg', 'email is trimmed');
SELECT is((SELECT caller_phone FROM inquiries WHERE id = '00000000-0000-0000-0000-300000000004'), '02 987 6543', 'a landline stays as typed');
SELECT is((SELECT caller_phone FROM inquiries WHERE id = '00000000-0000-0000-0000-300000000005'), 'call after 5', 'text that is not a number stays as typed');
SELECT is((SELECT caller_phone FROM inquiries WHERE id = '00000000-0000-0000-0000-300000000006'), '0044770090', 'an international prefix is not read as a BG mobile');

SELECT is(
  (SELECT raw_payload::text FROM inquiries WHERE id = '00000000-0000-0000-0000-300000000001'),
  current_setting('test.raw_before'),
  'raw_payload is byte-for-byte unchanged'
);

SELECT is(
  (SELECT received_at::text FROM inquiries WHERE id = '00000000-0000-0000-0000-300000000001'),
  current_setting('test.received_before'),
  'received_at is unchanged'
);

SELECT is(
  (SELECT ctid::text FROM inquiries WHERE id = '00000000-0000-0000-0000-300000000007'),
  current_setting('test.untouched_before'),
  'a row that is already clean is not updated'
);

-- Running it again changes nothing

SELECT is(
  (SELECT row(phones_updated, emails_updated)::text FROM backfill_inquiry_callers()),
  '(0,0)',
  'a second run updates nothing'
);

SELECT * FROM finish();
ROLLBACK;
