# Decisions

Decisions that still shape the code. Before changing something an AD covers, read it; to change
the decision, add a new AD that supersedes it (don't edit an Accepted one). Code, migrations and
specs cite these IDs. History before 2026-10-29: `docs/archive/` and git.

**New AD:** next free number, then `Status`, `Decision`, `Why`, and `Revisit if` when there is a
trigger. Two to six lines. Status is Proposed, Accepted or Superseded by AD-NNN.

---

## Product

### AD-039: Full agency system, not a follow-up layer
**Accepted** (founder, 2026-10-28). BrokerCRM replaces the agency's listing tool rather than
sitting next to it, with follow-up discipline as the edge. Committed modules, pilot gate and
non-goals: `SPEC.md` §1–3. Evidence sets the order of committed modules, not whether they are
built. Bulgaria first; residential sales agencies with 2–30 brokers; pricing hypothesis €20 per
broker per month, all modules included.
**Why:** Bulgarian agencies buy property-first (`docs/research/crm-competitive-gap-analysis.md`).

### AD-047: Module-based agent-skills workflow
**Accepted** (founder, 2026-10-29). `/feature-ideas` → `/spec` → `/plan` → `/build` →
`/review` → `/ship`, one module at a time, no sprints. `SPEC.md` is the single product file,
`spec/<module-id>.md` per module, `tasks/` for the active module only. The AGENTS.md Definition
of Done overrides the plugin's.

### AD-048: Local-only development
**Accepted** (founder, 2026-10-29). Development runs only on the founder's machine with Docker
Desktop; `npm run stack:up` doesn't start dockerd. CI still runs typecheck, lint, Vitest, pgTAP.
**Revisit if:** we develop in cloud sessions again.

## Stack and platform

### AD-002: Next.js + Supabase + Tailwind + shadcn/ui
**Accepted.** Next.js (App Router, now 16) on Vercel, Supabase for Postgres, auth and RLS.
**Why:** native RLS, SQL-first, simple ops, low cost.

### AD-030: `src/proxy.ts` refreshes the session only
**Accepted.** Next 16 replaced middleware with the proxy; it refreshes the Supabase session.
Authorization lives in Server Component layouts and RLS.

### AD-040: Production changes go through migrations only
**Accepted** (founder, 2026-10-28). Prod (`emflwmivjachbnaqumnn`) history was baselined with
`migration repair` and now equals the repo. Never change prod schema outside a migration.
**Revisit if:** a parity check finds unexplained drift.

### AD-043: Local QA stack and E2E smoke
**Accepted.** `npm run stack:up` runs local Supabase and writes `.env.local`; `npm run test:e2e`
runs the Playwright core loop in bg and en at 1280 and 390 px. Service integration tests run
against the same stack as the seeded users. (Its cloud-session part is superseded by AD-048.)
`npm run test:services` switches them on and prints coverage, not gated; plain `npm run test` skips
them. They refuse a non-local URL, and each suite deletes its own rows with the service role.

## Tenancy, security and roles

### AD-001: Records are visible to the whole agency
**Accepted.** Every member sees every record in their agency; one RLS policy per table.
Assignment and Today scope are UI defaults, not visibility (see AD-044).
**Revisit if:** pilot agencies need "own records only".

### AD-004: RLS through SECURITY DEFINER helpers
**Accepted.** Policies call `current_agency_id()` / `current_user_role()` and never query
`agency_memberships` inline (that recursed). Template: `supabase-patterns` skill.

### AD-027: Atomic tenant provisioning
**Accepted.** Sign-up calls one SECURITY DEFINER RPC, `create_agency_with_owner(name, locale)`,
which creates the agency, owner membership and localized default seeds in one transaction.

### AD-028: Explicit function grants
**Accepted.** Revoke EXECUTE from `PUBLIC, anon, authenticated` on every function, then grant
only the RPCs the app calls. Internal helpers are not callable over REST.

### AD-023 / AD-029: `profiles` without `agency_id`, visible to colleagues
**Accepted** (AD-029 revises AD-023). `public.profiles` is created by a trigger on
`auth.users`, has no `agency_id` and no INSERT policy, and is visible to the user and to
colleagues via `shares_agency_with()`.

### AD-024: Invitations through `admin.inviteUserByEmail()`
**Accepted.** A Server Action uses the service-role client (`src/lib/supabase/admin.ts`) to invite
and creates an `invited` membership; the auth callback activates it. The invite creates the auth
user immediately, so the membership is written after the call.

### AD-045: Configuration and merge are owner/manager only
**Accepted** (founder, 2026-10-28). Stages, lead sources and contact merge need owner or manager:
`requireRole(ctx, CONFIG_ROLES)` in actions, hidden in the UI, and RLS on `stages`,
`lead_sources` and `merge_history` writes.
**Open:** a merge is a series of ordinary edits, so RLS blocks only its history row. An atomic,
role-checked merge RPC is in the `SPEC.md` ideas backlog. Answered by AD-050.

### AD-050: Conversion and merge are atomic RPCs
**Accepted** (2026-10-30). `convert_inquiry` and `merge_contacts` do all their writes in one
transaction, as SECURITY INVOKER so RLS and audit triggers still apply. `merge_contacts` checks the
role itself, and both refuse another agency's rows. Validation that needs TypeScript (phone
normalising, assignee check) stays in the service. Failures surface through `rpcFailure()`.
**Why:** checking each write's error would report a failure but leave a half-done merge or a
stranded contact and opportunity, and a retry would then duplicate them.
**Revisit if:** either flow needs work outside the database in the same step.

