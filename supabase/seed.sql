-- ==============================================================================
-- Seed Data for Development
-- Creates two Agencies (Alpha Imoti, Beta Estates), 3 Users each (Owner, Manager, Broker),
-- Contacts, Opportunities, Inquiries, Tasks and Notes.
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
  (v_agency_2, v_opp_2_1, v_user_2_broker, 'Prepare Beta docs', 'other', now() - interval '2 days', 'pending');

  -- 10. Create Notes
  INSERT INTO public.notes (agency_id, opportunity_id, created_by, content) VALUES
  (v_agency_1, v_opp_1_1, v_user_1_broker, 'Client is highly interested.'),
  (v_agency_2, v_opp_2_1, v_user_2_broker, 'Waiting on missing documents.');

END $$;
