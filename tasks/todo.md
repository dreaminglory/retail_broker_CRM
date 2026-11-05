# Tasks: requirements

> **Plan:** `tasks/plan.md` · **Spec:** `spec/requirements.md`
> Every task also clears the Definition of Done in `AGENTS.md`. Tick a task only after that.
> Migrations: `20261105000001`… in order. pgTAP: `077-requirements.sql`, `078-requirement-writes.sql`.

## Phase 1: Data model

## Task 1: Requirement tables, constraints, guards and AD-059
**Description:** Create `feat/requirements` and mark `requirements` In progress in `SPEC.md`.
Write AD-059 in `docs/decisions-log.md` with the plan's architecture decisions, and update
`spec/requirements.md` where they sharpen it (the audit line: no new `entity_type`). Migration
`20261105000001_requirements.sql` per `supabase-patterns`:
- **`requirements`:** every spec field plus `location_keys text[] NOT NULL DEFAULT '{}'`.
  Unique `opportunity_id`, composite FK to opportunities `CASCADE`.
- **`CHECK`s:**
  - min ≤ max; rooms 1–9; budget and m² > 0; floor −5…200
  - `property_types` and `construction` are `<@` the property lists
  - `financing` list; `wishes` ≤ 2,000 chars
  - rule 2 (at least one criterion, counting `location_keys`)
  - rule 4 (each must flag only with its criterion)
- **`requirement_locations`:** `agency_id`, `requirement_id` (composite FK `CASCADE`),
  `settlement_id` (`RESTRICT`), `area_id` with a composite FK to `areas (agency_id,
  settlement_id, id)` `RESTRICT`; `UNIQUE NULLS NOT DISTINCT (requirement_id, settlement_id,
  area_id)`.
- **RLS and grants:** `ENABLE` + `FORCE`; `SELECT` policy only; `INSERT`, `UPDATE`, `DELETE`
  revoked from `authenticated` and `anon`. Writes come in Task 2.
- **Triggers:**
  - `BEFORE INSERT` on `requirements` refuses a non-buyer/tenant opportunity
    (`requirements.errors.wrongOpportunityType`)
  - `trg_check_opportunity_type_vs_requirement` refuses a type change to seller or landlord
    (`opportunities.errors.typeHasRequirement`)
- **Tests and docs:**
  - Add both tables to `010-rls-catalog.sql`.
  - Start `077-requirements.sql`, inserting as the table owner to test the constraints.
  - Update `docs/domain-model.md`:
    - §2.7 gets a requirement sub-diagram (or a new §2.8)
    - invariants Q1…: one per deal, buyer/tenant only, type guard, `CHECK`s, single writer
    - glossary: Requirement = Изисквания
    - migration count in the header

**Acceptance criteria:**
- [x] Every `CHECK` from rules 2–4 refuses a bad row (AC-4, AC-5 at the DB layer)
- [x] A requirement on a seller deal, a second requirement on one deal, and a buyer → seller change with a requirement are refused; buyer → tenant passes (AC-3 at the DB layer)
- [x] An area of Plovdiv under Sofia and an Alpha area on a Beta requirement are refused by the FKs; members can read their own agency's rows only and can't write either table directly (AC-7 part)

**Verification:**
- [x] `npx supabase db reset` then `npm run test:db`

**Dependencies:** None
**Files likely touched:** `SPEC.md`, `docs/decisions-log.md`, `spec/requirements.md`, `supabase/migrations/20261105000001_requirements.sql`, `supabase/tests/database/010-rls-catalog.sql`, `supabase/tests/database/077-requirements.sql`, `docs/domain-model.md`
**Estimated scope:** M (two docs files are edits only)

## Task 2: Save and remove RPCs with the audit trigger
**Description:** Migration `20261105000002_requirement_writes.sql`:
- **`save_requirement(p_opportunity_id uuid, p_fields jsonb, p_locations jsonb)`**, `SECURITY
  DEFINER`, granted to `authenticated` only. It:
  - checks that the opportunity is in `current_agency_id()`, is buyer/tenant, and is `active` or
    `nurture`; otherwise it raises `requirements.errors.notFound`, `wrongOpportunityType` or
    `readOnly`
  - upserts the row and replaces its locations
  - writes the sorted `location_keys` in the same `UPDATE`
  - returns the requirement id
