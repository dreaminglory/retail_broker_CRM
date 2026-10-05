# Sprint 5 Task List — BrokerCRM

> **Theme:** Pilot-ready: lock the doors, load the data, speak Bulgarian.
> **Plan:** `docs/sprint-5-implementation-plan.md` (section numbers below refer to it)
> **Legend:** `[ ]` todo · `[x]` done · **(Should)** = can be cut per plan §7 · AC = acceptance criterion · PAC = pilot acceptance criterion

---

## Slice 5.0 — Migration Baseline & Test Harness (≈2 d)

### User stories
- **US-T050:** As the product team, we can rebuild a production-identical database locally in one command, so every change is tested before it reaches pilot agencies.

### Tasks
- [ ] Take a schema-only `pg_dump` of prod and store it outside the repo
- [x] Rename future-dated migrations (AD-030):
  - [x] `20261006000001_create_audit_log.sql` → `20261003000001_create_audit_log.sql`
  - [x] `20261010000001_create_profiles.sql` → `20261003000002_create_profiles.sql`
  - [x] `20261010000002_add_invitation_columns.sql` → `20261003000003_add_invitation_columns.sql`
- [x] `supabase db reset` locally; fix any migration that fails on a clean DB
- [x] `supabase db diff --linked --schema public` → empty (write a corrective migration if not)
- [x] `supabase migration repair --status applied <version>` for all 23 versions
- [x] Write `supabase/seed.sql` with two agencies (Alpha Imoti, Beta Estates). Each gets owner/manager/broker users with known credentials, plus contacts, an inquiry, an opportunity, a task and a note.
- [x] Add `supabase/tests/database/000-setup-tests-hooks.sql` (pgTAP + test helpers: create user, authenticate as, clear auth)
- [x] Add `supabase/tests/database/001-smoke.sql`
- [x] Install `vitest`, `vite-tsconfig-paths`; add `vitest.config.mts`
- [x] Add `src/domain/contacts/phone.test.ts` (≥ 8 cases incl. invalid)
- [x] Add scripts `test`, `test:watch`, `test:db`, `typecheck` to `package.json`

### Acceptance criteria
- [x] **AC-5.0-1** `supabase db reset && supabase test db` passes on a clean machine
- [x] **AC-5.0-2** `supabase migration list --linked` shows local and remote in agreement (23 applied)
- [x] **AC-5.0-3** `npm test` passes the phone normalization suite
- [x] **AC-5.0-4** `supabase db diff --linked` reports no drift

---

## Slice 5.1 — Security Hardening & Tenant-Isolation Suite (≈4 d)

### User stories
- **US-O050:** As an agency owner, I can trust that nobody outside my agency can join it, read its data, or write into its history.
- **US-O051:** As an owner, I can show prospects and auditors automated proof that agencies are isolated from each other. (PAC-10)
- **US-M050:** As a manager, I can invite brokers. Only the owner can grant manager or owner roles.
- **US-B050:** As an invited broker, clicking my invitation link activates my membership and takes me safely into the app.

### Tests first (each must fail before its fix)
- [x] `030-exploit-regressions.sql`: F-01 self-membership as owner into a foreign agency
- [x] `030`: F-02 audit_log insert into a foreign agency
- [x] `030`: F-03 anon `rpc/seed_agency_defaults` and `rpc/get_user_email` denied
- [x] `030`: F-05 manager inserts an `owner` or `active` membership
- [x] `030`: F-10 second active membership for the same user
- [x] `041-profiles-visibility.sql`: F-06 cross-agency profile read
- [x] `src/lib/safe-redirect.test.ts`: F-07 open redirect cases

### Database
- [x] Pre-check: no user has more than 1 active membership
- [x] Migration `…_harden_tenant_provisioning.sql`:
  - [x] Partial unique index `uq_one_active_membership_per_user`
  - [x] `create_agency_with_owner(p_agency_name, p_locale)` RPC (atomic agency + owner + seed)
  - [x] `accept_pending_invitations()` RPC
  - [x] Drop `authenticated_can_create_own_membership`, `owners_managers_can_invite`, `authenticated_can_create_agency`
  - [x] New `invite_insert` policy (status = invited; owner any role; manager broker only)
  - [x] New `invite_delete_pending` policy
  - [x] Recreate `owners_can_update_memberships` with `WITH CHECK`
  - [x] `prevent_membership_identity_change` trigger
