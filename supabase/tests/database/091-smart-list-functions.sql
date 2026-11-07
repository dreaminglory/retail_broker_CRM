-- spec: smart-lists, Tasks 2-4 (AD-062). opportunity_last_touch and smart_list_opportunities:
-- each filter key alone, `me`, the agency-day windows at fixed instants around Sofia midnight,
-- every sort's order, paging and the p_after key, and Beta getting nothing of Alpha.
--
-- The clock is fixed: smart_list_opportunities_at takes the instant the public function reads
-- from now(). 2026-06-15 12:00 UTC is 15:00 in Sofia (UTC+3); local midnight is 21:00 UTC.
BEGIN;
SELECT plan(53);

-- ── Setup ────────────────────────────────────────────────────────────────────

SELECT set_config('test.now', '2026-06-15 12:00:00+00', true);
SELECT set_config('test.a1', gen_random_uuid()::text, true);
SELECT set_config('test.a2', gen_random_uuid()::text, true);
SELECT set_config('test.u_broker', gen_random_uuid()::text, true);
SELECT set_config('test.u_broker2', gen_random_uuid()::text, true);
SELECT set_config('test.u_b_broker', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email) VALUES
  (current_setting('test.u_broker')::uuid, 'slf-broker@example.com'),
  (current_setting('test.u_broker2')::uuid, 'slf-broker2@example.com'),
  (current_setting('test.u_b_broker')::uuid, 'slf-b-broker@example.com');

INSERT INTO agencies (id, name, slug) VALUES
  (current_setting('test.a1')::uuid, 'Agency SLF1', 'slf1'),
  (current_setting('test.a2')::uuid, 'Agency SLF2', 'slf2');

INSERT INTO agency_memberships (agency_id, user_id, role, status) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.u_broker')::uuid, 'broker', 'active'),
  (current_setting('test.a1')::uuid, current_setting('test.u_broker2')::uuid, 'broker', 'active'),
  (current_setting('test.a2')::uuid, current_setting('test.u_b_broker')::uuid, 'broker', 'active');

SELECT seed_agency_defaults(current_setting('test.a1')::uuid);
SELECT seed_agency_defaults(current_setting('test.a2')::uuid);

SELECT set_config('test.stage1', (SELECT id FROM stages WHERE agency_id = current_setting('test.a1')::uuid ORDER BY sort_order LIMIT 1)::text, true);
SELECT set_config('test.stage2', (SELECT id FROM stages WHERE agency_id = current_setting('test.a1')::uuid ORDER BY sort_order OFFSET 1 LIMIT 1)::text, true);
SELECT set_config('test.src1', (SELECT id FROM lead_sources WHERE agency_id = current_setting('test.a1')::uuid ORDER BY name LIMIT 1)::text, true);
SELECT set_config('test.src2', (SELECT id FROM lead_sources WHERE agency_id = current_setting('test.a1')::uuid ORDER BY name OFFSET 1 LIMIT 1)::text, true);
SELECT set_config('test.stage_b', (SELECT id FROM stages WHERE agency_id = current_setting('test.a2')::uuid ORDER BY sort_order LIMIT 1)::text, true);

CREATE FUNCTION pg_temp.act_as(p_user TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    format('{"sub": "%s", "role": "authenticated"}', current_setting('test.' || p_user)), true);
  SET ROLE authenticated;
END;
$$;

-- The deal ids are d1..d8 in agency A1 and db in agency A2. A title starts with its name.
SELECT set_config('test.' || n, gen_random_uuid()::text, true)
FROM unnest(ARRAY['d1','d2','d3','d4','d5','d6','d7','d8','db']) AS n;

INSERT INTO opportunities (id, agency_id, title, type, status, temperature, stage_id, source_id, assigned_to, created_at)
SELECT current_setting('test.' || v.n)::uuid, v.ag::uuid, v.title, v.type, v.status, v.temp,
       CASE WHEN v.ag = current_setting('test.a2') THEN current_setting('test.stage_b')::uuid
            ELSE current_setting('test.' || v.stage)::uuid END,
       CASE WHEN v.src IS NULL THEN NULL ELSE current_setting('test.' || v.src)::uuid END,
       CASE v.owner WHEN 'broker' THEN current_setting('test.u_broker')::uuid
                    WHEN 'broker2' THEN current_setting('test.u_broker2')::uuid
                    WHEN 'beta' THEN current_setting('test.u_b_broker')::uuid END,
       v.created_at::timestamptz