## Domain

### AD-008: Contacts are persons or organizations
**Accepted.** `contacts.type`; persons use first and last name, organizations `company_name`.
`display_name` is generated.

### AD-009: Four opportunity types
**Accepted.** buyer, seller, landlord, tenant; one shared pipeline.

### AD-006 / AD-007: Stages and lead sources are per-agency tables
**Accepted.** Seeded on provisioning, editable in Settings (owner/manager, AD-045).

### AD-012: Phones stored as E.164, emails lowercase
**Accepted.** Normalized in validation via `normalizePhone()` / `normalizeContactMethodValue()`;
the database doesn't enforce the format. Viber and WhatsApp use the same normalization.

### AD-041: International phone parsing with libphonenumber-js
**Accepted.** `libphonenumber-js` (min
metadata), BG default region, behind the same `normalizePhone()` signature. Landlines and foreign
numbers become valid; unparseable numbers are still rejected. BG numbers must pass `isValid()` or
have 9 national digits, which AD-012 accepted and stored data holds; foreign ones only
`isPossible()`, because min metadata lags new ranges abroad and rejecting a real caller costs more
than storing a typo.
**Revisit if:** bundle size hurts mobile.

### AD-049: A new inquiry assignee must be an active agency member
**Accepted.** Any member may assign (AD-001), and `assigned_to` only references `auth.users`, so
`InquiryService` checks a new assignee against the agency's active members on create, update and
convert. Leaving a deactivated assignee in place is allowed, so an edit doesn't force a reassign.
**Revisit if:** a database check covers every assignable table.

### AD-018: Contacts may share a phone or email
**Accepted.** No unique constraint on `contact_methods`; the duplicate warning ("create anyway")
is the defence. Spouses and colleagues share numbers.

### AD-015 / AD-017: Duplicates and merge
**Accepted.** Similar names found with `pg_trgm` on `display_name`. Merge picks a winner, moves
all related records to it, archives the loser and stores its pre-merge state in `merge_history`.

### AD-013: Task type is a CHECK-constrained text column
**Accepted.** A small fixed set; no lookup table.

### AD-014: Completing a task needs an outcome; the next step is prompted, not forced
**Accepted.** `completeWithNext` requires `outcome`; next task and stage change are optional.
An opportunity left with no pending task shows as at-risk.

### AD-046: Pending tasks are editable; completed and cancelled are final
**Accepted.** Any member can edit, reschedule or cancel a pending task; anything else throws
`errors.task_not_pending`. The cancel reason goes in `tasks.outcome`. Reschedule presets are
computed in agency time. `next_action_at` changes only through the trigger.
**Revisit if:** reports need cancel reasons apart from outcomes.

### AD-044: Today defaults to "mine"
**Accepted** (founder, 2026-10-28). Owners and managers get a Mine / Agency toggle
(`?scope=agency`); a broker always gets their own. Exceptions stays agency-wide.
**Revisit if:** managers ask for a per-broker filter.

### AD-016: Exceptions is a role-gated route
**Accepted.** `/exceptions` is owner/manager only, checked in the Server Component.

### AD-019 / AD-021: Notes table; the timeline is assembled on read
**Accepted.** One `notes` table with `contact_id` and/or `opportunity_id` (at least one). The
timeline merges notes, tasks, inquiries and audit events at read time; no activity table.

### AD-020: `audit_log` is written by triggers only
**Accepted.** AFTER UPDATE triggers on `opportunities` and `contacts`; the app only reads it and
RLS denies inserts from members.

### AD-026: Global search with Postgres full-text search
**Accepted.** Weighted `tsvector` columns kept by triggers (contacts include their contact
methods via a cascading trigger), `'simple'` config for Bulgarian, plus `pg_trgm`.

### AD-037: EUR is the currency
**Accepted.** EUR by default in `agencies.settings` and `opportunities.currency`, formatted with
`useFormatter`. Historical BGN values stay as stored.

## Import

### AD-034: Chunked import pipeline
**Accepted.** The client parses the CSV and stages 500-row chunks into `import_rows` (Server
Action bodies max 1 MB), the server validates, and the client loops batch-commit RPCs until
`remaining = 0`.