- [x] Migration `…_harden_function_privileges.sql`:
  - [x] `SET search_path = public` on the 9 flagged functions
  - [x] REVOKE/GRANT matrix per plan §4 Slice 5.1
  - [x] `ALTER DEFAULT PRIVILEGES … REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated`
- [x] Migration `…_harden_policies.sql`:
  - [x] `audit_log` tenant_insert / tenant_select via `current_agency_id()`
  - [x] `agencies` SELECT via `current_agency_id()`
  - [x] `shares_agency_with()` helper and `profiles_select_self_or_colleague` policy
- [x] ~Supabase Dashboard: enable Leaked Password Protection~ (Skipped)

### Domain & actions
- [x] `src/lib/errors.ts`: `DomainError(code, params)`
- [x] `src/domain/agencies/validation.ts` + `service.ts` (`createWithOwner` → RPC, maps PG codes)
- [x] `MemberService.inviteMember(ctx, …)`: agencyId from `AuthContext`; role check **before** admin call
- [x] `MemberService.cancelInvitation(ctx, …)` with role/status guard; delete via user client
- [x] Make `MemberRepository.getMembership` public; remove `memberService["repo"]` hack
- [x] `team/actions.ts`: all actions use `getAuthContext()`; drop the `agencyId` form field
- [x] `signup/actions.ts`: `signupAction` (server-side signUp + RPC)
- [x] `/onboarding` page + action (fallback when there is no session or membership)
- [x] Auth callback: `isSafeRelativePath(next)`, `EmailOtpType`, `rpc('accept_pending_invitations')`
- [x] Dashboard layout: remove service-role invitation activation; redirect to `/onboarding` when there is no membership

### Infrastructure
- [x] Add `src/proxy.ts` (Next 16) calling `updateSession`
- [x] Rename `lib/supabase/middleware.ts` → `lib/supabase/proxy.ts`; protect all non-public routes; don't redirect away from `/auth/callback` or `/update-password`
- [x] Merge `createSupabaseAdmin` into `lib/supabase/admin.ts` (`server-only`, `persistSession: false`); delete the duplicate in `server.ts`

### Isolation suite
- [x] `010-rls-catalog.sql`: RLS enabled + forced on all tables; `agency_id` on all except `{agencies, profiles}`; no anon-executable SECURITY DEFINER; `search_path` set on all functions
- [x] `020-tenant-isolation-read.sql`: all 14 tables
- [x] `021-tenant-isolation-write.sql`: INSERT/UPDATE/DELETE on all 14 tables
- [x] `031-provisioning.sql`
- [x] `040-role-policies.sql`
- [x] `050-trigger-integrity.sql` (audit trigger + `next_action_at` sync still work)
- [ ] **(Should)** `.github/workflows/ci.yml`: supabase start → test db → npm test → typecheck → lint

### UI
- [x] Signup form posts to `signupAction`
- [x] Invite dialog: role options filtered by caller role

### Release
- [ ] Run the full suite locally, then `supabase db push` to prod
- [ ] Re-run the Supabase security advisor on prod

### Acceptance criteria
- [x] **AC-5.1-1 (PAC-10)** `supabase test db` green, with SELECT/INSERT/UPDATE/DELETE isolation asserted on every tenant table
- [x] **AC-5.1-2** Every exploit regression test failed before its fix and passes after (evidence in PR)
- [x] **AC-5.1-3** Prod advisor: 0 `anon_security_definer_function_executable`, 0 `function_search_path_mutable`
- [x] **AC-5.1-4** Signup is atomic; a forced failure leaves no partial agency
- [x] **AC-5.1-5** Invite → magic link → active membership works without service-role usage beyond `inviteUserByEmail`
- [x] **AC-5.1-6** A manager cannot invite a manager or owner (UI or crafted request)
- [x] **AC-5.1-7** `/auth/callback?next=@evil.com` lands on `/dashboard`
- [x] **AC-5.1-8** Unauthenticated `/contacts` → `/login` via `src/proxy.ts`
- [x] **AC-5.1-9** Manual smoke as owner and broker: Today, Contacts, Opportunities, Inquiries, Exceptions, Settings, Search

---

## Slice 5.2 — i18n Infrastructure & App Shell (≈2.5 d)

