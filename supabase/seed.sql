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

-- ==============================================================================
-- Requirements (spec: requirements, Task 3). Buyer and tenant deals with their contacts,
-- a next task each, and requirements saved through save_requirement as each agency's broker,
-- so they pass the same checks and audit as the app's saves (AD-059).
--   Alpha Opp 1 (buyer, Ivan Ivanov): AC-1-like, Лозенец and Център in Sofia
--   Alpha Opp 2 (tenant, Petar Georgiev): a monthly budget only
--   Alpha Opp 3 (buyer, Nadezhda Koleva): no requirement (empty state, E2E)
--   Beta Opp 2 (buyer, Stefan Nikolov): Лозенец in Sofia and the whole of Varna
--   Beta Opp 3 (tenant, Radka Ilieva): Тракия in Plovdiv, monthly budget
--   Beta Opp 4 (buyer, Todor Marinov): no requirement
-- ==============================================================================
DO $$
DECLARE
  v_agency_1 UUID := '11111111-1111-1111-1111-111111111111';
  v_broker_1 UUID := '11111111-4444-4444-4444-444444444444';
  v_agency_2 UUID := '22222222-1111-1111-1111-111111111111';
  v_broker_2 UUID := '22222222-4444-4444-4444-444444444444';

  v_sofia   UUID := (SELECT id FROM public.settlements WHERE ekatte = '68134');
  v_plovdiv UUID := (SELECT id FROM public.settlements WHERE ekatte = '56784');
  v_varna   UUID := (SELECT id FROM public.settlements WHERE ekatte = '10135');

  v_stage_1 UUID := (SELECT id FROM public.stages WHERE agency_id = '11111111-1111-1111-1111-111111111111' AND name = 'Active' LIMIT 1);
  v_stage_2 UUID := (SELECT id FROM public.stages WHERE agency_id = '22222222-1111-1111-1111-111111111111' AND name = 'Active' LIMIT 1);

  v_opp_1_1 UUID := '11111111-6666-6666-6666-666666666661';
  v_opp_1_2 UUID := '11111111-6666-6666-6666-666666666662';
  v_opp_1_3 UUID := '11111111-6666-6666-6666-666666666663';
  v_opp_2_2 UUID := '22222222-6666-6666-6666-666666666662';
  v_opp_2_3 UUID := '22222222-6666-6666-6666-666666666663';
  v_opp_2_4 UUID := '22222222-6666-6666-6666-666666666664';

  v_contact_1_3 UUID := '11111111-5555-5555-5555-555555555553';
  v_contact_1_4 UUID := '11111111-5555-5555-5555-555555555554';
  v_contact_2_3 UUID := '22222222-5555-5555-5555-555555555553';
  v_contact_2_4 UUID := '22222222-5555-5555-5555-555555555554';
  v_contact_2_5 UUID := '22222222-5555-5555-5555-555555555555';
