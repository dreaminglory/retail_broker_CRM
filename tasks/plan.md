# Implementation Plan: trustworthy-loop

> **Spec:** `spec/trustworthy-loop.md` · **Checklist:** `tasks/todo.md`
> **Status:** approved scope, carried over from Sprint 6 (slices 6.3–6.6). Slices 6.0–6.2 are done;
> their plan is in `docs/archive/sprint-6-implementation-plan.md`.

## Overview
Four phases, each one a vertical piece that can be merged and checked on its own: inquiry intake
integrity, lists at volume, import and i18n hygiene, and service tests in CI. Phase 1 goes first
because the `reminders` module needs inquiry reassign; the others can run in any order after it.

## Architecture decisions
- Phone parsing uses `libphonenumber-js` (min metadata), BG default region, behind the existing
  `normalizePhone()` signature (AD-041, Proposed: accept it when Task 1 lands).
- Caller data already stored is fixed by a backfill migration; `raw_payload` is never touched.
- `reassignInquiryAction` moves from `exceptions/actions.ts` to `inquiries/actions.ts` so the
  inbox and Exceptions share one action (AD-001: any member may assign).
- Paging is server-side (`count` + `range`, 50 per page, `?page=`) with one shared `ListPager`.
- The import revert fix, `db_recheck` CHECK value and `handle_new_user` fallback are new
  migrations; applied migrations are never edited.
- Service integration tests run against local Supabase as the seeded users (AD-043).

## Task list

### Phase 1: Inquiry intake integrity
- [x] Task 1: International and landline phones (FR-CON-15)
- [x] Task 2: Normalise inquiry callers in validation and conversion (FR-INQ-14)
- [x] Task 3: Backfill stored inquiry callers
- [x] Task 4: Phone-aware global search
- [x] Task 5: Edit and reassign an inquiry (FR-INQ-13)

### Checkpoint: intake
- [x] AC-1…AC-4 of the spec pass; Definition of Done for each task

### Phase 2: Lists at volume
- [x] Task 6: Volume seed script
- [x] Task 7: Paginated opportunity list with a shared pager
- [x] Task 8: Pager on contacts and inquiries (FR-CON-10)
- [x] Task 9: Agency-wide contact picker (FR-OPP-16)
- [x] Task 10: Broker and temperature filters on opportunities (FR-OPP-11)

### Checkpoint: volume
- [x] AC-5…AC-7 pass with the volume seed loaded

### Phase 3: Import and i18n hygiene
- [x] Task 11: Safe import revert and the `db_recheck` status
- [x] Task 12: Profile name fallback at signup (FR-PRF-03)
- [x] Task 13: Remove English leaks and untranslated errors (FR-LOC-01)
- [x] Task 14: BG click-through of every route

### Checkpoint: hygiene
- [x] AC-8…AC-10 pass

### Phase 4: Service tests in CI
- [ ] Task 15: Supabase test client and the CI job
- [ ] Task 16: Inquiry service and validation suites
- [ ] Task 17 (cuttable): Opportunity and merge service suites

### Checkpoint: module done
- [ ] AC-11 passes; all spec acceptance criteria met
- [ ] Close the module (AGENTS.md *Workflow* step 6)

## Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Backfill meets numbers that don't parse | Med | Leave them unchanged and count them in the migration's notice |
| Async picker or pager breaks mobile layouts | Med | Browser check at 390 px in both locales per task |
| Service tests are flaky against a shared local stack | Med | Each suite creates its own rows and cleans up; skip without `SUPABASE_TEST_URL` |

## Open questions
- None blocking.