### User stories
- **US-B052:** As a user, I can choose Bulgarian or English in my profile, and the choice follows me to every device.

### Tasks
- [x] Verify `next-intl` v4 peer compatibility with Next 16.3.3 (fallback: in-house provider, R-01)
- [x] Migration `…_add_profile_locale.sql` (`profiles.locale`, CHECK bg/en, default bg)
- [x] `messages/en.json`, `messages/bg.json` with the namespace skeleton
- [x] `src/i18n/config.ts`, `src/i18n/request.ts` (cookie `NEXT_LOCALE` → default)
- [x] `next.config.ts` → `createNextIntlPlugin`
- [x] Root layout: dynamic `<html lang>` + `NextIntlClientProvider`
- [x] `src/global.d.ts`: typed messages (`typeof en.json`)
- [x] `src/lib/i18n/format.ts` + `use-format.ts` (date, relative, number, currency)
- [x] `src/lib/i18n/field-error.tsx` (translates Zod key messages)
- [x] `toActionError()` in `src/lib/actions.ts` (DomainError → localized message)
- [x] Profiles domain: `locale` type, `updateLocaleSchema`, `repository.updateLocale`
- [x] `updateLocaleAction` (profile + cookie + `revalidatePath('/', 'layout')`)
- [x] `syncLocaleCookieAction` after login; set the cookie in the auth callback
- [x] Feature flag `NEXT_PUBLIC_I18N_BG_ENABLED` (default false)
- [x] Extract strings: sidebar, header, settings layout, command palette
- [x] Extract strings: login, signup, forgot-password, update-password, onboarding
- [x] Settings → Profile: language switcher
- [x] Localized `generateMetadata` for the extracted pages
- [x] Vitest: `messages/messages.test.ts` (key parity, non-empty, ICU-valid)
- [x] Vitest: `src/lib/i18n/format.test.ts`

### Acceptance criteria
- [x] **AC-5.2-1** Language switch re-renders the shell and persists across logout/login and devices
- [x] **AC-5.2-2** `<html lang>` matches the active locale
- [x] **AC-5.2-3** Missing key in `bg.json` fails `npm test`; missing key in `en.json` fails `npm run typecheck`
- [x] **AC-5.2-4** Flag off → production UI unchanged, only English offered
- [x] **AC-5.2-5** Server Action errors in extracted areas come back localized

---

## Slice 5.3 — Import Foundation & Contacts Import (≈5 d)

### User stories
- **US-M051:** As a manager, I can upload the contacts spreadsheet we've kept in Excel/Google Sheets, map its columns, and preview problems before anything is saved. (PIL-CSV)
- **US-M052:** As a manager, contacts that already exist (same phone or email, in any format) are not duplicated when I import, even if I import the same file twice. (PAC-11)
- **US-M053:** As a manager, I can download the rejected rows with reasons, fix them, and import just those.
- **US-O052:** As an owner, only managers and owners can bulk-import data into the agency.

### Database
- [ ] Migration `…_create_import_tables.sql`:
  - [ ] `import_jobs` (agency_id, status lifecycle, file meta, sha256, mapping, options, counters)
  - [ ] `import_rows` (agency_id, raw, normalized, status, errors, match_reason, matched/entity ids)
  - [ ] `contacts.import_job_id`, `contacts.external_ref` + partial unique index
  - [ ] RLS (ENABLE + FORCE) with owner/manager-only policies on both tables
  - [ ] `updated_at` trigger on `import_jobs`
- [ ] Migration `…_import_commit_contacts_fn.sql`: `import_commit_contacts(job, limit)` SECURITY INVOKER, per-row savepoint, re-check, audit row, counters, explicit GRANT

### Domain (`src/domain/imports/`)
- [ ] `types.ts`
- [ ] `validation.ts` (job, mapping, options, stage-rows schemas; messages = i18n keys)
- [ ] `csv/header-detection.ts` (BG + EN synonyms)
- [ ] `csv/row-mapper.ts` (full-name split, organization detection)
- [ ] `duplicate-classifier.ts` (DB match, in-file match, name-similar warning)
- [ ] `repository.ts` (all queries agency-scoped, chunked `.in()` lookups)
- [ ] `service.ts` (createJob, saveMapping, stageRows, validate, commitBatch, getSummary, buildErrorReportCsv)

