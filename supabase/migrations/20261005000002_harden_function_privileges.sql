-- 1. Fix function search_path mutability finding
ALTER FUNCTION current_agency_id() SET search_path = public;
ALTER FUNCTION current_user_role() SET search_path = public;
ALTER FUNCTION seed_agency_defaults(UUID) SET search_path = public;
ALTER FUNCTION sync_opportunity_next_action() SET search_path = public;
ALTER FUNCTION contacts_search_vector_update() SET search_path = public;
ALTER FUNCTION contact_methods_search_vector_update() SET search_path = public;
ALTER FUNCTION opportunities_search_vector_update() SET search_path = public;
ALTER FUNCTION inquiries_search_vector_update() SET search_path = public;
ALTER FUNCTION get_user_email(UUID) SET search_path = public;
ALTER FUNCTION get_stage_name(UUID) SET search_path = public;
ALTER FUNCTION audit_opportunity_changes() SET search_path = public;
ALTER FUNCTION audit_contact_status_changes() SET search_path = public;
ALTER FUNCTION handle_new_user() SET search_path = public;
ALTER FUNCTION update_updated_at_column() SET search_path = public;

-- Also new ones created in the previous file (though they already have it, doing it again doesn't hurt)
ALTER FUNCTION create_agency_with_owner(text, text) SET search_path = public;
ALTER FUNCTION accept_pending_invitations() SET search_path = public;
ALTER FUNCTION prevent_membership_identity_change() SET search_path = public;

-- 2. Explicit grants and revokes for functions
-- RLS helpers
GRANT EXECUTE ON FUNCTION current_agency_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION current_agency_id() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION current_user_role() TO authenticated;
REVOKE EXECUTE ON FUNCTION current_user_role() FROM PUBLIC, anon;

-- RPCs
GRANT EXECUTE ON FUNCTION create_agency_with_owner(text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION create_agency_with_owner(text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION accept_pending_invitations() TO authenticated;
REVOKE EXECUTE ON FUNCTION accept_pending_invitations() FROM PUBLIC, anon;

-- Internal / Triggers (REVOKE from both)
REVOKE EXECUTE ON FUNCTION seed_agency_defaults(UUID) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION get_user_email(UUID) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION get_stage_name(UUID) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION audit_opportunity_changes() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION audit_contact_status_changes() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION sync_opportunity_next_action() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION contacts_search_vector_update() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION contact_methods_search_vector_update() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION opportunities_search_vector_update() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION inquiries_search_vector_update() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION update_updated_at_column() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION prevent_membership_identity_change() FROM PUBLIC, authenticated, anon;

-- 3. Default privileges for future functions
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
