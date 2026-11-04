# Tasks: properties

> **Plan:** `tasks/plan.md` · **Spec:** `spec/properties.md`
> Every task also clears the Definition of Done in `AGENTS.md`. Tick a task only after that.
> Migrations: `20261103000001`… in order. pgTAP: `072-properties.sql`, `073-property-triggers.sql`.

## Phase 1: Data model

## Task 1: Settlements reference data (EKATTE)
**Description:** Create `feat/properties` and mark `properties` In progress in `SPEC.md`. Add
`scripts/ekatte/build-settlements.mjs`: it reads the NSI EKATTE export (settlements, municipalities,
provinces), transliterates names under the 2009 Transliteration Act and writes
`supabase/migrations/20261103000001_settlements.sql`. The migration creates the global
`settlements` table (`ekatte` code PK-unique, `name_bg`, `name_en`, `kind` city/village,
`municipality_bg/en`, `province_bg/en`), adds `FORCE` RLS with `SELECT` for `authenticated` and no
write policies, adds prefix indexes, and inserts the rows. Add it to `010-rls-catalog.sql` as
global. Start `072-properties.sql`.

**Acceptance criteria:**
- [x] About 5,250 rows; София, Пловдив, Варна and one village present, with `name_en` Sofia, Plovdiv, Varna
- [x] Every role can read; no role can insert, update or delete (pgTAP)
- [x] The converter rejects an input file with missing or renamed columns, with a clear message

**Verification:**
- [x] `npx vitest run scripts/ekatte` (transliteration cases: щ→sht, ъ→a, ю→yu, final ия→ia)
- [x] `npx supabase db reset` then `npm run test:db`
- [x] Manual: migration file size noted in the task log; stop and ask if the licence is unclear or the file exceeds ~2 MB

**Log:** Source `Ekatte-2025-json.zip` (NSI, data as of 2025-12-23), 5,254 rows (257 towns, 4,997 villages; 2 monasteries skipped), migration 604 KB. The converter is TypeScript (`build-settlements.ts`, run with `node`) like `scripts/seed-volume.ts`; tests in `build-settlements.test.ts`. Our transliteration differs from NSI `name_en` on 4 rows, all NSI typos. Щъркелово is not in the register; pgTAP checks Щърково → Shtarkovo. NSI states no licence on the archive page (founder accepted, 2026-11-03).

**Dependencies:** None
**Files likely touched:** `SPEC.md`, `scripts/ekatte/build-settlements.mjs`, `scripts/ekatte/transliterate.test.ts`, `supabase/migrations/20261103000001_settlements.sql`, `supabase/tests/database/010-rls-catalog.sql`, `072-properties.sql`
**Estimated scope:** M

## Task 2: Property tables, RLS and constraints
**Description:** Migration `20261103000002_properties.sql` per `supabase-patterns`: `areas`,
`properties`, `listings`, `property_parties`, `opportunity_properties` with the tenant template;
`tasks.property_id` (`SET NULL`), `notes.property_id` with N1 extended to three parents;
`agencies.property_code_seq`; the rule 3 `CHECK`s; the partial unique indexes (open listing per
offer type, one `selected`, one open party); `opportunity_properties.property_id ON DELETE
RESTRICT`; area-belongs-to-settlement via composite FK. Areas: insert, update and delete are
owner/manager only (T6). Add every table to `010-rls-catalog.sql`. Update `docs/domain-model.md`
(new "Property" area in the context map, ER diagram, invariants, glossary: Имот, Обява, Квартал,
Населено място, Кандидат). Add AD-057 with the plan's decisions.

**Acceptance criteria:**
- [x] Beta's broker sees and writes none of Alpha's rows in the five tables; a broker can't delete a property, listing or area, a manager can
- [x] An apartment without `rooms`, a plot with `floor`, `floor > floors_total`, a price ≤ 0 and a second open sale listing are each rejected
- [x] A second `selected` link on one opportunity and an area from another settlement are rejected

**Verification:**
- [x] `npx supabase db reset` then `npm run test:db`
- [x] `npm run typecheck` (no generated-type drift)

