-- ==============================================================================
-- Seed Data for Development
-- Creates an Agency, 3 Users (Owner, Manager, Broker), Contacts, Opportunities,
-- Inquiries, and Tasks.
-- ==============================================================================

DO $$
DECLARE
  v_agency_id UUID := '11111111-1111-1111-1111-111111111111';
  
  v_user_owner UUID := '22222222-2222-2222-2222-222222222222';
  v_user_manager UUID := '33333333-3333-3333-3333-333333333333';
  v_user_broker UUID := '44444444-4444-4444-4444-444444444444';

  v_stage_new UUID;
  v_stage_active UUID;
  v_stage_won UUID;
  
  v_source_portal UUID;
  v_source_website UUID;

  v_contact_1 UUID := '55555555-5555-5555-5555-555555555551';
  v_contact_2 UUID := '55555555-5555-5555-5555-555555555552';
  v_contact_3 UUID := '55555555-5555-5555-5555-555555555553';
  v_contact_4 UUID := '55555555-5555-5555-5555-555555555554';

  v_opp_1 UUID := '66666666-6666-6666-6666-666666666661';
  v_opp_2 UUID := '66666666-6666-6666-6666-666666666662';
  v_opp_3 UUID := '66666666-6666-6666-6666-666666666663';

  v_inq_1 UUID := '77777777-7777-7777-7777-777777777771';
  v_inq_2 UUID := '77777777-7777-7777-7777-777777777772';
BEGIN
  -- 1. Create Users (Password for all: password123)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change_token_current,
    email_change, phone_change
  ) VALUES 
  (v_user_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@agency.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Alice", "last_name":"Owner"}', now(), now(), '', '', '', '', '', ''),
  (v_user_manager, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager@agency.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Bob", "last_name":"Manager"}', now(), now(), '', '', '', '', '', ''),
  (v_user_broker, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'broker@agency.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Charlie", "last_name":"Broker"}', now(), now(), '', '', '', '', '', '');

  -- Provide identity linkage for users
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at) VALUES
  (gen_random_uuid(), v_user_owner, v_user_owner::text, format('{"sub":"%s","email":"owner@agency.com"}', v_user_owner)::jsonb, 'email', now(), now()),
  (gen_random_uuid(), v_user_manager, v_user_manager::text, format('{"sub":"%s","email":"manager@agency.com"}', v_user_manager)::jsonb, 'email', now(), now()),
  (gen_random_uuid(), v_user_broker, v_user_broker::text, format('{"sub":"%s","email":"broker@agency.com"}', v_user_broker)::jsonb, 'email', now(), now());

  -- 2. Create Agency
  INSERT INTO public.agencies (id, name, slug) VALUES (v_agency_id, 'Prime Real Estate Bulgaria', 'prime-re');

  -- 3. Create Agency Memberships
  INSERT INTO public.agency_memberships (user_id, agency_id, role, status) VALUES
  (v_user_owner, v_agency_id, 'owner', 'active'),
  (v_user_manager, v_agency_id, 'manager', 'active'),
  (v_user_broker, v_agency_id, 'broker', 'active');

  -- (Profiles are auto-created by the handle_new_user trigger on auth.users insert)

  -- 4. Seed Defaults (Stages and Sources via the provided function)
  PERFORM public.seed_agency_defaults(v_agency_id);

  -- Fetch stage and source IDs for later use
  SELECT id INTO v_stage_new FROM public.stages WHERE agency_id = v_agency_id AND name = 'New' LIMIT 1;
  SELECT id INTO v_stage_active FROM public.stages WHERE agency_id = v_agency_id AND name = 'Active' LIMIT 1;
  SELECT id INTO v_stage_won FROM public.stages WHERE agency_id = v_agency_id AND name = 'Won' LIMIT 1;

  SELECT id INTO v_source_portal FROM public.lead_sources WHERE agency_id = v_agency_id AND name = 'Imot.bg' LIMIT 1;
  SELECT id INTO v_source_website FROM public.lead_sources WHERE agency_id = v_agency_id AND name = 'Agency Website' LIMIT 1;

  -- 5. Create Contacts
  INSERT INTO public.contacts (id, agency_id, first_name, last_name, company_name, display_name, type) VALUES
  (v_contact_1, v_agency_id, 'Dimitar', 'Ivanov', NULL, 'Dimitar Ivanov', 'person'),
  (v_contact_2, v_agency_id, 'Elena', 'Petrova', NULL, 'Elena Petrova', 'person'),
  (v_contact_3, v_agency_id, NULL, NULL, 'TechCorp OOD', 'TechCorp OOD', 'organization'),
  (v_contact_4, v_agency_id, 'Stefan', 'Georgiev', NULL, 'Stefan Georgiev', 'person');

  INSERT INTO public.contact_methods (agency_id, contact_id, type, value, is_primary) VALUES
  (v_agency_id, v_contact_1, 'phone', '+359888111222', true),
  (v_agency_id, v_contact_1, 'email', 'dimitar@example.com', true),
  (v_agency_id, v_contact_2, 'phone', '+359888333444', true),
  (v_agency_id, v_contact_3, 'email', 'office@techcorp.bg', true),
  (v_agency_id, v_contact_4, 'phone', '+359888555666', true);

  -- 6. Create Inquiries (The raw lead source)
  INSERT INTO public.inquiries (id, agency_id, contact_id, source_id, status, raw_payload) VALUES
  (v_inq_1, v_agency_id, v_contact_1, v_source_portal, 'converted', '{"property_url": "https://imot.bg/123", "message": "I am interested in this apartment in Lozenets."}'::jsonb),
  (v_inq_2, v_agency_id, v_contact_2, v_source_website, 'converted', '{"message": "Looking to sell my 2-bed in Mladost."}'::jsonb);

  -- 7. Create Opportunities
  INSERT INTO public.opportunities (id, agency_id, title, type, stage_id, source_id, inquiry_id, primary_contact_id, assigned_to, status, expected_value) VALUES
  (v_opp_1, v_agency_id, 'Buy 2-bed Lozenets', 'buyer', v_stage_active, v_source_portal, v_inq_1, v_contact_1, v_user_broker, 'active', 250000),
  (v_opp_2, v_agency_id, 'Sell Office Space Mladost', 'seller', v_stage_new, v_source_website, v_inq_2, v_contact_2, v_user_manager, 'active', 400000),
  (v_opp_3, v_agency_id, 'Rent out Vitosha house', 'landlord', v_stage_won, v_source_portal, NULL, v_contact_4, v_user_owner, 'won', 1500);

  -- 8. Create Opportunity Participants
  INSERT INTO public.opportunity_participants (opportunity_id, agency_id, contact_id, role) VALUES
  (v_opp_1, v_agency_id, v_contact_1, 'buyer'),
  (v_opp_2, v_agency_id, v_contact_2, 'seller'),
  (v_opp_3, v_agency_id, v_contact_4, 'landlord');

  -- 9. Create Tasks (Assigning them to our 3 brokers)
  INSERT INTO public.tasks (agency_id, opportunity_id, assigned_to, title, task_type, due_at, status) VALUES
  (v_agency_id, v_opp_1, v_user_broker, 'Call to schedule viewing', 'call', now() + interval '1 day', 'pending'),
  (v_agency_id, v_opp_2, v_user_manager, 'Prepare valuation report', 'other', now() - interval '2 days', 'pending'), -- Overdue task for today screen
  (v_agency_id, v_opp_3, v_user_owner, 'Send contract', 'email', now() - interval '5 days', 'completed');

END $$;
