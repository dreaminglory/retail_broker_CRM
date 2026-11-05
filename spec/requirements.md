# Spec: requirements

> **Status:** Done (2026-11-05). Approved scope (founder, 2026-11-05). Plan:
> `docs/archive/requirements-plan.md`. Decisions: AD-059. Requirements: FR-REQ-01…07.
> **Evidence:** gap analysis §5.1 #7 (buyer requirements and two-way matching are a core purchase
> reason in BG), benchmark B-11, business brief "Pilot MVP", AD-039 pilot gate.
> Scope answers from the founder (2026-11-05): one requirement per opportunity, a must-have
> flag per criterion, entered on the opportunity page only, with floor, construction,
> financing and free-text wishes. Assumptions A1–A5 are unvalidated.

## Objective

A broker records what a buyer or tenant is looking for (budget, where, what type, how big)
on the opportunity itself, so the search is part of the deal's history rather than a line in
a notebook or Viber, and `matching` can later propose properties against it. Pilot-gate
item (AD-039); `matching` and `smart-lists` build on it.

**Users:** brokers (record and update the client's search), owners and managers (see every
deal's search, e.g. when taking over a client).

**Not in this module:** finding properties for the requirement (that is `matching`), lists of
buyers by criteria (`smart-lists`), capture at inquiry conversion.

## Data model (AD-059)

```
opportunities (buyer | tenant) ──1:0..1── requirements ──< requirement_locations >── settlements
                                                                    └──────────────── areas (optional)
```

- **`requirements`**: one row per opportunity, unique `opportunity_id`, composite FK
  `(agency_id, opportunity_id)` → `opportunities` `ON DELETE CASCADE` (AD-057).
  - **Budget:** `budget_min`, `budget_max` (numeric > 0, EUR, AD-037). On a buyer deal it is
    the purchase price, on a tenant deal the monthly rent. The offer type is derived from the
    opportunity type (buyer → sale, tenant → rent), not stored.
  - **Type:** `property_types text[]`, a subset of the property types
    (`apartment | studio | maisonette | house | house_floor | plot | garage`); empty = any.
  - **Size:** `rooms_min`, `rooms_max` (1–9), `area_m2_min`, `area_m2_max` (> 0).
  - **Floor:** `floor_min`, `floor_max` (same range as `properties.floor`, −5…200),
    `not_top_floor boolean`. The ground floor (партер) is floor 1, so "not the ground
    floor" ("не първи") is `floor_min = 2`.
  - **Construction:** `construction text[]`, a subset of `brick | panel | epk | timber | other`;
    empty = any.
  - **Financing:** `financing` `cash | mortgage | mixed | unknown`, default `unknown`. Shown,
    never matched.
  - **Wishes:** `wishes text` (≤ 2,000 chars): parking, elevator, Act 16, exposure. Shown,
    never matched.
  - **Must-have flags:** `budget_must`, `location_must`, `type_must`, `rooms_must`,
    `area_m2_must`, `floor_must`, `construction_must` (boolean, default false). `matching`
    treats a must-have as a filter and the rest as score.
- **`requirement_locations`**: `requirement_id`, `settlement_id` (required), `area_id`
  (optional; NULL = the whole settlement). The area must belong to the settlement (composite
  FK, like L4). Unique `(requirement_id, settlement_id, area_id)` with NULLs not distinct.
  A join table rather than a `uuid[]`, so every location has a real foreign key.
- **Audit:** created, changed (each changed criterion with its old and new value, locations as
  names) and removed are recorded and show on the opportunity timeline. One save is one
  timeline entry. Per AD-059 there is no new `entity_type`: each save is one `opportunity` row
  with `field_name = 'requirement'`, like a property link (AD-057), written by the audit trigger
  on `requirements`. The only writers are the `save_requirement` and `remove_requirement` RPCs,
  and the row's `location_keys` snapshot lets the trigger see a location change.

## Business rules

1. A requirement exists only on `buyer` and `tenant` opportunities, at most one each. An
   opportunity's type can't change to `seller` or `landlord` while it has a requirement
   (same pattern as L10). Changing `buyer` ↔ `tenant` keeps it; the budget label follows
   the type and the form shows a notice that the budget is now read as rent (or price).
2. A requirement needs at least one criterion: a budget bound, a location, a type, a rooms
   bound or an m² bound. Financing and wishes alone don't count.
3. Every min ≤ its max when both are set; rooms 1–9; m² and budget > 0. Enforced by `CHECK`,
   mirrored in Zod.
4. A must-have flag can be on only when its criterion is set (`CHECK`). The form turns on
   budget, location and type as must-haves when the broker fills them, and the broker can
   switch any flag. [ASSUMPTION A1: those three defaults match how brokers think. Validate:
   share of requirements where brokers switch a default off]
5. Rooms apply only to property types that have rooms; a requirement for "apartment or
   house, 3 rooms" stores the rooms once and `matching` applies them to apartments only.
6. Locations are settlements from EKATTE and, optionally, the agency's areas in them. The
   picker offers active areas only; a deactivated area stays on requirements that have it,
   shown as inactive.
7. Whoever can edit the opportunity can add, edit or remove its requirement (any member, like
   opportunity–property links in T2). It is editable while the opportunity is `active` or
   `nurture`, read-only when `won`, `lost` or `archived` (reopen to edit).
8. Removing a requirement deletes the row and its locations; the timeline keeps the audit
   entries.
9. Merging contacts doesn't touch requirements (they hang on opportunities). Deleting an
   opportunity deletes its requirement.
10. Every row points only at its own agency's rows (composite FKs, AD-057); RLS as for every
    tenant table.

## Screens

- **Opportunity detail (buyer/tenant):** an "Изисквания" section above Properties. Empty state:
  "Add the client's search". Filled: a one-line summary (e.g. "Апартамент, 2–3 стаи,
  Лозенец или Изток, до €200 000") with must-haves marked, then the full criteria, financing
  and wishes, and "updated on" date. Edit opens a form (sheet on mobile): budget, locations
  (settlement, then its areas, several of each), types, rooms, m², floor, construction,
  financing, wishes, each matchable criterion with a must-have toggle. Seller and landlord
  deals show no section.
- **Opportunity timeline:** requirement created, changed (old → new per criterion), removed.
- **Opportunities list:** the summary line under the title on buyer/tenant rows.
- **Contact detail:** each buyer/tenant opportunity in the list shows its summary line.
- **Floor fields:** the property form says that the ground floor (партер) is floor 1. The
  requirement form doesn't (founder, 2026-11-05: not needed there).
- **Glossary:** Requirement = **Изисквания** (canonical, plural as brokers say it), added to
  `docs/domain-model.md` §7 in the migration commit.

## Where it lives

- Migration `supabase/migrations/2026110500000N_requirements.sql`; pgTAP
  `supabase/tests/database/077-requirements.sql`; `010-rls-catalog.sql` gets both tables.
- `src/domain/requirements/` (`types.ts`, `validation.ts`, `repository.ts`, `service.ts`,
  `summary.ts` for the one-line summary, tests beside them).
- UI in `src/components/domain/requirements/`; Server Actions in
  `src/app/(dashboard)/opportunities/[id]/requirement/actions.ts`.
- Keys under `requirements.*` in both `messages/bg.json` and `messages/en.json`.
- Commands, code style and the mutation pattern: `AGENTS.md`.

## Success criteria

- **AC-1** On a buyer opportunity a broker records: apartment or maisonette, 2–3 rooms,
  Sofia – Lozenets or Iztok, €150,000–€200,000, not the top floor, brick, mortgage, "needs
  parking"; budget, location and type are must-haves by default. The summary shows on the
  opportunity, the opportunities list and the contact (FR-REQ-01, -02, -05).
- **AC-2** Changing the budget max from €200,000 to €220,000 and adding Mladost 1 shows one
  timeline entry with both changes and their old values (FR-REQ-04).
- **AC-3** A seller opportunity can't get a requirement; a buyer opportunity with one can't be
  changed to seller, with a translated message; buyer → tenant keeps it and the budget label
  says rent (FR-REQ-03).
- **AC-4** Saving with no criterion, with `rooms_min` > `rooms_max`, or with an area of
  Plovdiv under Sofia is refused with a translated message, in Zod and in the database.
- **AC-5** A must-have flag on an empty criterion is refused by the database.
- **AC-6** A won opportunity shows its requirement read-only; reopened, it is editable
  (FR-REQ-06).
- **AC-7** A broker of agency Beta sees none of Alpha's requirements or locations and can't
  point a requirement at an Alpha opportunity or area (pgTAP) (FR-REQ-07).
- **AC-8** The form and section work in BG and EN at 1280 and 390 px; no hardcoded strings.

**FR rows (BRD, area FR-REQ):** 01 requirement record with budget, locations, types, rooms,
m², floor, construction, financing, wishes; 02 must-have flag per matchable criterion; 03
buyer/tenant only, one per deal, type-change guard; 04 audited, one timeline entry per save;
05 summary line on opportunity, list and contact; 06 read-only on closed deals; 07 tenant
isolation.

## Testing strategy

- **pgTAP `077-requirements.sql`:** RLS on both tables and the catalog entry; `CHECK`s from
  rules 3 and 4; the one-per-opportunity index; the buyer/tenant and type-change guards
  (rule 1); the area-in-settlement FK; cross-agency FKs; the audit trigger including the
  single-entry save.
- **Vitest:** Zod schema (rules 2–4, defaults of rule 4, empty arrays); `summary.ts` in BG
  and EN (ranges, open-ended bounds, several areas, rent vs price); `RequirementService` in
  the service suites (closed-deal guard, seller refusal, save with locations, remove);
  timeline mapping for the `requirement` entries.
- **E2E (Playwright):** extend the core loop: add a requirement to the seeded buyer
  opportunity, edit its budget, see the timeline entry and the summary in the list. BG and
  EN, 1280 and 390.
- **Seed:** requirements on most seeded buyer and tenant opportunities of both agencies, some
  with several areas, one with only a budget, and one buyer/tenant deal with none (empty
  state).

## Boundaries

- Always: filter by `agency_id` in the repository; the `supabase-patterns` checklist for both
  tables; status-like lists (`financing`, the type and construction subsets) as `CHECK` + Zod
  + TS + both message files, reusing the property enums rather than copying them; update
  `docs/domain-model.md` (requirement in §2.7 or a new §2.8, invariants, glossary) in the
  migration commit; write AD-059 before the migration.
- Ask first: any change to `opportunities` columns or to `convert_inquiry`; a new dependency;
  a different storage for locations than the join table.
- Never: match or score properties here; store the offer type; app code writing
  `audit_log`; a requirement on a contact instead of an opportunity.

## Out of scope

Matching and match scores, a requirements list or search screen, filters on the opportunities
list by criteria, capture at inquiry conversion or CSV import, several requirements per
opportunity, map-drawn zones, price per m² as a criterion, requirement history beyond the
audit log, notifying anyone when a requirement changes.

## Cut order if time runs short

1. Summary line on contact detail.
2. Summary line on the opportunities list.
3. The buyer ↔ tenant budget notice (the label still follows the type).

## Assumptions

- **A1** Budget, location and type as default must-haves (rule 4).
- **A2** One requirement per opportunity is enough; a client with a second search gets a
  second opportunity. Validate: brokers asking for alternatives on one deal.
- **A3** Areas the agency already defined cover where buyers search; otherwise brokers fall
  back to whole settlements. Validate: share of requirements with a settlement and no area.
- **A4** Floor bounds plus "not the top floor" cover the floor wishes brokers hear ("не първи,
  не последен").

## Resolved questions (founder, 2026-11-05)

- **BG term:** "Изисквания".
- **Ground floor:** партер is floor 1. [ASSUMPTION A5: agencies' existing data numbers it the
  same way. Validate: floors in the onboarding dry-run export]