**Log:** `typecheck` runs as `npx tsc --noEmit`: `next typegen` fails in this environment (SWC native binding refuses its cache folder because of the folder permissions; not a code issue). Beyond the plan, and recorded in AD-057: composite `(agency_id, x_id)` foreign keys, with `UNIQUE (agency_id, id)` added to contacts and opportunities; one `subject` per opportunity; a used area is `RESTRICT`; party hard delete is owner/manager only, link delete any member; `merge_contacts` moves property parties. The `audit_log.entity_type` extension moves to Task 3 with the audit triggers.

**Dependencies:** Task 1
**Files likely touched:** `supabase/migrations/20261103000002_properties.sql`, `010-rls-catalog.sql`, `072-properties.sql`, `docs/domain-model.md`, `docs/decisions-log.md`
**Estimated scope:** M

## Task 3: Property triggers
**Description:** Migration `20261103000003_property_triggers.sql`:
- the property `code` from `agencies.property_code_seq`
- audit triggers (SECURITY DEFINER, AD-020) writing `property` created / archived / assignment
  and `listing` created / price / status, with `audit_log.entity_type` extended
- link status changes as `opportunity` rows with `field_name = 'property_link'` and
  `metadata.property_id`
- rule 5 on `opportunity_properties` and a guard on `opportunities.type`
- rule 7 on task completion
- rule 8: archiving withdraws open listings and blocks new links, listings and viewing tasks

Write `073-property-triggers.sql`. Add the invariants to `docs/domain-model.md`.

**Acceptance criteria:**
- [x] Two concurrent inserts in one agency get different codes; codes are per agency
- [x] Completing a viewing task moves `candidate` → `viewed`, creates a missing link as `viewed`, and leaves `offered` untouched (AC-3 in the DB)
- [x] A `subject` link on a buyer opportunity, a buyer → seller type change with candidates, and a new listing on an archived property are each refused with an i18n key
- [x] Price and link status changes write one audit row each; members still can't insert into `audit_log`

**Verification:**
- [x] `npx supabase db reset` then `npm run test:db`

**Log:** Concurrency checked by hand with two `psql` sessions: the second insert waited on the counter row lock until the first finished (pgTAP runs one session). Beyond the plan: rule 4 is also a trigger (`guard_listing_update`, read-only closed or withdrawn listings, sets `closed_at`), adding and removing a link are audited too (NULL ↔ status), rule 7 creates a missing link only on buyer and tenant deals with an active property, and an existing link on an archived property can still change status. Raised keys for the services to map: `properties.errors.relationNotAllowed`, `properties.errors.archived`, `opportunities.errors.typeHasProperties`, `listings.errors.readOnly`. `050-trigger-integrity.sql` was left unchanged; the new triggers are covered in `073`.

**Dependencies:** Task 2
**Files likely touched:** `supabase/migrations/20261103000003_property_triggers.sql`, `073-property-triggers.sql`, `050-trigger-integrity.sql`, `docs/domain-model.md`
**Estimated scope:** M

## Task 4: Seed properties
**Description:** Extend `supabase/seed.sql`:
- both agencies get areas for Sofia (Лозенец, Младост 1, Център) and Plovdiv (Кършияка, Тракия)
- about 8 properties each, across the seven types
- sale and rent listings, including one reserved and one withdrawn
- parties on existing contacts
- candidate links in several statuses on the seeded buyer opportunities, and a subject link on a
  seller opportunity

**Acceptance criteria:**
- [x] `db reset` runs clean and every seeded row satisfies the Task 2–3 constraints
- [x] The existing E2E and service suites still pass

**Verification:**
- [x] `npx supabase db reset`, `npm run test:db`, `npm run test:services`, `npm run test:e2e`

**Log:** Seeded links use the existing deals, so other suites keep their counts: candidates (offered, viewed, candidate, rejected) on Alpha Opp 1 (buyer), and a subject link on Beta Opp 1 (seller). Both agencies have codes #1001–#1008. No `selected` link is seeded. test:db PASS, test:services 483/483, test:e2e 28/28 (on the dev server already running on :3000).

**Dependencies:** Task 3
**Files likely touched:** `supabase/seed.sql`
**Estimated scope:** S

## Checkpoint 1: Data model
- [x] `db reset`, `test:db`, `typecheck` (as `tsc --noEmit`), `lint` (0 errors, the 47 existing warnings), `test` green
- [x] Founder reviews the Property section of `docs/domain-model.md` and AD-057 before any UI (approved 2026-11-03)

## Phase 2: Inventory

