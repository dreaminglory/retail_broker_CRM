# Sprint 6 Task List — BrokerCRM

> **Theme:** Make the loop trustworthy: secure prod, fix the core loop, prove it with tests, and remind brokers.
> **Plan:** `docs/sprint-6-implementation-plan.md`
> **Legend:** `[ ]` todo · `[x]` done · **(Should)** = cuttable per plan §7 · AC = acceptance criterion

---

## Slice 6.0 — Prod sync & security carry-over (≈3 d)

### User stories
- **US-O056:** As an owner, I know a broker can't rename our pipeline or merge clients, and no outsider can join my agency.

### Tasks
#### Prod sync (AD-040), founder present at the push
- [ ] Back up the prod schema and data to a place outside the repo, and confirm the backup/PITR policy
- [ ] Diff the prod schema against a local `supabase db reset --version 20261003000003` and resolve any drift
- [ ] Pre-flight checks: users with more than one active membership, rows that break the Sprint 5 constraints
- [ ] `supabase migration repair --status applied` for every version ≤ `20261003000003`
- [ ] `supabase db push --dry-run`, then `supabase db push`
- [ ] Advisor re-run, leaked-password protection on, exploit replay with a throwaway account, signup/login smoke test
- [ ] If an app build is deployed anywhere, redeploy it to match; record the hosting state in STATUS
#### Database
- [ ] Migration `20261102000001_restrict_audit_inserts.sql` (drop `audit_log.tenant_insert`; triggers and RPCs still write)
- [ ] Migration `20261102000002_config_role_policies.sql` (stages, lead_sources INSERT/UPDATE and merge_history INSERT need owner/manager)
- [ ] pgTAP `030-exploit-regressions` (audit insert denied) and `040-role-policies` (broker config writes denied)
#### Server Actions / app
- [ ] Role gates in `settings/stages/actions.ts`, `settings/lead-sources/actions.ts`, `contacts/merge-actions.ts`
- [ ] `merge-actions.ts` moves to `getAuthContext()` + `ActionResult` + `toActionError()`
- [ ] `src/proxy.ts` (Next 16) using `lib/supabase/middleware.ts#updateSession` (read `node_modules/next/dist/docs` first)
- [ ] Settings nav and layout hide Stages, Lead sources and Merge from brokers
- [ ] `.env.example`: remove `NEXT_PUBLIC_I18N_BG_ENABLED`, add `NEXT_PUBLIC_APP_URL`

### Acceptance criteria
- [ ] **AC-6.0-1** Prod migration history equals the repo, and `db push --dry-run` is empty (FR-SEC-07)
- [ ] **AC-6.0-2** Prod advisor: no anon-executable SECURITY DEFINER function; the exploit replay is denied
- [ ] **AC-6.0-3** An `authenticated` INSERT into `audit_log` fails; stage changes are still audited
- [ ] **AC-6.0-4** A broker is refused when creating a stage or source or merging contacts, from the UI and the API (FR-SET-06)
- [ ] **AC-6.0-5** A session idle past the access-token TTL keeps working (FR-AUT-03 ✅)

---

## Slice 6.1 — Cloud QA setup (≈1.5 d)

### User stories
- **US-T051:** As a developer or agent, I can bring up and QA the running app in a cloud session.

### Tasks
- [ ] Founder: fix the cloud environment setup script so `npm ci` runs inside the repo directory
- [ ] `scripts/stack-up.sh` + `npm run stack:up` (dockerd if needed, `supabase start -x …`, `.env.local` from `supabase status -o env`)
- [ ] `supabase/seed.sql`: tasks relative to `now()` (overdue, due today in Sofia, upcoming), new inquiries, BG and foreign phones
- [ ] Vet and add `@playwright/test` matched to the pre-installed browser
- [ ] `e2e/core-loop.spec.ts` + `npm run test:e2e` (BG and EN; 1280 px and 390 px **(Should)**)
- [ ] AGENTS.md Commands: `stack:up`, `test:e2e`; a short "QA in a cloud session" note

### Acceptance criteria
- [ ] **AC-6.1-1** In a fresh cloud session, `npm run stack:up && npm run dev` serves a logged-in Today within 10 minutes (FR-TST-05)
- [ ] **AC-6.1-2** `npm run test:e2e` passes in both locales (FR-TST-06)
- [ ] **AC-6.1-3** `npm run test:db` passes in the cloud session

---

## Slice 6.2 — Follow-up loop defects (≈3 d)

### User stories
- **US-B057:** As a broker, I can move a call to tomorrow in two taps.
- **US-M059:** As a manager, Today shows my own work unless I ask for the agency's.