BEGIN
  INSERT INTO public.contacts (id, agency_id, first_name, last_name, display_name, type) VALUES
  (v_contact_1_3, v_agency_1, 'Petar',    'Georgiev', 'Petar Georgiev',  'person'),
  (v_contact_1_4, v_agency_1, 'Nadezhda', 'Koleva',   'Nadezhda Koleva', 'person'),
  (v_contact_2_3, v_agency_2, 'Stefan',   'Nikolov',  'Stefan Nikolov',  'person'),
  (v_contact_2_4, v_agency_2, 'Radka',    'Ilieva',   'Radka Ilieva',    'person'),
  (v_contact_2_5, v_agency_2, 'Todor',    'Marinov',  'Todor Marinov',   'person');

  INSERT INTO public.contact_methods (agency_id, contact_id, type, value, is_primary) VALUES
  (v_agency_1, v_contact_1_3, 'phone', '+359888555101', true),
  (v_agency_1, v_contact_1_4, 'phone', '+359888555102', true),
  (v_agency_2, v_contact_2_3, 'phone', '+359888555201', true),
  (v_agency_2, v_contact_2_4, 'phone', '+359888555202', true),
  (v_agency_2, v_contact_2_5, 'phone', '+359888555203', true);

  INSERT INTO public.opportunities (id, agency_id, title, type, stage_id, primary_contact_id, assigned_to, status, expected_value) VALUES
  (v_opp_1_2, v_agency_1, 'Alpha Opp 2', 'tenant', v_stage_1, v_contact_1_3, v_broker_1, 'active', 800),
  (v_opp_1_3, v_agency_1, 'Alpha Opp 3', 'buyer',  v_stage_1, v_contact_1_4, v_broker_1, 'active', 120000),
  (v_opp_2_2, v_agency_2, 'Beta Opp 2',  'buyer',  v_stage_2, v_contact_2_3, v_broker_2, 'active', 260000),
  (v_opp_2_3, v_agency_2, 'Beta Opp 3',  'tenant', v_stage_2, v_contact_2_4, v_broker_2, 'active', 550),
  (v_opp_2_4, v_agency_2, 'Beta Opp 4',  'buyer',  v_stage_2, v_contact_2_5, v_broker_2, 'active', 90000);

  INSERT INTO public.opportunity_participants (opportunity_id, agency_id, contact_id, role) VALUES
  (v_opp_1_2, v_agency_1, v_contact_1_3, 'tenant'),
  (v_opp_1_3, v_agency_1, v_contact_1_4, 'buyer'),
  (v_opp_2_2, v_agency_2, v_contact_2_3, 'buyer'),
  (v_opp_2_3, v_agency_2, v_contact_2_4, 'tenant'),
  (v_opp_2_4, v_agency_2, v_contact_2_5, 'buyer');

  -- Every deal has a next action; none of these is overdue or due today.
  INSERT INTO public.tasks (agency_id, opportunity_id, assigned_to, title, task_type, due_at, status) VALUES
  (v_agency_1, v_opp_1_2, v_broker_1, 'Send Petar rentals in his budget', 'email', now() + interval '2 days', 'pending'),
  (v_agency_1, v_opp_1_3, v_broker_1, 'Ask Nadezhda what she is looking for', 'call', now() + interval '4 days', 'pending'),
  (v_agency_2, v_opp_2_2, v_broker_2, 'Shortlist for Stefan', 'other', now() + interval '2 days', 'pending'),
  (v_agency_2, v_opp_2_3, v_broker_2, 'Call Radka about Trakia', 'call', now() + interval '3 days', 'pending'),
  (v_agency_2, v_opp_2_4, v_broker_2, 'First call with Todor', 'call', now() + interval '5 days', 'pending');

  -- Alpha, as its broker
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_broker_1, 'role', 'authenticated')::text, true);

  PERFORM public.save_requirement(v_opp_1_1,
    '{"budget_min": 150000, "budget_max": 200000, "property_types": ["apartment", "maisonette"],
      "rooms_min": 2, "rooms_max": 3, "not_top_floor": true, "construction": ["brick"],
      "financing": "mortgage", "wishes": "Паркомясто или гараж; асансьор.",
      "budget_must": true, "location_must": true, "type_must": true}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('settlement_id', v_sofia, 'area_id', '11111111-8888-0000-0000-000000000001'),
      jsonb_build_object('settlement_id', v_sofia, 'area_id', '11111111-8888-0000-0000-000000000003')
    ));

  PERFORM public.save_requirement(v_opp_1_2,
    '{"budget_max": 800, "budget_must": true}'::jsonb,
    '[]'::jsonb);

  -- Beta, as its broker
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_broker_2, 'role', 'authenticated')::text, true);

  PERFORM public.save_requirement(v_opp_2_2,
    '{"budget_min": 200000, "budget_max": 300000, "property_types": ["apartment"],
      "rooms_min": 3, "rooms_max": 4, "area_m2_min": 80, "floor_min": 2,
      "construction": ["brick", "epk"], "financing": "cash",
      "budget_must": true, "location_must": true, "type_must": true, "rooms_must": true}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('settlement_id', v_sofia, 'area_id', '22222222-8888-0000-0000-000000000001'),
      jsonb_build_object('settlement_id', v_varna)
    ));

  PERFORM public.save_requirement(v_opp_2_3,
    '{"budget_min": 400, "budget_max": 600, "property_types": ["studio", "apartment"],
      "rooms_max": 2, "location_must": true, "wishes": "С домашен любимец."}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('settlement_id', v_plovdiv, 'area_id', '22222222-8888-0000-0000-000000000005')
    ));

  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ==============================================================================
