# Architecture Decision Records (ADR)

> Decisions are recorded here as they are made during development.
> Each entry follows the format: context, decision, rationale, consequences.
> Referenced by ID (e.g., "see AD-004") in code comments and commit messages.

---

## Sprint 0 Decisions

### AD-001: Record Visibility — Agency-Wide
**Date:** 2026-08-07 | **Status:** Accepted

**Context:** Need to decide whether records are agency-visible, team-scoped, or private to brokers.
**Decision:** Agency-visible — all members of an agency can see all records.
**Rationale:** Simplest RLS, promotes collaboration, aligns with "agency owns the data."
**Consequences:** If pilot agencies need privacy, we'll add scoping later. For now, one simple RLS policy per table.

---

### AD-002: Tech Stack — Next.js 15 + Supabase
**Date:** 2026-08-07 | **Status:** Accepted

**Context:** Evaluated 5 tech stacks across 10 criteria. See `tech-stack-evaluation.md`.
**Decision:** Next.js 15 (App Router) + Supabase + Tailwind CSS + shadcn/ui + Vercel.
**Rationale:** Native RLS, SQL-first for DE founder, best AI support, simplest ops, lowest cost.
**Consequences:** Tied to Supabase for auth/storage/DB (acceptable — standard PostgreSQL underneath).

---

### AD-003: Localization — English First
**Date:** 2026-08-07 | **Status:** Accepted

**Context:** Product targets Bulgarian market but building with AI assistance in English is faster.
**Decision:** Build in English, localize before pilot.
**Rationale:** Avoids i18n infrastructure complexity during the foundation slice.
**Consequences:** Must extract all user-facing strings cleanly for later translation.

---

### AD-004: RLS Pattern — SECURITY DEFINER Helper Functions
**Date:** 2026-08-27 | **Status:** Accepted

**Context:** RLS policies on `agency_memberships` that queried `agency_memberships` caused infinite recursion. PostgreSQL evaluates RLS on every table access, including subqueries within policies.
**Decision:** Create `current_agency_id()` and `current_user_role()` as `SECURITY DEFINER` functions that bypass RLS to resolve the current user's tenant context.
**Rationale:** SECURITY DEFINER runs as the function owner (superuser), bypassing RLS. Marking as `STABLE` allows caching within a query. Wrapping `auth.uid()` in `(SELECT ...)` prevents per-row re-evaluation.
**Consequences:** All future RLS policies use `current_agency_id()` instead of inline subqueries. This is now the standard pattern — see `supabase-patterns` skill.

---

## Sprint 1 Decisions

### AD-005: Minimal Task Entity in Sprint 1
**Date:** 2026-09-01 | **Status:** Accepted

**Context:** The BRD originally placed Tasks in Sprint 2, but the domain model requires every active Opportunity to have a next action (Task) with a due date. Without tasks, Opportunities would be incomplete — the Today Screen (Sprint 2) depends on task data existing.
**Decision:** Pull a minimal `tasks` table with basic CRUD into Sprint 1. Full task workflows (completion with mandatory outcome, task sequences, action plans) remain in Sprint 2.
**Rationale:** Ensures the data model is complete enough that Opportunity → Task → Next Action relationship works from Sprint 1. Sprint 2 builds the UI and business logic on top.
**Consequences:** Sprint 1 includes `tasks` table, basic create/update/complete actions, and a simple task list on Opportunity detail. Sprint 2 adds the Today Screen, overdue tracking, completion rules, and task-driven workflows.

---

### AD-006: Pipeline Configurability Deferred to Sprint 2
**Date:** 2026-09-01 | **Status:** Accepted

**Context:** Should agencies be able to customize pipeline stages from Sprint 1, or use a fixed default set?
**Decision:** Ship Sprint 1 with a `stages` table seeded with a default pipeline. No pipeline management UI in Sprint 1 — agencies use the default stages (New → Attempting Contact → Qualified → Active → Viewing → Offer → Negotiation → Won → Lost → Nurture). Pipeline configurability UI is Sprint 2.
**Rationale:** The data model uses proper tables (not enums) so we don't need a migration when configurability is added. But the UI complexity of stage management is deferred.
**Consequences:** Sprint 1 seed migration creates default stages. Sprint 2 adds Settings → Pipeline configuration UI. The schema is ready for configurability — only the UI is deferred.

---

### AD-007: LeadSource — Fully Configurable from Sprint 1
**Date:** 2026-09-01 | **Status:** Accepted

**Context:** Lead sources need to be configurable per the business description. Options: (a) full management UI, (b) seed list with inline-add only.
**Decision:** Full LeadSource management — agencies can add, edit, and deactivate lead sources from Sprint 1. Seeded defaults are provided but fully editable.
**Rationale:** Source attribution is critical to the CRM's value proposition. Agencies have different channels and must be able to name them. A settings page for lead sources is relatively simple.
**Consequences:** Sprint 1 includes a Settings → Lead Sources page, plus inline source selection on Inquiry and Opportunity forms. Seed data provides sensible defaults.