## Task 5: Areas in Settings
**Description:** `src/domain/areas/` (types, Zod, repository, service) following lead sources;
a settlements lookup in `src/domain/settlements/` (prefix search, at most 20 rows, locale name);
`settings/areas` page and actions with `requireRole(ctx, CONFIG_ROLES)`: pick a settlement, then
add, rename, deactivate and reorder its areas. Add an entry to the settings sidebar. Add messages
to both locale files.

**Acceptance criteria:**
- [x] An owner adds "Лозенец" to София and sees it; a duplicate name (case-insensitive) is refused with a translated error (AC-7)
- [x] A broker doesn't see the Areas entry, and the action refuses them
- [x] The settlement search finds "плов" → Пловдив and "plov" → Plovdiv

**Verification:**
- [x] `npx vitest run src/domain/areas src/domain/settlements`
- [x] Browser: BG and EN, 1280 and 390 px

**Log:** The settlement search reads the Bulgarian name for Cyrillic input and the transliterated name otherwise, towns first. The search action lives in `src/app/(dashboard)/settlements/actions.ts` and the combobox in `src/components/domain/settlements/`, so Task 6 reuses both. Areas are deactivated, never deleted (a used area is RESTRICT). The page keeps the chosen settlement in `?settlement=` and shows chips for settlements that already have areas. The duplicate-name refusal maps 23505 to `areas.errors.duplicateName`. Browser: owner in BG and EN at 1280 and 390 px (add, duplicate refused, reorder, deactivate, "plov" → Plovdiv); broker sees no entry and is redirected.

**Dependencies:** Task 4
**Files likely touched:** `src/domain/areas/*`, `src/domain/settlements/*`, `src/app/(dashboard)/settings/areas/*`, `src/components/domain/areas/area-form.tsx`, `settings-sidebar.tsx`, `messages/{bg,en}.json`
**Estimated scope:** M

## Task 6: Create a property and see its page
**Description:** `src/domain/properties/` (types, Zod mirroring rule 3, repository, service with
the assignee check from I4). Components:
- `property-form.tsx`, whose fields follow the type (rooms only for apartments, plot m² for plots
  and houses)
- `settlement-combobox.tsx` and an area select filtered by settlement

Routes `/properties/new` and `/properties/[id]` (attributes, responsible broker, code). Add
"Имоти" to the sidebar between Opportunities and Contacts.

**Acceptance criteria:**
- [x] A broker creates "Sofia, Lozenets, 2 rooms, 68 m²" and lands on its page showing `#code` and the derived "двустаен" / "2-room"
- [x] Invalid combinations show field errors before submit; an inactive assignee is refused
- [x] A property of another agency returns 404

**Verification:**
- [x] `npx vitest run src/domain/properties`; service suite `PropertyService` in `npm run test:services`
- [x] Browser: BG and EN, 1280 and 390 px

**Log:** Rule 3 lives in `propertyFormSchema`: one table says which attributes each type has, the form shows only those, and the schema clears the rest so a hidden value never saves. The settlement is checked in the same refinement, so every field error shows at once, client-side before submit. A wrong area for the settlement maps `fk_properties_area` to `properties.errors.areaNotInSettlement`; trigger keys (`P0001`) pass through as i18n keys. "Имоти" sits between Contacts and Opportunities, the order the sidebar already has. A plain `/properties` list (newest 50, active) stands in until Task 9. Another agency gets 404: `getDetail` returns null (service suite) and the page also refuses a non-uuid id. Browser: broker in BG and EN at 1280 and 390 px; the AC-1 apartment saved as #1011 "Двустаен, Лозенец, София" / "2-room apartment, Лозенец, Sofia".

**Dependencies:** Task 5
**Files likely touched:** `src/domain/properties/*`, `src/app/(dashboard)/properties/{new,[id]}/*`, `src/app/(dashboard)/properties/actions.ts`, `src/components/domain/properties/{property-form,settlement-combobox}.tsx`, `sidebar.tsx`, `messages/{bg,en}.json`
**Estimated scope:** L (domain and form are one path; split the combobox out if it grows)

## Task 7: Listings on a property
**Description:** `src/domain/listings/` (Zod, repository, service: one open per offer type,
closed and withdrawn are read-only). A listings section on the property page: add a sale or
rent listing, change the price, reserve, close, withdraw. Price per m² is shown, not stored.

