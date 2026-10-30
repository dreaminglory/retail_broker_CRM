# Tasks: trustworthy-loop

> **Plan:** `tasks/plan.md` · **Spec:** `spec/trustworthy-loop.md`
> Every task also clears the Definition of Done in `AGENTS.md`. Tick a task only after that.

## Task 1: International and landline phones
**Description:** Replace the BG-mobile regex in `normalizePhone()` with `libphonenumber-js` (min
metadata, BG default region), keeping its signature. Turn the landline `it.todo` cases into real
tests and add foreign numbers. Mark AD-041 Accepted in `docs/decisions-log.md`.

**Acceptance criteria:**
- [x] `+44 7700 900123`, `+49 30 123456`, `02 987 6543` and `0888 123 456` normalise to E.164
- [x] An unparseable number is still rejected

**Verification:**
- [x] `npx vitest run src/domain/contacts/phone.test.ts`
- [x] Creating a contact with a UK number in the browser saves `+447700900123`

**Dependencies:** None
**Files likely touched:** `package.json`, `src/domain/contacts/phone.ts`, `src/domain/contacts/phone.test.ts`
**Estimated scope:** S

## Task 2: Normalise inquiry callers in validation and conversion
**Description:** Inquiry validation normalises caller phone (E.164) and email (lowercase).
`InquiryService.convert` normalises before copying to `contact_methods`, and its duplicate check
passes both phone and email.

**Acceptance criteria:**
- [x] An inquiry `0888 123 456` converts with a duplicate warning against `+359888123456` (AC-2)
- [x] `raw_payload` is unchanged after create, edit and convert (AC-4)

**Verification:**
- [x] `npx vitest run src/domain/inquiries`
- [x] Manual: convert a seeded inquiry with a local-format number and see the duplicate warning

**Dependencies:** Task 1
**Files likely touched:** `src/domain/inquiries/validation.ts`, `validation.test.ts`, `service.ts`
**Estimated scope:** S

## Task 3: Backfill stored inquiry callers
**Description:** A migration normalises existing caller phones to E.164 and emails to lowercase
where they parse, leaving `raw_payload` and unparseable values alone. pgTAP covers it.

**Acceptance criteria:**
- [x] After `npx supabase db reset`, seeded inquiry callers are E.164 and lowercase
- [x] `raw_payload` is byte-for-byte unchanged

**Verification:**
- [x] `npx supabase db reset` then `npm run test:db`

**Dependencies:** Task 1 (same parsing rules)
**Files likely touched:** `supabase/migrations/<ts>_normalise_inquiry_callers.sql`, `supabase/tests/database/0NN-inquiry-callers.sql`
**Estimated scope:** S

## Task 4: Phone-aware global search
**Description:** Global search normalises queries that look like phone numbers before matching.

**Acceptance criteria:**
- [x] Searching `0888 123 456` finds the contact stored as `+359888123456`

**Verification:**
- [x] Vitest for the query normaliser; manual ⌘K check

**Dependencies:** Task 1
**Files likely touched:** the global search action and repository
**Estimated scope:** XS

## Task 5: Edit and reassign an inquiry
**Description:** Move `reassignInquiryAction` to `inquiries/actions.ts`. Add an edit dialog that
reuses `inquiry-form.tsx` and wires `updateInquiryAction`. Show the assignee's name on
`inquiry-card.tsx`. Add an assign select to the Exceptions unassigned list. i18n keys in both files.

**Acceptance criteria:**
- [x] The assignee can be changed from the inbox and Exceptions, and the card shows the name (AC-3)
- [x] `raw_payload` and `received_at` can't be edited (AC-4)

**Verification:**
- [x] `npm run test`; browser check in `bg` and `en` at 1280 and 390 px

**Dependencies:** Task 2
**Files likely touched:** `src/app/(dashboard)/inquiries/actions.ts`, `src/app/(dashboard)/exceptions/actions.ts`, `src/components/domain/inquiries/*`, the Exceptions page, `messages/{bg,en}.json`
**Estimated scope:** M

## Checkpoint: intake
- [x] AC-1…AC-4 pass; review with the founder before Phase 2

## Task 6: Volume seed script
**Description:** `scripts/seed-volume.ts` adds 2,000 contacts and 300 opportunities to the local
stack (refuses to run against a non-local URL).

**Acceptance criteria:**
- [x] Running it twice doesn't duplicate data; it never runs against prod

**Verification:**
- [x] Run after `npx supabase db reset`; counts match

**Dependencies:** None
**Files likely touched:** `scripts/seed-volume.ts`, `package.json`
**Estimated scope:** S

## Task 7: Paginated opportunity list with a shared pager
**Description:** The opportunities repository uses `count` + `range` (50 per page) and drops the
200 cap. A shared `ListPager` (prev/next, "x–y of n", `?page=`) shows on the opportunity list.

**Acceptance criteria:**
- [x] With the volume seed, all 300 opportunities are reachable page by page
- [x] A page loads in under 3 s locally (NFR-07)

**Verification:**
- [x] Vitest for the paging maths; browser check at 390 px

**Dependencies:** Task 6
**Files likely touched:** `src/domain/opportunities/repository.ts`, `src/components/ui/list-pager.tsx` (or `components/domain/shared`), the opportunities page
**Estimated scope:** M

## Task 8: Pager on contacts and inquiries
**Description:** Reuse `ListPager` on the contact and inquiry lists.

**Acceptance criteria:**
- [x] Every list has a working pager (AC-6, FR-CON-10)

**Verification:**
- [x] Browser check in `bg` and `en` at 1280 and 390 px

**Dependencies:** Task 7
**Files likely touched:** contacts and inquiries pages and repositories
**Estimated scope:** S