### Server Actions & routes
- [ ] `createImportJobAction` (returns previous jobs with the same hash)
- [ ] `saveImportMappingAction`
- [ ] `stageImportRowsAction` (≤ 500 rows per call)
- [ ] `validateImportJobAction`
- [ ] `commitImportBatchAction`
- [ ] Route Handler `GET /settings/import/[id]/errors.csv` (UTF-8 BOM)

### UI
- [ ] Install `papaparse` + `@types/papaparse`
- [ ] `/settings/import` (history), `/settings/import/new?type=contact`, `/settings/import/[id]`
- [ ] Settings sidebar "Import" (owner/manager) + "Import" button on Contacts list
- [ ] `file-drop-zone.tsx` (size check, SHA-256, UTF-8 → windows-1251 fallback, override, preview)
- [ ] `column-mapping-table.tsx`
- [ ] `import-options-form.tsx` (skip / update / create)
- [ ] `validation-summary.tsx` (+ same-file warning)
- [ ] `import-row-table.tsx` (paged, status filter, errors, matched-contact link)
- [ ] `import-progress.tsx` (batch loop, resume on reload)
- [ ] `import-wizard.tsx`, `import-job-list.tsx`, `import-status-badge.tsx`
- [ ] Contact detail "Imported from…" line; timeline renders `created` audit with import metadata
- [ ] All new strings via message keys (EN + BG placeholders)

### Tests
- [ ] pgTAP `060-import-rls.sql`
- [ ] pgTAP `061-import-commit-contacts.sql` (create, re-import skip, bad row isolated)
- [ ] Vitest `header-detection.test.ts`, `row-mapper.test.ts`, `duplicate-classifier.test.ts`
- [ ] Fixture CSVs: UTF-8 comma, windows-1251 semicolon, messy phones, in-file duplicates, 5,000 rows

### Acceptance criteria
- [ ] **AC-5.3-1 (PIL-CSV)** UTF-8 and windows-1251, `,` and `;` files import; BG/EN headers auto-map; mapping overridable
- [ ] **AC-5.3-2** Review shows valid / invalid / duplicate counts, row errors, matched contacts, before any write
- [ ] **AC-5.3-3 (PAC-11)** Re-importing the same file creates 0 contacts; the UI warns it was imported before
- [ ] **AC-5.3-4 (PAC-11)** Phones stored E.164; `0888 123 456` matches existing `+359888123456`
- [ ] **AC-5.3-5** Invalid rows don't block valid ones; the error CSV opens in Excel with correct Cyrillic
- [ ] **AC-5.3-6** Imported contacts have an audit "created" entry, are searchable, and show their import origin
- [ ] **AC-5.3-7** Brokers can't see or use import (UI, actions, RLS)
- [ ] **AC-5.3-8** 5,000 rows import in < 2 min with progress; closing the tab and resuming creates no duplicates

---

## Slice 5.4 — Inquiry Import, Import History & Revert (≈3 d)

### User stories
- **US-M054:** As a manager, I can import historical or portal-exported inquiries with their original source, reference number and date preserved. (PAC-01)
- **US-M055:** As a manager, re-importing an inquiry export doesn't create duplicate inquiries. (PAC-11)
- **US-M056:** As a manager, I can see who imported what, when, and with what result.
- **US-M057:** As a manager, I can see how many imported inquiries will land in each broker's Today screen before I commit.
- **US-O053:** As an owner, I can undo a mistaken import within 7 days without touching records my team has already worked on.
- **US-B051:** As a broker, imported inquiries assigned to me as "New" appear on my Today screen and link to the matching contact.

### Database
- [ ] Pre-check: no duplicate `(agency_id, source_id, external_ref)` in prod
- [ ] Migration `…_inquiry_import_idempotency.sql` (`inquiries.import_job_id`, unique index `NULLS NOT DISTINCT`)
- [ ] Migration `…_import_commit_inquiries_fn.sql` (contact link/create, `ON CONFLICT DO NOTHING`, `raw_payload` with import provenance)
- [ ] **(Should)** Migration `…_import_revert_fn.sql` (7-day window, untouched/unreferenced only)

