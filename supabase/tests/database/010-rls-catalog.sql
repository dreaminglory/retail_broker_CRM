BEGIN;
SELECT plan(5); -- Update this number as we add tests

-- 1. Check that RLS is enabled and forced on all public tables
-- Exclude PostGIS or internal tables if any, but in our schema we check all public tables.
SELECT tables_are(
    'public',
    ARRAY['agencies', 'profiles', 'agency_memberships', 'contacts', 'inquiries', 'opportunities', 'notes', 'tasks', 'audit_log', 'lead_sources', 'stages', 'opportunity_participants', 'contact_methods', 'merge_history'],
    'All expected tables should exist'
);

-- We need a query to verify RLS is enabled and forced on all tables.
-- pgTAP doesn't have a single function for "all tables have RLS", so we query pg_class.
SELECT is_empty(
    $$
    SELECT relname 
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
      AND c.relkind = 'r' 
      AND (c.relrowsecurity = false OR c.relforcerowsecurity = false)
    $$,
    'All public tables must have RLS enabled and forced'
);

-- 2. Check that `agency_id` exists on all tables EXCEPT `agencies` and `profiles`
SELECT is_empty(
    $$
    SELECT t.table_name
    FROM information_schema.tables t
    LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND c.column_name = 'agency_id'
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND t.table_name NOT IN ('agencies', 'profiles')
      AND c.column_name IS NULL
    $$,
    'All tenant tables must have an agency_id column'
);

-- 3. No anon-executable SECURITY DEFINER functions
SELECT is_empty(
    $$
    SELECT p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
    $$,
    'No SECURITY DEFINER functions should be executable by anon'
);

-- 4. Function search_path is set (not mutable)
-- Functions must have search_path set in their proconfig to prevent search_path injection
SELECT is_empty(
    $$
    SELECT p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
    WHERE n.nspname = 'public'
      AND d.objid IS NULL -- Exclude functions belonging to extensions (like pg_trgm)
      AND (p.proconfig IS NULL OR NOT ('search_path=public' = ANY(p.proconfig) OR 'search_path=public, pg_temp' = ANY(p.proconfig) OR 'search_path="public"' = ANY(p.proconfig) OR 'search_path=public,pg_temp' = ANY(p.proconfig)))
    $$,
    'All public non-extension functions must have search_path explicitly set'
);

SELECT * FROM finish();
ROLLBACK;
