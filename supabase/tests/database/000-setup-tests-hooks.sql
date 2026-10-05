-- 000-setup-tests-hooks.sql
-- Contains pgTAP and testing helper functions.

CREATE SCHEMA IF NOT EXISTS tests;

-- Helper: Authenticate as a specific user (simulate Supabase JWT)
CREATE OR REPLACE FUNCTION tests.authenticate_as(user_id UUID) RETURNS void AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('role', 'authenticated', true);
END;
$$ LANGUAGE plpgsql;

-- Helper: Clear authentication (become anon)
CREATE OR REPLACE FUNCTION tests.clear_auth() RETURNS void AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('role', 'anon', true);
END;
$$ LANGUAGE plpgsql;

-- Helper: Create a dummy user in auth.users
CREATE OR REPLACE FUNCTION tests.create_user(user_id UUID, email_address text) RETURNS void AS $$
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (
    user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email_address,
    crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT USAGE ON SCHEMA tests TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tests TO anon, authenticated;

SELECT plan(1);
SELECT pass('setup ok');
SELECT * FROM finish();