-- Matching (spec: matching, Task 4, AD-060). New properties that hit every match result for
-- the seeded requirements. Alpha Opp 1 (buyer): apartment or maisonette, 2–3 rooms, Лозенец or
-- Център, €150–200k, not top floor, brick; type, budget and location are must-haves.
--   ...9011  exact: 2-room Лозенец at €185,000                    100%
--   ...9012  3-room Лозенец at €209,000                           budget "close" on a must-have: hidden
--   ...9013  2-room Лозенец, no m², no construction at €175,000   "?" on construction
--   ...9014  3-room Център, reserved at €195,000                  100%, listed after the active ones
--   ...9015  2-room Лозенец, rent only at €750                    never shown to a buyer
-- Beta Opp 2 (buyer) gets an exact match, a near miss and one with unrecorded values; Beta Opp 3
-- (tenant, Тракия must-have) the same.
-- ==============================================================================
DO $$
DECLARE
  v_agency_1 UUID := '11111111-1111-1111-1111-111111111111';
  v_broker_1 UUID := '11111111-4444-4444-4444-444444444444';
  v_agency_2 UUID := '22222222-1111-1111-1111-111111111111';
  v_broker_2 UUID := '22222222-4444-4444-4444-444444444444';

  v_sofia   UUID := (SELECT id FROM public.settlements WHERE ekatte = '68134');
  v_plovdiv UUID := (SELECT id FROM public.settlements WHERE ekatte = '56784');

  v_a1_lozenets UUID := '11111111-8888-0000-0000-000000000001';
  v_a1_center   UUID := '11111111-8888-0000-0000-000000000003';
  v_a2_lozenets UUID := '22222222-8888-0000-0000-000000000001';
  v_a2_trakia   UUID := '22222222-8888-0000-0000-000000000005';
