# BrokerCRM Technical Architecture & Engineering Runbook

> **Status:** Up to date as of Sprint 5  
> **Purpose:** A comprehensive technical guide for future developers joining the project. This document synthesizes how the data flows, how components are structured, and how the core loops were built across all sprints.


---


## 1. Stack Overview

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript (Strict mode, no `any` types)
- **Styling:** Tailwind CSS 4 + shadcn/ui + Lucide Icons
- **Database:** Supabase (PostgreSQL)
- **Validation:** Zod + React Hook Form
- **Auth:** Supabase Auth (Email/Password)
- **Tenant Isolation:** Native PostgreSQL Row-Level Security (RLS)

---

## 2. Infrastructure & Auth Foundation (Sprint 0)

Sprint 0 established the multi-tenant architecture and authentication flow.

### Tenant Isolation (RLS)
The CRM is designed as a multi-tenant SaaS. Every database table (except reference tables) contains an `agency_id` column. Cross-tenant leakage is strictly prevented at the database level using Row-Level Security.

**Key Helper:**
`current_agency_id()` is a `SECURITY DEFINER` function that bypasses RLS to safely resolve the current user's tenant context:
```sql
CREATE OR REPLACE FUNCTION current_agency_id() RETURNS UUID AS $$
  SELECT agency_id FROM agency_memberships
  WHERE user_id = (SELECT auth.uid()) AND status = 'active' LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
```

**Standard Policy Pattern:**
All tenant-scoped tables use this pattern:
```sql
CREATE POLICY "tenant_select" ON <table> FOR SELECT USING (agency_id = current_agency_id());
```

### Next.js & Supabase Client Strategy
- **Server Components & Actions:** Use `createSupabaseServer()` (from `@/lib/supabase/server`). This client reads cookies via `next/headers` and carries the user's auth context through RLS.
- **Client Components:** Use `createSupabaseBrowser()` (from `@/lib/supabase/client`).
- **Middleware:** `src/middleware.ts` forces session refreshes on every request and protects `/dashboard/*` routes.

### Signup Flow
When a user signs up, three things happen sequentially:
1. `auth.signUp()` creates the Supabase user.
2. An `agency` record is created.
3. An `agency_membership` is created linking the user to the agency as an `owner`.
*(Default pipeline stages and lead sources are seeded into the new agency).*

---

## 3. Core Domain Layer (Sprint 1)

Sprint 1 delivered the domain entities that power the CRM's operational loop: `Inquiry → Contact → Opportunity → Task`.

### Project Structure Pattern
Each domain entity lives in `src/domain/<entity>/` and follows a strict separation of concerns:
- `types.ts` — TypeScript interfaces (e.g., `Opportunity`, `OpportunityStatus`).
- `validation.ts` — Zod schemas for input validation (e.g., `createOpportunitySchema`).
- `repository.ts` — Database query layer (CRUD operations using the Supabase client).
- `service.ts` — Business logic layer (orchestrates repositories, enforces rules).

### Entities & Data Flow
1. **Inquiries (`inquiries`)**: Immutable inbound lead events (e.g., phone calls, web forms). Once linked to a contact and converted to an opportunity, the original inquiry is preserved.
2. **Contacts (`contacts` & `contact_methods`)**: Durable records of people or organizations. Contact methods (phones/emails) are normalized. 
3. **Opportunities (`opportunities` & `opportunity_participants`)**: The core commercial pursuit (buyer, seller, landlord, tenant). 
4. **Tasks (`tasks`)**: Follow-up actions. Changing or completing tasks updates the denormalized `next_action_at` field on the Opportunity.
5. **Configuration (`lead_sources` & `stages`)**: Agency-configurable taxonomies for tracking lead origin and pipeline progression.

### Server Actions
All database mutations occur via Next.js Server Actions (e.g., `src/app/(dashboard)/opportunities/actions.ts`). Server Actions construct the server-side Supabase client, perform Zod validation, call the domain `Service`, and then trigger `revalidatePath()`.

---

## 4. The Operational Daily Loop (Sprint 2)

Sprint 2 built the application workflows on top of the domain layer, focusing on broker daily routines and manager oversight.

### Enhanced Task Workflows
Tasks drive the CRM. We implemented a "soft-enforcement" completion flow:
- When a broker completes a task, they are prompted to record an **Outcome** (what happened) and schedule the **Next Action** (what happens next).
- Doing this in one transaction keeps the pipeline moving and ensures the opportunity's `next_action_at` is always accurate.

### The Today Screen (`/today`)
The central hub for brokers, querying real-time exceptions and due work:
1. **Overdue Tasks**: Past-due tasks sorted by age.
2. **New Inquiries**: Unhandled inbound leads assigned to the broker.
3. **Due Today**: Tasks scheduled for the current day.
4. **Coming Up**: Tasks due in the next 3 days.
5. **At Risk**: Active opportunities that have *no pending tasks scheduled* (i.e., forgotten deals).