---

### AD-008: Contact Types — Person and Organization
**Date:** 2026-09-01 | **Status:** Accepted

**Context:** Should the `contacts` table support both Person and Organization types, or start with Person only?
**Decision:** Support both from Sprint 1. The `type` column distinguishes them. Person contacts have `first_name` + `last_name`; Organization contacts use `company_name` as the primary name. A Person can optionally have a `company_name` for affiliation.
**Rationale:** Bulgarian real estate involves both individual buyers/sellers and corporate entities (developers, investment companies). Supporting both avoids a future migration that restructures the core entity.
**Consequences:** Contact forms need conditional fields based on type. `display_name` is generated: `first_name + last_name` for persons, `company_name` for organizations.

---

### AD-009: All Four Opportunity Types in Sprint 1
**Date:** 2026-09-01 | **Status:** Accepted

**Context:** The domain model lists buyer, seller, landlord, tenant as opportunity types. Could start with buyer/seller only.
**Decision:** Include all four types from Sprint 1.
**Rationale:** Bulgarian agencies handle rentals alongside sales. Limiting to buyer/seller would force workarounds and create bad data. The implementation cost of four types vs. two is minimal.
**Consequences:** Opportunity forms include all four types. Pipeline stages are shared across types for now (type-specific pipelines can come in Sprint 2 with configurability).

---

### AD-010: Phone Format — Free Text for Now
**Date:** 2026-09-01 | **Status:** Accepted

**Context:** The domain model skill specifies E.164 format (+359XXXXXXXXX). Should we enforce this strictly?
**Decision:** Accept free-text phone numbers in Sprint 1. No strict E.164 validation.
**Rationale:** Bulgarian users enter phones in various formats (0888 123 456, +359 888 123 456, 088-812-3456). Strict validation creates friction during data entry and import. Normalization can be added later as a background job or on-save hook.
**Consequences:** Phone fields accept any text. A future sprint can add a normalization function and display formatting. Duplicate detection (Sprint 2) may need fuzzy phone matching.

---

### AD-011: Duplicate Contact Detection Deferred to Sprint 2
**Date:** 2026-09-01 | **Status:** Accepted

**Context:** The business description emphasizes duplicate detection as critical. Should Sprint 1 include duplicate suggestions when creating contacts?
**Decision:** Defer to Sprint 2. Sprint 1 has a unique constraint on `(agency_id, type, value)` in `contact_methods` to prevent exact duplicate contact methods, but no proactive duplicate suggestion UI.
**Rationale:** Good duplicate detection requires fuzzy phone matching, name similarity, and a suggestion UI — significant complexity. Sprint 1 focuses on getting the core CRUD loop working. The unique constraint prevents the worst duplicates.
**Consequences:** Sprint 2 adds: duplicate suggestion modal on contact create, merge workflow, merge history table. The `contact_methods` unique constraint provides basic protection until then.

---

### AD-012: Phone Format — E.164 Enforced (Reverses AD-010)
**Date:** 2026-09-05 | **Status:** Accepted

**Context:** AD-010 deferred phone format enforcement to avoid friction during data entry. On review, free-text storage was reconsidered: the unique constraint on `(agency_id, type, value)` in `contact_methods` only works correctly if values are consistently formatted — `0888123456` and `+359888123456` are the same number but would create two distinct DB rows.
**Decision:** Enforce E.164 normalization at the validation layer (not the DB layer). Accept any common Bulgarian format from the UI; normalize to `+359XXXXXXXXX` before saving. Viber and WhatsApp use the same phone normalization. Emails are lowercased on save.
**Rationale:** Normalization at the application layer (Zod transform + `normalizePhone()` utility) avoids a DB-level constraint change while ensuring the deduplication logic in `contact_methods` works correctly. Users still type numbers naturally — the normalization is invisible to them.
**Consequences:** `src/domain/contacts/phone.ts` provides `normalizePhone()`. Server Actions call `normalizeContactMethodValue()` before all inserts/updates to `contact_methods`. The DB schema is unchanged. Existing free-text data (if any) will need a one-time normalization backfill if agencies had data before this change.

---

## Sprint 2 Decisions

### AD-013: Task Type Column vs Table
**Date:** 2026-09-23 | **Status:** Accepted

**Context:** Need to categorize tasks (call, email, viewing, etc.). Should we use a separate lookup table or a simple text column with a CHECK constraint?
**Decision:** Task type is a TEXT column with a CHECK constraint.
**Rationale:** The set of task types is small and relatively fixed. Avoiding a separate table prevents unnecessary JOINs and keeps the schema simple.

