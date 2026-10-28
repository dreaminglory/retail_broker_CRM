# Sprint 6 Implementation Plan — BrokerCRM

> **Status:** Approved (2026-10-28)
> **Scope approved by:** founder. All four Phase 3 questions were answered with the recommended option:
> prod baseline + push, reminders/digest as the §5.1 item, Vercel Cron, and the four assumptions in §3.3.
> **Duration:** ~4 weeks (≈20 dev-days)
> **Companion:** `docs/sprint-6-task-list.md` · **Roadmap:** `docs/roadmap.md`
> **Evidence:** `docs/research/crm-competitive-gap-analysis.md` (§5.0, §5.1),
> `docs/research/brokercrm-feature-inventory.md`, AD-039. `pilot-feedback.md` is empty, so nothing is E3.

## 1. Sprint Theme
> **"Make the loop trustworthy: secure prod, fix the core loop, prove it with tests, and remind brokers."**

AD-039 sets the paid-pilot gate as: core-loop defects fixed, reminders, a light property record,
requirements and matching. This sprint does the first two. It also brings production up to the
Sprint 5 security baseline, and it gives every later sprint a working cloud QA stack and real
service tests. Without these, the property sprints would be built on a loop that loses work. The
north-star lever is reliability: a next action that is scheduled must show up correctly and must
be remembered without the broker having to open the app.

## 2. Pre-Sprint Findings
Checked on 2026-10-28 against the code, a local Supabase stack and the production project `emflwmivjachbnaqumnn`.

| # | Finding (docs vs code vs DB) | Severity | Fixed in |
|---|---|---|---|
| F-01 | **Prod is on the Sprint 4 schema:** 14 tables (16 locally), no migration history, no `create_agency_with_owner`, no `profiles.locale`. It matches the migrations up to `20261003000003`. The Sprint 5 `db push` was never done. | Critical | 6.0 |
| F-02 | So **the exploits Sprint 5 fixed are still live on prod**: any user can insert an owner membership into any agency, any user can insert `audit_log` rows, profiles are readable across agencies, and anon can execute 9 SECURITY DEFINER functions. At risk: 4 agencies, 25 contacts. | Critical | 6.0 |
| F-03 | `src/proxy.ts` is still missing (AD-030, FR-AUT-03), so sessions are not refreshed per request. | High | 6.0 |
| F-04 | Locally, `audit_log.tenant_insert` still lets any member insert audit rows in their own agency, which breaks AD-020. | High | 6.0 |
| F-05 | Brokers can create and rename stages, edit lead sources and merge contacts. `merge-actions.ts` bypasses `getAuthContext` and throws. | Medium | 6.0 |
| F-06 | The cloud setup script runs `npm ci` outside the repo, so it fails. The Docker daemon is not started. Started by hand, `supabase start` and pgTAP work (93/93 pass). | Medium | 6.1 |
| F-07 | All 9 §5.0 defects are confirmed in code (for example `task-card.tsx:121`, `completeTaskAction` reading only `outcome`, `new Date(val)` in `tasks/validation.ts:23,64`, four actions with no UI caller). | Medium | 6.2–6.5 |
| F-08 | Vitest has 2 files (19 passing, 2 todo). No service tests (FR-TST-03 ⚠️). | Medium | 6.6 |
| F-09 | BRD rows claim unbuilt features: FR-OPP-11, SRC-03, TEM-07, CON-10, INQ-05/11, TSK-04, LOC-01/04, PRF-03. | Docs | 6.8 |
| F-10 | Sprint 5 left unticked: the founder `bg.json` review, the 390 px BG click-through, the onboarding dry run, and `translateDefaultNamesAction`. | Low | 6.5, 6.8 / dropped |
| F-11 | `.env.example` lists the removed `NEXT_PUBLIC_I18N_BG_ENABLED` and is missing `NEXT_PUBLIC_APP_URL`. | Low | 6.0 |
| F-12 | `pilot-feedback.md` is empty (no E3). The brief lists Smart Lists in the Pilot MVP, but AD-039 §6 leaves them out of the gate. The roadmap puts them in Sprint 8. | Process | roadmap |