### AD-035: Inquiry idempotency key
**Accepted.** Unique `(agency_id, source_id, external_ref)` on `inquiries`; re-imports and future
portal feeds skip exact duplicates.

### AD-036: Import revert within 7 days, untouched records only
**Accepted.** The revert deletes only imported records nobody has worked on: a contact with no
edit, note, task, opportunity, participant, inquiry or merge since the import, an inquiry with
no edit or conversion. The note an import row brought in isn't work unless edited. Rows that
created a record become `reverted` or `revert_skipped`. The edit guard on contacts goes beyond
`spec/trustworthy-loop.md` rule 10 because the confirmation dialog promises it.

## i18n

### AD-031: next-intl without locale routing
**Accepted.** `NEXT_LOCALE` cookie, set from `profiles.locale`; Bulgarian is the default. Every key
in both `messages/bg.json` and `messages/en.json`.

### AD-032 / AD-033: Errors travel as i18n keys
**Accepted.** Zod messages and `DomainError.code` are i18n keys; `toActionError()`
(`src/lib/actions.ts`) translates them on the server. RPCs return keys too, since they can't see
the request locale. Repository failures throw `errors.loadFailed`, `saveFailed` or `deleteFailed`
with the database message as the log-only detail; any other error becomes `errors.unexpected`
and is logged, so raw English never reaches the UI. Supabase Auth messages go through
`authErrorKey()`. `src/lib/i18n-keys.test.ts` fails on a key missing from the message files.

### AD-038: "Сделка" for opportunity
**Accepted.** Bulgarian UI uses "Сделка", not "Възможност". Glossary: `crm-domain-model` skill.

## Notifications

### AD-025 / AD-042: Email reminders via a Vercel Cron route and Resend
**Accepted** (founder, 2026-10-28; AD-042 replaces AD-025's pg_cron + Edge Function mechanism).
Email only. A Vercel Cron Route Handler reuses the TypeScript services (pg_cron + `pg_net`
calling the route is the fallback). The service-role client is allowed in that route, and every
query still filters by `agency_id`. Local development uses Mailpit and manual triggers. Scope:
`spec/reminders.md`.
**Revisit if:** push notifications arrive with the PWA.

### AD-051: How reminder emails are claimed, keyed and sent
**Accepted** (founder, 2026-10-30, with the reminders plan). Refines AD-042; scope stays in
`spec/reminders.md`.
- **Claim, then send.** A send first inserts a `pending` row in `notification_deliveries`
  (`ON CONFLICT DO NOTHING`); only the run that inserted it sends, then sets `sent` or `failed`.
  `sent` and `pending` block a repeat, `failed` and `skipped` can be claimed again. A crash
  mid-send leaves `pending`: that user misses one email rather than getting two.
- **Key per email.** `(user_id, kind, period_key)` is unique. `daily_digest` → `YYYY-MM-DD`
  (agency-local date); `inquiry_assigned` → `<inquiry_id>:YYYY-MM-DD`; an import summary →
  `import:<job_id>`. A single date key would stop a broker's second inquiry email of the day.
- **`skipped` means an empty digest**, so "why didn't X get an email?" has an answer. A user who
  turned the digest off, or a deactivated member, gets no row at all.
- **Only the service role writes** the table (the digest route, and `after()` work in the
  inquiry actions). Members read their own rows, owners and managers the agency's.
- **The route stays off until `go-live`.** With no `CRON_SECRET` it refuses every call;
  `?now=` is ignored when `NODE_ENV=production`.
- **Mail transport:** `MAIL_TRANSPORT=smtp` (Mailpit) or `resend` (plain `fetch`, paced).
**Why:** a double email costs trust and a missed one costs one digest; an inquiry email must
not be suppressed by the day's earlier one.
**Revisit if:** the pilot needs retries beyond the next day's run, or volume outgrows one request.

### AD-052: Agency counts are part of the digest
**Accepted** (2026-10-31, while building `reminders`; for founder review). Refines
`spec/reminders.md` rules 2 and 5.
- **Turning the digest off also stops the counts.** An owner or manager has one digest switch,
  and no separate email carries the counts.
- **Same rows as the sections.** The builder derives the counts from the agency's rows the digest
  has already loaded, so they add no query. Definitions match Exceptions (`docs/domain-model.md` §4).
- **The subject counts own work, or the agency's when there is none.** They aren't added together,
  because an own overdue task is also in the agency's overdue count.
**Why:** one switch is simpler to explain, and a count that can't disagree with the digest's own
sections is easier to trust.
**Revisit if:** owners want the counts without their own digest, or the other way round.

---

## Retired

Kept so old references resolve: AD-003 (English first: replaced by AD-031), AD-005 and AD-011
(sprint sequencing), AD-010 (free-text phones: reversed by AD-012), AD-022 ("Team Member"
placeholder: replaced by AD-023).
