-- Speed check for smart lists (spec: smart-lists rule 10, AC-9; AD-062).
-- Builds the scale data of scripts/matching/scale.sql in a scratch agency (2,000 properties with
-- an open listing each, 2,000 buyer/tenant deals with requirements), then times
-- smart_list_opportunities as that agency's broker (RLS on) and prints min / median / p95 / max
-- in ms. The new-matches list is the module's risk (AD-062): every active deal against every
-- open listing, so it is timed with the pre-filter in deal_matches, and the same count made
-- straight from match_evaluate (no pre-filter) is timed for 3 deals for comparison.
-- Everything runs in one transaction that is rolled back.
--
-- LOCAL STACK ONLY. It refuses to run unless the seeded agency 11111111-1111-… exists.
--   docker exec -i supabase_db_retail_broker_crm_application psql -U postgres -d postgres -v ON_ERROR_STOP=1 < scripts/smart-lists/scale.sql
-- Add -v full=1 for the slow case (every deal counted to sort by new matches).
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM agencies WHERE id = '11111111-1111-1111-1111-111111111111') THEN
    RAISE EXCEPTION 'Not the local seeded stack: refusing to add scale data';
  END IF;
END $$;

SELECT set_config('scale.agency', gen_random_uuid()::text, true);
SELECT set_config('scale.user', gen_random_uuid()::text, true);
SELECT set_config('scale.sofia', (SELECT id FROM settlements WHERE ekatte = '68134')::text, true);

INSERT INTO auth.users (id, email) VALUES (current_setting('scale.user')::uuid, 'scale@example.com');
INSERT INTO agencies (id, name, slug) VALUES (current_setting('scale.agency')::uuid, 'Scale', 'scale-agency');
INSERT INTO agency_memberships (agency_id, user_id, role, status)
VALUES (current_setting('scale.agency')::uuid, current_setting('scale.user')::uuid, 'broker', 'active');
SELECT seed_agency_defaults(current_setting('scale.agency')::uuid);
SELECT set_config('scale.stage', (SELECT id FROM stages WHERE agency_id = current_setting('scale.agency')::uuid ORDER BY sort_order LIMIT 1)::text, true);

-- Eight areas of Sofia
INSERT INTO areas (id, agency_id, settlement_id, name)
SELECT ('00000000-0000-0000-0000-00000000000' || n)::uuid, current_setting('scale.agency')::uuid, current_setting('scale.sofia')::uuid, 'Area ' || n
FROM generate_series(1, 8) n;

-- 2,000 properties: mostly apartments, a few of every other type
INSERT INTO properties (agency_id, code, type, rooms, area_m2, plot_m2, floor, floors_total, construction, settlement_id, area_id)
SELECT current_setting('scale.agency')::uuid, 0, t.type,
       CASE WHEN t.type = 'apartment' THEN 1 + (g % 4) END,
       CASE WHEN t.type = 'plot' THEN NULL WHEN g % 11 = 0 THEN NULL ELSE 30 + (g * 7) % 120 END,
       CASE WHEN t.type IN ('plot', 'house') THEN 300 + (g * 13) % 1500 END,
       CASE WHEN t.type IN ('house', 'plot') THEN NULL WHEN g % 9 = 0 THEN NULL ELSE 1 + g % 7 END,
       CASE WHEN t.type = 'plot' THEN NULL ELSE 7 END,
       CASE WHEN t.type IN ('plot', 'garage') THEN NULL WHEN g % 7 = 0 THEN NULL ELSE (ARRAY['brick', 'panel', 'epk'])[1 + g % 3] END,
       current_setting('scale.sofia')::uuid,
       CASE WHEN g % 13 = 0 THEN NULL ELSE ('00000000-0000-0000-0000-00000000000' || (1 + g % 8))::uuid END
FROM generate_series(1, 2000) g
CROSS JOIN LATERAL (SELECT (ARRAY['apartment','apartment','apartment','apartment','apartment','apartment','studio','maisonette','house','house_floor','plot','garage'])[1 + g % 12] AS type) t;

-- One open listing each: 70% sale, 30% rent; a tenth reserved
INSERT INTO listings (agency_id, property_id, offer_type, price, status, listed_at)
SELECT p.agency_id, p.id,
       CASE WHEN n % 10 < 7 THEN 'sale' ELSE 'rent' END,
       CASE WHEN n % 10 < 7 THEN 60000 + (n * 997) % 340000 ELSE 300 + (n * 31) % 1200 END,
       CASE WHEN n % 10 = 0 THEN 'reserved' ELSE 'active' END,
       now() - (n % 120) * interval '1 day'
FROM (SELECT p.*, row_number() OVER (ORDER BY p.code) AS n FROM properties p WHERE p.agency_id = current_setting('scale.agency')::uuid) p;