**Acceptance criteria:**
- [x] Add a sale listing at €185,000; change it to €179,000; both values are in `audit_log` (AC-5)
- [x] A second open sale listing and editing a closed one are refused with translated errors
- [x] A property can have an open sale and an open rent listing together

**Verification:**
- [x] `npx vitest run src/domain/listings`; `ListingService` in `npm run test:services`
- [x] Browser: BG and EN, 1280 and 390 px

**Log:** The service adds no checks of its own: the open-listing index maps to `listings.errors.openExists`, and the triggers raise `listings.errors.readOnly` and `properties.errors.archived`. The form only offers offer types without an open listing. Closing and withdrawing ask first because they are final. Price per m² is computed on screen (plots by plot area; rent with cents). Prices accept "185 000" and a decimal comma. Browser: BG and EN at 1280 and 390 px. On #1011: €185,000 → €179,000, with both values in `audit_log` (checked with psql); rent €900 opened next to the sale listing, then closed and read-only.

**Dependencies:** Task 6
**Files likely touched:** `src/domain/listings/*`, `src/components/domain/properties/listing-section.tsx`, `listing-form.tsx`, `properties/actions.ts`, `messages/{bg,en}.json`
**Estimated scope:** M

## Task 8: Parties on a property and on the contact page
**Description:** `src/domain/property-parties/` (repository, service). A parties section on the
property page: add an existing contact with a role (reusing `contact-combobox.tsx`) or create one
with the existing contact form, then end a party. The contact page gets a "Properties" block with
role and status.

**Acceptance criteria:**
- [x] Add an owner and a co-owner; ending the owner keeps it under "Past parties"
- [x] Adding the same open contact twice is refused with a translated error
- [x] The contact page lists the property with the role, in both locales

**Verification:**
- [x] `npx vitest run src/domain/property-parties`; service suite
- [x] Browser: BG and EN, 1280 and 390 px

**Log:** "Add party" picks a role, then an existing contact (ContactCombobox) or a new one through the existing ContactForm and `createContactAction`, so the duplicate check (C3) runs as usual; the new contact is then added with the chosen role. Ending sets `ended_at` only on a current row, and ending twice gives `propertyParties.errors.alreadyEnded`. The open-party index maps to `propertyParties.errors.alreadyParty`. The contact page's Properties block is a Server Component on `contacts/[id]/page.tsx` (not the client file the plan named), current parties first. Browser: BG and EN at 1280 and 390 px on #1011: owner Ivan Ivanov and a new co-owner added, the duplicate refused in BG, the owner ended and listed under past parties, and Ivan's contact page shows the property with Owner · Ended.

**Dependencies:** Task 6
**Files likely touched:** `src/domain/property-parties/*`, `src/components/domain/properties/party-section.tsx`, `contacts/[id]/contact-detail-client.tsx`, `properties/actions.ts`, `messages/{bg,en}.json`
**Estimated scope:** M

## Task 9: Property list with filters and pager
**Description:** `/properties` with `list-pager.tsx`. Filters: type, settlement, area, offer
type, listing status, price range, rooms, responsible broker, archived. Filters are kept in the
URL. A table on desktop and cards at 390 px; each row shows code, type and rooms, area, m², open
listing prices and the responsible broker.

**Acceptance criteria:**
- [x] Filtering by Лозенец and a price range €150,000–200,000 shows the AC-1 property (AC-1)
- [x] Properties without listings appear unless an offer type, status or price filter is set; no duplicates when a property has two listings
- [x] Archived properties are hidden by default

**Verification:**
- [x] Repository cases with and without listing filters in `npm run test:services`
- [x] Browser: BG and EN, 1280 and 390 px

**Log:** One PostgREST query per page. Each row embeds its open listings for display. A listing filter (offer type, listing status, price) adds a second, aliased `!inner` embed of listings that only filters, so a property with two matching listings shows once and `count: exact` stays right. Price and offer type match open listings unless a listing status is chosen. Filters are parsed from the URL by `parsePropertyListFilters`, and invalid values are ignored. Archived properties show with Properties = Archived or All. Service suite `list.integration.test.ts` runs in an area of its own, so seed rows don't count. Browser: BG and EN; the table at 1280 px, cards at 390 px; Sofia + Лозенец + €150,000–200,000 shows #1011 and seeded #1001 (AC-1) and hides the Лозенец garage that has no listing.

