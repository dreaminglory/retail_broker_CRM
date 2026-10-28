---
name: supabase-patterns
description: BrokerCRM-specific Supabase patterns — tenant RLS template, role checks, function grants, migration checklist and pgTAP expectations. Use when writing a migration, RLS policy, database function, trigger or RPC in this repo. For general Supabase/Postgres knowledge use the official supabase skills.
---

# Supabase patterns (BrokerCRM)

General Supabase and Postgres guidance comes from the official `supabase` and
`supabase-postgres-best-practices` skills. This file only holds what is specific
to this repo. Client setup lives in `src/lib/supabase/{server,client,admin}.ts`:
read those files rather than copying code from here.

## Helpers (already exist, never redefine)

| Function | Returns | Use in policies as |
|---|---|---|
| `current_agency_id()` | the caller's active agency | `agency_id = current_agency_id()` |
| `current_user_role()` | `'owner' \| 'manager' \| 'broker'` | `current_user_role() IN ('owner','manager')` |
| `shares_agency_with(uuid)` | caller and user share an agency | user-level tables such as `profiles` |

All three are `SECURITY DEFINER STABLE SET search_path = public`. They exist so that
policies never query `agency_memberships` directly (see G-001, AD-004).

## Tenant table template

```sql
CREATE TABLE <things> (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  -- ...
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_<things>_agency_id ON <things>(agency_id);
-- plus composites for real filters, e.g. (agency_id, status)

CREATE TRIGGER set_<things>_updated_at
  BEFORE UPDATE ON <things>
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE <things> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <things> FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON <things>
  FOR SELECT USING (agency_id = current_agency_id());

CREATE POLICY "tenant_insert" ON <things>
  FOR INSERT WITH CHECK (agency_id = current_agency_id());

CREATE POLICY "tenant_update" ON <things>
  FOR UPDATE USING (agency_id = current_agency_id())
  WITH CHECK (agency_id = current_agency_id());

-- Hard delete only for owners/managers; prefer soft delete (status = 'archived').
CREATE POLICY "tenant_delete" ON <things>
  FOR DELETE USING (
    agency_id = current_agency_id()
    AND current_user_role() IN ('owner', 'manager')
  );
```

Roles are exactly `owner`, `manager`, `broker`. There is no `admin`.

## Never

- A policy that selects from `agency_memberships` (or from its own table): infinite
  recursion (G-001). Use the helpers above.
- `auth.uid()` without a subselect in a policy: write `(SELECT auth.uid())` (L-001).
- `ENABLE` without `FORCE` row level security: table owners bypass RLS, which hides
  bugs in local tests (G-002).
- Relying on the default `EXECUTE` grant. Functions in `public` have it revoked from
  `anon` and `authenticated`; grant explicitly, and never grant a `SECURITY DEFINER`
  function to `anon` (AD-028, L-009).
- Rows in `audit_log` written from app code. It is append-only and filled by triggers (AD-020).

## Functions and RPCs

```sql
CREATE OR REPLACE FUNCTION public.<name>(...)
RETURNS ... LANGUAGE plpgsql
SECURITY DEFINER            -- only when it must bypass RLS; otherwise INVOKER
SET search_path = public
AS $$ ... $$;

REVOKE EXECUTE ON FUNCTION public.<name>(...) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.<name>(...) TO authenticated;
```

A `SECURITY DEFINER` function must check tenancy and role itself
(`current_agency_id()`, `current_user_role()`), because RLS no longer protects it.
RPCs don't receive the request locale: return error codes (i18n keys), not
translated text (G-008).

Long-running work goes through a client-driven loop that returns
`{processed, remaining}` (see `import_commit_contacts`), not one big call (P-009, G-007).

## Migration checklist

1. File: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`. Never edit a migration
   that has already been applied; add a new one.
2. New table: follow the template, then **add it to the `tables_are` array in
   `supabase/tests/database/010-rls-catalog.sql`**. That test fails on any table it
   doesn't list.
3. New policy or function: add a pgTAP test for cross-tenant access (pattern:
   `020`/`021-tenant-isolation-*.sql`, `040-role-policies.sql`).
4. `npx supabase db reset` then `npm run test:db` pass.
5. Update `docs/domain-model.md` (diagram, invariants, states) in the same change.