-- 2,000 buyer (70%) and tenant (30%) deals, active or nurture
INSERT INTO opportunities (id, agency_id, title, type, status, stage_id, assigned_to)
SELECT gen_random_uuid(), current_setting('scale.agency')::uuid, 'Deal ' || g,
       CASE WHEN g % 10 < 7 THEN 'buyer' ELSE 'tenant' END,
       CASE WHEN g % 8 = 0 THEN 'nurture' ELSE 'active' END,
       current_setting('scale.stage')::uuid, current_setting('scale.user')::uuid
FROM generate_series(1, 2000) g;

-- Their requirements: budget, rooms, one or two areas; budget, location and type are must-haves
-- on most, m² and floor on some (written as the table owner, like the pgTAP fixtures)
INSERT INTO requirements (agency_id, opportunity_id, budget_min, budget_max, property_types, rooms_min, rooms_max,
                          area_m2_min, area_m2_max, floor_min, not_top_floor, construction,
                          type_must, budget_must, location_must, rooms_must, area_m2_must, floor_must, location_keys)
SELECT o.agency_id, o.id,
       CASE WHEN o.type = 'buyer' THEN 80000 + (n * 1009) % 150000 ELSE 300 + (n * 17) % 400 END,
       CASE WHEN o.type = 'buyer' THEN 180000 + (n * 1009) % 200000 ELSE 700 + (n * 17) % 500 END,
       ARRAY['apartment', 'studio'],
       1 + n % 3, 3 + n % 2,
       CASE WHEN n % 3 = 0 THEN 40 END, CASE WHEN n % 3 = 0 THEN 110 END,
       CASE WHEN n % 4 = 0 THEN 2 END, n % 5 = 0,
       CASE WHEN n % 2 = 0 THEN ARRAY['brick', 'epk'] ELSE '{}' END,
       true, n % 10 <> 0, n % 10 <> 1, n % 3 = 1, n % 3 = 0, n % 4 = 0,
       (SELECT array_agg(k ORDER BY k) FROM (VALUES
          (current_setting('scale.sofia') || ':00000000-0000-0000-0000-00000000000' || (1 + n % 8)),
          (current_setting('scale.sofia') || ':00000000-0000-0000-0000-00000000000' || (1 + (n + 3) % 8))
        ) v(k))
FROM (SELECT o.*, row_number() OVER (ORDER BY o.title) AS n FROM opportunities o WHERE o.agency_id = current_setting('scale.agency')::uuid) o;

-- 5,000 inquiries: 40% new, a third unassigned, spread over 90 days
INSERT INTO inquiries (agency_id, assigned_to, status, caller_name, caller_phone, received_at, raw_payload)
SELECT current_setting('scale.agency')::uuid,
       CASE WHEN g % 3 = 0 THEN NULL ELSE current_setting('scale.user')::uuid END,
       CASE WHEN g % 10 < 4 THEN 'new' WHEN g % 10 < 6 THEN 'contacted' WHEN g % 10 < 8 THEN 'converted' ELSE 'dismissed' END,
       'Caller ' || g, '+3598881' || lpad(g::text, 5, '0'),
       now() - (g % 90) * interval '1 day' - (g % 24) * interval '1 hour', '{}'::jsonb
FROM generate_series(1, 5000) g;

-- Tasks and touches per deal (n = its row number): a fifth has no task (no next action), a fifth
-- an overdue one, a fifth one due today (Sofia, later today), the rest a future one. A third has
-- a completed task and a quarter a note, at different ages, so last touch varies.
-- The tasks trigger sets next_action_at on each insert.
INSERT INTO tasks (agency_id, opportunity_id, assigned_to, title, task_type, due_at, status)
SELECT o.agency_id, o.id, o.assigned_to, 'Task ' || o.n, 'call',
       CASE o.n % 5 WHEN 1 THEN now() - interval '2 days'
                    WHEN 2 THEN least((date_trunc('day', now() AT TIME ZONE 'Europe/Sofia') + interval '1 day' - interval '1 second') AT TIME ZONE 'Europe/Sofia', now() + interval '2 hours')
                    ELSE now() + (1 + o.n % 9) * interval '1 day' END,
       'pending'
FROM (SELECT o.*, row_number() OVER (ORDER BY o.title) AS n FROM opportunities o WHERE o.agency_id = current_setting('scale.agency')::uuid) o
WHERE o.n % 5 <> 0;
INSERT INTO tasks (agency_id, opportunity_id, assigned_to, title, task_type, due_at, status, completed_at)
SELECT o.agency_id, o.id, o.assigned_to, 'Done ' || o.n, 'call', now() - (o.n % 40) * interval '1 day', 'completed',
       now() - (o.n % 40) * interval '1 day'