### Duplicate Contact Detection (`pg_trgm`)
To maintain data hygiene:
- We enabled PostgreSQL's `pg_trgm` extension.
- Added trigram indexes on `contacts.display_name` and GIN indexes on `contact_methods.value`.
- During contact creation, `findPotentialDuplicates()` checks for exact email/phone matches and fuzzy name matches, presenting a modal to the user before creating a duplicate.

### Contact Merge Workflow
When duplicates occur, owners can merge them:
- **Archive-Loser Pattern**: The chosen "winner" absorbs all relational data (opportunities, tasks, inquiries, non-duplicate contact methods).
- The "loser" is soft-deleted (`status = 'archived'`).
- A `merge_history` row captures a complete JSONB snapshot of the loser for audit trailing.

### Manager Exceptions Dashboard (`/exceptions`)
Role-gated (owners and managers only) dashboard that aggregates agency-wide bottlenecks:
- Unassigned Inquiries
- Overdue tasks grouped by broker
- Stale Opportunities (> 7 days since last update)
- Workload Distribution (Active Deals vs. Pending Tasks per broker)

---

## 5. Development Guidelines & Gotchas

1. **RLS Subquery Recursion**: NEVER write an RLS policy that queries the same table. Always use a `SECURITY DEFINER` helper function like `current_agency_id()`.
2. **Phone Normalization**: Phone numbers are stored in E.164 format. The UI accepts local Bulgarian formats and normalizes them via `normalizePhone()` before saving to prevent duplicate mismatches.
3. **UI State Updates**: Avoid synchronous React state updates inside `useEffect` (Next.js 15 is strict and will throw HMR errors). Use `setTimeout(..., 0)` if you must break the event loop.
4. **Data Isolation Tests**: Always assume the user could try to spoof IDs. Rely on Server Action checks and RLS to guarantee they can only touch their agency's data.

---

## 6. Sprint 3 Architecture (Completed)

Sprint 3 focused on historical context, accountability, and unifying the timeline for the broker. Key architectural additions include:

### Notes & Polymorphic Attachments
- **Table Design**: We created a single `notes` table that attaches to either a contact or an opportunity, enforced via a `CHECK (contact_id IS NOT NULL OR opportunity_id IS NOT NULL)` constraint.
- **Features**: Notes support pinning (`is_pinned`) and are tightly integrated with the timeline, displaying the author resolving to `auth.users`.

### System Audit Logging (Trigger-Based)
- **Append-Only Architecture**: The `audit_log` table enforces immutability via RLS (no `UPDATE` or `DELETE` policies exist).
- **PostgreSQL Triggers**: Instead of bloating the Next.js API layer with audit logic, we implemented `AFTER UPDATE` triggers directly on the `opportunities` and `contacts` tables. 
- **Security Definer Context**: Because users cannot manually INSERT into `audit_log` from the client, the trigger functions run as `SECURITY DEFINER` and derive the actor via `(SELECT auth.uid())` natively in PostgreSQL.

### Unified Activity Timeline
- **Aggregation Strategy (AD-019)**: Rather than writing every system event into one massive activity table (event sourcing), we fetch heterogeneous entities (`notes`, `tasks`, `audit_log`, `inquiries`) concurrently via `Promise.all()` in the `TimelineService`.
- **Discriminated Union Types**: We map the varying database schemas into a unified `TimelineEntry` TypeScript discriminated union, which is then sorted chronologically in memory. 
- **Polymorphic UI rendering**: The frontend `ActivityTimeline` component delegates the rendering of each row to specific sub-components based on the `type` discriminator.

### Multi-Dimensional Contact Linking
- We updated the Contact detail page to display a comprehensive list of all linked opportunities.
- **Data aggregation**: Opportunities are fetched by checking both `opportunities.primary_contact_id` AND `opportunity_participants.contact_id` to ensure all active and historical involvements are surfaced.
- **Sorting Logic**: Terminal statuses (Won, Lost, Nurture) are cleanly grouped at the bottom, while active pipelines take visual priority.

---

## 7. Sprint 4 Architecture (Completed)

Sprint 4 focused on giving agencies real user management, including team invitations, role assignments, real name resolution across the system, and platform hardening features like global search. Key architectural additions include:

### User Profiles & Synchronization
- **`public.profiles` Table (AD-023)**: Created a public profiles table separate from `auth.users` to store `display_name` and `avatar_url`. This table intentionally lacks an `agency_id` as a user's identity transcends any single agency.
- **Trigger-Based Sync**: A PostgreSQL `AFTER INSERT` trigger on `auth.users` automatically provisions a profile row. The trigger uses `SECURITY DEFINER` and writes to the `public.profiles` schema to ensure stability.
- **Author Resolution**: "Team Member" placeholders across the application (Timeline, Notes, Tasks, Audit Logs) were replaced with real names by batch-resolving UUIDs against the `profiles` table.

