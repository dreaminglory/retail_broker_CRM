-- ============================================================
-- Migration: Create RLS helper function
-- current_agency_id() is used by ALL future tenant-scoped RLS policies.
-- ============================================================

CREATE OR REPLACE FUNCTION current_agency_id()
RETURNS UUID AS $$
  SELECT agency_id
  FROM agency_memberships
  WHERE user_id = (SELECT auth.uid())
    AND status = 'active'
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- NOTES:
-- • (SELECT auth.uid()) prevents per-row re-evaluation
-- • STABLE allows PostgreSQL to cache within a query
-- • SECURITY DEFINER lets this function read agency_memberships even when
--   RLS is enabled on that table (it runs as the function owner)
-- • LIMIT 1 handles the case where a user belongs to multiple agencies
--   (for now, we assume single-agency; multi-agency support is a future feature)