FROM (VALUES
  ('d1', current_setting('test.a1'), 'd1 Lozenets flat',       'buyer',    'active',  'hot',  'stage1', 'src1', 'broker',  '2026-05-01 10:00+00'),
  ('d2', current_setting('test.a1'), 'd2 Beta house 100% sure','seller',   'active',  'warm', 'stage1', 'src2', 'broker2', '2026-05-02 10:00+00'),
  ('d3', current_setting('test.a1'), 'd3 Mladost studio',      'buyer',    'active',  'cold', 'stage2', 'src1', NULL,      '2026-05-03 10:00+00'),
  ('d4', current_setting('test.a1'), 'd4 Center rent',         'tenant',   'active',  'hot',  'stage2', NULL,   'broker',  '2026-05-04 10:00+00'),
  ('d5', current_setting('test.a1'), 'd5 Villa listing',      'landlord', 'active',  'warm', 'stage1', 'src2', 'broker',  '2026-05-05 10:00+00'),
  ('d6', current_setting('test.a1'), 'd6 Waiting buyer',       'buyer',    'nurture', 'warm', 'stage1', NULL,   'broker2', '2026-05-06 10:00+00'),
  ('d7', current_setting('test.a1'), 'd7 Late buyer',          'buyer',    'active',  'cold', 'stage1', NULL,   'broker',  '2026-05-07 10:00+00'),
  ('d8', current_setting('test.a1'), 'd8 Closed deal',         'buyer',    'won',     'warm', 'stage1', NULL,   'broker',  '2026-05-08 10:00+00'),
  ('db', current_setting('test.a2'), 'db Beta deal',           'buyer',    'active',  'warm', 'stage1', NULL,   'beta',    '2026-05-09 10:00+00')
) AS v(n, ag, title, type, status, temp, stage, src, owner, created_at);

-- Touches. A cancelled task never counts, even with a completion date; an edit never counts.
INSERT INTO tasks (agency_id, opportunity_id, title, status, completed_at) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.d1')::uuid, 'call', 'completed', '2026-06-10 10:00+00'),
  (current_setting('test.a1')::uuid, current_setting('test.d2')::uuid, 'cancelled call', 'cancelled', '2026-06-14 10:00+00'),
  (current_setting('test.a1')::uuid, current_setting('test.d3')::uuid, 'call', 'completed', '2026-06-12 12:00+00');
INSERT INTO notes (agency_id, opportunity_id, content, created_at) VALUES
  (current_setting('test.a1')::uuid, current_setting('test.d1')::uuid, 'n', '2026-06-13 09:00+00'),
  (current_setting('test.a1')::uuid, current_setting('test.d4')::uuid, 'n', '2026-06-01 09:00+00');

-- Next actions (set after the tasks, whose trigger recomputes next_action_at).
UPDATE opportunities SET next_action_at = v.at::timestamptz
FROM (VALUES
  ('d2', '2026-06-15 11:59:59+00'),  -- just before now: overdue
  ('d3', '2026-06-15 12:00:00+00'),  -- exactly now: today
  ('d4', '2026-06-15 20:59:59+00'),  -- 23:59:59 Sofia: today
  ('d5', '2026-06-15 21:00:00+00'),  -- local midnight: upcoming
  ('d6', '2026-06-18 20:59:59+00'),  -- last second of the upcoming window
  ('d7', '2026-06-18 21:00:00+00')   -- first second after it: later
) AS v(n, at)
WHERE id = current_setting('test.' || v.n)::uuid;

-- Titles of a list call, first word only, in the order the function returns them.
CREATE FUNCTION pg_temp.lst(p_filter JSONB, p_limit INT DEFAULT 100, p_offset INT DEFAULT 0, p_after JSONB DEFAULT NULL)
RETURNS TEXT[] LANGUAGE sql AS $$
  SELECT coalesce(array_agg(split_part(r.title, ' ', 1) ORDER BY r.ord), ARRAY[]::text[])
  FROM smart_list_opportunities_at(current_setting('test.now')::timestamptz, p_filter, p_limit, p_offset, p_after)
       WITH ORDINALITY AS r(id, agency_id, title, type, stage_id, source_id, inquiry_id, primary_contact_id,
         assigned_to, status, temperature, expected_value, currency, notes, next_action_at, closed_at,
         lost_reason, created_by, created_at, updated_at, last_touch, new_matches, sort_key, total_count, ord)
$$;

-- Same, ignoring order.
CREATE FUNCTION pg_temp.lst_set(p_filter JSONB) RETURNS TEXT[] LANGUAGE sql AS $$
  SELECT ARRAY(SELECT x FROM unnest(pg_temp.lst(p_filter)) AS x ORDER BY x)
