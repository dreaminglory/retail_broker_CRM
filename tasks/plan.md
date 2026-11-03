# Implementation Plan: properties

> **Spec:** `spec/properties.md` · **Checklist:** `tasks/todo.md`
> **Status:** Plan approved (founder, 2026-11-03). Approved scope (founder, 2026-11-03).
> Data model: AD-056. Branch: `feat/properties`.

## Overview
An agency keeps its properties in BrokerCRM and every buyer or tenant opportunity shows which
properties were proposed, viewed, offered, rejected or chosen. Four phases. Phase 1 builds and
proves the whole schema in the database first, because the data model is the module's main risk
(`SPEC.md` §7) and every later module depends on it. Phases 2–4 then deliver the screens as vertical
slices on top of it: the inventory, the links to opportunities, and the history and search.
The spec's cut order (notes, ⌘K search, the prefilled subject property) sits at the end of its
phase, so any of those three can be dropped without touching the others.

## Architecture decisions
Where the plan sharpens the spec. Task 2 records these as AD-057 and adjusts `spec/properties.md`
if anything changes; acceptance criteria AC-1…AC-8 stay as they are.

- **Schema first, then vertical slices.** This is an exception to vertical slicing: two
  migrations with pgTAP (Tasks 2–3) before any UI, so the founder can review the data model at
  Checkpoint 1 while changing it is still cheap. Every UI task after that is a full path
  (repository → service → action → screen).
- **Rules in the strongest layer** (`crm-domain-model`):
  - `CHECK`s: rule 3 (type-specific fields), price > 0.
  - Partial unique indexes: one open listing per `(property_id, offer_type)`, one `selected` link per
    opportunity, one open party per `(property_id, contact_id)`.
  - Triggers:
    - rule 5, relation vs opportunity type: on `opportunity_properties`, plus a guard on
      `opportunities.type` changes, because the type is editable.
    - rule 7, viewing completion: `AFTER UPDATE OF status ON tasks`.
    - rule 8, archiving withdraws open listings and blocks new links, listings and viewing tasks.
    - the per-agency property `code`.
  - Services mirror these rules only to return friendly i18n errors before the database refuses.
- **Property code:** an `agencies.property_code_seq` counter incremented by a `BEFORE INSERT`
  trigger (`UPDATE … RETURNING`, row-locked, so two inserts never share a code). Shown as `#1042`.
  Unique `(agency_id, code)`.
- **One audit row per link change.** A link status change writes `entity_type = 'opportunity'`,
  `action = 'status_change'`, `field_name = 'property_link'` and `metadata.property_id`. The property
  timeline reads its own rows (`property`, `listing` with `metadata.property_id`) plus those
  opportunity rows. This shows each change on both timelines without duplicate rows. `audit_log`
  gains `entity_type` values `property` and `listing`; `action` values stay as they are.
- **Settlements** come from the NSI EKATTE register, through a committed converter script
  (`scripts/ekatte/`) that writes one data migration. `name_en` uses the official Bulgarian
  transliteration (Transliteration Act 2009), so the result can be checked against Sofia →
  Sofia, Пловдив → Plovdiv, Щъркелово → Shtarkelovo. The table is global: `FORCE` RLS, `SELECT`
  for `authenticated`, no write policies, and listed in `010-rls-catalog.sql` as global. The picker
  searches by prefix on `lower(name_bg)` / `lower(name_en)` (`text_pattern_ops` index), shows
  "гр. София, обл. София-град" and returns at most 20 rows.
- **Delete vs archive:** `opportunity_properties.property_id` is `ON DELETE RESTRICT`, so a linked
  property can't be deleted. The service also refuses to delete when there are open listings or
  tasks, and suggests archiving instead. `tasks.property_id` is `SET NULL` as the spec says.
- **List filters on listings:** filtering by offer type, status or price embeds `listings!inner`
  in the PostgREST query. Without those filters the list embeds open listings only, for display.
- **Reuse:** `contact-combobox.tsx` for parties; `list-pager.tsx` for lists; the lead-sources
  pattern (`src/domain/lead-sources`, `settings/lead-sources`) for areas; `requireRole(ctx,
  CONFIG_ROLES)` for area config and deletes.