### Domain
- [ ] `InquiryImportField` type; `inquiryMappingSchema`; `inquiryImportOptionsSchema`
- [ ] `csv/date-parse.ts` (BG formats, agency timezone)
- [ ] `csv/value-resolvers.ts` (source by name, assignee by email/name, status synonyms)
- [ ] `ImportService.validate` for inquiries (phone normalization, in-file + DB external_ref dedupe)
- [ ] **(Should)** `ImportService.revert`
- [ ] `Inquiry` type: `import_job_id`
- [ ] Map unique violation → `DomainError('inquiries.externalRefExists')` in manual create

### Server Actions & UI
- [ ] Import actions dispatch on `entity_type`
- [ ] **(Should)** `revertImportJobAction` + revalidate contacts, inquiries, today, exceptions
- [ ] Wizard `type=inquiry` + options step (default source, unknown-source policy, default assignee, default status, link/create contacts)
- [ ] Per-broker "will appear as New" impact preview
- [ ] "Import" button on Inquiries list (owner/manager)
- [ ] "Imported" badge on inquiry card/detail, linking to the job
- [ ] **(Should)** "Revert import" button + confirmation dialog + result summary
- [ ] Job history shows entity type, file, user, date, counts, status

### Tests
- [ ] pgTAP `062-import-commit-inquiries.sql`
- [ ] **(Should)** pgTAP `063-import-revert.sql`
- [ ] Vitest `date-parse.test.ts` (incl. DST), `value-resolvers.test.ts`

### Acceptance criteria
- [ ] **AC-5.4-1 (PAC-01)** Imported inquiries keep source, external ref, original `received_at` and the full original row in `raw_payload`; detail shows import provenance
- [ ] **AC-5.4-2 (PAC-11)** Re-import with mapped `external_ref` creates 0 new inquiries
- [ ] **AC-5.4-3** Unknown sources → default or row error per option; unknown assignees → row error
- [ ] **AC-5.4-4** Link-contacts links by phone/email (visible on the contact timeline); create-missing creates deduplicated contacts
- [ ] **AC-5.4-5** Per-broker "New" impact is shown before commit
- [ ] **AC-5.4-6 (Should)** Revert within 7 days deletes only untouched/unreferenced records and lists what was kept
- [ ] **AC-5.4-7** Manual inquiry with a duplicate external ref for the same source → friendly localized error

---

## Slice 5.5 — Full Bulgarian Localization, Timezone & Currency (≈4 d)

### User stories
- **US-B053:** As a Bulgarian broker, the whole application speaks Bulgarian by default, including errors, empty states and emails. (PIL-BG)
- **US-B054:** As a broker, dates, times, numbers and prices appear in the Bulgarian format I'm used to.
- **US-B055:** As a broker, "Today" means today in Sofia, no matter where the server runs.
- **US-O054:** As a new agency owner, my default pipeline stages and lead sources are created in Bulgarian.
- **US-O055:** As an owner, invitation and password-reset emails reach my team in Bulgarian.

### Prerequisites
- [ ] Decide the Opportunity term („Сделка" vs „Възможност") and sign off the glossary (plan Appendix A)
- [ ] Confirm AD-037 (EUR default, no conversion of legacy BGN)

### Database
- [ ] Migration `…_localized_defaults_tz_currency.sql`:
  - [ ] `seed_agency_defaults(p_agency_id, p_locale)` with BG names; `create_agency_with_owner` passes the locale
  - [ ] Backfill `agencies.settings` timezone `Europe/Sofia` + `default_currency` `EUR`
  - [ ] `opportunities.currency` default `EUR`
  - [ ] Re-apply REVOKE/GRANT on the new function signature

### Domain & actions
- [ ] `src/domain/agencies/settings.ts` (`agencySettingsSchema`, `getAgencySettings` with `cache()`)
- [ ] Install `@date-fns/tz`; `src/lib/time/agency-day.ts`
- [ ] `TaskRepository` Today/Upcoming/Overdue use agency day bounds; Exceptions stale check too
- [ ] Zod messages → keys: contacts, inquiries, opportunities, tasks, notes, lead-sources, stages, members, profiles
- [ ] Service errors → `DomainError` (inquiry transitions, member safeguards, stages, merge, not-found)
- [ ] Replace `err.message` returns with `toActionError()` in every actions file
- [ ] `signupAction` passes the locale (cookie → Accept-Language → bg)
- [ ] Opportunity create defaults currency from agency settings
- [ ] **(Should)** `translateDefaultNamesAction` (stages + lead sources, exact English defaults only)