FROM (SELECT o.*, row_number() OVER (ORDER BY o.title) AS n FROM opportunities o WHERE o.agency_id = current_setting('scale.agency')::uuid) o
WHERE o.n % 3 = 0;
INSERT INTO notes (agency_id, opportunity_id, created_by, content, created_at)
SELECT o.agency_id, o.id, o.assigned_to, 'Note ' || o.n, now() - (o.n % 25) * interval '1 day'
FROM (SELECT o.*, row_number() OVER (ORDER BY o.title) AS n FROM opportunities o WHERE o.agency_id = current_setting('scale.agency')::uuid) o
WHERE o.n % 4 = 0;
-- Hot and seller deals so the threshold lists have rows
UPDATE opportunities SET temperature = 'hot' WHERE agency_id = current_setting('scale.agency')::uuid AND title ~ '[05]$';
UPDATE opportunities SET type = 'seller' WHERE agency_id = current_setting('scale.agency')::uuid AND title ~ '[27]$' AND NOT EXISTS (SELECT 1 FROM requirements r WHERE r.opportunity_id = opportunities.id);

ANALYZE properties; ANALYZE listings; ANALYZE opportunities; ANALYZE requirements; ANALYZE opportunity_properties;
ANALYZE inquiries; ANALYZE tasks; ANALYZE notes;

SELECT count(*) AS deals FROM opportunities WHERE agency_id = current_setting('scale.agency')::uuid;

-- Unfiltered reference, as the table owner (no RLS): the same count straight from match_evaluate,
-- for three deals. Multiply by deals / 3 for the whole list.
CREATE TEMP TABLE scale_timing (fn TEXT, ms NUMERIC, n INT);
GRANT ALL ON scale_timing TO authenticated;
DO $$
DECLARE
  v_id UUID; v_start TIMESTAMPTZ; v_n INT;
BEGIN
  FOR v_id IN SELECT o.id FROM opportunities o JOIN requirements r ON r.opportunity_id = o.id
              WHERE o.agency_id = current_setting('scale.agency')::uuid ORDER BY o.title LIMIT 3 LOOP
    v_start := clock_timestamp();
    SELECT count(*) INTO v_n
    FROM opportunities o
    JOIN requirements r ON r.opportunity_id = o.id
    JOIN listings l ON l.agency_id = o.agency_id AND l.status IN ('active', 'reserved')
                   AND l.offer_type = CASE o.type WHEN 'buyer' THEN 'sale' ELSE 'rent' END
    JOIN properties p ON p.id = l.property_id AND p.status = 'active'
    WHERE o.id = v_id AND (match_evaluate(r, p, l)->>'listed')::boolean;
    INSERT INTO scale_timing VALUES ('one deal, match_evaluate only (no pre-filter)', extract(epoch FROM clock_timestamp() - v_start) * 1000, v_n);
  END LOOP;
END $$;

