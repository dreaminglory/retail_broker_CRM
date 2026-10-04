# Learnings & Best Practices

> A living document of patterns, gotchas, and best practices discovered during development.
> Updated continuously. Referenced by the `learnings-and-decisions` skill.
> Use IDs (e.g., "see L-002") when referencing in code comments.

---

## Best Practices

### L-001: Always Wrap `auth.uid()` in a Subselect
**Date:** 2026-08-27
**Context:** Writing RLS policies for tenant-scoped tables.
**Learning:** PostgreSQL re-evaluates function calls per row in RLS policies. Using `(SELECT auth.uid())` forces a single evaluation and caches the result for the entire query, dramatically improving performance on large tables.
**Impact:** All RLS policies and helper functions must use `(SELECT auth.uid())` — never bare `auth.uid()`. This is enforced in the `supabase-patterns` skill template.

### L-002: Use SECURITY DEFINER for RLS Helper Functions
**Date:** 2026-08-28
**Context:** `current_agency_id()` needs to read `agency_memberships` which itself has RLS enabled.
**Learning:** `SECURITY DEFINER` functions execute with the privileges of the function owner (typically the migration user/superuser), bypassing RLS. Combined with `STABLE` (allows caching) and `SET search_path = public` (security best practice to prevent search_path attacks), this creates a safe, performant helper pattern.
**Impact:** All tenant-resolution helper functions follow this pattern. New helpers (e.g., `current_user_role()`) use the same `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public` signature.

### L-003: Keep RLS Policies Simple — No JOINs, Use Helpers
**Date:** 2026-08-28
**Context:** Complex RLS policies with inline subqueries against `agency_memberships` caused infinite recursion.
**Learning:** RLS policies should be single-condition checks against helper functions. Never write a policy that queries a table with its own RLS policies inline — extract the lookup into a `SECURITY DEFINER` helper function.
**Impact:** Standard RLS template is now: `agency_id = current_agency_id()`. Role checks use `current_user_role()`. See `supabase-patterns` skill for the full template.

### L-004: Supabase Server vs Browser Client Pattern
**Date:** 2026-08-27
**Context:** Next.js 15 App Router requires different Supabase clients for server and client components.
**Learning:**
- **Server Components / Server Actions**: Use `createSupabaseServer()` from `@/lib/supabase/server` — reads cookies via `next/headers`, runs on the server, and carries the user's auth context through RLS.
- **Client Components**: Use `createSupabaseBrowser()` from `@/lib/supabase/client` — uses browser cookies, needed for interactive auth flows (signup, login).
- **Middleware**: Uses a separate `updateSession()` helper from `@/lib/supabase/middleware` to refresh tokens on every request.
**Impact:** Always check whether you're in a server or client context before choosing the Supabase client. Server Actions should always use the server client.

### L-005: Signup Flow — Agency + Membership in One Transaction
**Date:** 2026-08-27
**Context:** When a new user signs up, they need a User record, an Agency, and an AgencyMembership created atomically.
**Learning:** The signup flow creates all three sequentially from the client: (1) `auth.signUp()` creates the user, (2) insert into `agencies` creates the tenant, (3) insert into `agency_memberships` links the user as `owner` with `status: 'active'`. If step 2 or 3 fails, the user sees a partial-success error message.
**Impact:** Future improvement: wrap steps 2-3 in a database function or edge function for true atomicity. For now, the RLS policies are permissive enough to allow this client-side flow (see `authenticated_can_create_agency` and `authenticated_can_create_own_membership` policies).

### L-006: Migration File Naming Convention
**Date:** 2026-08-27
**Context:** Establishing a consistent naming pattern for Supabase migrations.
**Learning:** Use `YYYYMMDDHHMMSS_description.sql` format. The timestamp prefix ensures correct ordering. Use `000001`, `000002`, etc. for sequential migrations on the same day. Descriptions should be lowercase with underscores (e.g., `create_contacts`, `fix_rls_recursion`).
**Impact:** All migrations follow this pattern in `supabase/migrations/`.

---

## Gotchas & Pitfalls

### G-001: RLS Infinite Recursion on Self-Referencing Policies
**Date:** 2026-08-28
**Problem:** RLS policies on `agency_memberships` that contained subqueries against `agency_memberships` caused infinite recursion: the policy triggered itself when the subquery hit the same table.
**Root cause:** PostgreSQL evaluates RLS policies on every table access, including subqueries within other RLS policies. A SELECT policy on `agency_memberships` that does `SELECT agency_id FROM agency_memberships WHERE ...` triggers the policy again, creating infinite recursion.
**Fix:** Migration `20260828000004_fix_rls_recursion.sql` replaced inline subqueries with calls to `current_agency_id()` and `current_user_role()` — both `SECURITY DEFINER` functions that bypass RLS.
**Prevention:** Never write RLS policies that query the same table (directly or transitively). Always use `SECURITY DEFINER` helper functions for tenant/role resolution. This rule is codified in the `supabase-patterns` skill.