### Tasks
#### Domain
- [x] `parseAgencyLocal()` in `src/lib/time/agency-day.ts`; used by `src/domain/tasks/validation.ts` (both schemas)
- [x] `TaskService.reschedule()` / `cancel()` (pending-only, `DomainError`)
- [x] Today repository: one bucket per task (no Overdue + Due today double-listing)
- [x] Vitest: `parseAgencyLocal` (DST), reschedule/cancel guards, bucket exclusivity
- [x] pgTAP `050-trigger-integrity`: `next_action_at` after reschedule and cancel
#### Server Actions
- [x] Opportunity-page `completeTaskAction` uses `completeWithNext` (next task + stage)
- [x] `rescheduleTaskAction`, `cancelTaskAction` wired; `getTodayScreenData(scope)`
#### UI
- [x] `task-card.tsx`: fix the literal `t('dueTodayTime'…)`, `useFormatter`, `isToday` in agency time
- [x] Task menu: edit, reschedule presets (+1 h, tomorrow 09:00, +2 days, next Monday 09:00), cancel with an optional reason
- [x] Mine/Agency toggle on Today (owner/manager)
- [x] i18n keys in `messages/bg.json` + `messages/en.json`
- [x] Browser check: desktop + 390 px, BG and EN

### Acceptance criteria
- [x] **AC-6.2-1** A task due 14:00 Sofia shows "Today 14:00" in BG, in exactly one section, and is stored as 12:00Z in winter
- [x] **AC-6.2-2** Completing on the opportunity page with a next task and stage creates the task and moves the stage (FR-TSK-04 ✅)
- [x] **AC-6.2-3** Reschedule and cancel update `next_action_at` through the trigger; with no pending task, the opportunity is at-risk (FR-TSK-08)
- [x] **AC-6.2-4** A manager's Today defaults to Mine; `?scope=agency` shows everyone's (FR-TOD-04)

---

## Slice 6.3 — Inquiry intake integrity (≈3 d)

### User stories
- **US-B058:** As a broker, I can save a foreign buyer's or a landline number.
- **US-M058:** As a manager, I can assign an unassigned inquiry from Exceptions.

### Tasks
#### Database
- [ ] Migration `20261109000001_normalise_inquiry_callers.sql` (E.164 / lowercase backfill; `raw_payload` untouched) + pgTAP
#### Domain
- [ ] Vet and add `libphonenumber-js`; `normalizePhone()` keeps its signature, BG default region (AD-041)
- [ ] `phone.test.ts`: landline `it.todo` → real tests; +44, +49, invalid
- [ ] Inquiry validation normalises caller phone and email; Vitest
- [ ] `InquiryService.convert` normalises before copying; the duplicate check passes phone + email
- [ ] Global search normalises phone-looking queries
#### Server Actions
- [ ] `updateInquiryAction` wired; `reassignInquiryAction` moved to `inquiries/actions.ts`
#### UI
- [ ] Inquiry edit dialog (reuses `inquiry-form.tsx`); assignee name on `inquiry-card.tsx`
- [ ] Assign select on the Exceptions unassigned list
- [ ] i18n keys in both files; browser check in BG + EN

### Acceptance criteria
- [ ] **AC-6.3-1** `+44 7700 900123` and `02 987 6543` are saved as E.164 (FR-CON-15)
- [ ] **AC-6.3-2** Inquiry `0888 123 456` converts with a duplicate warning against `+359888123456` (FR-INQ-14)
- [ ] **AC-6.3-3** The assignee can be changed from the inbox and Exceptions, and the card shows the name (FR-INQ-13, FR-INQ-05/11 ✅)
- [ ] **AC-6.3-4** Editing never changes `raw_payload`

---

## Slice 6.4 — Lists at volume (≈2.5 d)

### Tasks
- [ ] `scripts/seed-volume.ts` (2,000 contacts, 300 opportunities; local only)
- [ ] Opportunities repository: `count` + `range`, 50/page, no 200 cap
- [ ] Shared `ListPager` (URL `?page=`) on contacts, opportunities and inquiries (FR-CON-10 ✅)
- [ ] `searchContactsForPicker` action + async `ContactCombobox` in `opportunity-form` and `convert-inquiry-dialog`
- [ ] Broker and temperature filters on opportunities (FR-OPP-11 ✅)
- [ ] **(Should)** Owner and primary-contact columns on opportunity rows
- [ ] Vitest: paging maths; browser check at 390 px

### Acceptance criteria
- [ ] **AC-6.4-1** With 2,000 contacts, contact #1,999 can be found and picked in the opportunity form (FR-OPP-16)
- [ ] **AC-6.4-2** Every list has a working pager; pages load in under 3 s locally (NFR-07)
- [ ] **AC-6.4-3** Filtering by broker and temperature works

---

## Slice 6.5 — Import & i18n hygiene (≈1.5 d)

### Tasks
- [ ] Migration `20261116000001_fix_import_revert_and_recheck.sql` (revert guard, row statuses, `db_recheck` in CHECK, `handle_new_user` name fallback)
- [ ] pgTAP: `063` revert with a note keeps the contact; `061` `db_recheck` row skipped; `031` profile name
- [ ] Hide the "update existing" import strategy in the UI
- [ ] Fix the English leaks (inventory §2.13); repository `Error` → `DomainError`; signup, onboarding and profile actions use `toActionError()`
- [ ] BG click-through of every route at desktop + 390 px (Sprint 5 carry-over)

