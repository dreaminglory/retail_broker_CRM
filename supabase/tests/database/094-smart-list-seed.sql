-- spec: smart-lists, Task 5 (AD-062). The nine built-in lists of spec/smart-lists.md written as
-- raw jsonb (the presets src/domain/smart-lists/built-in.ts will hold) and run against the
-- seeded data: each returns exactly the "SL " rows the seed puts in it, a record just outside a
-- threshold stays out (AC-2), and a Beta broker sees Beta's rows only. Needs `supabase db reset`
-- (the seed); other rows of the seed are not asserted, only the SL ones, except new-matches,
-- which is the matching seed's deals.
BEGIN;
SELECT plan(24);

CREATE FUNCTION pg_temp.act_as(p_user UUID) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', p_user), true);
  SET ROLE authenticated;
END;
$$;

-- Titles of a deal list, SL rows only, in the function's order.
CREATE FUNCTION pg_temp.sl_deals(p_filter JSONB) RETURNS TEXT[] LANGUAGE sql AS $$
  SELECT coalesce(array_agg(title ORDER BY ord), ARRAY[]::text[])
  FROM smart_list_opportunities(p_filter, 100, 0, NULL) WITH ORDINALITY AS r(id, agency_id, title, type, stage_id, source_id,
    inquiry_id, primary_contact_id, assigned_to, status, temperature, expected_value, currency, notes, next_action_at,
    closed_at, lost_reason, created_by, created_at, updated_at, last_touch, new_matches, sort_key, total_count, ord)
  WHERE title LIKE 'SL %'