## Task 9: Agency-wide contact picker
**Description:** A `searchContactsForPicker(q)` action (20 results) and an async shadcn
`ContactCombobox` replace the 200-row selects in `opportunity-form` and `convert-inquiry-dialog`.

**Acceptance criteria:**
- [x] With 2,000 contacts, contact #1,999 can be found and picked in the opportunity form (AC-5)

**Verification:**
- [x] Browser check at 390 px; Vitest for the action's validation

**Dependencies:** Task 6
**Files likely touched:** `src/components/domain/contacts/contact-combobox.tsx`, `opportunity-form.tsx`, `convert-inquiry-dialog.tsx`, the contacts actions
**Estimated scope:** M

## Task 10: Broker and temperature filters on opportunities
**Description:** Add broker and temperature filters (the repository already supports
`assignedTo`). Cuttable part: owner and primary-contact columns on the rows.

**Acceptance criteria:**
- [x] Filtering by broker and temperature works and combines with the other filters (AC-7)

**Verification:**
- [x] Browser check in both locales

**Dependencies:** Task 7
**Files likely touched:** `opportunities-page-client.tsx`, `src/domain/opportunities/repository.ts`, `messages/{bg,en}.json`
**Estimated scope:** S

## Checkpoint: volume
- [x] AC-5…AC-7 pass with the volume seed loaded

## Task 11: Safe import revert and the `db_recheck` status
**Description:** A migration fixes the revert guard (skip contacts that gained a note, task,
opportunity or merge since the import; mark every row `reverted` or `revert_skipped`) and adds
`db_recheck` to the `match_reason` CHECK. Hide the "update existing" strategy in the UI.

**Acceptance criteria:**
- [x] Reverting an import whose contact got a note keeps the contact and the note (AC-8)
- [x] A `db_recheck` row is `skipped`

**Verification:**
- [x] pgTAP `063` and `061` updated; `npx supabase db reset` then `npm run test:db`

**Dependencies:** None
**Files likely touched:** `supabase/migrations/<ts>_fix_import_revert_and_recheck.sql`, `supabase/tests/database/061-*.sql`, `063-*.sql`, `src/components/domain/imports/import-options-form.tsx`
**Estimated scope:** M

## Task 12: Profile name fallback at signup
**Description:** `handle_new_user` falls back from `display_name` to `full_name`, then first +
last name, then the email prefix.

**Acceptance criteria:**
- [x] A new signup's profile shows the full name (AC-10)

**Verification:**
- [x] pgTAP `031`; manual signup on the local stack

**Dependencies:** None
**Files likely touched:** `supabase/migrations/<ts>_profile_name_fallback.sql`, `supabase/tests/database/031-provisioning.sql`
**Estimated scope:** S

## Task 13: Remove English leaks and untranslated errors
**Description:** Fix the strings listed in inventory §2.13. Repository `Error`s become
`DomainError` keys. Signup, onboarding and profile actions use `toActionError()`.

**Acceptance criteria:**
- [x] No new `i18next/no-literal-string` warnings; the suppressed ones in touched files are gone
- [x] Every new key exists in `messages/bg.json` and `messages/en.json`

**Verification:**
- [x] `npm run lint`; `npx eslint . --prune-suppressions` if suppressions shrank

**Dependencies:** None
**Files likely touched:** repositories under `src/domain/`, signup/onboarding/profile actions, `messages/{bg,en}.json`
**Estimated scope:** M

## Task 14: BG click-through of every route
**Description:** Walk every route in `bg` at 1280 and 390 px and fix what's left. Closes the
Sprint 5 carry-over.

**Acceptance criteria:**
- [x] No English visible anywhere (AC-9, FR-LOC-01)

**Verification:**
- [x] Manual, as an owner and as a broker

**Dependencies:** Task 13
**Files likely touched:** whatever the walk finds
**Estimated scope:** S

## Checkpoint: hygiene
- [x] AC-8…AC-10 pass

## Task 15: Supabase test client and the CI job
**Description:** `src/test/supabase-test-client.ts` signs in as the seeded users and skips when
`SUPABASE_TEST_URL` is unset. The CI `database` job runs the service suites after pgTAP and
prints coverage (not gated).

**Acceptance criteria:**
- [ ] A sample integration test runs locally against `npm run stack:up` and in CI

**Verification:**
- [ ] `npm run test` with and without `SUPABASE_TEST_URL`; CI green

**Dependencies:** None
**Files likely touched:** `src/test/supabase-test-client.ts`, `.github/workflows/ci.yml`, `vitest.config.*`
**Estimated scope:** S

## Task 16: Inquiry service and validation suites
**Description:** Integration tests for inquiry transitions and convert; validation tests for
tasks, inquiries and contacts where missing.

**Acceptance criteria:**
- [ ] Every service file changed in this module has a test file (AC-11)

**Verification:**
- [ ] `npm run test` against the local stack; CI green

**Dependencies:** Task 15
**Files likely touched:** `src/domain/inquiries/service.test.ts`, `src/domain/contacts/validation.test.ts`
**Estimated scope:** M

## Task 17 (cuttable): Opportunity and merge service suites
**Description:** Integration tests for opportunity close and reopen, and for merge (moves
children, archives the loser).

**Acceptance criteria:**
- [ ] Suites green locally and in CI; FR-TST-03 becomes ✅

**Verification:**
- [ ] `npm run test` against the local stack

**Dependencies:** Task 15
**Files likely touched:** `src/domain/opportunities/service.test.ts`, `src/domain/contacts/merge.test.ts`
**Estimated scope:** M

## Checkpoint: module done
- [ ] All spec acceptance criteria met
- [ ] Close the module (AGENTS.md *Workflow* step 6)