---

### AD-014: Soft Task Completion Enforcement
**Date:** 2026-09-23 | **Status:** Accepted

**Context:** The domain model says completing a task should require an outcome and a next step.
**Decision:** Implement "soft" enforcement. The UI will prominently prompt the user to record an outcome and schedule a next action, but it will not strictly block completion if they skip it.
**Rationale:** Hard enforcement can frustrate users during initial adoption. We encourage the right behavior without breaking their workflow.

---

### AD-015: Basic Contact Merge Workflow (Archive Loser)
**Date:** 2026-09-23 | **Status:** Accepted

**Context:** When merging duplicate contacts, do we build a complex field-by-field merge UI, or a basic "pick winner, archive loser" flow?
**Decision:** Basic approach. The user selects a winner; all relational data (opportunities, inquiries, tasks, contact methods) is transferred to the winner. The loser is archived, and a `merge_history` record is created storing the loser's full pre-merge state.
**Rationale:** Vastly simpler to implement for Sprint 2 while still solving the business problem safely. The history record preserves an audit trail.

---

### AD-016: Manager Dashboard as Role-Gated Route
**Date:** 2026-09-23 | **Status:** Accepted

**Context:** Need an exception dashboard for managers.
**Decision:** Implement as a separate `/exceptions` route, protected by a role guard checking for `owner` or `manager`.
**Rationale:** Keeps the operational focus on exceptions rather than full analytics. Role checks in a Server Component ensure security.

---

### AD-017: pg_trgm for Fuzzy Contact Name Matching
**Date:** 2026-09-23 | **Status:** Accepted

**Context:** Need to detect similar contact names during creation to prevent duplicates.
**Decision:** Use the PostgreSQL `pg_trgm` extension and a trigram index on the `display_name` column.
**Rationale:** Native to Postgres, no external dependency required. Sufficient for pilot-scale data size and provides good enough fuzzy matching for Bulgarian and Latin names.

---

### AD-018: Dropping Unique Constraint on Contact Methods
**Date:** 2026-09-25 | **Status:** Accepted

**Context:** AD-011 noted a unique constraint on `(agency_id, type, value)` in `contact_methods` to prevent exact duplicates. However, with the introduction of the duplicate suggestion modal in Sprint 2, users are explicitly given the option to bypass the duplicate check ("Create anyway") when they legitimately need to share a phone number or email across contacts (e.g., spouses, colleagues).
**Decision:** Drop the `uq_contact_method_per_agency` constraint from the database.
**Rationale:** The UI-level duplicate detection handles the core business requirement of preventing *accidental* duplicates, while dropping the strict database constraint allows for intentional sharing of contact details across different records.
**Consequences:** Multiple contacts within an agency can now share the same exact email or phone number if the user confirms the creation. The duplicate suggestion modal is the primary defense against duplicates.

---

## Sprint 3 Decisions

### AD-019: Notes vs. Activity — Separate Table or Unified?
**Date:** 2026-09-28 | **Status:** Accepted

**Context:** Need an Activity Timeline that merges notes, tasks, stage changes, assignments, etc. into a unified chronological view.
**Decision:** Keep structured domain records (tasks, inquiries, audit logs) in separate tables. Add a `notes` table for user-authored content. The timeline is an aggregation view generated at read-time, not a single oversized activity storage table.
**Rationale:** Keeps the domain boundaries clean and matches the business description expectation.

---

### AD-020: Audit Log — Database Trigger vs. Application-Layer
**Date:** 2026-09-28 | **Status:** Accepted

**Context:** AC-09 requires tracing ownership, stage, and assignment changes.
**Decision:** Use a PostgreSQL `AFTER UPDATE` trigger on `opportunities` and `contacts` that writes to an `audit_log` table.
**Rationale:** Trigger-based auditing is tamper-proof (even direct DB edits are captured) and aligns with existing trigger patterns in the project.
**Consequences:** The application reads from `audit_log` but does not mutate it.

---

### AD-021: Notes — Contact-Level, Opportunity-Level, or Both?
**Date:** 2026-09-28 | **Status:** Accepted

**Context:** Both contacts and opportunities need notes, currently stored as a flat text field on both tables.
**Decision:** A single `notes` table with `contact_id` and `opportunity_id` columns. A note must have at least one set.
**Rationale:** Unified structure that easily surfaces opportunity notes on the contact's timeline.

---

### AD-022: Deferring Public User Profiles for Timeline Author Mapping
**Date:** 2026-09-30 | **Status:** Accepted