$$;
-- Same, every row (for new-matches, which is the matching seed's deals).
CREATE FUNCTION pg_temp.all_deals(p_filter JSONB) RETURNS TEXT[] LANGUAGE sql AS $$
  SELECT coalesce(array_agg(title ORDER BY ord), ARRAY[]::text[])
  FROM smart_list_opportunities(p_filter, 100, 0, NULL) WITH ORDINALITY AS r(id, agency_id, title, type, stage_id, source_id,
    inquiry_id, primary_contact_id, assigned_to, status, temperature, expected_value, currency, notes, next_action_at,
    closed_at, lost_reason, created_by, created_at, updated_at, last_touch, new_matches, sort_key, total_count, ord)
$$;
CREATE FUNCTION pg_temp.sl_inquiries(p_filter JSONB) RETURNS TEXT[] LANGUAGE sql AS $$
  SELECT coalesce(array_agg(caller_name ORDER BY ord), ARRAY[]::text[])
  FROM smart_list_inquiries(p_filter, 100, 0, NULL) WITH ORDINALITY AS r(id, agency_id, source_id, source_description,
    contact_id, opportunity_id, assigned_to, status, caller_name, caller_phone, caller_email, subject, description,
    raw_payload, external_ref, dismissed_reason, received_at, created_by, created_at, updated_at, import_job_id,
    joined_at, sort_key, total_count, ord)
  WHERE caller_name LIKE 'SL %'
$$;

-- ── Alpha's broker, "Mine" ───────────────────────────────────────────────────

SELECT pg_temp.act_as('11111111-4444-4444-4444-444444444444');

SELECT is(pg_temp.sl_deals('{"status":["active"],"next_action":"none","assigned_to":"me","sort":"last_touch_asc"}'),
  ARRAY['SL No action'], 'no-next-action');
SELECT is(pg_temp.sl_deals('{"status":["active"],"next_action":"overdue","assigned_to":"me","sort":"next_action_asc"}'),
  ARRAY['SL Overdue'], 'overdue');
SELECT is(pg_temp.sl_deals('{"status":["active"],"next_action":"today","assigned_to":"me","sort":"next_action_asc"}'),
  ARRAY['SL Due today'], 'due-today');
SELECT is(pg_temp.sl_deals('{"status":["active"],"temperature":["hot"],"no_touch_days":3,"assigned_to":"me","sort":"last_touch_asc"}'),
  ARRAY['SL Hot touched 4d'], 'hot-no-touch: touched 4 days ago is in, 2 days ago is out');
SELECT is(pg_temp.sl_deals('{"status":["active"],"type":["seller","landlord"],"no_touch_days":14,"assigned_to":"me","sort":"last_touch_asc"}'),
  ARRAY['SL Seller touched 15d'], 'sellers-need-update: 15 days is in, 13 days is out');
SELECT is(pg_temp.all_deals('{"status":["active","nurture"],"type":["buyer","tenant"],"has_new_matches":true,"assigned_to":"me","sort":"new_matches_desc"}'),
  ARRAY['Alpha Opp 1', 'Alpha Opp 2'], 'new-matches: the two matching-seed deals with an unoffered match (3 each, so ordered by id)');
SELECT is(pg_temp.sl_deals('{"status":["active"],"assigned_to":"unassigned","sort":"created_desc"}'),
  ARRAY['SL Unassigned deal'], 'unassigned-deals');
SELECT is(pg_temp.sl_inquiries('{"status":["new"],"assigned_to":"me","sort":"received_asc"}'),
  ARRAY['SL New inquiry'], 'new-inquiries (mine)');
SELECT is(pg_temp.sl_inquiries('{"status":["new"],"assigned_to":"unassigned","sort":"received_asc"}'),
  ARRAY['SL Unassigned inquiry'], 'unassigned-inquiries');

-- The SL deals sit in their own list only: each other list has none of them.
SELECT is(pg_temp.sl_deals('{"status":["active"],"next_action":"none","assigned_to":"me"}'),
  ARRAY['SL No action'], 'only "SL No action" has no next action');
SELECT is(pg_temp.sl_deals('{"status":["active"],"temperature":["hot"],"assigned_to":"me","sort":"last_touch_asc"}'),
  ARRAY['SL Hot touched 4d', 'SL Hot touched 2d'], 'both hot deals exist; the threshold separates them');

SELECT is((SELECT array_agg(name ORDER BY name) FROM smart_lists WHERE name LIKE 'SL %'),
  ARRAY['SL My hot deals', 'SL Team overdue'], 'the broker sees their personal list and the shared one');

-- ── The same lists as Alpha's manager (Agency scope, no "me") ────────────────

SELECT pg_temp.act_as('11111111-3333-3333-3333-333333333333');

SELECT is(pg_temp.sl_deals('{"status":["active"],"next_action":"none","sort":"last_touch_asc"}'),
  ARRAY['SL No action'], 'agency scope: no-next-action');
SELECT is(pg_temp.sl_deals('{"status":["active"],"next_action":"overdue","sort":"next_action_asc"}'),
  ARRAY['SL Overdue'], 'agency scope: overdue');
SELECT is(pg_temp.sl_deals('{"status":["active"],"assigned_to":"unassigned","sort":"created_desc"}'),
  ARRAY['SL Unassigned deal'], 'agency scope: unassigned-deals');
SELECT is(pg_temp.sl_deals('{"status":["active"],"assigned_to":"me"}'), ARRAY[]::text[],
  'the manager owns none of the SL deals');
SELECT is((SELECT array_agg(name ORDER BY name) FROM smart_lists WHERE name LIKE 'SL %'),
  ARRAY['SL Team overdue'], 'the manager sees the shared list but not the broker''s personal one');

-- ── Beta's broker ────────────────────────────────────────────────────────────

SELECT pg_temp.act_as('22222222-4444-4444-4444-444444444444');

SELECT is(pg_temp.sl_deals('{"status":["active"],"next_action":"none","assigned_to":"me","sort":"last_touch_asc"}'),
  ARRAY['SL No action'], 'Beta: no-next-action has its own row');
SELECT is(pg_temp.sl_deals('{"status":["active"],"temperature":["hot"],"no_touch_days":3,"assigned_to":"me","sort":"last_touch_asc"}'),
  ARRAY['SL Hot touched 4d'], 'Beta: hot-no-touch');
SELECT is(pg_temp.all_deals('{"status":["active","nurture"],"type":["buyer","tenant"],"has_new_matches":true,"assigned_to":"me","sort":"new_matches_desc"}'),
  (SELECT array_agg(title ORDER BY title) FROM (VALUES ('Beta Opp 2'), ('Beta Opp 3')) v(title)),
  'Beta: new-matches holds only Beta''s matching-seed deals');
SELECT is(
  (SELECT count(*)::int FROM smart_list_opportunities('{"status":["active"],"next_action":"none"}', 100, 0, NULL) WHERE title LIKE 'SL %'),
  1, 'Beta sees one SL deal without a next action, not Alpha''s');
SELECT is(pg_temp.sl_inquiries('{"status":["new"],"assigned_to":"unassigned"}'),
  ARRAY['SL Unassigned inquiry'], 'Beta: unassigned-inquiries');
SELECT is((SELECT array_agg(name ORDER BY name) FROM smart_lists WHERE name LIKE 'SL %'),
  ARRAY['SL My hot deals', 'SL Team overdue'], 'Beta''s broker sees Beta''s two lists');
SELECT is((SELECT count(*)::int FROM smart_lists WHERE agency_id = '11111111-1111-1111-1111-111111111111'), 0,
  'and none of Alpha''s');

SELECT * FROM finish();
ROLLBACK;
