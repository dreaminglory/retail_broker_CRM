-- ==============================================================================
-- Seed Data for Development
-- Creates two Agencies (Alpha Imoti, Beta Estates), 3 Users each (Owner, Manager, Broker),
-- Contacts, Opportunities, Inquiries, Tasks and Notes.
-- Logins (password123): owner|manager|broker@alpha.bg and owner|manager|broker@beta.bg.
-- Task due dates are relative to now(), so Today always has overdue, due-today and
-- upcoming work after a `db reset` (Sprint 6, slice 6.1).
-- ==============================================================================

DO $$
DECLARE
  -- Agency 1: Alpha Imoti
  v_agency_1 UUID := '11111111-1111-1111-1111-111111111111';
  v_user_1_owner UUID := '11111111-2222-2222-2222-222222222222';
  v_user_1_manager UUID := '11111111-3333-3333-3333-333333333333';
  v_user_1_broker UUID := '11111111-4444-4444-4444-444444444444';

  v_stage_1_new UUID;
  v_stage_1_active UUID;
  v_stage_1_won UUID;
  
  v_source_1_portal UUID;
  v_source_1_website UUID;

  v_contact_1_1 UUID := '11111111-5555-5555-5555-555555555551';
  v_contact_1_2 UUID := '11111111-5555-5555-5555-555555555552';

  v_opp_1_1 UUID := '11111111-6666-6666-6666-666666666661';
  v_inq_1_1 UUID := '11111111-7777-7777-7777-777777777771';

  -- Agency 2: Beta Estates
  v_agency_2 UUID := '22222222-1111-1111-1111-111111111111';
  v_user_2_owner UUID := '22222222-2222-2222-2222-222222222222';
  v_user_2_manager UUID := '22222222-3333-3333-3333-333333333333';
  v_user_2_broker UUID := '22222222-4444-4444-4444-444444444444';

  v_stage_2_new UUID;
  v_stage_2_active UUID;
  v_stage_2_won UUID;
  
  v_source_2_portal UUID;
  v_source_2_website UUID;

  v_contact_2_1 UUID := '22222222-5555-5555-5555-555555555551';
  v_contact_2_2 UUID := '22222222-5555-5555-5555-555555555552';

  v_opp_2_1 UUID := '22222222-6666-6666-6666-666666666661';
  v_inq_2_1 UUID := '22222222-7777-7777-7777-777777777771';

  -- Today in agency time (Europe/Sofia, src/lib/time/agency-day.ts): 23:00 local, or a few
  -- minutes from now when the seed runs later than that, but never past local midnight.
  v_due_today TIMESTAMPTZ := least(
    greatest(
      (date_trunc('day', now() AT TIME ZONE 'Europe/Sofia') + interval '23 hours') AT TIME ZONE 'Europe/Sofia',
      now() + interval '5 minutes'
    ),
    (date_trunc('day', now() AT TIME ZONE 'Europe/Sofia') + interval '1 day' - interval '1 second') AT TIME ZONE 'Europe/Sofia'
  );