**Dependencies:** Task 7
**Files likely touched:** `src/app/(dashboard)/properties/{page,properties-page-client}.tsx`, `src/components/domain/properties/{property-list-table,property-filters}.tsx`, `src/domain/properties/repository.ts`, `messages/{bg,en}.json`
**Estimated scope:** M

## Task 10: Edit, reassign, archive and delete a property
**Description:** Edit attributes and the responsible broker on the property page. Archive and
unarchive (any member). Delete is owner/manager only, and refused when there are links, open
listings or tasks, with a suggestion to archive.

**Acceptance criteria:**
- [x] Archiving withdraws open listings, and the property drops out of the list and pickers
- [x] A broker sees no Delete; a manager deleting a linked property gets a translated refusal
- [x] A reassignment shows in `audit_log`

**Verification:**
- [x] `PropertyService` archive and delete cases in `npm run test:services`
- [x] Browser: BG and EN, 1280 px

**Log:** Editing is a page, `/properties/[id]/edit`, reusing PropertyForm. A deactivated area the property still uses stays selectable. Leaving the broker out keeps the current one. Delete counts links, open listings and tasks first (`properties.errors.inUse`); a delete that RLS lets through to no row means `errors.forbidden`, and the action also checks `CONFIG_ROLES` first. The task part of rule 1 lives in the service, because `tasks.property_id` is SET NULL; recorded as L14 in `docs/domain-model.md` with the gap (not atomic), plus L15 for the assignee check. Browser: broker in BG sees Edit and Archive but no Delete. #1011 was reassigned to Bob (an `assignment_change` row in `audit_log`, checked with psql), archived (sale listing withdrawn, gone from the list), then unarchived. The manager's delete of linked #1001 got the translated refusal. EN checked at 1280 px.

**Dependencies:** Task 6, Task 7
**Files likely touched:** `src/domain/properties/service.ts`, `properties/actions.ts`, `src/components/domain/properties/property-actions-menu.tsx`, `messages/{bg,en}.json`
**Estimated scope:** S