$$;

-- ── Last touch ───────────────────────────────────────────────────────────────

SELECT is((SELECT opportunity_last_touch(o) FROM opportunities o WHERE id = current_setting('test.d1')::uuid),
  '2026-06-13 09:00+00'::timestamptz, 'last touch: the later of a completed task and a note');
SELECT is((SELECT opportunity_last_touch(o) FROM opportunities o WHERE id = current_setting('test.d3')::uuid),
  '2026-06-12 12:00+00'::timestamptz, 'last touch: a completed task alone');
SELECT is((SELECT opportunity_last_touch(o) FROM opportunities o WHERE id = current_setting('test.d4')::uuid),
  '2026-06-01 09:00+00'::timestamptz, 'last touch: a note alone');
SELECT is((SELECT opportunity_last_touch(o) FROM opportunities o WHERE id = current_setting('test.d2')::uuid),
  '2026-05-02 10:00+00'::timestamptz, 'last touch: a cancelled task does not count, so the deal''s creation does');
SELECT is((SELECT opportunity_last_touch(o) FROM opportunities o WHERE id = current_setting('test.d7')::uuid),
  '2026-05-07 10:00+00'::timestamptz, 'last touch: no task and no note is the creation date');

UPDATE opportunities SET title = title || ' edited', temperature = 'hot'
WHERE id = current_setting('test.d2')::uuid;
SELECT ok((SELECT updated_at FROM opportunities WHERE id = current_setting('test.d2')::uuid) > '2026-06-14'::timestamptz,
  'the edit moved updated_at');
SELECT is((SELECT opportunity_last_touch(o) FROM opportunities o WHERE id = current_setting('test.d2')::uuid),
  '2026-05-02 10:00+00'::timestamptz, 'last touch: an edit (updated_at) does not move it');
UPDATE opportunities SET title = 'd2 Beta house 100% sure', temperature = 'warm' WHERE id = current_setting('test.d2')::uuid;

-- ── Filters, one at a time (as broker, agency A1) ────────────────────────────

SELECT pg_temp.act_as('u_broker');

SELECT is(pg_temp.lst_set('{}'), ARRAY['d1','d2','d3','d4','d5','d7'], 'an empty filter is the active deals');
SELECT is(pg_temp.lst_set('{"bogus": 1, "status": ["active"]}'), ARRAY['d1','d2','d3','d4','d5','d7'], 'an unknown key is ignored');
SELECT is(pg_temp.lst_set('{"status": ["nurture"]}'), ARRAY['d6'], 'status: nurture');
SELECT is(pg_temp.lst_set('{"status": ["won"]}'), ARRAY['d8'], 'status: won');
SELECT is(pg_temp.lst_set('{"status": ["active","nurture"]}'), ARRAY['d1','d2','d3','d4','d5','d6','d7'], 'status: several');
SELECT is(pg_temp.lst_set('{"type": ["buyer"]}'), ARRAY['d1','d3','d7'], 'type');
SELECT is(pg_temp.lst_set('{"type": ["seller","landlord"]}'), ARRAY['d2','d5'], 'type: several');
SELECT is(pg_temp.lst_set(format('{"stage_id": ["%s"]}', current_setting('test.stage2'))::jsonb), ARRAY['d3','d4'], 'stage_id');
SELECT is(pg_temp.lst_set('{"temperature": ["hot"]}'), ARRAY['d1','d4'], 'temperature');
SELECT is(pg_temp.lst_set(format('{"source_id": ["%s"]}', current_setting('test.src1'))::jsonb), ARRAY['d1','d3'], 'source_id');
SELECT is(pg_temp.lst_set(format('{"source_id": ["%s","%s"]}', current_setting('test.src1'), current_setting('test.src2'))::jsonb),
  ARRAY['d1','d2','d3','d5'], 'source_id: several');