## 3. Prioritised Scope
### 3.1 In scope
Value is the sum of loop, gate, adoption and evidence scores (0–12). P0 means security or data-integrity carry-over.

| Priority | Item | Source · Evidence | Score | Effort | Why now |
|---|---|---|---|---|---|
| P0 | 6.0 Prod sync and security carry-over | carry-over · E2 | P0 | 3 | Live takeover hole; every later deploy depends on it |
| 1 | 6.2 Follow-up loop defects | gap §5.0 · E2 | 11 | 3 | Breaks the core promise on Today |
| 2 | 6.3 Inquiry intake integrity | gap §5.0 · E2 | 10 | 3 | Duplicates and lost foreign buyers at step 2 |
| 3 | 6.7 Reminders and daily digest | gap §5.1 #1, AD-025 · E2 | 10 | 3.5 | Pilot gate; "forgetting" failure mode |
| 4 | 6.4 Lists at volume | gap §5.0 · E2 | 8 | 2.5 | Import makes 2,000-contact agencies real |
| 5 | 6.1 Cloud QA setup | founder ask, F-06 · E1 | 7 | 1.5 | Definition-of-done step 4 can't run in cloud sessions |
| 6 | 6.5 Import and i18n hygiene | gap §5.0 · E2 | 7 | 1.5 | Data loss on revert; English in the BG UI |
| 7 | 6.6 Test coverage | founder ask, FR-TST-03 · E2 | 6 | 1.5 | Thin coverage blocks safe shipping |
| — | 6.8 Sprint close | process | — | 0.5 | |

### 3.2 Deferred (again)
| Item | New target | Reason |
|---|---|---|
| Smart Lists | Sprint 8 | Pilot MVP item. Needs requirements and properties first so "matches" and "sellers needing update" lists are possible |
| Retention purge job | Sprint 9 (GDPR slice) | Belongs with the retention rules and the legal basis |
| Opportunity import | Backlog | No evidence. Property import (Sprint 8) matters more for onboarding |
| `pg_trgm` → `extensions` schema | Sprint 9 | Low advisor finding. Moving it touches the duplicate-detection functions |
| Click-to-call and post-call prompt | Sprint 7 | Swapped out for reminders (founder, 2026-10-28) |
| Join an existing opportunity at inquiry conversion | Sprint 7 | PAC item. Fits the Sprint 7 conversion work |
| Resend invitation (FR-TEM-07), lead-source reorder (FR-SRC-03) | Sprint 7 / backlog | Mark ⚠️ in the BRD now |
| `translateDefaultNamesAction` | Dropped | New agencies are seeded in their language (Sprint 5). No legacy EN agencies need it |

### 3.3 Business rules & assumptions
The founder confirmed assumptions A1–A4 on 2026-10-28. They are still pilot-unvalidated (E2 at best).

**Digest and reminders (6.7)** · gap §5.1 #1 · AD-025 events kept
1. One digest per active member on working days (Mon–Fri) at about **08:00 agency time**. A1 [ASSUMPTION, validate in pilot: owner meeting, "did the email change what you did first?"]
2. Content: the recipient's overdue tasks, tasks due today, and new uncontacted inquiries assigned to them. Owners and managers also get agency counts (unassigned inquiries, overdue tasks) with a link to Exceptions. At most 10 rows per section, then "+N more". A1
3. No email when every section is empty, and none to deactivated members. The language is `profiles.locale` and dates are in agency time. Emails show names and task titles only, never phones or notes (GDPR minimisation).
4. When an inquiry is assigned to someone other than the person acting, the assignee gets an immediate email. A bulk import sends one summary per assignee. A failed email never fails the action.
5. Each user can turn the digest off (default on). Sends are idempotent per (user, kind, local date).
6. Bulgarian public holidays are **not** skipped yet. [ASSUMPTION, validate: complaints]

**International phones (6.3)** · AD-041 · A2: any number libphonenumber accepts, with BG as the default region (so `0888…` and `02 …` become `+359…`; landlines are valid). Inquiry caller phone and email are normalised like contact methods. A number that can't be parsed is rejected (AD-012 kept). The duplicate check at conversion matches phone and email.