- **`remove_requirement(p_opportunity_id uuid)`** has the same checks, then deletes the row.
- **`audit_requirement_changes()`**, `AFTER INSERT OR UPDATE OR DELETE` on `requirements`. It
  writes one `opportunity` row with `field_name = 'requirement'` and
  `metadata = { event, changes: [{ field, from, to }] }`:
  - only the fields that changed, and nothing when nothing changed
  - locations as `{ settlement_bg, settlement_en, area }` lists resolved from `OLD` and
    `NEW.location_keys`
  - `performed_by` = `auth.uid()`

Write `078-requirement-writes.sql`.

**Acceptance criteria:**
- [x] A save that changes the budget max and adds a location writes exactly one audit row with both changes and their old values; a save with no change writes none (AC-2 at the DB layer)
- [x] `location_keys` equals the saved locations after create, edit and an edit that clears them; a save on a won deal and on a seller deal is refused with its key; reopening makes it writable (AC-6 at the DB layer)
- [x] A Beta broker calling either RPC with an Alpha opportunity id gets `notFound` and no row changes; deleting an opportunity deletes its requirement and locations (AC-7)

**Verification:**
- [x] `npx supabase db reset` then `npm run test:db`
- [x] `docs/domain-model.md` invariants updated for the RPCs and the audit shape (§2.4 History)

**Dependencies:** Task 1
**Files likely touched:** `supabase/migrations/20261105000002_requirement_writes.sql`, `supabase/tests/database/078-requirement-writes.sql`, `docs/domain-model.md`
**Estimated scope:** M

## Task 3: Seed requirements for both agencies
**Description:** In `supabase/seed.sql`:
- add buyer and tenant opportunities with their contacts and participants: two more for Alpha
  (one tenant), three for Beta (one tenant); today Alpha has one buyer deal and Beta has none
- give requirements through `save_requirement`, or direct inserts as the seed owner with
  matching `location_keys`:
  - Alpha Opp 1: several Sofia areas
  - one deal with a budget only
  - one tenant deal with a monthly budget
  - one buyer/tenant deal left without a requirement, for the empty state
- add requirements for Beta

**Acceptance criteria:**
- [x] `db reset` loads the seed; every seeded requirement satisfies the `CHECK`s and `location_keys` matches its locations
- [ ] Existing service and E2E suites still pass unchanged — services pass (635); **E2E not run** (2026-11-05): `next dev` can't load SWC's native binding on this machine (`ERR_SWC_NATIVE_CACHE`, a folder ACL check), so Playwright's web server never starts

**Verification:**
- [ ] `npx supabase db reset`, `npm run test:db`, `npm run test:services` ✓; `npm run test:e2e` blocked as above

**Dependencies:** Task 2
**Files likely touched:** `supabase/seed.sql`
**Estimated scope:** S

