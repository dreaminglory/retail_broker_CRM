-- 20261102000007_revoke_import_rpcs_from_anon.sql
-- trustworthy-loop (AD-028): the import RPCs kept the default PUBLIC EXECUTE, so anon could
-- call them. They are SECURITY INVOKER and RLS hides every job from anon, so nothing leaked.

REVOKE EXECUTE ON FUNCTION import_commit_contacts(UUID, INT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION import_commit_contacts(UUID, INT) TO authenticated;

REVOKE EXECUTE ON FUNCTION import_commit_inquiries(UUID, INT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION import_commit_inquiries(UUID, INT) TO authenticated;

REVOKE EXECUTE ON FUNCTION import_revert(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION import_revert(UUID) TO authenticated;