**Today scope (6.2)** · AD-044 · A3: brokers see their own work. Owners and managers see **their own by default** with a "Mine / Agency" toggle (`?scope=agency`). Exceptions stays agency-wide.

**Configuration roles (6.0)** · AD-045 · A4: creating, renaming, reordering and deleting stages and lead sources, and merging contacts, is owner/manager only, in both the action and RLS. Brokers don't see those settings pages.

**Task edit, reschedule and cancel (6.2):** any member can edit a pending task (AD-001), but not a completed or cancelled one. Reschedule offers presets: +1 h, tomorrow 09:00, +2 days, next Monday 09:00 (agency time). Cancel takes an optional reason. `next_action_at` is updated only by the trigger.

**Inquiry edit and reassign (6.3):** caller fields, source, subject, description, external ref and assignee can be edited. `raw_payload` and `received_at` cannot. The inquiry card shows the assignee's name. Unassigned inquiries can be assigned on Exceptions.

## 4. Slice Breakdown
Order: 6.0 → 6.1 → {6.2, 6.3} → {6.4, 6.5, 6.6, 6.7} → 6.8.
| Slice | Est. (d) | Week | Depends on |
|---|---|---|---|
| 6.0 Prod sync & security carry-over | 3 | 1 | — |
| 6.1 Cloud QA setup | 1.5 | 1 | — (6.0 for prod parity) |
| 6.2 Follow-up loop defects | 3 | 1–2 | 6.1 |
| 6.3 Inquiry intake integrity | 3 | 2 | 6.1 |
| 6.4 Lists at volume | 2.5 | 3 | 6.2, 6.3 |
| 6.5 Import & i18n hygiene | 1.5 | 3 | 6.3 |
| 6.6 Test coverage | 1.5 | 3 | 6.2 |
| 6.7 Reminders & daily digest | 3.5 | 4 | 6.2, 6.3 |
| 6.8 Sprint close | 0.5 | 4 | all |
| **Total** | **20** | | |

### Slice 6.0 — Prod sync & security carry-over
**Goal:** prod runs the same schema as `main`, with migration history, and the Sprint 5 exploits are closed there. Sessions refresh. Configuration is role-gated. · **Flag:** none
- **Prod sync (AD-040), founder present at the push:**
  1. Back up the schema and data to a place outside the repo.
  2. Diff the prod schema against a local `db reset --version 20261003000003` and fix any drift.
  3. Pre-flight checks for the Sprint 5 constraints (more than one active membership, profile backfill).
  4. Run `migration repair --status applied` up to the cutoff, then `db push --dry-run`, then `db push`.
  5. Afterwards: advisor, turn on leaked-password protection, replay the exploit with a throwaway account, smoke-test signup and login, and deploy the matching app build.
- **Migrations:**
  - `20261102000001_restrict_audit_inserts.sql`: drop `audit_log.tenant_insert`. At kickoff, check that trigger and RPC writers still bypass FORCE RLS.
  - `20261102000002_config_role_policies.sql`: INSERT and UPDATE on `stages` and `lead_sources`, and INSERT on `merge_history`, require owner or manager.