### UI extraction (one commit per area)
- [ ] Today (+ task-card, task-complete-dialog)
- [ ] Contacts (list, detail, form, methods, duplicate modal, merge dialog, linked opps, activity, notes)
- [ ] Inquiries (list, card, form, convert dialog)
- [ ] Opportunities (list, detail, form, table, participants, stage badge, task list, close dialog)
- [ ] Activity (timeline, timeline-entry phrases, note card/list)
- [ ] Manager (exceptions, dashboard)
- [ ] Settings (lead sources, stages, team/members)
- [ ] Import wizard + report (final BG copy)
- [ ] `enums.*` namespace replaces all hard-coded label maps
- [ ] All `format`/`formatDistanceToNow` calls → `lib/i18n/format.ts` (agency timezone server-side)
- [ ] Replace hard-coded `"bg-BG"` currency formatters with locale + record currency
- [ ] Localized page metadata on all pages
- [ ] Supabase email templates in BG: `supabase/templates/*.html` + `config.toml`; prod dashboard runbook step
- [ ] **(Should)** `eslint-plugin-i18next` `no-literal-string` (jsx-text-only, warn)

### Translation & flip
- [ ] Machine-assisted BG pass using the glossary
- [ ] Founder native review of `bg.json`
- [ ] Browser click-through in BG (desktop + 390 px) on every route; fix overflow
- [ ] Flip `defaultLocale` to `bg`; remove `NEXT_PUBLIC_I18N_BG_ENABLED`

### Tests
- [ ] Parity test green on the full catalogue
- [ ] Vitest `agency-day.test.ts` (23:30 Sofia edge, DST, server TZ = UTC)
- [ ] pgTAP `031-provisioning.sql`: BG locale seeds BG names

### Acceptance criteria
- [ ] **AC-5.5-1 (PIL-BG)** Every route shows no English UI text by default (user data excepted)
- [ ] **AC-5.5-2** English profile setting gives a full English UI; catalogues at parity
- [ ] **AC-5.5-3** BG formats: `05.10.2026`, "преди 2 часа", `1 234,50`, `125 000 €`
- [ ] **AC-5.5-4** Today buckets follow Europe/Sofia boundaries with the server in UTC
- [ ] **AC-5.5-5** New BG agencies get BG stage and source names; "translate defaults" leaves custom names untouched
- [ ] **AC-5.5-6** New opportunities default to EUR; legacy BGN still displays as BGN
- [ ] **AC-5.5-7** Invite and reset emails arrive in Bulgarian
- [ ] **AC-5.5-8** No layout breakage at 390 px in BG on the key screens

---

## Slice 5.6 — Sprint Close (≈0.5 d)

- [ ] `docs/BRD.md`: FR-SEC, FR-TST, FR-IMP, FR-I18N, FR-LOC tables; Sprint 5 user stories marked ✅
- [ ] `docs/BRD.md` §6: Notifications → Sprint 6; **add Smart Lists (Sprint 6)**; Opportunity import (6+); Requirement/Property reference (7); retention purge job (6); `pg_trgm` move (backlog)
- [ ] `docs/decisions-log.md`: AD-027 … AD-038; mark AD-023 revised, L-005 superseded
- [ ] `docs/learnings.md`: G-007 … G-010, P-009, P-010
- [ ] `docs/technical-architecture.md`: Next.js 16 / proxy; Sprint 5 section
- [ ] `.agents/AGENTS.md` + `learnings-and-decisions` skill: Next 16; catalog-guard rule; explicit GRANT rule; re-sync the skill with the decisions log
- [ ] README: local dev runbook (`supabase start`, `db reset`, `test db`, `npm test`, `npm run dev`)

---

## Sprint 5 Definition of Done

- [ ] All Must slices (5.0–5.5 minus items marked Should) merged and deployed to prod
- [ ] `supabase test db`, `npm test`, `npm run typecheck`, `npm run lint` all green
- [ ] Prod security advisor shows no ERROR or anon-executable SECURITY DEFINER findings
- [ ] PAC-01, PAC-10, PAC-11 demonstrably met; PIL-CSV and PIL-BG met
- [ ] An onboarding dry run: a real (anonymised) agency spreadsheet imported end-to-end in Bulgarian UI by a non-developer
- [ ] Docs updated (Slice 5.6)