### Checkpoint 1: Data model
- [x] `npx supabase db reset` and `npm run test:db` green
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` green — lint (0 errors) and test pass; `tsc --noEmit` passes, but `npm run typecheck`'s `next typegen` step hits the same SWC error
- [x] Founder reviews AD-059 (`SECURITY DEFINER` writers, `location_keys`, audit shape) and `docs/domain-model.md` before any UI — accepted 2026-11-05

## Phase 2: Opportunity page

## Task 4: Show the requirement on the opportunity
**Description:** `src/domain/requirements/`:
- `types.ts`
- `repository.ts`: `findByOpportunity` embedding locations with settlement and area names;
  fallback to a second query if the composite-FK embed doesn't resolve
- `summary.ts` with `summary.test.ts`: ranges, open bounds ("до €200 000", "от 2 стаи"),
  several areas, a whole settlement, rent vs price, must-haves marked, BG and EN

Add an "Изисквания" section to the opportunity page for buyer/tenant deals (Server Component
data in `page.tsx`, `src/components/domain/requirements/requirement-section.tsx`):
- empty state
- summary line, then the full criteria, financing, wishes and "updated on"
- inactive areas marked

Seller/landlord deals show nothing.

**Acceptance criteria:**
- [x] The seeded Alpha buyer deal shows its summary and criteria in BG and EN; the deal without a requirement shows the empty state; a seller deal shows no section
- [x] `summary.ts` covers every case listed above in both locales

**Verification:**
- [x] `npx vitest run src/domain/requirements` (summary, plus the read in `service.integration.test.ts` and an SSR test of the section)
- [x] Browser: seeded deals, BG and EN, 1280 and 390 px (checked through the DOM; the pane's screenshots timed out). The dev server runs with `SWC_NATIVE_BINDING_CACHE` set, as in `.claude/launch.json`.
- Names come from `SettlementService` and `AreaService`, as for property links; the locations embed over the composite FK resolves.

**Dependencies:** Task 3
**Files likely touched:** `src/domain/requirements/{types,repository,summary,summary.test}.ts`, `src/components/domain/requirements/requirement-section.tsx`, `src/app/(dashboard)/opportunities/[id]/{page,opportunity-detail-client}.tsx`, `messages/{bg,en}.json`
**Estimated scope:** M

## Task 5: Add and edit a requirement
**Description:**
- **Validation:** `validation.ts` with `validation.test.ts`, a Zod schema mirroring rules 2–4.
  It refuses a whole settlement together with one of its areas, and refuses a must flag
  without its criterion. The form sets the default must flags for budget, location and type
  when they're filled.
- **Service:** `service.ts`, `RequirementService.save`. It gives friendly errors for a
  seller/landlord deal and a closed deal, then calls the RPC and maps its `P0001` keys to
  `DomainError`. Add `service.integration.test.ts` to the service suites.
- **Server Action:** `src/app/(dashboard)/opportunities/[id]/requirement/actions.ts`
  (`getAuthContext` → Zod → service → `revalidatePath`, `ActionResult`).
- **Form:** `requirement-form.tsx` in a Sheet on mobile, with groups budget, where, what and
  extra; a location picker (settlement via `SettlementCombobox`, then several of its active
  areas, several settlements); a must-have toggle per matchable criterion; a budget label for
  price or monthly rent by deal type; the floor hint "партер = 1".
- **Property form:** add the same floor hint to `property-form.tsx`.

**Acceptance criteria:**
- [x] A broker records AC-1's requirement on a buyer deal and sees it in the section; budget, location and type are must-haves by default and can be switched off (switching off: `applyDefaultMust` tests; not clicked in the browser yet, see Task 6)
- [x] No criterion, `rooms_min` > `rooms_max`, and a must flag on an empty criterion are refused with translated messages by Zod; the same cases pass Zod in a test and are refused by the RPC (AC-4, AC-5)
- [x] Editing keeps unchanged fields and locations; both floor fields show the hint

**Verification:**
- [x] `npx vitest run src/domain/requirements`, `npm run test:services` (733, after a `db reset`: the browser check had filled Alpha Opp 3)
- [x] Browser: create and edit on Alpha Opp 3 in BG at the pane's desktop width, the form in EN at 390 px, the property form's hint in both languages. Driven through DOM events: the hidden pane takes no pointer clicks.

**Dependencies:** Task 4
**Files likely touched:** `src/domain/requirements/{validation,validation.test,service,service.integration.test}.ts`, `src/app/(dashboard)/opportunities/[id]/requirement/actions.ts`, `src/components/domain/requirements/{requirement-form,location-picker}.tsx`, `src/components/domain/properties/property-form.tsx`, `messages/{bg,en}.json`
**Estimated scope:** L. Split if it runs long: 5a validation, service and action; 5b form and picker.

## Task 6: Remove, read-only on closed deals, type-change error
**Description:**
- `RequirementService.remove` and its action, with a confirm dialog in the section.
- The section is read-only (no edit or remove) when the deal is won, lost or archived.
- `OpportunityRepository` maps `opportunities.errors.typeHasRequirement` like
  `typeHasProperties`, so changing a buyer deal with a requirement to seller shows a toast.

**Acceptance criteria:**
- [x] Removing a requirement brings back the empty state; a won deal shows it read-only and, reopened, editable (AC-6)
- [x] Changing a buyer deal with a requirement to seller is refused with a translated message; buyer → tenant keeps it and the budget label says rent (AC-3). The message shows inline in the opportunity form, like `typeHasProperties`, not as a toast.

**Verification:**
- [x] `npm run test:services` (remove, closed guard, type-change mapping): 750 after a `db reset`
- [x] Browser: remove with confirm and cancel, switching a default must-have off, won → read-only (BG and EN) → reopened → editable, tenant → landlord refused, tenant → buyer keeps it with the price label. The won status was set in the local DB; the type was set on the form's hidden input (the hidden pane's selects don't open).

**Dependencies:** Task 5
**Files likely touched:** `src/domain/requirements/{service,service.integration.test}.ts`, `src/app/(dashboard)/opportunities/[id]/requirement/actions.ts`, `src/components/domain/requirements/requirement-section.tsx`, `src/domain/opportunities/repository.ts`, `messages/{bg,en}.json`
**Estimated scope:** M

## Task 7: Requirement entries on the timelines
**Description:**
- `describeAudit` gets a `requirement` kind (`event`, `changes`), covered in
  `audit-event.test.ts`.
- `timeline-entry.tsx` renders created, changed and removed: each changed criterion as
  old → new, with money, ranges and lists formatted and location names in the user's locale.
- Extend `service.integration.test.ts` in the timeline domain: one entry per save on the
  opportunity timeline, also shown on the contact timeline.

**Acceptance criteria:**
- [x] AC-2: changing the budget max from €200,000 to €220,000 and adding Mladost 1 shows one entry with both changes and their old values, in BG and EN
- [x] Created and removed entries show; a renamed area keeps its name at the time in old entries (the name comes from the row's metadata: SSR test; not renamed in the browser)

**Verification:**
- [x] `npx vitest run src/domain/timeline`, `npm run test:services` (764 after a `db reset`)
- [x] Browser: the AC-2 edit on Alpha Opp 1 through the form, then the opportunity and contact timelines in BG and EN at 390 px

**Dependencies:** Task 5
**Files likely touched:** `src/domain/timeline/{audit-event,audit-event.test,service.integration.test}.ts`, `src/components/domain/timeline/timeline-entry.tsx`, `messages/{bg,en}.json`
**Estimated scope:** M

### Checkpoint 2: Opportunity page
- [ ] AC-1 (opportunity part) through AC-6 seen in the browser in BG and EN at 1280 and 390 px
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:services`, `npm run test:db` green
- [ ] `/review` of Phases 1–2