-- Timings, as the scratch broker (RLS on)
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('scale.user'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_start TIMESTAMPTZ; v_n INT; i INT; v_id UUID;
BEGIN
  -- One deal through deal_match_rows (with the pre-filter), 20 different deals, and the same deals
  -- through match_properties (it reads the same view; matching measured p95 ~150 ms before).
  FOR v_id IN SELECT o.id FROM opportunities o JOIN requirements r ON r.opportunity_id = o.id ORDER BY o.title LIMIT 20 LOOP
    v_start := clock_timestamp();
    SELECT count(*) INTO v_n FROM deal_match_rows d WHERE d.opportunity_id = v_id AND d.is_new;
    INSERT INTO scale_timing VALUES ('one deal through deal_match_rows (pre-filter)', extract(epoch FROM clock_timestamp() - v_start) * 1000, v_n);
    v_start := clock_timestamp();
    SELECT count(*) INTO v_n FROM match_properties(v_id, true, 20, 0);
    INSERT INTO scale_timing VALUES ('match_properties, page of 20', extract(epoch FROM clock_timestamp() - v_start) * 1000, v_n);
  END LOOP;
  -- The new-matches count: deals with at least one new match, stopping at the first per deal.
  FOR i IN 1..3 LOOP
    v_start := clock_timestamp();
    SELECT total_count INTO v_n FROM smart_list_opportunities(
      '{"status":["active","nurture"],"type":["buyer","tenant"],"has_new_matches":true}', 1, 0, NULL);
    INSERT INTO scale_timing VALUES ('new-matches count only (has_new_matches, stops at first match)', extract(epoch FROM clock_timestamp() - v_start) * 1000, v_n);
  END LOOP;
  FOR i IN 1..20 LOOP
    v_start := clock_timestamp();
    SELECT count(*) INTO v_n FROM smart_list_opportunities('{}', 20, 0, NULL);
    INSERT INTO scale_timing VALUES ('plain active list, page of 20', extract(epoch FROM clock_timestamp() - v_start) * 1000, v_n);
  END LOOP;
  FOR i IN 1..20 LOOP
    v_start := clock_timestamp();
    SELECT count(*) INTO v_n FROM smart_list_opportunities('{"sort":"last_touch_asc","no_touch_days":14}', 20, 0, NULL);
    INSERT INTO scale_timing VALUES ('no touch for 14 days, page of 20', extract(epoch FROM clock_timestamp() - v_start) * 1000, v_n);
  END LOOP;
END $$;

-- The whole new-matches list sorted by count (every deal counted): slow, so opt in with -v full=1.
\if :{?full}
DO $$
DECLARE
  v_start TIMESTAMPTZ; v_n INT;
BEGIN
  v_start := clock_timestamp();
  SELECT count(*) INTO v_n FROM smart_list_opportunities(
    '{"status":["active","nurture"],"type":["buyer","tenant"],"has_new_matches":true,"sort":"new_matches_desc"}', 20, 0, NULL);
  INSERT INTO scale_timing VALUES ('new-matches list sorted by count, page of 20', extract(epoch FROM clock_timestamp() - v_start) * 1000, v_n);
END $$;
\endif

-- The overview: all nine built-in lists in one counts call, then each list's page of 20. The
-- filters are the presets of src/domain/smart-lists/built-in.ts (see 094-smart-list-seed.sql).
CREATE TEMP TABLE scale_lists (key TEXT, entity TEXT, filter JSONB);
GRANT ALL ON scale_lists TO authenticated;
INSERT INTO scale_lists VALUES
  ('no-next-action', 'opportunity', '{"status":["active"],"next_action":"none","assigned_to":"me","sort":"last_touch_asc"}'),
  ('overdue', 'opportunity', '{"status":["active"],"next_action":"overdue","assigned_to":"me","sort":"next_action_asc"}'),
  ('due-today', 'opportunity', '{"status":["active"],"next_action":"today","assigned_to":"me","sort":"next_action_asc"}'),
  ('hot-no-touch', 'opportunity', '{"status":["active"],"temperature":["hot"],"no_touch_days":3,"assigned_to":"me","sort":"last_touch_asc"}'),
  ('sellers-need-update', 'opportunity', '{"status":["active"],"type":["seller","landlord"],"no_touch_days":14,"assigned_to":"me","sort":"last_touch_asc"}'),
  ('new-matches', 'opportunity', '{"status":["active","nurture"],"type":["buyer","tenant"],"has_new_matches":true,"assigned_to":"me","sort":"new_matches_desc"}'),
  ('unassigned-deals', 'opportunity', '{"status":["active"],"assigned_to":"unassigned","sort":"created_desc"}'),
  ('new-inquiries', 'inquiry', '{"status":["new"],"assigned_to":"me","sort":"received_asc"}'),
  ('unassigned-inquiries', 'inquiry', '{"status":["new"],"assigned_to":"unassigned","sort":"received_asc"}');

DO $$
DECLARE
  v_start TIMESTAMPTZ; v_n INT; i INT; r RECORD;
BEGIN
  FOR i IN 1..10 LOOP
    v_start := clock_timestamp();
    SELECT count(*) INTO v_n FROM smart_list_counts((SELECT jsonb_agg(to_jsonb(l)) FROM scale_lists l));
    INSERT INTO scale_timing VALUES ('OVERVIEW: counts for all 9 built-in lists', extract(epoch FROM clock_timestamp() - v_start) * 1000, v_n);
  END LOOP;
  FOR r IN SELECT * FROM scale_lists WHERE key <> 'new-matches' LOOP
    FOR i IN 1..10 LOOP
      v_start := clock_timestamp();
      IF r.entity = 'opportunity' THEN
        SELECT count(*) INTO v_n FROM smart_list_opportunities(r.filter, 20, 0, NULL);
      ELSE
        SELECT count(*) INTO v_n FROM smart_list_inquiries(r.filter, 20, 0, NULL);
      END IF;
      INSERT INTO scale_timing VALUES ('list page: ' || r.key, extract(epoch FROM clock_timestamp() - v_start) * 1000, v_n);
    END LOOP;
  END LOOP;
END $$;

SELECT fn, count(*) AS runs,
       round(min(ms), 1) AS min_ms,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY ms))::numeric, 1) AS median_ms,
       round((percentile_cont(0.95) WITHIN GROUP (ORDER BY ms))::numeric, 1) AS p95_ms,
       round(max(ms), 1) AS max_ms,
       max(n) AS rows
FROM scale_timing GROUP BY fn ORDER BY fn;

ROLLBACK;