### Acceptance criteria
- [ ] **AC-6.5-1** Reverting an import whose contact got a note keeps the contact and the note
- [ ] **AC-6.5-2** The BG click-through shows no English (FR-LOC-01 ✅)
- [ ] **AC-6.5-3** A new signup's profile shows the full name (FR-PRF-03 ✅)

---

## Slice 6.6 — Test coverage (≈1.5 d)

### Tasks
- [ ] `src/test/supabase-test-client.ts` (signs in as seeded users; skips without `SUPABASE_TEST_URL`)
- [ ] `src/domain/tasks/service.test.ts`
- [ ] `src/domain/inquiries/service.test.ts`
- [ ] **(Should)** `src/domain/opportunities/service.test.ts`
- [ ] **(Should)** `src/domain/contacts/merge.test.ts`
- [ ] `validation.test.ts` for tasks, inquiries, contacts
- [ ] CI `database` job runs the service suites after pgTAP; coverage printed (not gated)

### Acceptance criteria
- [ ] **AC-6.6-1** CI runs the service suites against Supabase, and they're green
- [ ] **AC-6.6-2** Every service file changed in Sprint 6 has a test file
- [ ] **AC-6.6-3** FR-TST-03 is ✅

---

## Slice 6.7 — Reminders & daily digest (≈3.5 d)

### User stories
- **US-B056:** As a broker, I get a morning email of today's and overdue work, so nothing slips while I'm in the field.

### Tasks
#### Database
- [ ] Migration `20261123000001_notifications.sql` (`notification_deliveries` per P-001; `profiles.digest_enabled`)
- [ ] Add `notification_deliveries` to `010-rls-catalog.sql`; pgTAP `070-notification-deliveries.sql`
#### Domain (`src/domain/notifications/`)
- [ ] `mailer.ts`: interface + Mailpit SMTP adapter (dev/test) + Resend adapter (prod, vet and add `resend`)
- [ ] `digest-builder.ts` (pure) + Vitest (empty means no send, cap 10 + "+N", owner extras, timezone edges)
- [ ] Email templates via next-intl `createTranslator` (BG/EN)
- [ ] `service.ts` with idempotent sends + Vitest using a fake mailer
#### Route / actions
- [ ] `src/app/api/cron/daily-digest/route.ts` (`CRON_SECRET`, service role, 08:xx agency time, weekdays)
- [ ] `npm run digest:run` (calls the route locally with `CRON_SECRET`; `?now=` override outside production)
- [ ] `vercel.json` crons at 05:00 and 06:00 UTC written but not relied on until go-live (AD-042)
- [ ] **(Should)** `inquiry_assigned` email via `after()` from inquiry create, update, reassign and convert
#### UI / env
- [ ] Digest toggle in Profile settings; `notifications.*` keys in both files
- [ ] `.env.example`: `MAIL_TRANSPORT`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`
- [ ] Mailpit check in BG and EN (all acceptance runs locally; no domain needed)

### Acceptance criteria
- [ ] **AC-6.7-1** Calling the digest route twice on one day sends one digest per eligible user, seen in Mailpit (FR-NTF-01)
- [ ] **AC-6.7-2** A broker with an overdue task gets a BG digest listing it; the link opens Today
- [ ] **AC-6.7-3** Assigning an inquiry to a colleague emails them within a minute; self-assignment sends nothing (FR-NTF-02)
- [ ] **AC-6.7-4** Turning the digest off stops it; inquiry-assigned emails still arrive (FR-NTF-03)

---

## Sprint Close (Slice 6.8, ≈0.5 d)
- [ ] All Must slices merged and deployed (`supabase db push` done; prod history in sync)
- [ ] `npm run test:db`, `npm run test`, `npm run typecheck`, `npm run lint`, `npm run test:e2e` all green
- [ ] Supabase security advisor clean on prod
- [ ] Task list fully ticked (or untouched items moved to STATUS.md carry-over)
- [ ] BRD: new FRs (plan §6), ⚠️ marks for F-09 rows still open, Deferred Items updated
- [ ] `docs/domain-model.md`: `notification_deliveries`, digest rules, configuration role invariant, Today scope, §6 gaps
- [ ] `docs/decisions-log.md`: AD-040…AD-045; `docs/learnings.md`: prod drift / migration repair, cloud dockerd, `after()` email
- [ ] `crm-benchmark.md`: add N-01…N-12 from gap analysis §7 as B-23…
- [ ] `docs/STATUS.md` and `docs/roadmap.md` refreshed
- [ ] Go-live prerequisites (domain, Resend, hosting plan; plan §8) still listed in STATUS carry-over
- [ ] Sprint 5 is already archived; the Sprint 6 plan and task list move to `docs/archive/` at the Sprint 7 close