### Team Management & Invitation Flow
- **Magic Link Invitations (AD-024)**: Leveraged Supabase Auth's `admin.inviteUserByEmail()` for inviting brokers via email. This required instantiating a Supabase admin client (`src/lib/supabase/admin.ts`) using the `SUPABASE_SERVICE_ROLE_KEY` exclusively within Server Actions.
- **Auth Callback Logic**: The `/auth/callback` route was enhanced to handle `type=invite` tokens differently than standard signups, redirecting invited users to complete their profile setup and transitioning their `agency_memberships` status from `invited` to `active`.
- **Role & Access Controls**: Expanded `agency_memberships` to robustly handle role changes (broker, manager, owner) and deactivation functionality, strictly gated by owner-only RLS policies.

### Global Search & Platform Hardening
- **PostgreSQL Full-Text Search (AD-026)**: Implemented a server-side global search endpoint utilizing PostgreSQL's native `to_tsvector`/`to_tsquery` alongside existing trigram matching (`pg_trgm`).
- **Trigger-Maintained Vectors**: Search vectors (`search_vector` column of type `tsvector`) on `contacts` and `opportunities` are automatically kept in sync via `BEFORE INSERT OR UPDATE` triggers.
- **Command Palette UI**: Added a ⌘K / Ctrl+K triggered search overlay allowing users to instantly find contacts, opportunities, and inquiries across their agency.
- **Settings Consolidation**: Organized the settings area into a clean sidebar-navigation structure grouping Profile, Team, Lead Sources, and Pipeline configurations.

---

## 8. Sprint 5 Architecture (Completed)

Sprint 5 focused on tenant isolation hardening, localization, and robust CSV imports.

### Security Hardening & Isolation Suite
- **Atomic Provisioning (AD-027)**: Agency creation, owner membership insertion, and default seeding are now handled in a single `SECURITY DEFINER` RPC to prevent partial signups.
- **Function Privilege Grants (AD-028)**: Removed default `EXECUTE` permissions from public schema functions for `anon` and `authenticated` roles, enforcing explicit `GRANT` only for required endpoints.
- **pgTAP Test Suite**: Introduced a comprehensive PostgreSQL testing suite using `pgTAP` and `supabase test db` to enforce tenant isolation and catalog rules (e.g. ensuring every table has RLS enabled and an `agency_id` column).

### Localization & i18n
- **next-intl (AD-031)**: We adopted `next-intl` in "without i18n routing" mode, using the `NEXT_LOCALE` cookie based on the `profiles.locale` column.
- **Error Mapping (AD-032 & AD-033)**: All Zod validation messages and Server Action exceptions are now returned as translation keys (`DomainError.code`), ensuring the client component renders the error in the correct language via `useTranslations`.
- **Dynamic Entity Translation**: Hardcoded system stages and UI fallbacks (e.g., "Unassigned") were migrated to a dynamic translation lookup. A custom hook `useStageTranslation` evaluates if a stage name matches a default system stage (e.g., "New") and translates it dynamically, while preserving custom user-defined stage names.
- **Global Formatting**: Custom formatting wrappers were deprecated in favor of `next-intl`'s `useFormatter` (`format.dateTime`, `format.number`) to ensure strict locale adherence across all dates and currency operations.

### Next.js 16 Proxy Migration
- **Proxy Pattern (AD-030)**: Next.js 16 deprecated traditional middleware for session updates. We implemented `src/proxy.ts` to handle Supabase token refreshing and basic redirects, keeping full authorization checks in the Server Components (layouts).

### Import Pipeline Architecture
- **Chunking Pattern (AD-034)**: To bypass Vercel's 1MB payload limits and timeouts for 5,000-row CSV files, parsing is done client-side. The data is chunked and staged into `import_rows` incrementally via Server Actions.
- **Validation & Commit**: Once staged, server-side validation classifies duplicates and normalizes phones. A Postgres RPC (`import_commit_contacts`) iterates over valid rows, inserting atomic records with savepoints, returning `{processed, remaining}` to a client-driven loop.
- **Idempotency (AD-035)**: Inquiries utilize `(agency_id, source_id, external_ref)` as a unique index to allow safe re-importing of historical portal exports without duplication.
- **Revert (AD-036)**: Owners can undo mistakes via a soft-revert bounded to a 7-day window. The RPC uses a CTE (`contact_check`) to explicitly compute whether a contact can be safely deleted (no manual tasks, notes, or linked inquiries).

---

*This document is a living architecture guide and should be updated as future Sprints (CSV Import, etc.) are implemented.*