- **Actions/UI:** role gates in the stages, lead-sources and merge actions. Merge moves to `getAuthContext`, `ActionResult` and `toActionError`. The settings nav hides those pages from brokers.
- **Proxy:** `src/proxy.ts` wires up the dead `lib/supabase/middleware.ts#updateSession`. Read `node_modules/next/dist/docs` first.
- **Other:** `.env.example` cleanup (F-11).
- **Tests:** pgTAP `030` (authenticated audit insert denied) and `040` (broker can't write stages, sources or merge history).
- **Acceptance criteria:**
  - AC-6.0-1: prod migration history equals the repo, and `db push --dry-run` is empty.
  - AC-6.0-2: the prod advisor shows no anon-executable SECURITY DEFINER function, and the exploit replay is denied.
  - AC-6.0-3: an `authenticated` INSERT into `audit_log` fails, and opportunity stage changes are still audited.
  - AC-6.0-4: a broker gets "forbidden" when creating a stage or source or merging contacts, from both the UI and the API.
  - AC-6.0-5: a session idle past the access-token TTL keeps working without logging in again.

### Slice 6.1 — Cloud QA setup
**Goal:** any cloud or CI session can bring up the full app against local Supabase with seeded logins, and drive it in a browser. · AD-043
- **Environment (founder action):** the setup script must run `npm ci` inside the repo directory.
- **Repo:** `scripts/stack-up.sh` and `npm run stack:up`. It starts `dockerd` if there's no socket, runs `supabase start -x` without the unused services, and writes `.env.local` from `supabase status -o env`. It's idempotent.
- **Seed:** tasks relative to `now()` (overdue, due today in Sofia, upcoming), new inquiries, and BG and foreign phones. Logins: `owner|manager|broker@alpha.bg` and `@beta.bg`.
- **E2E smoke:** the vetted `@playwright/test` (matched to the pre-installed browser). `e2e/core-loop.spec.ts`: inquiry → convert → task → complete with next on the opportunity page → Today. Runs in `bg` and `en` at 1280 px and 390 px. `npm run test:e2e`; the CI job comes in Sprint 8.
- **Docs:** add `stack:up` and `test:e2e` to the AGENTS.md Commands, plus a "QA in a cloud session" note for `supermatt:qa`.
- **Acceptance criteria:**
  - AC-6.1-1: in a fresh cloud session, `npm run stack:up && npm run dev` serves a logged-in Today page within 10 minutes.
  - AC-6.1-2: `npm run test:e2e` passes in both locales.
  - AC-6.1-3: `npm run test:db` passes in the cloud session.
- **Risks:** a container without privileges for dockerd. Fallback: a Supabase branch (`create_branch`) as the QA database (cost).

### Slice 6.2 — Follow-up loop defects
**Goal:** Today and the opportunity page show and record next actions correctly. · AD-044
- **Domain:** due dates are parsed in agency time (new `parseAgencyLocal()` in `agency-day.ts`, used by `tasks/validation.ts`). `TaskService.reschedule` and `cancel` work on pending tasks only (`DomainError` otherwise). Today puts each task in exactly one bucket.
- **Actions:** the opportunity page's `completeTaskAction` reuses `completeWithNext`, as Today does. Reschedule and cancel are wired to the UI. `getTodayScreenData` takes `scope`.
- **UI:** `task-card.tsx` gets the literal key fixed, `useFormatter` instead of date-fns `format`, and `isToday` in agency time. A task menu (edit, reschedule presets, cancel) on Today and the opportunity page, and the Mine/Agency toggle.
- **Tests:** Vitest for `parseAgencyLocal` (DST), the reschedule and cancel guards, and one bucket per task. pgTAP 050 for `next_action_at` after reschedule and cancel.
- **Acceptance criteria:**
  - AC-6.2-1: a task due today at 14:00 Sofia shows "Today 14:00" in BG, appears in exactly one Today section, and is saved as 12:00Z in winter.
  - AC-6.2-2: completing a task on the opportunity page with a next task and a stage creates the task and moves the stage (FR-TSK-04 ✅).
  - AC-6.2-3: rescheduling or cancelling updates `next_action_at` through the trigger, and the opportunity shows as at-risk when no pending task is left.
  - AC-6.2-4: a manager's Today shows only their own work by default, and `?scope=agency` shows everyone's.

### Slice 6.3 — Inquiry intake integrity
**Goal:** an inquiry's caller data is clean, editable and assignable, and conversion catches duplicates. · AD-041
- **Dependency:** the vetted `libphonenumber-js` (min metadata). `normalizePhone()` keeps its signature, and the `it.todo` landline cases become real tests.
- **Migrations:** `20261109000001_normalise_inquiry_callers.sql`: backfill caller phone to E.164 and email to lowercase where they parse. `raw_payload` is untouched.
- **Domain:** inquiry validation normalises phone and email. `convert` normalises before copying to `contact_methods`, and its duplicate check passes phone and email. Global search normalises queries that look like phones.
- **Actions/UI:** wire up `updateInquiryAction` and `reassignInquiryAction` (moved to `inquiries/actions.ts`; any member may assign, AD-001). Add an edit dialog that reuses `inquiry-form.tsx`, the assignee name on the card, and an assign select on Exceptions. They call the 6.7 email hook once it lands.
- **Tests:** Vitest for phone cases (BG mobile, Sofia landline, +44, +49, invalid), validation, and conversion duplicate inputs. pgTAP for the backfill.
- **Acceptance criteria:**
  - AC-6.3-1: `+44 7700 900123` and `02 987 6543` are saved as E.164.
  - AC-6.3-2: an inquiry `0888 123 456` converts with a duplicate warning against a contact with `+359888123456`.
  - AC-6.3-3: an inquiry's assignee can be changed from the inbox and from Exceptions, and the card shows the name.
  - AC-6.3-4: editing never changes `raw_payload`.

### Slice 6.4 — Lists at volume
**Goal:** every list and picker works with 2,000 contacts and 300 opportunities.
- **Domain:** opportunities repository with `count` + `range` (50/page), dropping the 200 cap. A `searchContactsForPicker(q)` action (20 results).
- **UI:**
  - A shared `ListPager` (prev/next and "x–y of n", URL `?page=`) on contacts, opportunities and inquiries.
  - A shadcn-based async `ContactCombobox` replacing the 200-row selects in `opportunity-form` and `convert-inquiry-dialog`.
  - Broker and temperature filters on opportunities (FR-OPP-11). Rows show the owner and the primary contact.
- **Tests:** a volume script (`scripts/seed-volume.ts`, local only). Vitest for paging maths. A browser check at 390 px.
- **Acceptance criteria:**
  - AC-6.4-1: with 2,000 contacts, contact #1,999 can be found and picked in the opportunity form.
  - AC-6.4-2: every list shows a working pager, and pages load in under 3 s locally (NFR-07).
  - AC-6.4-3: filtering by broker and temperature works (FR-OPP-11 ✅).

### Slice 6.5 — Import & i18n hygiene
**Goal:** reverting an import never deletes worked-on data, and the BG UI has no English.
- **Migrations:** `20261116000001_fix_import_revert_and_recheck.sql`. The revert guard skips contacts that have gained a note, task, opportunity or merge since the import, and sets every row to `reverted` or `revert_skipped`. Add `db_recheck` to the `match_reason` CHECK, and hide "update existing". `handle_new_user` falls back from `display_name` to `full_name`, first + last, then the email prefix (FR-PRF-03).
- **App:** fix the English leaks listed in inventory §2.13. Repository `Error`s become `DomainError` keys. Signup, onboarding and profile actions use `toActionError`.
- **Tests:** pgTAP 063 (revert with a note keeps the contact), 061 (`db_recheck` row is `skipped`), 031 (profile name). Lint stays at no new warnings.
- **Acceptance criteria:**
  - AC-6.5-1: reverting an import whose contact got a note keeps that contact and its note.
  - AC-6.5-2: a BG click-through of every route shows no English (closes the Sprint 5 carry-over).
  - AC-6.5-3: a new signup's profile shows the full name.

### Slice 6.6 — Test coverage
**Goal:** the domain services that the core loop depends on have tests that run in CI. · AD-043
- **Approach:** service integration tests in Vitest against local Supabase, signed in as the seeded users (`src/test/supabase-test-client.ts`). They skip when `SUPABASE_TEST_URL` is unset, and the CI `database` job runs them. Validation stays as unit tests. Coverage is reported but not gated.
- **Suites:** tasks (create, completeWithNext, reschedule, cancel), inquiries (transitions, convert), opportunities (close, reopen), merge (moves children, archives the loser), and validation for tasks, inquiries and contacts.
- **Acceptance criteria:**
  - AC-6.6-1: CI runs the service suites against Supabase, and they're green.
  - AC-6.6-2: every service file changed in Sprint 6 has a test file.
  - AC-6.6-3: FR-TST-03 becomes ✅.

### Slice 6.7 — Reminders & daily digest
**Goal:** brokers learn about due work and new inquiries without opening the app. · AD-042 (supersedes the AD-025 mechanism)
- **Migrations:** `20261123000001_notifications.sql`: tenant table `notification_deliveries` per P-001 (`user_id`, `kind` `daily_digest|inquiry_assigned`, `period_key`, `entity_id`, `status` `sent|failed|skipped`, `provider_id`, `error`; unique `(user_id, kind, period_key)`). Members read their own rows, owners and managers read the agency's, and there are no client writes. Add `profiles.digest_enabled boolean NOT NULL DEFAULT true`, and add the table to `010-rls-catalog.sql`.
- **Domain** (`src/domain/notifications/`): `digest-builder.ts` (pure, built on the Today and Exceptions queries in agency time), templates rendered with next-intl `createTranslator` per recipient locale, `mailer.ts` (Resend adapter behind an interface, console adapter in dev), and `service.ts` (idempotent send).
- **Route:** `src/app/api/cron/daily-digest/route.ts` (`CRON_SECRET`, service role per AD-042). It sends to agencies whose local time is 08:xx on a weekday. `vercel.json` crons at 05:00 and 06:00 UTC cover DST.
- **Immediate:** an `inquiry_assigned` email from the inquiry create, update, reassign and convert actions, sent with `after()`.
- **UI and env:** a digest toggle in Profile, `notifications.*` keys in both locales, and `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL` in `.env.example`. The founder verifies the sending domain.
- **Tests:** Vitest for the builder (empty means no send, cap 10 plus "+N", owner extras, timezone edges) and idempotency with a fake mailer. pgTAP `070-notification-deliveries.sql`. A Mailpit check in BG and EN.
- **Acceptance criteria:**
  - AC-6.7-1: calling the cron route twice on one day sends one digest per eligible user.
  - AC-6.7-2: a broker with an overdue task gets a BG digest listing it, and the link opens Today.
  - AC-6.7-3: assigning an inquiry to a colleague emails them within a minute. Self-assignment sends nothing.
  - AC-6.7-4: turning the digest off stops it, and inquiry-assigned emails still arrive.
- **Risks:** a once-a-day cron limit on the Vercel Hobby plan (needs Pro, or pg_cron + `pg_net` calling the route as a fallback). Resend domain verification lead time. A cross-agency read with the service role must filter by `agency_id` in every query (reviewed in code review).

### Slice 6.8 — Sprint close
Tick the task list. In the BRD: mark the F-09 rows ⚠️ or fix them, add the §6 FRs, and update Deferred Items. In `domain-model.md`: add `notification_deliveries`, the digest rules, and the role-gated configuration invariant, and refresh §6 known gaps. Append AD-040…045 to `decisions-log.md` and the learnings (prod drift, `migration repair`, cloud dockerd) to `learnings.md`. Refresh `STATUS.md` and `roadmap.md`. Move `archive/`: Sprint 5 is already archived; move the Sprint 6 files at the Sprint 7 close. Add B-23… from gap analysis §7 to `crm-benchmark.md`.

## 5. New Decisions Needed
### AD-040: Baseline prod migration history with `migration repair` — Accepted (founder, 2026-10-28)
**Context:** F-01. **Options:** A) repair the history up to `20261003000003` and push; B) reset prod; C) a new project. **Recommendation/choice:** A, which keeps data. Every later prod change goes through `db push` only. **Revisit if:** the parity diff shows unexplained drift.