### G-002: `FORCE ROW LEVEL SECURITY` is Required for Table Owners
**Date:** 2026-08-27
**Problem:** RLS policies had no effect during local development when running migrations as the table owner.
**Root cause:** By default, PostgreSQL RLS does not apply to the table owner. `ENABLE ROW LEVEL SECURITY` only affects non-owner roles. `FORCE ROW LEVEL SECURITY` makes policies apply to the table owner too.
**Fix:** Every table uses both `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `ALTER TABLE ... FORCE ROW LEVEL SECURITY`.
**Prevention:** The RLS template in `supabase-patterns` always includes both statements.

### G-003: Next.js 15 HMR Cascading Re-renders from Synchronous setState
**Date:** 2026-09-22
**Problem:** Calling `setState` synchronously inside a `useEffect` caused cascading re-render errors and crashed the Next.js HMR overlay.
**Root cause:** Next.js 15 is extremely strict about state updates that trigger immediate cascading renders after mount.
**Fix:** Wrap the state update in a `setTimeout(..., 0)` to push it to the end of the event loop.
**Prevention:** Avoid synchronous state updates inside effects. If required (e.g., to force a remount via a `resetKey`), use a zero-delay timeout.

### G-004: BaseUI Uncontrolled Select DefaultValue Warning
**Date:** 2026-09-22
**Problem:** React throws a runtime warning: "A component is changing the default value state of an uncontrolled Select after being initialized."
**Root cause:** Passing a `defaultValue` that starts as `undefined` (while data loads) and then changes to an actual ID causes the component to complain because it ignores changes to `defaultValue` after initialization.
**Fix:** Add a `key` prop to the `<Select>` component that is bound to the default value. This forces React to completely unmount and remount the component when the data arrives, applying the new default properly.
**Prevention:** When using `defaultValue` on a `<Select>` that depends on asynchronously loaded arrays, bind the `key` to the default value.

---

## Useful Patterns

### P-001: Standard RLS Template for Tenant Tables
**Date:** 2026-08-27
**Pattern:** Every tenant-owned table follows this template:
```sql
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <table_name> FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON <table_name>
  FOR SELECT USING (agency_id = current_agency_id());

CREATE POLICY "tenant_insert" ON <table_name>
  FOR INSERT WITH CHECK (agency_id = current_agency_id());

CREATE POLICY "tenant_update" ON <table_name>
  FOR UPDATE USING (agency_id = current_agency_id())
  WITH CHECK (agency_id = current_agency_id());

CREATE POLICY "tenant_delete" ON <table_name>
  FOR DELETE USING (
    agency_id = current_agency_id()
    AND current_user_role() IN ('owner', 'manager')
  );
```
**Usage:** Copy this template for every new tenant-scoped table. Adjust the DELETE policy role requirements as needed per entity.

### P-002: Updated_at Trigger Pattern
**Date:** 2026-08-27
**Pattern:** The `update_updated_at_column()` function was created once in the agencies migration and reused:
```sql
CREATE TRIGGER set_<table>_updated_at
  BEFORE UPDATE ON <table>
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```
**Usage:** Add this trigger to every mutable table. The function already exists — just create the trigger.

### P-003: Dashboard Layout Auth Guard
**Date:** 2026-08-27
**Pattern:** The `(dashboard)/layout.tsx` uses a server component that checks auth and redirects:
```typescript
const supabase = await createSupabaseServer();
const { data: { user } } = await supabase.auth.getUser();
if (!user) { redirect("/login"); }
```
**Usage:** This protects all routes under `(dashboard)/` without per-page auth checks. Individual pages can query `agency_memberships` for role-based access control.

### P-004: Audit Log Triggers
**Date:** 2026-09-30
**Pattern:** For system-level auditing, we use PostgreSQL `AFTER UPDATE` triggers that write to an `audit_log` table.
**Usage:** The trigger functions must be `SECURITY DEFINER` so they can insert into the append-only `audit_log` table. To capture the user making the change, we use `(SELECT auth.uid())` within the trigger function, which safely fetches the current user from the session without breaking RLS context.

### P-005: Supabase Admin Client — Service Role Key Isolation
**Date:** 2026-10-01
**Pattern:** Administrative operations (like `inviteUserByEmail`) require a Supabase client instantiated with the `SUPABASE_SERVICE_ROLE_KEY`. This client bypasses all RLS and must be strictly isolated:
```typescript
// src/lib/supabase/admin.ts
export function createSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```
**Usage:** Only call `createSupabaseAdmin()` inside Server Actions or Route Handlers where the calling user's authorization has already been verified via the regular server client. Never import this module from client components — Next.js tree-shaking will exclude it from the client bundle as long as it's only imported in server-side code paths.

### P-006: User-Level RLS (Non-Tenant Tables)
**Date:** 2026-10-01
**Pattern:** Not all tables follow the standard `agency_id = current_agency_id()` RLS template. User-level tables like `profiles` use a different pattern:
```sql
-- Any authenticated user can read (cross-tenant visibility needed)
CREATE POLICY "authenticated_can_view" ON profiles
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

