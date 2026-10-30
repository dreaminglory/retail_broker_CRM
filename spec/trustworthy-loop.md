# Spec: trustworthy-loop

> **Status:** In progress. Approved scope (founder, 2026-10-28, as Sprint 6). Plan: `tasks/plan.md`.
> **Evidence:** `docs/research/crm-competitive-gap-analysis.md` §5.0, `docs/research/brokercrm-feature-inventory.md`
> §2.13 and §4. Nothing is E3 yet (`SPEC.md` *Pilot evidence* is empty).

## Objective

Make the core loop something an agency can trust with its real data before the pilot: caller
data is clean and assignable, every list works at agency volume, an import revert never deletes
worked-on records, the BG interface has no English, and the services the loop depends on have
tests that run in CI.

Already done in this module (Sprint 6, slices 6.0–6.2): prod synced with migration history
(AD-040), config and merge role gates (AD-045), `src/proxy.ts`, the local QA stack and E2E smoke
(AD-043), and the follow-up loop fixes on Today and the opportunity page (AD-044, AD-046).

**Users:** brokers (step 2: contact matched or created; step 6–8 on Today), managers
(assignment from Exceptions), owners (data imported from their old tool).

## Business rules

**International phones** (AD-041, assumption A2)
1. Any number libphonenumber-js accepts, with BG as the default region: `0888…` and `02 …`
   become `+359…`, landlines are valid. A number that can't be parsed is rejected (AD-012 kept).
   [ASSUMPTION — validate in pilot: count of non-`+359` and landline numbers stored per agency]
2. An inquiry's caller phone and email are normalised like contact methods (E.164, lowercase).
3. The duplicate check at conversion matches on phone **and** email.
4. Global search normalises queries that look like phone numbers.

**Inquiry edit and reassign**
5. Editable: caller fields, source, subject, description, external ref, assignee.
   Never editable: `raw_payload`, `received_at`.
6. Any member may assign an inquiry (AD-001). The card shows the assignee's name. Unassigned
   inquiries can be assigned from Exceptions.

**Lists at volume**
7. Contacts, opportunities and inquiries page at 50 rows with `?page=`; no 200-row cap.
8. Contact pickers search the whole agency (20 results), not a preloaded list.
9. Opportunities filter by broker and temperature as well as status, stage and type.

**Import and i18n hygiene**
10. Reverting an import skips any contact that has gained a note, task, opportunity or merge
    since the import, and marks every row `reverted` or `revert_skipped`.
11. A `db_recheck` row is `skipped`; the "update existing" strategy is hidden until it's built.
12. A new signup's profile name falls back from `display_name` to `full_name`, then first +
    last name, then the email prefix.
13. No English in the BG UI, including errors: repository errors become `DomainError` keys, and
    signup, onboarding and profile actions use `toActionError()`.

## Edge cases
- A phone stored before this module as a BG-mobile-only string: the backfill migration
  normalises inquiry callers where they parse and leaves the rest untouched.
- An inquiry with no assignee shown on Exceptions; an assignee who is later deactivated.
- A contact merged after an import, then the import is reverted.
- DST changes and Sofia midnight for anything date-based (`src/lib/time/agency-day.ts`).

## Success criteria
- **AC-1** `+44 7700 900123` and `02 987 6543` are saved as E.164 (FR-CON-15).
- **AC-2** An inquiry with `0888 123 456` converts with a duplicate warning against a contact
  with `+359888123456` (FR-INQ-14).
- **AC-3** An inquiry's assignee can be changed from the inbox and from Exceptions, and the card
  shows the name (FR-INQ-13, FR-INQ-05/11).
- **AC-4** Editing an inquiry never changes `raw_payload`.
- **AC-5** With 2,000 contacts, contact #1,999 can be found and picked in the opportunity form
  (FR-OPP-16).
- **AC-6** Every list has a working pager, and pages load in under 3 s locally (NFR-07,
  FR-CON-10).
- **AC-7** Filtering opportunities by broker and temperature works (FR-OPP-11).
- **AC-8** Reverting an import whose contact got a note keeps the contact and the note.
- **AC-9** A BG click-through of every route at desktop and 390 px shows no English (FR-LOC-01).
- **AC-10** A new signup's profile shows the full name (FR-PRF-03).
- **AC-11** CI runs the service suites against local Supabase and they're green; every service
  file changed in this module has a test file (FR-TST-03).

## Testing strategy
- Vitest unit tests for phone parsing, validation and paging maths.
- Service integration tests in Vitest against local Supabase, signed in as the seeded users
  (`src/test/supabase-test-client.ts`); they skip when `SUPABASE_TEST_URL` is unset, and the CI
  `database` job runs them after pgTAP. Coverage is printed, not gated (AD-043).
- pgTAP for the caller backfill and the import revert, recheck and profile-name changes.
- A volume seed (`scripts/seed-volume.ts`, local only) for the 2,000-contact checks.
- Browser check in `bg` and `en` at 1280 and 390 px for every UI change.

## Boundaries
- Always: the AGENTS.md rules and Definition of Done; `supabase-patterns` for every migration.
- Ask first: adding `libphonenumber-js` beyond the min metadata build; anything that touches
  `raw_payload`.
- Never: modify a migration that has already run on prod; write `audit_log` or
  `next_action_at` from app code.

## Cut order if time runs short
1. Owner and primary-contact columns on opportunity rows.

## Open questions
- None. The AD-045 merge-RPC question is answered by AD-050.
