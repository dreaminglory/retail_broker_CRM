---
name: learnings-and-decisions
description: Living knowledge base of best practices, patterns, and architecture decisions discovered during development. Check this skill when making decisions that might have been encountered before, or when starting a new sprint. Update this file whenever a significant lesson is learned or a decision is made.
---

# Learnings & Decisions — Living Knowledge Base

This file is a **self-improving reference**. It accumulates best practices, gotchas,
and architecture decisions discovered during development. Every new chat session
can reference this to avoid repeating mistakes.

## How to Use This File
- **Read** this before starting work on a new feature area
- **Update** this after discovering a gotcha, making a decision, or finding a better pattern
- **Reference** entries by their ID (e.g., "see L-003") in commit messages or code comments

---

### AD-001: Record Visibility — Agency-Wide
**Date:** 2026-08-07
**Decision:** All records visible to all agency members (no team/private scoping)
**Rationale:** Simplest RLS model, promotes collaboration, aligns with "agency owns the data"
**Revisit if:** Pilot agencies request private contacts or team-scoped opportunities

### AD-002: Tech Stack — Next.js 15 + Supabase
**Date:** 2026-08-07
**Decision:** Next.js 15 (App Router) + Supabase (PostgreSQL + RLS + Auth)
**Rationale:** Best multi-tenant support (native RLS), SQL-first for DE founder, best AI support, lowest cost, simplest ops
**Alternatives rejected:** Prisma (no RLS), T3 (too complex), SvelteKit (smaller ecosystem), Remix (uncertain roadmap)

### AD-003: Localization Strategy — English First
**Date:** 2026-08-07
**Decision:** Build in English, localize to Bulgarian before pilot deployment
**Rationale:** Avoids i18n complexity slowing foundation slice development
**Implementation:** Use a string extraction pattern that makes future i18n straightforward

### AD-004: RLS Pattern — SECURITY DEFINER Helper Functions
**Date:** 2026-08-27
**Decision:** `current_agency_id()` and `current_user_role()` as `SECURITY DEFINER` + `STABLE` functions
**Rationale:** Inline subqueries on `agency_memberships` caused infinite RLS recursion. SECURITY DEFINER bypasses RLS; STABLE allows within-query caching; `(SELECT auth.uid())` prevents per-row re-evaluation.
**Rule:** All RLS policies must use `current_agency_id()` — never inline subqueries.

### AD-005: Minimal Task Entity in Sprint 1
**Date:** 2026-09-01
**Decision:** Pull a minimal `tasks` table into Sprint 1 (basic CRUD only). Full completion workflows, action plans, and Today Screen are Sprint 2.
**Rationale:** Opportunity → Task → next_action_at relationship must exist for the data model to be complete.

### AD-006: Pipeline Stages — Seeded Defaults, Configurability in Sprint 2
**Date:** 2026-09-01
**Decision:** Ship with seeded default pipeline stages. No management UI in Sprint 1.
**Rationale:** Schema uses proper tables (not enums), so configurability can be added without migration. UI complexity deferred.

### AD-007: LeadSource — Fully Configurable from Sprint 1
**Date:** 2026-09-01
**Decision:** Full LeadSource CRUD in Sprint 1 (agencies can add/edit/deactivate). Seed defaults provided.
**Rationale:** Source attribution is core CRM value. Settings → Lead Sources page is relatively simple to build.

### AD-008: Contact Types — Person and Organization from Sprint 1
**Date:** 2026-09-01
**Decision:** Both Person and Organization contact types supported. Person: first+last name. Org: company_name. Person can have optional company_name for affiliation.
**Rationale:** Bulgarian agencies deal with both individuals and corporate entities. Avoiding a restructuring migration later justifies the upfront complexity.

### AD-009: All Four Opportunity Types in Sprint 1
**Date:** 2026-09-01
**Decision:** buyer / seller / landlord / tenant — all from Sprint 1.
**Rationale:** Limiting to buyer/seller would force workarounds for rental deals. Four types vs. two costs almost nothing to implement.

### AD-010: Phone Format — Free Text (Superseded by AD-012)
**Date:** 2026-09-01 | **Status:** Superseded
**Decision:** Accept free-text phone numbers.
**Superseded by:** AD-012.

### AD-011: Duplicate Contact Detection Deferred to Sprint 2
**Date:** 2026-09-01
**Decision:** No proactive duplicate suggestion UI in Sprint 1. Unique constraint on `(agency_id, type, value)` in `contact_methods` provides basic protection.
**Sprint 2 scope:** Fuzzy matching suggestion modal + merge workflow.

### AD-012: Phone Format — E.164 Enforced at Application Layer (Reverses AD-010)
**Date:** 2026-09-05
**Decision:** Normalize all phone-type contact methods to E.164 (`+359XXXXXXXXX`) before DB insert. Validation in Zod schema; normalization in `normalizePhone()` / `normalizeContactMethodValue()`. DB schema unchanged.
**Rationale:** The unique constraint on `contact_methods(agency_id, type, value)` only works if values are consistently formatted. Free-text would let `0888123456` and `+359888123456` coexist as separate rows for the same number.

### AD-027: Atomic Tenant Provisioning
**Date:** 2026-10-05
**Decision:** Agency creation and owner provisioning is a single atomic SECURITY DEFINER RPC.
**Rationale:** Prevents partial signups and hardens security.

### AD-028: Explicit Privilege Grants on Functions
**Date:** 2026-10-05
**Decision:** Revoke all EXECUTE permissions on public functions by default, explicitly GRANT only as needed.
**Rationale:** Least privilege; prevents anon from calling internal helpers.