## Phase 3: E2E and cut items

## Task 8: E2E for the requirement loop
**Description:** `e2e/requirements.spec.ts`: on a seeded buyer deal without a requirement, add
one (two areas, budget, type), edit the budget, see the summary and the single timeline entry.
BG and EN, 1280 and 390 px, using `e2e/fixtures.ts`. It must not depend on the cut items.

**Acceptance criteria:**
- [ ] The spec passes in all four projects (BG/EN × 1280/390) and leaves the seed reusable (or resets what it changed)

**Verification:**
- [ ] `npm run test:e2e`

**Dependencies:** Tasks 5, 7
**Files likely touched:** `e2e/requirements.spec.ts`, possibly `e2e/fixtures.ts`
**Estimated scope:** S

## Task 9: Buyer ↔ tenant budget notice (cut 3)
**Description:** In `opportunity-form.tsx`, when the type changes between buyer and tenant on a
deal with a requirement, show a notice that the budget is now read as rent (or price).

**Acceptance criteria:**
- [ ] The notice shows only for buyer ↔ tenant on a deal with a requirement, in BG and EN

**Verification:**
- [ ] Browser: BG and EN; `npm run lint`

**Dependencies:** Task 6
**Files likely touched:** `src/components/domain/opportunities/opportunity-form.tsx`, `src/app/(dashboard)/opportunities/[id]/opportunity-detail-client.tsx`, `messages/{bg,en}.json`
**Estimated scope:** S

## Task 10: Summary on the opportunities list (cut 2)
**Description:** The opportunities list query embeds the requirement with location names, and
the list shows the summary line under the title on buyer/tenant rows (table and mobile cards).
A repository test checks that the embed doesn't change the row count or the pager total.

**Acceptance criteria:**
- [ ] Buyer/tenant rows with a requirement show the summary; others show nothing; the pager totals are unchanged

**Verification:**
- [ ] `npm run test:services`; browser BG and EN, 1280 and 390 px

**Dependencies:** Task 4
**Files likely touched:** `src/domain/opportunities/{repository,types,service.integration.test}.ts`, `src/components/domain/opportunities/opportunity-list-table.tsx`, `src/app/(dashboard)/opportunities/opportunities-page-client.tsx`
**Estimated scope:** M

## Task 11: Summary on the contact page (cut 1)
**Description:** The contact page's linked opportunities show the summary line for buyer/tenant
deals.

**Acceptance criteria:**
- [ ] The seeded buyer contact's deal shows its summary in BG and EN

**Verification:**
- [ ] Browser BG and EN, 390 px; `npm run test`

**Dependencies:** Task 4
**Files likely touched:** `src/app/(dashboard)/contacts/[id]/page.tsx`, `src/components/domain/contacts/linked-opportunities.tsx`, `src/domain/opportunities/repository.ts`
**Estimated scope:** S

### Checkpoint 3: Complete
- [ ] AC-1…AC-8 met; the full Definition of Done in `AGENTS.md`
- [ ] `/review`
- [ ] Close the module: `SPEC.md` Done, FR-REQ rows ✅ in `docs/BRD.md`, `tasks/*` → `docs/archive/requirements-*.md`, spec status Done
