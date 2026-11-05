# Implementation Plan: requirements

> **Spec:** `spec/requirements.md` · **Checklist:** `tasks/todo.md`
> **Status:** Plan approved (founder, 2026-11-05). Approved scope (founder, 2026-11-05).
> Decisions: AD-059 (written in Task 1). Branch: `feat/requirements`.

## Overview
A buyer or tenant opportunity records the client's search, with a must-have flag per criterion,
so `matching` has something to match against. Three phases. Phase 1 builds and proves the two
tables, their guards, the single write path and the audit in the database. The data model is
what `matching` builds on, so the founder reviews it at Checkpoint 1 before any screen exists.
Phase 2 delivers the opportunity page as vertical slices: read, edit, remove and read-only, then
the timeline. Phase 3 adds the E2E test and then the spec's cut items, in reverse cut order, so
any of them can be dropped without touching the rest.

## Architecture decisions
Where the plan sharpens the spec. Task 1 records these as AD-059 and adjusts
`spec/requirements.md` where it changes; acceptance criteria AC-1…AC-8 stay as they are.

- **One write path: `save_requirement` and `remove_requirement` RPCs.** A save writes the row and
  replaces its locations in one transaction (the spec's "one save is one timeline entry"). Both
  are `SECURITY DEFINER` and the only writers: members get `SELECT` on both tables, and
  `INSERT`/`UPDATE`/`DELETE` are revoked, like `notification_deliveries` (E2). Each RPC checks
  itself that the opportunity is in `current_agency_id()`, is buyer/tenant, and is `active` or
  `nurture` (rules 1, 7). This departs from AD-050, where the RPCs are `SECURITY INVOKER`. With
  INVOKER, a member could write locations directly and bypass the location snapshot below, so the
  audit would miss changes. Errors are i18n keys (`requirements.errors.*`).
- **`requirements.location_keys text[]`**, a sorted snapshot of `settlement_id` or
  `settlement_id:area_id`, written only by `save_requirement`. It lets the database enforce what
  the spec puts on locations even though they live in a child table:
  - rule 2 as a `CHECK`: at least one of budget, rooms, m², types or `cardinality(location_keys) > 0`
  - rule 4's `location_must` as a `CHECK`
  - one audit row per save: the audit trigger diffs `OLD` and `NEW` on the row alone

  pgTAP checks that `location_keys` always matches `requirement_locations`.
- **Audit follows the AD-057 property-link pattern**, not a new `entity_type`. Each save writes
  one `audit_log` row with `entity_type = 'opportunity'`, `entity_id = opportunity_id`,
  `action = 'field_change'` and `field_name = 'requirement'`. `metadata` holds
  `{ event: created | changed | removed, changes: [{ field, from, to }] }`. For locations, the
  names in both languages go in, so the timeline needs no joins and survives an area rename.
  The opportunity and contact timelines already read opportunity rows, so their queries don't
  change; the contact timeline shows the entries too, as it does for property links. No change
  to the `audit_log` `CHECK`s. *(The spec said `entity_type` gains `requirement`; Task 1 updates
  that line.)*
- **Guards in the database:**
  - a `BEFORE INSERT` trigger refuses a requirement on a seller or landlord deal (rule 1)
  - `trg_check_opportunity_type_vs_requirement` on `opportunities` refuses a change to seller or
    landlord while a requirement exists (`opportunities.errors.typeHasRequirement`), next to the
    property-link guard
  - the RPCs refuse writes on won, lost and archived deals (rule 7)
  - `CHECK`s cover rules 3 and 4
  - composite FKs (AD-057): `(agency_id, opportunity_id)` → opportunities `CASCADE`,
    `(agency_id, settlement_id, area_id)` → areas `RESTRICT` (like L8), `settlement_id` →
    settlements `RESTRICT`

  The service mirrors these rules only to return friendly errors before the RPC refuses.
- **Locations uniqueness:** `UNIQUE NULLS NOT DISTINCT (requirement_id, settlement_id, area_id)`.
  Choosing a whole settlement and one of its areas at the same time is refused in Zod, because
  the whole settlement already covers the area.
- **Enums reused, not copied:** `PROPERTY_TYPES` and `CONSTRUCTIONS` from
  `src/domain/properties/validation.ts`; the DB `CHECK`s use `<@` against the same lists as
  `properties`.
- **Reads:** one repository query embeds locations with settlement names (`name_bg`, `name_en`)
  and area names. `summary.ts` is a pure function `(requirement, opportunityType, t, format) →
  string` used by the opportunity page, the list and the contact page.
- **Reuse:** `SettlementCombobox` and `listAreasForSettlementAction` for the location picker;
  the Sheet pattern of the existing property forms on mobile; `describeAudit` gets a
  `requirement` kind.
- **Floor hint:** "партер = 1" is a shared message key, used by the requirement form and the
  property form.

## Dependency graph
```
T1 tables, guards, AD-059 ─ T2 RPCs + audit ─ T3 seed ─┐
                                                       ├─ T4 show on opportunity ─ T5 add/edit ─ T6 remove, read-only, type guard
                                                       │                                    └─ T7 timeline
             T5, T7 ─ T8 E2E
             T5 ─ T9 buyer↔tenant notice (cut 3)
             T4 ─ T10 summary on opportunities list (cut 2)
             T4 ─ T11 summary on contact (cut 1)
```

## Task list
Full tasks with acceptance criteria are in `tasks/todo.md`.

### Phase 1: Data model
- [x] Task 1: Requirement tables, constraints, guards and AD-059
- [x] Task 2: Save and remove RPCs with the audit trigger
- [ ] Task 3: Seed requirements for both agencies

**Checkpoint 1:** `db reset` + `test:db` green; the founder reviews AD-059 and the model in
`docs/domain-model.md`.

### Phase 2: Opportunity page
- [ ] Task 4: Show the requirement on the opportunity
- [ ] Task 5: Add and edit a requirement
- [ ] Task 6: Remove, read-only on closed deals, type-change error
- [ ] Task 7: Requirement entries on the timelines

**Checkpoint 2:** AC-1 (opportunity part) through AC-6 seen in the browser in BG and EN at 1280
and 390 px; `/review` of Phases 1–2.

### Phase 3: E2E and cut items
- [ ] Task 8: E2E for the requirement loop
- [ ] Task 9: Buyer ↔ tenant budget notice (cut 3)
- [ ] Task 10: Summary on the opportunities list (cut 2)
- [ ] Task 11: Summary on the contact page (cut 1)

**Checkpoint 3:** every AC met, the full Definition of Done, `/review`; then close the module.

## Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| A `SECURITY DEFINER` RPC leaks across agencies | High | Explicit `current_agency_id()` check on the opportunity; composite FKs refuse a foreign area or opportunity; pgTAP calls both RPCs as a Beta broker against Alpha ids (AC-7) |
| `location_keys` drifts from `requirement_locations` | Med | Only the RPC writes either table (writes revoked); a pgTAP assertion compares them after every save in the test |
| The model needs a change once `matching` is specced (e.g. must-have semantics) | Med | Checkpoint 1 review before UI; the must-have flags are plain booleans that `matching` reads without needing a migration |
| Seed changes break existing E2E and service suites (Alpha has one buyer deal, Beta none) | Med | Task 3 only adds rows (new buyer/tenant deals with their own contacts) and runs `test:services` and `test:e2e` before ticking |
| PostgREST can't resolve the one-to-one embed over a composite FK | Low | Task 4 tries it first; fallback is a second query by `opportunity_id IN (…)` |
| The form is long on 390 px | Low | Sheet with grouped sections (budget, where, what, extra); must-have toggles inline with each group; checked at 390 px in Task 5 |
| About 80 new i18n keys | Low | Keys go in with each task; lint `i18next/no-literal-string`; glossary term Изисквания in Task 1 |

## Open questions
- None blocking. AD-059 accepted by the founder at Checkpoint 1 (2026-11-05). The two departures from earlier patterns (`SECURITY DEFINER` RPCs and the
  property-link audit shape instead of a new `entity_type`) are for the founder to confirm at
  Checkpoint 1, recorded in AD-059.
