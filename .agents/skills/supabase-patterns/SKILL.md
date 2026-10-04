---
name: supabase-patterns
description: Reference guide for Supabase patterns used in this project — RLS policies, auth helpers, server/client configuration, database queries, and migration patterns. Use when writing database migrations, RLS policies, authentication code, or Supabase queries.
---

# Supabase Patterns for BrokerCRM

## RLS Helper Function
All tenant tables use this helper to resolve the current user's agency:

```sql
CREATE OR REPLACE FUNCTION current_agency_id()
RETURNS UUID AS $$
  SELECT agency_id
  FROM agency_memberships
  WHERE user_id = (SELECT auth.uid())
    AND status = 'active'
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
```

**Critical notes:**
- Wrap `auth.uid()` in `(SELECT auth.uid())` to prevent re-evaluation per row
- Mark as `STABLE` so PostgreSQL caches within a query
- Mark as `SECURITY DEFINER` so it can read `agency_memberships` even when RLS is enabled on that table

## Standard RLS Policy Template
Apply this pattern to every tenant-owned table:

```sql
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <table_name> FORCE ROW LEVEL SECURITY;

-- Read: agency members can view their own agency's records
CREATE POLICY "tenant_select" ON <table_name>
  FOR SELECT USING (agency_id = current_agency_id());

-- Insert: can only insert into own agency
CREATE POLICY "tenant_insert" ON <table_name>
  FOR INSERT WITH CHECK (agency_id = current_agency_id());

-- Update: can only update own agency's records
CREATE POLICY "tenant_update" ON <table_name>
  FOR UPDATE USING (agency_id = current_agency_id())
  WITH CHECK (agency_id = current_agency_id());

-- Delete: restricted to owner/admin role
CREATE POLICY "tenant_delete" ON <table_name>
  FOR DELETE USING (
    agency_id = current_agency_id()
    AND EXISTS (
      SELECT 1 FROM agency_memberships
      WHERE user_id = (SELECT auth.uid())
        AND agency_id = current_agency_id()
        AND role IN ('owner', 'admin')
    )
  );
```

## Supabase Client Setup

### Server Client (for Server Components and Server Actions)
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createSupabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

### Browser Client (for Client Components)
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

## Migration Naming Convention
```
supabase/migrations/
├── 20260808000001_create_agencies.sql
├── 20260808000002_create_agency_memberships.sql
├── 20260808000003_create_rls_helper.sql
├── 20260808000004_create_contacts.sql
└── ...
```
Use timestamp-based naming: `YYYYMMDDHHMMSS_description.sql`

## Performance Tips
- Always index `agency_id` on every tenant table
- Create composite indexes for common queries: `(agency_id, status)`, `(agency_id, created_at DESC)`
- Keep RLS policies simple — avoid JOINs in policies, use helper functions instead
- Use `(SELECT auth.uid())` not `auth.uid()` in policies to prevent per-row evaluation
