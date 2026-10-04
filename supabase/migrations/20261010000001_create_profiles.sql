-- ============================================================
-- Migration: Create public.profiles table
-- Sprint 4 — Slice 4.1
-- AD-023: User Profiles sync strategy
-- ============================================================

-- 1. Create profiles table
-- NOTE: This table does NOT have agency_id because a user's
-- identity transcends any single agency (AD-023).
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. RLS — user-level table (not tenant-scoped)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

-- Any authenticated user can see profiles (needed for colleague name resolution)
CREATE POLICY "authenticated_can_view_profiles" ON profiles
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

-- Users can only update their own profile
CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- Allow inserts from the trigger (SECURITY DEFINER bypasses RLS).
-- We do NOT need an INSERT policy for the API because users should
-- only be created via the auth trigger, preventing unauthorized inserts.

-- 3. Trigger: auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      split_part(NEW.email, '@', 1)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 4. Backfill existing users
INSERT INTO profiles (id, email, display_name)
SELECT
  id,
  email,
  split_part(email, '@', 1)
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 5. Updated_at trigger (P-002)
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