### AD-041: International phone parsing with libphonenumber-js — Proposed
**Context:** foreign buyers and landlines are rejected (AD-012 regex). **Options:** A) libphonenumber-js min, BG default region; B) widen the regex; C) free text. **Recommendation:** A. Keeps E.164 (AD-012) with real validation. Adds about 80 KB, which is acceptable on server and form. **Revisit if:** bundle size hurts mobile.

### AD-042: Reminder delivery through a Vercel Cron Route Handler and Resend — Accepted (founder, 2026-10-28)
**Context:** AD-025 picked pg_cron + Edge Functions. Digest logic and i18n already live in TypeScript (G-008). **Options:** A) a Vercel Cron route reusing the TS services; B) pg_cron + Edge (Deno duplicate); C) pg_cron + `pg_net` calling the route. **Choice:** A, with C as the fallback trigger if the plan limits crons. AD-025's events and email-only channel stay. The service-role client is allowed in the cron route (an AGENTS.md exception, AD-042). Resend is recorded as a subprocessor. **Revisit if:** push notifications arrive with the PWA (Sprint 9).

### AD-043: Cloud QA stack and integration-test strategy — Proposed
**Context:** F-06, F-08. **Options:** A) local Supabase in Docker for cloud sessions and CI, with services tested against it; B) a Supabase branch per session; C) mocked clients. **Recommendation:** A. It's free, matches CI and tests RLS for real. B is the fallback. **Revisit if:** cloud containers lose Docker.