BEGIN
  -- One row per insert so the codes follow this order.
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  ('11111111-9999-0000-0000-000000000011', v_agency_1, 0, 'apartment', 2, 72,   3, 6, 'brick', 2010, v_sofia, v_a1_lozenets, 'ул. Незабравка 4, ап. 8',   v_broker_1, 'Съвпада напълно с търсенето на Иван.');
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  ('11111111-9999-0000-0000-000000000012', v_agency_1, 0, 'apartment', 3, 90,   2, 6, 'brick', 2014, v_sofia, v_a1_lozenets, 'ул. Хубча 9, ап. 5',      v_broker_1, NULL);
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  ('11111111-9999-0000-0000-000000000013', v_agency_1, 0, 'apartment', 2, NULL, 3, 6, NULL,    NULL, v_sofia, v_a1_lozenets, 'ул. Крум Попов 21, ап. 12', v_broker_1, 'Квадратура и строителство още не са вписани.');
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  ('11111111-9999-0000-0000-000000000014', v_agency_1, 0, 'apartment', 3, 88,   2, 5, 'brick', 2016, v_sofia, v_a1_center,   'ул. Граф Игнатиев 15, ап. 4', v_broker_1, NULL);
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  ('11111111-9999-0000-0000-000000000015', v_agency_1, 0, 'apartment', 2, 65,   2, 4, 'brick', 2005, v_sofia, v_a1_lozenets, 'ул. Златен рог 3, ап. 6',  v_broker_1, 'Само под наем.');

  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  ('22222222-9999-0000-0000-000000000011', v_agency_2, 0, 'apartment', 3, 90,   3, 5, 'brick', 2013, v_sofia, v_a2_lozenets, 'ул. Козяк 7, ап. 10',     v_broker_2, NULL);
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  ('22222222-9999-0000-0000-000000000012', v_agency_2, 0, 'apartment', 3, 88,   3, 5, 'brick', 2015, v_sofia, v_a2_lozenets, 'ул. Хаджикоцев 2, ап. 3', v_broker_2, NULL);
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  ('22222222-9999-0000-0000-000000000013', v_agency_2, 0, 'apartment', 3, NULL, NULL, 5, 'brick', 2011, v_sofia, v_a2_lozenets, 'ул. Златовръх 11, ап. 2', v_broker_2, 'Етаж и квадратура не са вписани.');
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  ('22222222-9999-0000-0000-000000000014', v_agency_2, 0, 'studio',    NULL, 40, 3, 6, 'brick', 2009, v_plovdiv, v_a2_trakia,  'ул. Тракия 17, ап. 9',    v_broker_2, NULL);
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  ('22222222-9999-0000-0000-000000000015', v_agency_2, 0, 'studio',    NULL, 42, 2, 6, 'brick', 2009, v_plovdiv, v_a2_trakia,  'ул. Тракия 17, ап. 4',    v_broker_2, NULL);
  INSERT INTO public.properties (id, agency_id, code, type, rooms, area_m2, floor, floors_total, construction, year_built, settlement_id, area_id, address, assigned_to, description) VALUES
  ('22222222-9999-0000-0000-000000000016', v_agency_2, 0, 'apartment', 2, 55,   2, 4, 'brick', 1999, v_plovdiv, NULL,          'ул. Брезовско шосе 40, ап. 7', v_broker_2, 'Кварталът не е вписан.');

  INSERT INTO public.listings (agency_id, property_id, offer_type, price, status, listed_at) VALUES
  (v_agency_1, '11111111-9999-0000-0000-000000000011', 'sale', 185000, 'active',   now() - interval '6 days'),
  (v_agency_1, '11111111-9999-0000-0000-000000000012', 'sale', 209000, 'active',   now() - interval '9 days'),
  (v_agency_1, '11111111-9999-0000-0000-000000000013', 'sale', 175000, 'active',   now() - interval '4 days'),
  (v_agency_1, '11111111-9999-0000-0000-000000000014', 'sale', 195000, 'reserved', now() - interval '14 days'),
  (v_agency_1, '11111111-9999-0000-0000-000000000015', 'rent', 750,    'active',   now() - interval '2 days'),
  (v_agency_2, '22222222-9999-0000-0000-000000000011', 'sale', 250000, 'active',   now() - interval '8 days'),
  (v_agency_2, '22222222-9999-0000-0000-000000000012', 'sale', 310000, 'active',   now() - interval '10 days'),
  (v_agency_2, '22222222-9999-0000-0000-000000000013', 'sale', 230000, 'active',   now() - interval '3 days'),
  (v_agency_2, '22222222-9999-0000-0000-000000000014', 'rent', 500,    'active',   now() - interval '5 days'),
  (v_agency_2, '22222222-9999-0000-0000-000000000015', 'rent', 660,    'active',   now() - interval '6 days'),
  (v_agency_2, '22222222-9999-0000-0000-000000000016', 'rent', 550,    'active',   now() - interval '1 day');
END $$;

-- ==============================================================================
-- conversion-join (Task 4). Per agency: a new inquiry from a contact who already has an
-- active deal with an owner (Ivan Ivanov / Maria Petrova), a new inquiry from a contact whose
-- deal is in nurture and who also has a won deal that must not be offered (Nina Georgieva /
-- Petar Dimitrov), and a pending invitation sent a day ago.
-- ==============================================================================
DO $$
DECLARE
  v_agency_1 UUID := '11111111-1111-1111-1111-111111111111';
  v_owner_1 UUID := '11111111-2222-2222-2222-222222222222';
  v_broker_1 UUID := '11111111-4444-4444-4444-444444444444';
  v_agency_2 UUID := '22222222-1111-1111-1111-111111111111';
  v_owner_2 UUID := '22222222-2222-2222-2222-222222222222';
  v_broker_2 UUID := '22222222-4444-4444-4444-444444444444';

  v_c1 UUID := '11111111-5555-5555-5555-555555555591';
  v_c2 UUID := '22222222-5555-5555-5555-555555555591';
  v_pending_1 UUID := '11111111-2222-2222-2222-aaaaaaaaaaa1';
  v_pending_2 UUID := '22222222-2222-2222-2222-aaaaaaaaaaa1';

  v_new_1 UUID; v_won_1 UUID; v_portal_1 UUID;
  v_new_2 UUID; v_won_2 UUID; v_portal_2 UUID;