-- Only the row owner can update
CREATE POLICY "owner_can_update" ON profiles
  FOR UPDATE USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- No INSERT policy — only SECURITY DEFINER triggers can create rows
```
**Usage:** Use this pattern for tables that represent user identity rather than tenant data. The key difference: no `agency_id` column, no `current_agency_id()` calls. Document the deviation from P-001 in the migration comments.

### P-007: Batch Profile Resolution via Map
**Date:** 2026-10-01
**Pattern:** When resolving display names for a list of entities (timeline entries, task lists, member lists), batch-fetch all profiles in one query and use a `Map<userId, Profile>` for O(1) lookups:
```typescript
async getProfilesByIds(userIds: string[]): Promise<Map<string, Profile>> {
  const uniqueIds = [...new Set(userIds)]; // Deduplicate
  const { data } = await this.db.from('profiles').select('*').in('id', uniqueIds);
  const map = new Map<string, Profile>();
  (data ?? []).forEach(p => map.set(p.id, p));
  return map;
}
```
**Usage:** Collect all user UUIDs from the result set first, then batch-resolve. This avoids N+1 queries when rendering timelines or member lists with 20+ entries.

### P-008: Search Vector Cascading Triggers
**Date:** 2026-10-01
**Pattern:** When a table's search vector depends on data in a related table (e.g., contact search includes phone numbers from `contact_methods`), use a cascading trigger pattern:
1. The parent table (`contacts`) has a `BEFORE INSERT OR UPDATE` trigger that builds the `tsvector` by joining the child table.
2. The child table (`contact_methods`) has an `AFTER INSERT OR UPDATE OR DELETE` trigger that touches the parent row (e.g., `UPDATE contacts SET display_name = display_name WHERE id = NEW.contact_id`), which re-fires the parent's search vector trigger.
**Usage:** Use `setweight()` to differentiate field importance (A = names, B = phones/emails). Use `'simple'` language config (not `'english'`) for Bulgarian names and phone numbers — it avoids stemming issues with non-English text.

---

## Gotchas & Pitfalls (Sprint 4)

### G-005: Backfilling Search Vectors via Identity Update
**Date:** 2026-10-01
**Problem:** After adding `search_vector` columns with `BEFORE INSERT OR UPDATE` triggers, existing rows have `NULL` search vectors because the trigger only fires on new inserts or updates.
**Root cause:** PostgreSQL triggers only fire on actual DML operations, not retroactively on existing data.
**Fix:** Use `UPDATE <table> SET id = id` to trigger a no-op update that fires the trigger on every existing row. This is simpler than writing a separate backfill SQL statement that duplicates the trigger logic.
**Prevention:** When adding trigger-maintained computed columns, always include a backfill step in the migration. The `SET id = id` trick is safe because `id` is the primary key and the value doesn't actually change.

### G-006: Supabase `inviteUserByEmail` Creates the Auth User Immediately
**Date:** 2026-10-01
**Problem:** The Sprint 4 plan assumed the `agency_memberships` row would be created *before* the user exists in `auth.users`. However, `admin.inviteUserByEmail()` creates the user in `auth.users` immediately (with `confirmed_at = null`), which fires the `handle_new_user` trigger and creates a `profiles` row.
**Root cause:** Supabase's invitation API pre-creates the auth user to generate the magic link token. The user exists but hasn't confirmed yet.
**Fix:** The invitation flow was adjusted: (1) call `inviteUserByEmail()` first to get the user ID, (2) create the `agency_memberships` row with that user ID and `status: 'invited'`. The auth callback activates the membership when the user clicks the link.
**Prevention:** When using Supabase admin APIs, test the exact sequence of side effects (trigger firing, row creation) before designing the application flow around assumptions.

