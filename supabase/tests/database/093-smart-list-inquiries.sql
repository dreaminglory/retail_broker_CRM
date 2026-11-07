-- spec: smart-lists, Task 4 (AD-062). smart_list_inquiries (each filter key, `me`, both sorts,
-- paging and the p_after key, tenancy) and smart_list_counts (the same numbers as the list
-- functions' total_count for a mix of deal and inquiry filters, capped at 1000, i18n keys on bad
-- input).
BEGIN;
SELECT plan(42);

-- ── Setup ────────────────────────────────────────────────────────────────────

SELECT set_config('test.now', '2026-06-15 12:00:00+00', true);
SELECT set_config('test.a1', gen_random_uuid()::text, true);
SELECT set_config('test.a2', gen_random_uuid()::text, true);
SELECT set_config('test.u_broker', gen_random_uuid()::text, true);
SELECT set_config('test.u_broker2', gen_random_uuid()::text, true);
SELECT set_config('test.u_b_broker', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES
  (current_setting('test.u_broker')::uuid, 'sli-broker@example.com'),
  (current_setting('test.u_broker2')::uuid, 'sli-broker2@example.com'),
  (current_setting('test.u_b_broker')::uuid, 'sli-b-broker@example.com');
INSERT INTO agencies (id, name, slug) VALUES
  (current_setting('test.a1')::uuid, 'Agency SLI1', 'sli1'),
  (current_setting('test.a2')::uuid, 'Agency SLI2', 'sli2');
INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.u_broker')::uuid, 'broker', 'active'),
  (current_setting('test.a1')::uuid, current_setting('test.u_broker2')::uuid, 'broker', 'active'),
  (current_setting('test.a2')::uuid, current_setting('test.u_b_broker')::uuid, 'broker', 'active');
SELECT seed_agency_defaults(current_setting('test.a1')::uuid);
SELECT seed_agency_defaults(current_setting('test.a2')::uuid);
SELECT set_config('test.src1', (SELECT id FROM lead_sources WHERE agency_id = current_setting('test.a1')::uuid ORDER BY name LIMIT 1)::text, true);
SELECT set_config('test.src2', (SELECT id FROM lead_sources WHERE agency_id = current_setting('test.a1')::uuid ORDER BY name OFFSET 1 LIMIT 1)::text, true);
SELECT set_config('test.stage', (SELECT id FROM stages WHERE agency_id = current_setting('test.a1')::uuid ORDER BY sort_order LIMIT 1)::text, true);

CREATE FUNCTION pg_temp.act_as(p_user TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    format('{"sub": "%s", "role": "authenticated"}', current_setting('test.' || p_user)), true);
  SET ROLE authenticated;
END;
$$;

-- Inquiries in agency A1 (the name is in caller_name's first word) and one in agency B.
SELECT set_config('test.' || n, gen_random_uuid()::text, true) FROM unnest(ARRAY['i1','i2','i3','i4','i5','i6','ib']) AS n;
INSERT INTO inquiries (id, agency_id, caller_name, caller_phone, caller_email, subject, status, assigned_to, source_id, received_at)
SELECT current_setting('test.' || v.n)::uuid, v.ag::uuid, v.name, v.phone, v.email, v.subject, v.status,
       CASE v.owner WHEN 'broker' THEN current_setting('test.u_broker')::uuid
                    WHEN 'broker2' THEN current_setting('test.u_broker2')::uuid
                    WHEN 'beta' THEN current_setting('test.u_b_broker')::uuid END,
       CASE WHEN v.src IS NULL THEN NULL ELSE current_setting('test.' || v.src)::uuid END,
       v.received::timestamptz
FROM (VALUES
  ('i1', current_setting('test.a1'), 'i1 Ivan Petrov',  '+359888111001', 'ivan@example.com',  'Лозенец 2-стаен',      'new',       'broker',  'src1', '2026-06-01 08:00+00'),
  ('i2', current_setting('test.a1'), 'i2 Maria Dimova', '+359888111002', 'maria@example.com', 'Продава къща 100% цена', 'new',       NULL,      'src1', '2026-06-02 08:00+00'),
  ('i3', current_setting('test.a1'), 'i3 Georgi Kolev', '+359888111003', NULL,                'Наем Център',          'contacted', 'broker2', 'src2', '2026-06-03 08:00+00'),
  ('i4', current_setting('test.a1'), 'i4 Elena Ilieva', '+359888111004', 'elena@example.com', NULL,                   'new',       'broker',  NULL,   '2026-06-04 08:00+00'),
  ('i5', current_setting('test.a1'), 'i5 Nikolay Stoev','+359888111005', NULL,                'Парцел',               'converted', 'broker',  'src2', '2026-06-05 08:00+00'),
  ('i6', current_setting('test.a1'), 'i6 Rado Rusev',    '+359888111006', NULL,                'Гараж',                'dismissed', NULL,      NULL,   '2026-06-05 09:00+00'),
  ('ib', current_setting('test.a2'), 'ib Beta Caller',   '+359888222001', NULL,                'Beta запитване',       'new',       'beta',    NULL,   '2026-06-06 08:00+00')
) AS v(n, ag, name, phone, email, subject, status, owner, src, received);

-- Deals for the mixed counts (A1): two active, one won.
INSERT INTO opportunities (agency_id, title, type, status, stage_id, assigned_to)
VALUES (current_setting('test.a1')::uuid, 'c1 deal', 'buyer', 'active', current_setting('test.stage')::uuid, current_setting('test.u_broker')::uuid),
       (current_setting('test.a1')::uuid, 'c2 deal', 'seller', 'active', current_setting('test.stage')::uuid, current_setting('test.u_broker2')::uuid),
       (current_setting('test.a1')::uuid, 'c3 deal', 'buyer', 'won', current_setting('test.stage')::uuid, current_setting('test.u_broker')::uuid);

CREATE FUNCTION pg_temp.inq(p_filter JSONB, p_limit INT DEFAULT 100, p_offset INT DEFAULT 0, p_after JSONB DEFAULT NULL)
RETURNS TEXT[] LANGUAGE sql AS $$
  SELECT coalesce(array_agg(split_part(r.caller_name, ' ', 1) ORDER BY r.ord), ARRAY[]::text[])
  FROM smart_list_inquiries(p_filter, p_limit, p_offset, p_after)
       WITH ORDINALITY AS r(id, agency_id, source_id, source_description, contact_id, opportunity_id, assigned_to, status,
         caller_name, caller_phone, caller_email, subject, description, raw_payload, external_ref, dismissed_reason,
         received_at, created_by, created_at, updated_at, import_job_id, joined_at, sort_key, total_count, ord)
$$;
CREATE FUNCTION pg_temp.inq_set(p_filter JSONB) RETURNS TEXT[] LANGUAGE sql AS $$
  SELECT ARRAY(SELECT x FROM unnest(pg_temp.inq(p_filter)) AS x ORDER BY x)
$$;

SELECT pg_temp.act_as('u_broker');

-- ── Filters, one at a time ───────────────────────────────────────────────────

SELECT is(pg_temp.inq_set('{}'), ARRAY['i1','i2','i3','i4','i5','i6'], 'an empty filter is every inquiry (as the inquiry list is today)');
SELECT is(pg_temp.inq_set('{"bogus": 1, "status": ["new"]}'), ARRAY['i1','i2','i4'], 'an unknown key is ignored');
SELECT is(pg_temp.inq_set('{"status": ["new"]}'), ARRAY['i1','i2','i4'], 'status: new');
SELECT is(pg_temp.inq_set('{"status": ["contacted","converted"]}'), ARRAY['i3','i5'], 'status: several');
SELECT is(pg_temp.inq_set('{"assigned_to": "me"}'), ARRAY['i1','i4','i5'], 'assigned_to: me is the caller');
SELECT is(pg_temp.inq_set('{"assigned_to": "unassigned"}'), ARRAY['i2','i6'], 'assigned_to: unassigned');
SELECT is(pg_temp.inq_set(format('{"assigned_to": "%s"}', current_setting('test.u_broker2'))::jsonb), ARRAY['i3'], 'assigned_to: a user id');
SELECT is(pg_temp.inq_set('{"assigned_to": "not-a-uuid"}'), ARRAY[]::text[], 'assigned_to: garbage matches nothing');
SELECT is(pg_temp.inq_set(format('{"source_id": ["%s"]}', current_setting('test.src1'))::jsonb), ARRAY['i1','i2'], 'source_id');
SELECT is(pg_temp.inq_set(format('{"source_id": ["%s","%s"]}', current_setting('test.src1'), current_setting('test.src2'))::jsonb),
  ARRAY['i1','i2','i3','i5'], 'source_id: several');
SELECT is(pg_temp.inq_set('{"search": "dimova"}'), ARRAY['i2'], 'search: caller name, any case');
SELECT is(pg_temp.inq_set('{"search": "888111003"}'), ARRAY['i3'], 'search: phone');
SELECT is(pg_temp.inq_set('{"search": "ELENA@"}'), ARRAY['i4'], 'search: email');
SELECT is(pg_temp.inq_set('{"search": "гараж"}'), ARRAY['i6'], 'search: subject, Cyrillic, any case');
SELECT is(pg_temp.inq_set('{"search": "%"}'), ARRAY['i2'], 'search: % is a literal character, not a wildcard');
SELECT is(pg_temp.inq_set('{"status": ["new"], "assigned_to": "me", "search": "ivan"}'), ARRAY['i1'], 'filters combine');

-- ── Order, paging and the queue key ──────────────────────────────────────────

SELECT is(pg_temp.inq('{}'), ARRAY['i6','i5','i4','i3','i2','i1'], 'sort: received_desc is the default, ties by id descending');
SELECT is(pg_temp.inq('{"sort": "received_asc"}'), ARRAY['i1','i2','i3','i4','i5','i6'], 'sort: received_asc, ties by id ascending');
SELECT is(pg_temp.inq('{"sort": "nonsense"}'), ARRAY['i6','i5','i4','i3','i2','i1'], 'sort: an unknown value falls back to received_desc');
SELECT is(pg_temp.inq('{"sort": "received_asc"}', 2, 2), ARRAY['i3','i4'], 'paging: limit 2, offset 2');
SELECT is((SELECT min(total_count) FROM smart_list_inquiries('{"status": ["new"]}', 1, 0, NULL)), 3::bigint,
  'total_count is the rows in the list, not in the page');

SELECT set_config('test.key_i2',
  (SELECT sort_key::text FROM smart_list_inquiries('{"status": ["new"], "sort": "received_asc"}', 100, 0, NULL)
   WHERE id = current_setting('test.i2')::uuid), true);
SELECT is(jsonb_array_length(current_setting('test.key_i2')::jsonb), 2, 'sort_key is [position, id]');
SELECT is(pg_temp.inq('{"status": ["new"], "sort": "received_asc"}', 100, 0, current_setting('test.key_i2')::jsonb), ARRAY['i4'],
  'p_after: the rows strictly after a key');

RESET ROLE;
UPDATE inquiries SET status = 'contacted' WHERE id = current_setting('test.i2')::uuid;
SELECT pg_temp.act_as('u_broker');
SELECT is(pg_temp.inq('{"status": ["new"], "sort": "received_asc"}', 1, 0, current_setting('test.key_i2')::jsonb), ARRAY['i4'],
  'p_after: still returns the next row after the inquiry itself left the list');
SELECT is((SELECT total_count FROM smart_list_inquiries('{"status": ["new"], "sort": "received_asc"}', 1, 0, current_setting('test.key_i2')::jsonb)),
  2::bigint, 'p_after: total_count is still the whole list');
RESET ROLE;
UPDATE inquiries SET status = 'new' WHERE id = current_setting('test.i2')::uuid;
SELECT pg_temp.act_as('u_broker');

-- ── Counts ───────────────────────────────────────────────────────────────────

SELECT is(
  (SELECT array_agg(c.key || '=' || c.count ORDER BY c.key) FROM smart_list_counts($$[
    {"key": "deals-all",   "entity": "opportunity", "filter": {}},
    {"key": "deals-mine",  "entity": "opportunity", "filter": {"assigned_to": "me"}},
    {"key": "deals-won",   "entity": "opportunity", "filter": {"status": ["won"]}},
    {"key": "inq-new",     "entity": "inquiry",     "filter": {"status": ["new"]}},
    {"key": "inq-mine",    "entity": "inquiry",     "filter": {"assigned_to": "me"}},
    {"key": "inq-unassigned", "entity": "inquiry",  "filter": {"status": ["new"], "assigned_to": "unassigned"}}
  ]$$::jsonb) AS c),
  ARRAY['deals-all=2', 'deals-mine=1', 'deals-won=1', 'inq-mine=3', 'inq-new=3', 'inq-unassigned=1'],
  'counts for a mix of deal and inquiry filters');

SELECT is(
  (SELECT c.count FROM smart_list_counts('[{"key": "x", "entity": "opportunity", "filter": {"status": ["active"]}}]') AS c),
  (SELECT min(total_count)::int FROM smart_list_opportunities('{"status": ["active"]}', 1, 0, NULL)),
  'a deal count equals the list function''s total_count');
SELECT is(
  (SELECT c.count FROM smart_list_counts('[{"key": "x", "entity": "opportunity", "filter": {"status": ["active"], "sort": "new_matches_desc"}}]') AS c),
  (SELECT c.count FROM smart_list_counts('[{"key": "x", "entity": "opportunity", "filter": {"status": ["active"]}}]') AS c),
  'a count ignores the filter''s sort (it would only make the count slower)');
SELECT is(
  (SELECT c.count FROM smart_list_counts('[{"key": "x", "entity": "inquiry", "filter": {"status": ["new"]}}]') AS c),
  (SELECT min(total_count)::int FROM smart_list_inquiries('{"status": ["new"]}', 1, 0, NULL)),
  'an inquiry count equals the list function''s total_count');
SELECT is((SELECT count(*)::int FROM smart_list_counts('[]')), 0, 'no lists, no rows');
SELECT is(
  (SELECT c.count FROM smart_list_counts('[{"key": "x", "entity": "inquiry", "filter": {"assigned_to": "not-a-uuid"}}]') AS c),
  0, 'a garbage filter counts nothing');

RESET ROLE;
INSERT INTO inquiries (agency_id, caller_name, status, received_at)
SELECT current_setting('test.a1')::uuid, 'bulk ' || g, 'dismissed', '2026-01-01'::timestamptz FROM generate_series(1, 1001) g;
SELECT pg_temp.act_as('u_broker');
SELECT is(
  (SELECT c.count FROM smart_list_counts('[{"key": "x", "entity": "inquiry", "filter": {"status": ["dismissed"]}}]') AS c),
  1000, 'a list with more than 1000 rows counts 1000');
SELECT is(
  (SELECT min(total_count)::int FROM smart_list_inquiries('{"status": ["dismissed"]}', 1, 0, NULL)), 1002,
  'while the list function still reports the real total');

-- ── Bad input is an i18n key, not SQL text ───────────────────────────────────

SELECT throws_ok($$ SELECT * FROM smart_list_counts('[{"key": "x", "entity": "contact", "filter": {}}]') $$,
  'P0001', 'smartLists.errors.invalidEntity', 'an unknown entity raises its key');
SELECT throws_ok($$ SELECT * FROM smart_list_counts('{"key": "x"}') $$,
  'P0001', 'smartLists.errors.invalidLists', 'a non-array raises its key');
SELECT throws_ok($$ SELECT * FROM smart_list_counts((SELECT jsonb_agg(jsonb_build_object('key', g::text, 'entity', 'inquiry', 'filter', '{}'::jsonb))
    FROM generate_series(1, 101) g)) $$,
  'P0001', 'smartLists.errors.tooManyLists', 'more than 100 lists raises its key');

-- ── Tenancy and grants ───────────────────────────────────────────────────────

SELECT pg_temp.act_as('u_b_broker');
SELECT is(pg_temp.inq_set('{}'), ARRAY['ib'], 'a Beta broker gets only Beta''s inquiries');
SELECT is(pg_temp.inq_set(format('{"source_id": ["%s"]}', current_setting('test.src1'))::jsonb), ARRAY[]::text[],
  'a Beta broker gets nothing with an Alpha source id');
SELECT is(
  (SELECT c.count FROM smart_list_counts('[{"key": "x", "entity": "inquiry", "filter": {}}]') AS c), 1,
  'a Beta broker''s count is Beta''s only');

SELECT ok(has_function_privilege('authenticated', 'smart_list_inquiries(jsonb, int, int, jsonb)', 'EXECUTE'),
  'authenticated can execute smart_list_inquiries');
SELECT ok(NOT has_function_privilege('anon', 'smart_list_inquiries(jsonb, int, int, jsonb)', 'EXECUTE'),
  'anon cannot execute smart_list_inquiries');
SELECT ok(has_function_privilege('authenticated', 'smart_list_counts(jsonb)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'smart_list_counts(jsonb)', 'EXECUTE'),
  'smart_list_counts: authenticated only');

SELECT * FROM finish();
ROLLBACK;