BEGIN
  SELECT id INTO v_new_1 FROM public.stages WHERE agency_id = v_agency_1 AND name = 'New' LIMIT 1;
  SELECT id INTO v_won_1 FROM public.stages WHERE agency_id = v_agency_1 AND name = 'Won' LIMIT 1;
  SELECT id INTO v_portal_1 FROM public.lead_sources WHERE agency_id = v_agency_1 AND name = 'Imot.bg' LIMIT 1;
  SELECT id INTO v_new_2 FROM public.stages WHERE agency_id = v_agency_2 AND name = 'New' LIMIT 1;
  SELECT id INTO v_won_2 FROM public.stages WHERE agency_id = v_agency_2 AND name = 'Won' LIMIT 1;
  SELECT id INTO v_portal_2 FROM public.lead_sources WHERE agency_id = v_agency_2 AND name = 'Imot.bg' LIMIT 1;

  INSERT INTO public.contacts (id, agency_id, first_name, last_name, display_name, type) VALUES
  (v_c1, v_agency_1, 'Nina', 'Georgieva', 'Nina Georgieva', 'person'),
  (v_c2, v_agency_2, 'Petar', 'Dimitrov', 'Petar Dimitrov', 'person');

  INSERT INTO public.contact_methods (agency_id, contact_id, type, value, is_primary) VALUES
  (v_agency_1, v_c1, 'phone', '+359888555001', true),
  (v_agency_2, v_c2, 'phone', '+359888555002', true);

  INSERT INTO public.opportunities (agency_id, title, type, stage_id, primary_contact_id, assigned_to, status, closed_at, lost_reason) VALUES
  (v_agency_1, 'Nina: 2-bedroom, on hold', 'buyer', v_new_1, v_c1, v_broker_1, 'nurture', now() - interval '20 days', 'timing'),
  (v_agency_1, 'Nina: studio, bought', 'buyer', v_won_1, v_c1, v_broker_1, 'won', now() - interval '90 days', NULL),
  (v_agency_2, 'Petar: office, on hold', 'buyer', v_new_2, v_c2, v_broker_2, 'nurture', now() - interval '20 days', 'timing'),
  (v_agency_2, 'Petar: flat, bought', 'buyer', v_won_2, v_c2, v_broker_2, 'won', now() - interval '90 days', NULL);

  INSERT INTO public.inquiries (agency_id, source_id, assigned_to, status, caller_name, caller_phone, subject, received_at, raw_payload) VALUES
  (v_agency_1, v_portal_1, v_owner_1, 'new', 'Ivan Ivanov', '+359888111222', 'Another flat in Mladost', now() - interval '20 minutes', '{"message": "I called last week, one more question."}'::jsonb),
  (v_agency_1, v_portal_1, v_owner_1, 'new', 'Nina Georgieva', '+359888555001', 'Back in the market', now() - interval '10 minutes', '{"message": "We are looking again."}'::jsonb),
  (v_agency_2, v_portal_2, v_owner_2, 'new', 'Maria Petrova', '+359888333444', 'Selling the garage too', now() - interval '20 minutes', '{"message": "Can you list the garage as well?"}'::jsonb),
  (v_agency_2, v_portal_2, v_owner_2, 'new', 'Petar Dimitrov', '+359888555002', 'Back in the market', now() - interval '10 minutes', '{"message": "Looking again."}'::jsonb);

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, invited_at, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change_token_current,
    email_change, phone_change
  ) VALUES
  (v_pending_1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pending@alpha.bg', '', NULL, '{"provider":"email","providers":["email"]}', '{}', now() - interval '1 day', now() - interval '1 day', now() - interval '1 day', '', '', '', '', '', ''),
  (v_pending_2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pending@beta.bg', '', NULL, '{"provider":"email","providers":["email"]}', '{}', now() - interval '1 day', now() - interval '1 day', now() - interval '1 day', '', '', '', '', '', '');

  INSERT INTO public.agency_memberships (user_id, agency_id, role, status, invitation_email, invited_by, invited_at, invitation_sent_at) VALUES
  (v_pending_1, v_agency_1, 'broker', 'invited', 'pending@alpha.bg', v_owner_1, now() - interval '1 day', now() - interval '1 day'),
  (v_pending_2, v_agency_2, 'broker', 'invited', 'pending@beta.bg', v_owner_2, now() - interval '1 day', now() - interval '1 day');
END $$;