SELECT is(pg_temp.lst_set('{"assigned_to": "me"}'), ARRAY['d1','d4','d5','d7'], 'assigned_to: me is the caller');
SELECT is(pg_temp.lst_set('{"assigned_to": "unassigned"}'), ARRAY['d3'], 'assigned_to: unassigned');
SELECT is(pg_temp.lst_set(format('{"assigned_to": "%s"}', current_setting('test.u_broker2'))::jsonb), ARRAY['d2'], 'assigned_to: a user id');
SELECT is(pg_temp.lst_set('{"assigned_to": "not-a-uuid"}'), ARRAY[]::text[], 'assigned_to: garbage matches nothing');
SELECT is(pg_temp.lst_set('{"search": "lozenets"}'), ARRAY['d1'], 'search: title, any case');
SELECT is(pg_temp.lst_set('{"search": "%"}'), ARRAY['d2'], 'search: % is a literal character, not a wildcard');
SELECT is(pg_temp.lst_set('{"no_touch_days": 3}'), ARRAY['d2','d3','d4','d5','d7'], 'no_touch_days: 3 includes a touch exactly 3 days ago');
SELECT is(pg_temp.lst_set('{"no_touch_days": 4}'), ARRAY['d2','d4','d5','d7'], 'no_touch_days: 4');

-- ── Agency-day windows at the fixed instant ──────────────────────────────────

SELECT is(pg_temp.lst_set('{"next_action": "none"}'), ARRAY['d1'], 'next_action: none');
SELECT is(pg_temp.lst_set('{"next_action": "overdue"}'), ARRAY['d2'], 'next_action: overdue stops just before now');
SELECT is(pg_temp.lst_set('{"next_action": "today"}'), ARRAY['d3','d4'], 'next_action: today runs from now to 23:59:59 Sofia');
SELECT is(pg_temp.lst_set('{"next_action": "upcoming"}'), ARRAY['d5'], 'next_action: upcoming starts at Sofia midnight');
SELECT is(pg_temp.lst_set('{"next_action": "upcoming", "status": ["nurture"]}'), ARRAY['d6'],
  'next_action: upcoming ends at midnight + 4 days (23:59:59 on day 3 is in)');
SELECT is(pg_temp.lst_set('{"next_action": "upcoming", "status": ["active","nurture"]}'), ARRAY['d5','d6'],
  'next_action: upcoming excludes the first second of day 4 (d7)');

RESET ROLE;
-- Around the DST switch (2026-03-29 03:00 -> 04:00 in Sofia): 21:30 UTC on the 28th is 23:30
-- local (UTC+2), so local midnight is 22:00 UTC and "today" ends then; the day after is 23 hours long.
SELECT set_config('test.now', '2026-03-28 21:30:00+00', true);
UPDATE opportunities SET next_action_at = '2026-03-28 21:59:59+00' WHERE id = current_setting('test.d1')::uuid;
UPDATE opportunities SET next_action_at = '2026-03-28 22:00:00+00' WHERE id = current_setting('test.d2')::uuid;
-- The window ends at local midnight + 4 days = 1 April 00:00 in UTC+3 = 21:00 UTC on 31 March
-- (a plain 96 hours would end an hour later).
UPDATE opportunities SET next_action_at = '2026-03-31 20:59:59+00' WHERE id = current_setting('test.d3')::uuid;
UPDATE opportunities SET next_action_at = '2026-03-31 21:00:00+00' WHERE id = current_setting('test.d4')::uuid;
SELECT pg_temp.act_as('u_broker');
SELECT is(pg_temp.lst_set('{"next_action": "today", "type": ["buyer","seller","tenant"]}'), ARRAY['d1'],
  'DST: today ends at local midnight (22:00 UTC)');
SELECT is(pg_temp.lst_set('{"next_action": "upcoming", "type": ["buyer","seller","tenant"]}'), ARRAY['d2','d3'],
  'DST: upcoming starts at local midnight and ends 4 local days later, across the 23-hour day');
SELECT set_config('test.now', '2026-06-15 12:00:00+00', true);

-- ── Order ────────────────────────────────────────────────────────────────────

RESET ROLE;
UPDATE opportunities SET next_action_at = v.at::timestamptz
FROM (VALUES
  ('d1', NULL), ('d2', '2026-06-15 11:59:59+00'), ('d3', '2026-06-15 12:00:00+00'),
  ('d4', '2026-06-15 20:59:59+00'), ('d5', '2026-06-15 21:00:00+00'), ('d7', '2026-06-18 21:00:00+00')
) AS v(n, at)
WHERE id = current_setting('test.' || v.n)::uuid;
SELECT pg_temp.act_as('u_broker');

SELECT is(pg_temp.lst('{}'), ARRAY['d7','d5','d4','d3','d2','d1'], 'sort: created_desc is the default');
SELECT is(pg_temp.lst('{"sort": "last_touch_asc"}'), ARRAY['d2','d5','d7','d4','d3','d1'], 'sort: last_touch_asc');
SELECT is(pg_temp.lst('{"sort": "next_action_asc"}'), ARRAY['d2','d3','d4','d5','d7','d1'], 'sort: next_action_asc puts no next action last');
SELECT is(pg_temp.lst('{"sort": "no_such_sort"}'), ARRAY['d7','d5','d4','d3','d2','d1'], 'sort: an unknown value falls back to created_desc');