**Context:** The timeline needs to display the author of notes, tasks, and audit events. However, `auth.users` is not joinable directly from the `public` schema via PostgREST.
**Decision:** Temporarily hardcode "Team Member" in the timeline UI and defer the creation of a `public.profiles` table (which would sync with `auth.users`) to a later sprint focused on Member Management. The database successfully stores the user `UUID`, so no data is lost.
**Rationale:** Building the `public.profiles` architecture out of sequence would stall core CRM development. It's better to build user profiles holistically when implementing agency invitations and role management.
**Consequences:** The UI will read "Team Member" for all actions until the `public.profiles` feature is built, after which past timeline entries will automatically display correct names based on the stored `UUID`s.

---

## Sprint 4 Decisions

### AD-023: User Profiles — `public.profiles` Sync Strategy
**Date:** 2026-10-01 | **Status:** Accepted

**Context:** AD-022 deferred `public.profiles` to the Team Management sprint. We need to decide how to keep `profiles` in sync with `auth.users` and whether `profiles` should be tenant-scoped.
**Decision:** Create a `public.profiles` table (with `id` as PK referencing `auth.users`) populated via a PostgreSQL `AFTER INSERT` trigger on `auth.users`. The table intentionally has **no `agency_id`** because a user's identity transcends any single agency. RLS allows any authenticated user to SELECT (needed for cross-agency colleague resolution), but only the row owner can UPDATE.
**Rationale:** The trigger-on-`auth.users` pattern ensures profiles are always created, even for users who are invited but haven't finished onboarding. Having no `agency_id` keeps profiles orthogonal to tenancy — the `agency_memberships` table already handles that relationship.
**Consequences:** Every JOIN against `auth.users` for display names is replaced by a JOIN against `public.profiles`. This is the first table in the system that intentionally breaks the standard P-001 RLS template (no `agency_id`, no `current_agency_id()` check). The INSERT policy was also dropped — only the `SECURITY DEFINER` trigger can create profiles, preventing unauthorized inserts from the API.

---

### AD-024: Invitation Flow — Supabase Admin API with Magic Link
**Date:** 2026-10-01 | **Status:** Accepted

**Context:** Owners need to invite brokers. Options: (a) magic link via Supabase `admin.inviteUserByEmail()`, (b) custom invitation code system, (c) shareable link.
**Decision:** Use Supabase Auth's `admin.inviteUserByEmail()` called from a Server Action via a dedicated admin client (`src/lib/supabase/admin.ts`). The invitation creates an `agency_memberships` row with `status: 'invited'` immediately. When the invited user clicks the magic link and hits the auth callback, all their `invited` memberships are activated to `active`.
**Rationale:** Supabase's built-in invitation system handles email delivery, token generation, and link expiry. No custom token infrastructure needed.
**Consequences:** Requires `SUPABASE_SERVICE_ROLE_KEY` in server-side environment variables. The admin client must never be exposed to the client bundle. The auth callback route (`src/app/(auth)/auth/callback/route.ts`) was enhanced to handle invitation activation after token exchange.

---

### AD-025: Notification Architecture — Decision Only (No Implementation)
**Date:** 2026-10-01 | **Status:** Accepted

**Context:** BRD §259 lists notifications as deferred pending a product decision on channels and timing.
**Decision:** Email-only for the pilot via Resend. Events: (1) task due reminder at 9 AM, (2) inquiry assigned (immediate), (3) opportunity reassigned (immediate), (4) overdue task escalation (daily digest). Mechanism: Supabase Edge Functions triggered by `pg_cron` for scheduled notifications, database triggers for immediate.
**Rationale:** Recording the decision now enables Sprint 5+ implementation without revisiting the product discussion. Email-only keeps pilot scope manageable.
**Consequences:** No implementation in Sprint 4. The `profiles` table can later hold per-user notification preferences.

---

### AD-026: Global Search — PostgreSQL Full-Text Search with Weighted Vectors
**Date:** 2026-10-01 | **Status:** Accepted

**Context:** Pilot agencies need to search across contacts, opportunities, and inquiries from any screen. Options: (a) PostgreSQL FTS, (b) external search service (Algolia/Meilisearch), (c) client-side filtering.
**Decision:** Server-side search using PostgreSQL `tsvector` columns with `setweight()` for relevance ranking, maintained by `BEFORE INSERT OR UPDATE` triggers. Combined with `pg_trgm` (already enabled in Sprint 2). Searches are parallelized across entity types via `Promise.all()`.
**Rationale:** No external service needed at pilot scale. PostgreSQL's built-in capabilities are sufficient for hundreds to low thousands of records per agency.
**Consequences:** Added `search_vector tsvector` columns to `contacts`, `opportunities`, and `inquiries`. Contact search vectors include contact method values (phone/email) by joining `contact_methods` in the trigger. A cascading trigger on `contact_methods` updates the parent contact's search vector when methods change. Backfill done via `UPDATE ... SET id = id` to fire the triggers on existing rows.

---

_New decisions will be added as they are made during development._