- **Defaults from the spec's open questions** (approved as written): the full EKATTE list in one
  migration (~5,250 rows); price per m² derived on screen only. Revisit at Checkpoint 1 if the
  migration file is larger than about 2 MB.

## Dependency graph
```
T1 settlements ─┐
                ├─ T2 schema + RLS ─ T3 triggers ─ T4 seed ─┐
                                                            ├─ T5 areas
                                                            ├─ T6 create + view property ─┬─ T7 listings
                                                            │                             ├─ T8 parties
                                                            │                             ├─ T9 list + filters
                                                            │                             └─ T10 edit, archive, delete
                                                            │
             T6 ─┬─ T11 candidates ─ T13 viewing tasks
                 └─ T12 subject property (cut 3)
             T7, T11 ─ T14 property timeline ─ T15 notes (cut 1)
             T6 ─ T16 ⌘K search (cut 2)
             all ─ T17 E2E
```

## Task list
Full tasks with acceptance criteria are in `tasks/todo.md`.

### Phase 1: Data model
- [x] Task 1: Settlements reference data (EKATTE)
- [x] Task 2: Property tables, RLS and constraints
- [x] Task 3: Property triggers (code, audit, rules 5, 7, 8)
- [ ] Task 4: Seed properties for both agencies

**Checkpoint 1:** `db reset` + `test:db` green; founder reviews the model in `docs/domain-model.md`.

### Phase 2: Inventory
- [ ] Task 5: Areas in Settings
- [ ] Task 6: Create a property and see its page
- [ ] Task 7: Listings on a property
- [ ] Task 8: Parties on a property and on the contact page
- [ ] Task 9: Property list with filters and pager
- [ ] Task 10: Edit, reassign, archive and delete a property

**Checkpoint 2:** AC-1, AC-5, AC-6, AC-7 seen in the browser in BG and EN at 1280 and 390 px.

### Phase 3: Opportunities
- [ ] Task 11: Candidate properties on buyer and tenant opportunities
- [ ] Task 13: Viewing tasks with a property
- [ ] Task 12: Subject property on seller and landlord opportunities (cut 3)

**Checkpoint 3:** AC-2, AC-3, AC-4 seen in the browser; `/review` of Phases 1–3.

### Phase 4: History, search and E2E
- [ ] Task 14: Property timeline
- [ ] Task 17: E2E for the property loop
- [ ] Task 15: Notes on properties (cut 1)
- [ ] Task 16: ⌘K search for properties (cut 2)

**Checkpoint 4:** every AC met, the full Definition of Done, `/review`; then close the module.

Task 12 runs after Task 13, and Task 17 runs before Tasks 15–16. That way the spec's cut items
come last and the E2E test doesn't depend on them.

## Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| The EKATTE file's format or licence differs from what the plan expects | Med | Task 1 comes first. The converter fails loudly on unknown columns. If the licence is unclear, stop and ask (spec "Ask first"). Fallback: towns only (A3) |
| The data model needs a change after the UI is built | High | Phase 1 is DB only; founder review at Checkpoint 1 before any screen |
| Changing an opportunity's type orphans its links (buyer → seller with candidates) | Med | A trigger on `opportunities` refuses the change while incompatible links exist; translated error in `OpportunityService` |
| PostgREST `!inner` filters on listings return duplicates or miss properties without listings | Med | Repository tests with and without listing filters in the service suite (Task 9) |
| Property pages grow large (detail + listings + parties + links + timeline) | Low | Sections are separate Server Components with their own queries, like the opportunity page |
| About 150 new i18n keys in two languages | Low | Keys go in with each task; lint `i18next/no-literal-string`; glossary terms (Имот, Обява, Квартал, Кандидат) added in Task 2 |
| Seed changes break the existing E2E and service suites | Med | Task 4 only adds rows and runs `test:services` and `test:e2e` before ticking |

## Open questions
- None blocking. The two spec defaults are listed under Architecture decisions.