SELECT is(
  (SELECT count(*)::int FROM smart_list_opportunities_at(current_setting('test.now')::timestamptz,
     '{"status": ["active","nurture","won"], "sort": "last_touch_asc"}', 100, 0, NULL) AS l
   JOIN opportunities o ON o.id = l.id
   WHERE l.last_touch IS DISTINCT FROM opportunity_last_touch(o)),
  0, 'the list''s last_touch is opportunity_last_touch for every deal (one rule, read through one view)');

-- ── Paging and the queue key ─────────────────────────────────────────────────

SELECT is(pg_temp.lst('{"sort": "next_action_asc"}', 2, 2), ARRAY['d4','d5'], 'paging: limit 2, offset 2');
SELECT is((SELECT min(total_count) FROM smart_list_opportunities_at(current_setting('test.now')::timestamptz, '{}', 2, 4, NULL)), 6::bigint,
  'total_count is the rows in the list, not in the page');
SELECT is((SELECT count(*)::int FROM smart_list_opportunities_at(current_setting('test.now')::timestamptz, '{}', 1000, 0, NULL)), 6,
  'a huge limit is accepted');

SELECT set_config('test.key_d3',
  (SELECT sort_key::text FROM smart_list_opportunities_at(current_setting('test.now')::timestamptz,
     '{"sort":"next_action_asc"}', 100, 0, NULL) WHERE id = current_setting('test.d3')::uuid), true);
SELECT is(jsonb_array_length(current_setting('test.key_d3')::jsonb), 2, 'sort_key is [position, id]');
SELECT is(pg_temp.lst('{"sort": "next_action_asc"}', 100, 0, current_setting('test.key_d3')::jsonb),
  ARRAY['d4','d5','d7','d1'], 'p_after: the rows strictly after a key');

RESET ROLE;
UPDATE opportunities SET status = 'won' WHERE id = current_setting('test.d3')::uuid;
SELECT pg_temp.act_as('u_broker');
SELECT is(pg_temp.lst('{"sort": "next_action_asc"}', 1, 0, current_setting('test.key_d3')::jsonb), ARRAY['d4'],
  'p_after: still returns the next row after the deal itself left the list');
SELECT is((SELECT total_count FROM smart_list_opportunities_at(current_setting('test.now')::timestamptz,
  '{"sort":"next_action_asc"}', 1, 0, current_setting('test.key_d3')::jsonb)), 5::bigint,
  'p_after: total_count is still the whole list');
SELECT is(pg_temp.lst('{"sort": "created_desc"}', 100, 0,
  (SELECT sort_key FROM smart_list_opportunities_at(current_setting('test.now')::timestamptz, '{}', 100, 0, NULL)
   WHERE id = current_setting('test.d4')::uuid)), ARRAY['d2','d1'], 'p_after: created_desc continues down the list');

-- ── me and tenancy ───────────────────────────────────────────────────────────

SELECT pg_temp.act_as('u_broker2');
SELECT is(pg_temp.lst_set('{"assigned_to": "me"}'), ARRAY['d2'], 'me is the other broker when they call');

SELECT pg_temp.act_as('u_b_broker');
SELECT is(pg_temp.lst_set('{}'), ARRAY['db'], 'a Beta broker gets only Beta''s deals');
SELECT is(pg_temp.lst_set(format('{"stage_id": ["%s"]}', current_setting('test.stage2'))::jsonb), ARRAY[]::text[],
  'a Beta broker gets nothing with an Alpha stage id');
SELECT is(pg_temp.lst_set(format('{"assigned_to": "%s", "status": ["active","nurture","won"]}', current_setting('test.u_broker'))::jsonb),
  ARRAY[]::text[], 'a Beta broker gets nothing with an Alpha user id');

-- ── Grants ───────────────────────────────────────────────────────────────────

SELECT ok(has_function_privilege('authenticated', 'smart_list_opportunities(jsonb, int, int, jsonb)', 'EXECUTE'),
  'authenticated can execute smart_list_opportunities');
SELECT ok(NOT has_function_privilege('anon', 'smart_list_opportunities(jsonb, int, int, jsonb)', 'EXECUTE'),
  'anon cannot execute smart_list_opportunities');

SELECT * FROM finish();
ROLLBACK;