### AD-044: Today scope for owners and managers defaults to "mine" — Accepted (founder, 2026-10-28)
Corrects `domain-model.md` §4 ("per broker") versus the code (agency-wide). There's an Agency toggle, and Exceptions stays agency-wide.

### AD-045: Configuration and merge are owner/manager-only — Accepted (founder, 2026-10-28)
Stages, lead sources and contact merge are role-gated in the action and RLS. Visibility stays agency-wide (AD-001).

## 6. New BRD Entries
| ID | Requirement / Story | Slice |
|---|---|---|
| FR-SEC-07 | Prod schema equals the repo migrations, with history; deployments go only through `db push` | 6.0 |
| FR-SET-06 | Stages, lead sources and contact merge are restricted to owner/manager | 6.0 |
| FR-TST-05 | One command brings up the app with local Supabase and seeded logins in a cloud session | 6.1 |
| FR-TST-06 | An E2E smoke test covers the core loop in `bg` and `en` | 6.1 |
| FR-TSK-08 | Edit, reschedule (presets) and cancel a pending task | 6.2 |
| FR-TOD-04 | Owners and managers switch Today between Mine and Agency | 6.2 |
| FR-INQ-13 | Edit an inquiry and reassign it from the inbox and Exceptions | 6.3 |
| FR-INQ-14 | Inquiry caller phone and email are normalised; conversion duplicate check uses them | 6.3 |
| FR-CON-15 | International and landline phone numbers are accepted (E.164) | 6.3 |
| FR-OPP-16 | Opportunity list paginated; contact pickers search the whole agency | 6.4 |
| FR-NTF-01 | Daily digest email on working days at about 08:00 agency time | 6.7 |
| FR-NTF-02 | Immediate email when an inquiry is assigned to you | 6.7 |
| FR-NTF-03 | Each user can turn off the digest | 6.7 |