BEGIN
  -- 1. Create Users (Password for all: password123)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change_token_current,
    email_change, phone_change
  ) VALUES 
  -- Alpha Imoti Users
  (v_user_1_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@alpha.bg', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Alice", "last_name":"AlphaOwner"}', now(), now(), '', '', '', '', '', ''),
  (v_user_1_manager, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager@alpha.bg', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Bob", "last_name":"AlphaManager"}', now(), now(), '', '', '', '', '', ''),
  (v_user_1_broker, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'broker@alpha.bg', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Charlie", "last_name":"AlphaBroker"}', now(), now(), '', '', '', '', '', ''),
  -- Beta Estates Users
  (v_user_2_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@beta.bg', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Diana", "last_name":"BetaOwner"}', now(), now(), '', '', '', '', '', ''),
  (v_user_2_manager, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager@beta.bg', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Evan", "last_name":"BetaManager"}', now(), now(), '', '', '', '', '', ''),
  (v_user_2_broker, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'broker@beta.bg', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Fiona", "last_name":"BetaBroker"}', now(), now(), '', '', '', '', '', '');

  -- Provide identity linkage for users
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at) VALUES
  (gen_random_uuid(), v_user_1_owner, v_user_1_owner::text, format('{"sub":"%s","email":"owner@alpha.bg"}', v_user_1_owner)::jsonb, 'email', now(), now()),
  (gen_random_uuid(), v_user_1_manager, v_user_1_manager::text, format('{"sub":"%s","email":"manager@alpha.bg"}', v_user_1_manager)::jsonb, 'email', now(), now()),
  (gen_random_uuid(), v_user_1_broker, v_user_1_broker::text, format('{"sub":"%s","email":"broker@alpha.bg"}', v_user_1_broker)::jsonb, 'email', now(), now()),
  (gen_random_uuid(), v_user_2_owner, v_user_2_owner::text, format('{"sub":"%s","email":"owner@beta.bg"}', v_user_2_owner)::jsonb, 'email', now(), now()),
  (gen_random_uuid(), v_user_2_manager, v_user_2_manager::text, format('{"sub":"%s","email":"manager@beta.bg"}', v_user_2_manager)::jsonb, 'email', now(), now()),
  (gen_random_uuid(), v_user_2_broker, v_user_2_broker::text, format('{"sub":"%s","email":"broker@beta.bg"}', v_user_2_broker)::jsonb, 'email', now(), now());

  -- 2. Create Agencies
  INSERT INTO public.agencies (id, name, slug) VALUES 
  (v_agency_1, 'Alpha Imoti', 'alpha-imoti'),
  (v_agency_2, 'Beta Estates', 'beta-estates');

  -- 3. Create Agency Memberships
  INSERT INTO public.agency_memberships (user_id, agency_id, role, status) VALUES
  (v_user_1_owner, v_agency_1, 'owner', 'active'),
  (v_user_1_manager, v_agency_1, 'manager', 'active'),
  (v_user_1_broker, v_agency_1, 'broker', 'active'),
  (v_user_2_owner, v_agency_2, 'owner', 'active'),
  (v_user_2_manager, v_agency_2, 'manager', 'active'),
  (v_user_2_broker, v_agency_2, 'broker', 'active');

  -- (Profiles are auto-created by the handle_new_user trigger on auth.users insert)

  -- 4. Seed Defaults for both agencies
  PERFORM public.seed_agency_defaults(v_agency_1, 'en');
  PERFORM public.seed_agency_defaults(v_agency_2, 'en');

  -- Fetch stage and source IDs for Alpha
  SELECT id INTO v_stage_1_new FROM public.stages WHERE agency_id = v_agency_1 AND name = 'New' LIMIT 1;
  SELECT id INTO v_stage_1_active FROM public.stages WHERE agency_id = v_agency_1 AND name = 'Active' LIMIT 1;
  SELECT id INTO v_stage_1_won FROM public.stages WHERE agency_id = v_agency_1 AND name = 'Won' LIMIT 1;
  SELECT id INTO v_source_1_portal FROM public.lead_sources WHERE agency_id = v_agency_1 AND name = 'Imot.bg' LIMIT 1;
  SELECT id INTO v_source_1_website FROM public.lead_sources WHERE agency_id = v_agency_1 AND name = 'Agency Website' LIMIT 1;

  -- Fetch stage and source IDs for Beta
  SELECT id INTO v_stage_2_new FROM public.stages WHERE agency_id = v_agency_2 AND name = 'New' LIMIT 1;
  SELECT id INTO v_stage_2_active FROM public.stages WHERE agency_id = v_agency_2 AND name = 'Active' LIMIT 1;
  SELECT id INTO v_stage_2_won FROM public.stages WHERE agency_id = v_agency_2 AND name = 'Won' LIMIT 1;
  SELECT id INTO v_source_2_portal FROM public.lead_sources WHERE agency_id = v_agency_2 AND name = 'Imot.bg' LIMIT 1;
  SELECT id INTO v_source_2_website FROM public.lead_sources WHERE agency_id = v_agency_2 AND name = 'Agency Website' LIMIT 1;

  -- 5. Create Contacts
  INSERT INTO public.contacts (id, agency_id, first_name, last_name, company_name, display_name, type) VALUES
  (v_contact_1_1, v_agency_1, 'Ivan', 'Ivanov', NULL, 'Ivan Ivanov', 'person'),
  (v_contact_1_2, v_agency_1, NULL, NULL, 'AlphaCorp', 'AlphaCorp', 'organization'),
  (v_contact_2_1, v_agency_2, 'Maria', 'Petrova', NULL, 'Maria Petrova', 'person'),
  (v_contact_2_2, v_agency_2, NULL, NULL, 'BetaHoldings', 'BetaHoldings', 'organization');

  INSERT INTO public.contact_methods (agency_id, contact_id, type, value, is_primary) VALUES
  (v_agency_1, v_contact_1_1, 'phone', '+359888111222', true),
  (v_agency_1, v_contact_1_2, 'email', 'office@alphacorp.bg', true),
  (v_agency_2, v_contact_2_1, 'phone', '+359888333444', true),
  (v_agency_2, v_contact_2_2, 'email', 'office@betaholdings.bg', true);

  -- 6. Create Inquiries
  INSERT INTO public.inquiries (id, agency_id, contact_id, source_id, status, raw_payload) VALUES
  (v_inq_1_1, v_agency_1, v_contact_1_1, v_source_1_portal, 'converted', '{"message": "Interested in Alpha property."}'::jsonb),
  (v_inq_2_1, v_agency_2, v_contact_2_1, v_source_2_website, 'converted', '{"message": "Looking for Beta options."}'::jsonb);

  -- 7. Create Opportunities
  INSERT INTO public.opportunities (id, agency_id, title, type, stage_id, source_id, inquiry_id, primary_contact_id, assigned_to, status, expected_value) VALUES
  (v_opp_1_1, v_agency_1, 'Alpha Opp 1', 'buyer', v_stage_1_active, v_source_1_portal, v_inq_1_1, v_contact_1_1, v_user_1_broker, 'active', 200000),
  (v_opp_2_1, v_agency_2, 'Beta Opp 1', 'seller', v_stage_2_new, v_source_2_website, v_inq_2_1, v_contact_2_1, v_user_2_broker, 'active', 150000);

  -- 8. Create Opportunity Participants
  INSERT INTO public.opportunity_participants (opportunity_id, agency_id, contact_id, role) VALUES
  (v_opp_1_1, v_agency_1, v_contact_1_1, 'buyer'),
  (v_opp_2_1, v_agency_2, v_contact_2_1, 'seller');

  -- 9. Create Tasks
  INSERT INTO public.tasks (agency_id, opportunity_id, assigned_to, title, task_type, due_at, status) VALUES
  (v_agency_1, v_opp_1_1, v_user_1_broker, 'Call Alpha lead', 'call', now() + interval '1 day', 'pending'),
  (v_agency_2, v_opp_2_1, v_user_2_broker, 'Prepare Beta docs', 'other', now() - interval '2 days', 'pending'),
  -- Alpha Today: one overdue, one due today, one upcoming, for the broker and the manager
  (v_agency_1, v_opp_1_1, v_user_1_broker, 'Send Ivan the shortlist', 'email', now() - interval '1 day', 'pending'),
  (v_agency_1, v_opp_1_1, v_user_1_broker, 'Confirm viewing with Ivan', 'call', v_due_today, 'pending'),
  (v_agency_1, v_opp_1_1, v_user_1_manager, 'Review Ivan''s financing', 'other', now() + interval '3 days', 'pending');

  -- 9b. New inquiries with BG mobile, Sofia landline and foreign phones (E.164)
  INSERT INTO public.inquiries (agency_id, source_id, assigned_to, status, caller_name, caller_phone, caller_email, subject, received_at, raw_payload) VALUES
  (v_agency_1, v_source_1_portal, v_user_1_broker, 'new', 'Georgi Dimitrov', '+359887654321', NULL, '2-bedroom in Lozenets', now() - interval '2 hours', '{"message": "Is the Lozenets flat still available?"}'::jsonb),
  (v_agency_1, v_source_1_website, NULL, 'new', 'Elena Stoyanova', '+35929876543', 'elena.stoyanova@example.bg', 'Office space near the centre', now() - interval '30 minutes', '{"message": "Please call me at the office."}'::jsonb),
  (v_agency_1, v_source_1_portal, v_user_1_broker, 'new', 'John Smith', '+447700900123', 'john.smith@example.co.uk', 'Holiday flat in Bansko', now() - interval '1 day', '{"message": "Buying from the UK."}'::jsonb),
  (v_agency_2, v_source_2_portal, v_user_2_broker, 'new', 'Klaus Weber', '+4915123456789', NULL, 'Sea-view apartment in Varna', now() - interval '3 hours', '{"message": "Looking for a sea view."}'::jsonb);

  -- 10. Create Notes
  INSERT INTO public.notes (agency_id, opportunity_id, created_by, content) VALUES
  (v_agency_1, v_opp_1_1, v_user_1_broker, 'Client is highly interested.'),
  (v_agency_2, v_opp_2_1, v_user_2_broker, 'Waiting on missing documents.');

END $$;

-- ==============================================================================
-- Properties (spec: properties, Task 4). Areas for Sofia and Plovdiv in both agencies,
-- 8 properties each across the seven types, sale and rent listings (one reserved, one
-- withdrawn, one closed), parties on the seeded contacts, candidate links in several
-- statuses on Alpha's buyer deal and a subject link on Beta's seller deal.
-- Codes come from the trigger (Alpha and Beta both start at #1001, in insert order).
-- No `selected` link: the E2E and manual checks add one.
-- ==============================================================================
DO $$
DECLARE
  v_agency_1 UUID := '11111111-1111-1111-1111-111111111111';
  v_broker_1 UUID := '11111111-4444-4444-4444-444444444444';
  v_manager_1 UUID := '11111111-3333-3333-3333-333333333333';
  v_agency_2 UUID := '22222222-1111-1111-1111-111111111111';
  v_broker_2 UUID := '22222222-4444-4444-4444-444444444444';

  v_sofia   UUID := (SELECT id FROM public.settlements WHERE ekatte = '68134');
  v_plovdiv UUID := (SELECT id FROM public.settlements WHERE ekatte = '56784');
  v_varna   UUID := (SELECT id FROM public.settlements WHERE ekatte = '10135');

  -- Areas: <agency>-8888-0000-0000-00000000000N
  v_a1_lozenets  UUID := '11111111-8888-0000-0000-000000000001';
  v_a1_mladost   UUID := '11111111-8888-0000-0000-000000000002';
  v_a1_center    UUID := '11111111-8888-0000-0000-000000000003';
  v_a1_karshiyaka UUID := '11111111-8888-0000-0000-000000000004';
  v_a1_trakia    UUID := '11111111-8888-0000-0000-000000000005';
  v_a2_lozenets  UUID := '22222222-8888-0000-0000-000000000001';
  v_a2_mladost   UUID := '22222222-8888-0000-0000-000000000002';
  v_a2_center    UUID := '22222222-8888-0000-0000-000000000003';
  v_a2_karshiyaka UUID := '22222222-8888-0000-0000-000000000004';
  v_a2_trakia    UUID := '22222222-8888-0000-0000-000000000005';

  -- Properties: <agency>-9999-0000-0000-00000000000N
  v_p1_1 UUID := '11111111-9999-0000-0000-000000000001';
  v_p1_2 UUID := '11111111-9999-0000-0000-000000000002';
  v_p1_3 UUID := '11111111-9999-0000-0000-000000000003';
  v_p1_4 UUID := '11111111-9999-0000-0000-000000000004';
  v_p1_5 UUID := '11111111-9999-0000-0000-000000000005';
  v_p1_6 UUID := '11111111-9999-0000-0000-000000000006';
  v_p1_7 UUID := '11111111-9999-0000-0000-000000000007';
  v_p1_8 UUID := '11111111-9999-0000-0000-000000000008';
  v_p2_1 UUID := '22222222-9999-0000-0000-000000000001';
  v_p2_2 UUID := '22222222-9999-0000-0000-000000000002';
  v_p2_3 UUID := '22222222-9999-0000-0000-000000000003';
  v_p2_4 UUID := '22222222-9999-0000-0000-000000000004';
  v_p2_5 UUID := '22222222-9999-0000-0000-000000000005';
  v_p2_6 UUID := '22222222-9999-0000-0000-000000000006';
  v_p2_7 UUID := '22222222-9999-0000-0000-000000000007';
  v_p2_8 UUID := '22222222-9999-0000-0000-000000000008';
BEGIN
  INSERT INTO public.areas (id, agency_id, settlement_id, name, sort_order) VALUES
  (v_a1_lozenets,   v_agency_1, v_sofia,   'Лозенец',   1),
  (v_a1_mladost,    v_agency_1, v_sofia,   'Младост 1', 2),
  (v_a1_center,     v_agency_1, v_sofia,   'Център',    3),
  (v_a1_karshiyaka, v_agency_1, v_plovdiv, 'Кършияка',  1),
  (v_a1_trakia,     v_agency_1, v_plovdiv, 'Тракия',    2),
  (v_a2_lozenets,   v_agency_2, v_sofia,   'Лозенец',   1),
  (v_a2_mladost,    v_agency_2, v_sofia,   'Младост 1', 2),
  (v_a2_center,     v_agency_2, v_sofia,   'Център',    3),
  (v_a2_karshiyaka, v_agency_2, v_plovdiv, 'Кършияка',  1),
  (v_a2_trakia,     v_agency_2, v_plovdiv, 'Тракия',    2);

  -- One row per insert so the codes follow this order.
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, plot_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  (v_p1_1, v_agency_1, 0, 'apartment',   2, 68,  NULL, 4,    6,    'brick',  2008, v_sofia,   v_a1_lozenets,   'ул. Кричим 12, вх. А, ап. 9',  v_broker_1,  'Двустаен с южно изложение и гледка към Витоша.');
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, plot_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  (v_p1_2, v_agency_1, 0, 'studio',      1, 38,  NULL, 2,    8,    'panel',  1985, v_sofia,   v_a1_mladost,    'бл. 14, вх. Б, ап. 21',        v_broker_1,  NULL);
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, plot_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  (v_p1_3, v_agency_1, 0, 'maisonette',  4, 120, NULL, 6,    7,    'brick',  2015, v_sofia,   v_a1_center,     'ул. Солунска 30',              v_manager_1, 'Мезонет с тераса.');
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, plot_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  (v_p1_4, v_agency_1, 0, 'house',       5, 180, 600,  NULL, 2,    'brick',  2001, v_plovdiv, v_a1_karshiyaka, 'ул. Ягодово 7',                v_broker_1,  NULL);
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, plot_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  (v_p1_5, v_agency_1, 0, 'house_floor', 3, 95,  NULL, 1,    2,    'brick',  1978, v_plovdiv, v_a1_trakia,     'ул. Съединение 4, ет. 1',      v_broker_1,  NULL);
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, plot_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  (v_p1_6, v_agency_1, 0, 'plot',        NULL, NULL, 1500, NULL, NULL, NULL,   NULL, v_plovdiv, NULL,            'местност Остромила',           v_manager_1, 'Регулиран парцел.');
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, plot_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  (v_p1_7, v_agency_1, 0, 'garage',      NULL, 18, NULL,  -1,   6,    'brick',  2008, v_sofia,   v_a1_lozenets,   'ул. Кричим 12, гараж 3',       v_broker_1,  NULL);
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, plot_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  (v_p1_8, v_agency_1, 0, 'apartment',   3, 92,  NULL, 5,    8,    'epk',    1992, v_sofia,   v_a1_mladost,    'бл. 102, вх. 3, ап. 15',       v_broker_1,  'Още без обява.');

  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, plot_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  (v_p2_1, v_agency_2, 0, 'apartment',   3, 85,  NULL, 3,    5,    'brick',  2012, v_sofia,   v_a2_lozenets,   'ул. Златовръх 5, ап. 7',       v_broker_2,  NULL);
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, plot_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  (v_p2_2, v_agency_2, 0, 'studio',      1, 42,  NULL, 7,    10,   'panel',  1988, v_sofia,   v_a2_mladost,    'бл. 8, вх. А, ап. 40',         v_broker_2,  NULL);
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, plot_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  (v_p2_3, v_agency_2, 0, 'maisonette',  4, 140, NULL, 4,    5,    'brick',  2019, v_sofia,   v_a2_center,     'бул. Витоша 88',               v_broker_2,  NULL);
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, plot_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  (v_p2_4, v_agency_2, 0, 'house',       6, 210, 800,  NULL, 3,    'brick',  2005, v_plovdiv, v_a2_karshiyaka, 'ул. Хризантема 2',             v_broker_2,  NULL);
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, plot_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  (v_p2_5, v_agency_2, 0, 'house_floor', 2, 70,  NULL, 2,    2,    'brick',  1970, v_plovdiv, v_a2_trakia,     'ул. Освобождение 11, ет. 2',   v_broker_2,  NULL);
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, plot_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  (v_p2_6, v_agency_2, 0, 'plot',        NULL, NULL, 900, NULL, NULL, NULL,   NULL, v_varna,   NULL,            'м-т Траката',                  v_broker_2,  NULL);
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, plot_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  (v_p2_7, v_agency_2, 0, 'garage',      NULL, 20, NULL,  -1,   5,    'brick',  2012, v_sofia,   v_a2_lozenets,   'ул. Златовръх 5, гараж 1',     v_broker_2,  NULL);
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, plot_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  (v_p2_8, v_agency_2, 0, 'apartment',   2, 64,  NULL, 9,    12,   'brick',  2021, v_varna,   NULL,            'кв. Бриз, ул. Перла 3',        v_broker_2,  'С гледка към морето.');

  -- Listings: sale and rent; one reserved, one closed, one withdrawn per agency.
  -- A closed or withdrawn listing is inserted with that status (updates are refused).
  INSERT INTO public.listings (agency_id, property_id, offer_type, price, status, listed_at, closed_at) VALUES
  (v_agency_1, v_p1_1, 'sale', 185000, 'active',    now() - interval '20 days', NULL),
  (v_agency_1, v_p1_2, 'rent', 450,    'active',    now() - interval '10 days', NULL),
  (v_agency_1, v_p1_3, 'sale', 320000, 'reserved',  now() - interval '45 days', NULL),
  (v_agency_1, v_p1_4, 'sale', 260000, 'active',    now() - interval '30 days', NULL),
  (v_agency_1, v_p1_4, 'rent', 1200,   'withdrawn', now() - interval '90 days', now() - interval '60 days'),
  (v_agency_1, v_p1_5, 'rent', 700,    'active',    now() - interval '5 days',  NULL),
  (v_agency_1, v_p1_6, 'sale', 90000,  'active',    now() - interval '60 days', NULL),
  (v_agency_1, v_p1_7, 'sale', 25000,  'closed',    now() - interval '120 days', now() - interval '15 days'),
  (v_agency_2, v_p2_1, 'sale', 240000, 'active',    now() - interval '12 days', NULL),
  (v_agency_2, v_p2_2, 'rent', 550,    'active',    now() - interval '3 days',  NULL),
  (v_agency_2, v_p2_3, 'sale', 410000, 'reserved',  now() - interval '40 days', NULL),
  (v_agency_2, v_p2_4, 'sale', 295000, 'active',    now() - interval '25 days', NULL),
  (v_agency_2, v_p2_5, 'rent', 600,    'withdrawn', now() - interval '80 days', now() - interval '50 days'),
  (v_agency_2, v_p2_6, 'sale', 70000,  'active',    now() - interval '70 days', NULL),
  (v_agency_2, v_p2_7, 'sale', 28000,  'closed',    now() - interval '100 days', now() - interval '20 days'),
  (v_agency_2, v_p2_8, 'rent', 800,    'active',    now() - interval '7 days',  NULL);

  -- Parties on the seeded contacts (Ivan Ivanov, AlphaCorp; Maria Petrova, BetaHoldings).
  INSERT INTO public.property_parties (agency_id, property_id, contact_id, role, ended_at) VALUES
  (v_agency_1, v_p1_1, '11111111-5555-5555-5555-555555555552', 'owner',          NULL),
  (v_agency_1, v_p1_3, '11111111-5555-5555-5555-555555555552', 'representative', NULL),
  (v_agency_1, v_p1_5, '11111111-5555-5555-5555-555555555551', 'co_owner',       NULL),
  (v_agency_1, v_p1_7, '11111111-5555-5555-5555-555555555551', 'owner',          now() - interval '15 days'),
  (v_agency_2, v_p2_1, '22222222-5555-5555-5555-555555555551', 'owner',          NULL),
  (v_agency_2, v_p2_3, '22222222-5555-5555-5555-555555555552', 'owner',          NULL),
  (v_agency_2, v_p2_8, '22222222-5555-5555-5555-555555555552', 'occupant',       NULL);

  -- Alpha's buyer deal (Alpha Opp 1): candidates in several statuses.
  INSERT INTO public.opportunity_properties (agency_id, opportunity_id, property_id, relation, status, rejected_reason) VALUES
  (v_agency_1, '11111111-6666-6666-6666-666666666661', v_p1_1, 'candidate', 'offered',   NULL),
  (v_agency_1, '11111111-6666-6666-6666-666666666661', v_p1_3, 'candidate', 'viewed',    NULL),
  (v_agency_1, '11111111-6666-6666-6666-666666666661', v_p1_8, 'candidate', 'candidate', NULL),
  (v_agency_1, '11111111-6666-6666-6666-666666666661', v_p1_2, 'candidate', 'rejected',  'Твърде малък');

  -- Beta's seller deal (Beta Opp 1, Maria Petrova): her apartment is the subject.
  INSERT INTO public.opportunity_properties (agency_id, opportunity_id, property_id, relation) VALUES
  (v_agency_2, '22222222-6666-6666-6666-666666666661', v_p2_1, 'subject');
END $$;