### AD-029: Profiles Table Scope
**Date:** 2026-10-05
**Decision:** Restrict profile visibility to self + colleagues.

### AD-030: Next 16 Proxy Strategy
**Date:** 2026-10-06
**Decision:** Use `src/proxy.ts` for Supabase session refresh instead of Next 15 middleware.

### AD-031: i18n Strategy
**Date:** 2026-10-06
**Decision:** `next-intl` without i18n routing, using NEXT_LOCALE cookie.

### AD-032: Validation Messages as Keys
**Date:** 2026-10-06
**Decision:** Zod schemas return i18n keys, client translates them.

### AD-034: Import Pipeline Architecture
**Date:** 2026-10-07
**Decision:** Chunked CSV parsing on client, batched staging, server-side atomic commit via RPC.

### AD-037: Currency Standardization
**Date:** 2026-10-07
**Decision:** EUR is default, BGN deprecated.

### AD-038: Deal Terminology
**Date:** 2026-10-07
**Decision:** "Сделка" (Deal) instead of "Възможност".

---

## Best Practices Discovered

### L-007: Catalog Guard Test
**Date:** 2026-10-05
**Pattern:** Ensure every new table gets tested for RLS.
**Usage:** `010-rls-catalog.sql` automatically checks every table in the `public` schema for `agency_id` and `relforcerowsecurity`. Never merge a table without it.

### L-008: Explicit GRANT Rule
**Date:** 2026-10-05
**Pattern:** Supabase grants EXECUTE to anon/authenticated by default on new functions.
**Usage:** After creating a function, always `REVOKE EXECUTE ON FUNCTION fn FROM PUBLIC, anon, authenticated;` and then explicitly `GRANT EXECUTE ON FUNCTION fn TO authenticated;` if it is an RPC.

---

## Best Practices Discovered

### L-001: Double-Layer Tenant Scoping
**Date:** 2026-09-01
**Context:** Writing repositories for all domain entities.
**Learning:** Always include `agencyId` in repository WHERE clauses *in addition to* relying on RLS. RLS is the safety net; the explicit `.eq('agency_id', agencyId)` is the first line of defence. This matters especially in Server Actions where the Supabase client is the anon client scoped to the user's session.
**Impact:** Every `findAll`, `findById`, `update`, `delete` call in every repository includes `.eq('agency_id', agencyId)`.

### L-002: Store `db` on the Service, Not Just the Repository
**Date:** 2026-09-05
**Context:** `InquiryService.convert()` needed to insert contacts and contact_methods directly (not via ContactRepository) to avoid coupling issues during the atomic convert flow.
**Learning:** When a service needs to do raw DB operations beyond what its own repository exposes, store `this.db = db` directly on the service. Do NOT access private repository internals via `(repo as unknown as { db })`. Add a purpose-specific method to the repository instead.
**Impact:** Every service that needs multi-repo operations stores the raw `SupabaseClient`. Repositories expose named methods for all operations — no cast hacks.

### L-003: Soft-Delete Everything That Has References
**Date:** 2026-09-05
**Context:** Deciding how to handle removing contacts and lead sources.
**Learning:** Any entity referenced by foreign key in another table (contacts → opportunities, lead sources → inquiries) should be archived/deactivated, not hard-deleted. Hard-delete will fail or cascade incorrectly. `ContactService.archive()` and `LeadSourceService.deactivate()` are the canonical removal paths.
**Impact:** Archive/deactivate methods are the primary removal API. Hard-delete methods exist on repositories but should only be called when the entity is provably unreferenced.

### L-004: `status='pending'` Guard on Task Completion
**Date:** 2026-09-05
**Context:** Writing `TaskRepository.complete()` and `cancel()`.
**Learning:** Include `status='pending'` in the WHERE clause of completion/cancellation updates. This acts as an optimistic concurrency guard — if a race condition causes two requests to complete the same task, the second will return PGRST116 (no rows) and throw an error rather than silently succeeding.
**Impact:** Any state-transition update (completing, closing, converting) should include the expected current state in the WHERE clause.

---

## Gotchas & Pitfalls

### G-001: `??` and `||` Cannot Be Mixed Without Parentheses (TypeScript strict)
**Date:** 2026-09-05
**Problem:** TypeScript 5.x strict mode throws `TS5076` when `??` and `||` appear in the same expression without explicit grouping.
**Root cause:** The operators have different precedence semantics; TypeScript forces you to be explicit about intent.
**Fix:** Wrap the `||` sub-expression in parentheses: `a ?? (b || null)` instead of `a ?? b || null`.
**Prevention:** Always parenthesize `||` when used as a fallback inside a `??` chain.

### G-002: Supabase `PGRST116` = Not Found, Not a Real Error
**Date:** 2026-09-05
**Problem:** Calling `.single()` on a query that matches zero rows throws a Supabase error with code `PGRST116`.
**Fix:** Check for `error.code === 'PGRST116'` and return `null` instead of re-throwing.
**Pattern:** All `findById` methods follow this pattern — see any repository's `findById` implementation.

### G-003: Supabase `.select('*, relation(*)')` Alias Pattern
**Date:** 2026-09-05
**Context:** `OpportunityRepository.findById()` joins participants.
**Problem:** The Supabase PostgREST join syntax `opportunity_participants(*)` returns the data nested under the table name by default, not under the TypeScript type's field name `participants`.
**Fix:** Use the alias syntax: `.select('*, participants:opportunity_participants(*)')` to match the `OpportunityWithDetails.participants` field name.
**Prevention:** Always alias joined relations to match the TypeScript interface field name.

