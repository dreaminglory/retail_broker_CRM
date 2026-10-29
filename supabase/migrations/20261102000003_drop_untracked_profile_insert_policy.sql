-- 20261102000003_drop_untracked_profile_insert_policy.sql
-- Sprint 6, slice 6.0 (AD-040): production had a `profiles` INSERT policy with
-- `WITH CHECK (true)` that no migration created (found by the pre-push parity
-- diff). Profiles are created by the SECURITY DEFINER `handle_new_user` trigger,
-- which bypasses RLS, so no member needs to insert profiles. Dropping it brings
-- production in line with the repo; it is a no-op where the policy never existed.

DROP POLICY IF EXISTS "system_can_insert_profiles" ON profiles;