## Checkpoint 2: Inventory
- [x] `typecheck` (as `tsc --noEmit`), `lint` (0 errors, the 47 existing warnings), `test` (448 passed), `test:services` (558 passed) green
- [x] AC-1, AC-5, AC-6, AC-7 seen in the browser in BG and EN at 1280 and 390 px (AC-5 as the listing price change and the audit rows; its timeline view is Task 14. AC-6 as Beta's broker: 404 on Alpha's property, only Beta's rows in the list, redirected from Areas)

## Phase 3: Opportunities

## Task 11: Candidate properties on buyer and tenant opportunities
**Description:** `src/domain/opportunity-properties/` (repository, service: relation vs
opportunity type, one `selected`, archived refused, optional rejection reason). A Properties
section on the opportunity page: add a candidate with a property picker (active properties,
searched by code or address), change status inline. The property page lists linked opportunities
with status. `OpportunityService` translates the type-change refusal from Task 3.

**Acceptance criteria:**
- [x] Add two candidates to a buyer opportunity and move one to `offered`; both pages show it (AC-2)
- [x] A second `selected` is refused with a translated message (AC-4)
- [x] Changing a buyer opportunity with candidates to seller shows a translated refusal

**Verification:**
- [x] `npx vitest run src/domain/opportunity-properties`; service suite
- [x] Browser: BG and EN, 1280 and 390 px

**Log:** `OpportunityPropertyService` adds no checks of its own: the triggers raise `properties.errors.relationNotAllowed` and `properties.errors.archived`, and the unique indexes map to `opportunityProperties.errors.alreadySelected` / `alreadyLinked` / `subjectExists`. `OpportunityRepository.update` passes `opportunities.errors.typeHasProperties` through, so the edit form shows it. A link can also be removed (audited as status → NULL). Rejecting opens a dialog for the optional reason, shown under the row. The picker (`property-picker.tsx`) searches active properties by `#code`/code or address (`PropertyService.searchForPicker`, 20 rows) and hides linked ones; it takes `suggestions` for Task 13. The section shows on buyer and tenant deals only; seller and landlord come in Task 12. The property page gets a Deals section (`property-opportunities.tsx`). Browser: broker on Alpha Opp 1, BG at 1280 px and EN at 375 px: #1004 added by code and set to Избран, a second Selected refused (BG and EN toast), #1008 rejected with a reason, buyer → seller refused in the edit form, #1004 and #1001 property pages list the deal with its status. Seen in passing: the timeline's relative time can mismatch on hydration for entries seconds old (existing, Task 14 area).

**Dependencies:** Task 6
**Files likely touched:** `src/domain/opportunity-properties/*`, `src/components/domain/opportunities/property-links.tsx`, `src/components/domain/properties/property-picker.tsx`, `opportunities/[id]/*`, `messages/{bg,en}.json`
**Estimated scope:** M

## Task 13: Viewing tasks with a property
**Description:** Task form: when `task_type = viewing` and an opportunity is set, show a
property picker (the opportunity's linked properties first, then any active property). The task
card shows the property code and address. The property page gets "Schedule viewing". Completing
the task relies on the Task 3 trigger; the opportunity page refreshes the link status.

**Acceptance criteria:**
- [x] Completing a viewing for candidate A moves A to `viewed` and leaves B alone (AC-3)
- [x] Completing a viewing for an `offered` link leaves it `offered` (AC-3)
- [x] An archived property can't be chosen

**Verification:**
- [x] `npx vitest run src/domain/tasks` (schema accepts `property_id` only with an opportunity); service suite
- [x] Browser: BG and EN, 1280 and 390 px

**Log:** The opportunity page's add-task form had no type field; it now has one, and a viewing shows the property picker with the deal's active properties first, then any active property. The next task in the complete dialog gets the same picker (on Today it searches without suggestions). `taskSchemas().create` keeps `property_id` only on a viewing and refuses it without an opportunity (`validation.property_needs_opportunity`); recorded as L16. Task lists embed the property (`fk_tasks_property`), and the task row and the Today card show `#code · address` linking to it. Task inserts pass trigger keys through, so an archived property gives `properties.errors.archived`; the picker never offers one. "Schedule viewing" on the property page lets you pick one of the active buyer or tenant deals the property is a candidate on (title prefilled "Оглед #1001"). With none, it says to add the property to a deal first, because the page has no opportunity search. Completing a viewing revalidates the property page too. Service suite `viewing.integration.test.ts` (5 cases). Browser, BG at 1280 px: a viewing of candidate #1008 on Alpha Opp 1, completed → #1008 Огледан, #1001 stays Предложен; a viewing of offered #1001 scheduled from its property page, completed → still offered (checked with psql). EN at 375 px: viewing form with suggestions, Today card shows "#1003 · ул. Солунска 30".

**Dependencies:** Task 11
**Files likely touched:** `src/domain/tasks/{validation,repository,types}.ts`, `src/components/domain/tasks/task-card.tsx`, the task form component, `messages/{bg,en}.json`
**Estimated scope:** M

## Task 12: Subject property on seller and landlord opportunities (cut 3)
**Description:** On seller and landlord opportunities the Properties section sets one subject
property: pick an existing one, or "Create property", which opens the property form prefilled
with the opportunity's primary contact as owner and links it on save.

**Acceptance criteria:**
- [x] A seller opportunity links one subject property; a buyer opportunity offers no subject option (AC-4)
- [x] "Create property" saves the property, its owner party and the link, and returns to the opportunity

**Verification:**
- [x] Service suite: subject cases
- [x] Browser: BG and EN, 1280 px

**Log:** Seller and landlord deals get a "Subject property" section in place of the candidates. With no subject, it offers "Choose property" (the property picker; `setSubject`) and "Create property" (`/properties/new?opportunity=<id>`). With one, it shows the subject with a remove button. The new-property page names the deal and the primary contact who becomes owner. Saving runs `OpportunityPropertyService.createSubjectProperty` and returns to the deal. That method checks the deal first (seller or landlord, no subject yet; else `relationNotAllowed` / `subjectExists` before anything is written), then creates the property, the owner party and the link. Those are three writes, not one transaction: recorded as known gap 6 in `docs/domain-model.md`. A link to another agency's deal, or one that isn't seller or landlord, is a 404. Service suite `subject.integration.test.ts` (5 cases). Browser as Beta's broker: Beta Opp 1 (seller) shows the subject and no candidates; removed it, created #1009 from the deal in BG (owner Maria Petrova, subject link, back on the deal), then removed #1009 and chose #1001 with the picker in EN at 1280 px. The BG owner line was reworded to be gender-neutral.

**Dependencies:** Task 8, Task 11
**Files likely touched:** `src/components/domain/opportunities/property-links.tsx`, `properties/new/page.tsx`, `properties/actions.ts`, `messages/{bg,en}.json`
**Estimated scope:** S

## Checkpoint 3: Opportunities
- [x] `typecheck` (as `tsc --noEmit`), `lint` (0 errors, the 47 existing warnings), `test` (458 passed), `test:services` (586 passed), `test:db` (256 passed, after `db reset`) green; `test:e2e` 28/28
- [x] AC-2, AC-3, AC-4 seen in the browser (AC-2 as the status changes on both pages; its timeline view is Task 14)
- [x] `/review` of Phases 1–3

## Phase 4: History, search and E2E

## Task 14: Property timeline
**Description:** Extend `src/domain/timeline` with a property feed: `property` and `listing`
audit rows, `opportunity` rows with `field_name = 'property_link'` for this property, and tasks
with `property_id`. Render it on the property page. Show `property_link` rows on the opportunity
timeline with the property code.

**Acceptance criteria:**
- [x] The property timeline shows creation, the price change €185,000 → €179,000, a link status change and a viewing task, in order (AC-5)
- [x] The opportunity timeline shows the same link change once

**Verification:**
- [x] `npx vitest run src/domain/timeline`; timeline integration suite
- [x] Browser: BG and EN

**Dependencies:** Task 7, Task 11
**Files likely touched:** `src/domain/timeline/{service,types}.ts`, `src/components/domain/timeline/*`, `properties/[id]/property-activity.tsx`, `messages/{bg,en}.json`
**Estimated scope:** M

## Task 17: E2E for the property loop
**Description:** Extend Playwright: create a property with a sale listing and an owner, link it
to the seeded buyer opportunity, schedule and complete a viewing, and see `viewed` on both pages.
BG and EN, 1280 and 390 px. Add a cross-agency check that Beta can't open Alpha's property URL.

**Acceptance criteria:**
- [x] The new spec passes in all four projects (two languages × two widths) (AC-8)
- [x] The existing core-loop spec is unchanged and still passes

**Verification:**
- [x] `npm run test:e2e`

**Dependencies:** Task 13, Task 14
**Files likely touched:** `e2e/properties.spec.ts`, `e2e/fixtures.ts`
**Estimated scope:** S

## Task 15: Notes on properties (cut 1)
**Description:** Add a note on the property page using `notes.property_id` (schema from Task 2);
notes appear on the property timeline. Extend the notes Zod schema and service to allow the
property parent.

**Acceptance criteria:**
- [ ] A note added on the property shows on its timeline; blank notes are refused
- [ ] A note can't point at another agency's property

**Verification:**
- [ ] `npx vitest run src/domain/notes`; service suite
- [ ] Browser: BG and EN

**Dependencies:** Task 14
**Files likely touched:** `src/domain/notes/{validation,service,repository}.ts`, `properties/[id]/notes/*`, `src/domain/timeline/service.ts`
**Estimated scope:** S

## Task 16: ⌘K search for properties (cut 2)
**Description:** Migration `20261103000005_property_search.sql` adds a weighted `search_vector`
on `properties` (code, address, settlement and area names), kept by trigger (AD-036). Add
`SearchRepository.searchProperties` and the results in the ⌘K dialog.

**Acceptance criteria:**
- [ ] "1042", "Лозенец" and a street name each find the property; Beta's properties never appear
- [ ] Renaming an area updates the vectors of its properties

**Verification:**
- [ ] `npx supabase db reset`, `npm run test:db`; search service suite
- [ ] Browser: ⌘K in BG and EN

**Dependencies:** Task 6
**Files likely touched:** `supabase/migrations/20261103000005_property_search.sql`, `src/domain/search/{repository,service,types}.ts`, `src/components/domain/search/*`, `docs/domain-model.md`
**Estimated scope:** M

## Checkpoint 4: Complete
- [ ] AC-1…AC-8 met; full Definition of Done (typecheck, lint, test, test:services, test:db, test:e2e, browser BG/EN)
- [ ] `docs/domain-model.md` and AD-057 match the code
- [ ] `/review`, then close: `SPEC.md` Done, `docs/BRD.md` FR-PRP rows, move `tasks/*` to `docs/archive/properties-*.md`