User stories (US-B056–058, US-M058–059, US-O056, US-T051) are in the task list.

## 7. Budget & Cut List
20.0 d of 20. Drop in this order if behind:
1. 6.7 immediate `inquiry_assigned` email (keep the digest), −0.75 d.
2. 6.4 the "owner and primary contact columns" part, −0.5 d.
3. 6.6 `opportunities` and `merge` suites (keep tasks and inquiries), −0.5 d.
4. 6.1 E2E at 390 px and EN (keep BG desktop), −0.25 d.
5. 6.7 whole slice moves to Sprint 7, first item, −3.5 d. Last resort, because it is a pilot-gate item.

6.0, 6.2 and 6.3 are never cut.

## 8. Risks & Dependencies (sprint-level)
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Prod push fails or reveals drift | Medium | High | Backup, parity diff, dry-run, and a founder present at push |
| The prod exploit is used before 6.0 lands | Low | Critical | Run 6.0 first, on day 1 to 2 |
| Vercel plan limits cron | Medium | Medium | pg_cron + `pg_net` fallback (AD-042 C) |
| Resend domain not verified in time | Medium | Medium | Founder starts DNS in week 1; console mailer until then |
| Docker unavailable in some cloud images | Low | Medium | Supabase branch fallback (AD-043 B) |
| App hosting not confirmed (no `vercel.json` in the repo) | Medium | Medium | Founder confirms in week 1; cron is designed for Vercel |

## 9. Pilot Validation Hooks
| Assumption | How we'll measure it in the pilot | Feeds sprint |
|---|---|---|
| A1 Digest timing and content | `notification_deliveries` sends per user; weekly owner meeting question; share of overdue tasks completed before 12:00 | 8 |
| A2 International phones | Count of non-`+359` and landline numbers stored per agency | 9 |
| A3 Today "mine" default | Ask managers in week 2 of the pilot; toggle usage (URL param in logs) | 8 |
| A4 Config role gates | Support requests from brokers who can't edit stages or sources | 9 |
| Holidays not skipped | Complaints in `pilot-feedback.md` | 8 |
