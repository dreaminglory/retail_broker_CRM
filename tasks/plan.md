# Implementation Plan: matching

> **Spec:** `spec/matching.md` · **Checklist:** `tasks/todo.md`
> **Status:** Plan approved (founder, 2026-11-06). Approved scope (founder, 2026-11-05).
> Decisions: AD-060 (written in Task 1). Branch: `feat/matching`, cut from `feat/requirements`
> (founder, 2026-11-06; `feat/requirements` isn't merged into `main` yet).

## Overview
A buyer or tenant deal shows the agency's properties that fit its requirement, best first, with a
result per criterion; a property shows the deals it fits; one click adds it as a candidate. Three
phases. Phase 1 builds and proves the matching engine in the database: the scoring function,
the two list functions, the `source` column, a seed that hits every result and the speed target.
The scoring rules are the module's risk, so the founder reviews them on real seed rows at
Checkpoint 1, before any screen exists. Phase 2 delivers the opportunity side as vertical slices:
read the matches, show them, add one as candidate. Phase 3 adds the E2E test and then the spec's
cut items in reverse cut order (property-side list, "from matches" marker, Not suitable), so any
of them can be dropped without touching the rest.

## Architecture decisions
Where the plan sharpens the spec. Task 1 records these as AD-060 and adjusts `spec/matching.md`
where it changes; acceptance criteria AC-1…AC-9 stay as they are.

- **Three SQL functions, rules in one.**
  - `match_evaluate(r requirements, p properties, l listings) RETURNS jsonb`: `LANGUAGE sql`,
    `IMMUTABLE`, `PARALLEL SAFE`, no table reads. Returns `{ score, listed, criteria: [{ criterion,
    result, must }] }`, with `listed` = rule 3 passed and score > 0 (rule 4). The tolerances (10%,
    ±1 room) are constants in its body.
  - `match_properties(p_opportunity_id, p_include_linked, p_limit, p_offset)` and
    `match_opportunities(p_property_id, p_include_linked, p_limit, p_offset)`: `LANGUAGE sql`,
    `STABLE`, `SECURITY INVOKER` (RLS applies, AD-050) and `agency_id = current_agency_id()` on
    every table they read. Granted to `authenticated` only.
  - The functions return ids, the property fields the chips need, the listing, `score`,
    `criteria`, `link_status`, `total_count` and `unlinked_count` (both `count(*) OVER ()`, so one
    call fills the header count, the toggle and the pager). Names (settlement, area, contact,
    broker) are resolved in the service with the existing `SettlementService`, `AreaService` and
    member lookups, as `OpportunityPropertyService.listForOpportunity` already does, so the SQL
    doesn't join profiles or carry locale.
- **Location from `requirements.location_keys`** (AD-059), not a join: a property matches when
  its `settlement_id` or `settlement_id:area_id` is in the keys; it is `unknown` when the
  settlement appears only as `settlement_id:…` keys and the property has no area. This is the
  "Revisit if" of AD-059 answered: the snapshot is already the shape matching needs.
- **Which side scans what.** `match_properties` scans the agency's open listings of one offer type
  (`idx_listings_agency_status` already leads with `agency_id, status, offer_type`).
  `match_opportunities` scans the agency's requirements joined to active and nurture deals of the
  matching type (`idx_requirements_agency_id`). Task 4 measures both on 2,000 + 2,000 rows and adds
  an index only if the target is missed.
- **Order (rule 5, Q2):** `listing.status = 'reserved'` first key, so all active matches come
  before any reserved one; then score descending; then `listed_at` descending (deal side) or the
  deal's `updated_at` descending (property side); then id, so paging is stable.
- **`opportunity_properties.source`** `TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual',
  'match', 'viewing'))`. Writable on `INSERT` only: AD-058's column `UPDATE` grant stays
  `(status, rejected_reason)`. `mark_property_viewed()` inserts with `source = 'viewing'`. Mirrored
  as `LINK_SOURCES` in `src/domain/opportunity-properties/validation.ts`, the TS type and both
  message files. No audit change: the link audit (AD-057) still records the status.
- **Writes reuse the link service.** `OpportunityPropertyService.addCandidate` gains an optional
  `source` (default `manual`); a new `rejectFromMatch` creates the link as `rejected` with the
  optional reason and `source = 'match'` (the `CHECK`s and the relation trigger already allow a
  `rejected` insert). Actions live in the existing
  `src/app/(dashboard)/opportunities/[id]/properties/actions.ts` and revalidate both pages. No
  matching-specific write path, so properties rule 5 and the audit apply unchanged.
- **Chips without the rules.** `src/domain/matching/criteria.ts` maps the `criteria` jsonb to
  chips (label key, result icon, must-have mark, `n/a` dropped). It never recomputes a result, so
  there is no second copy of the rules in TypeScript (spec boundary).
- **No new screen state.** The section is a Server Component fed by the page; the toggle and
  pager are search params (`?matches=all&matchesPage=2`), like the existing pagers, so no client
  fetch and no `setState` in effects.

## Dependency graph
```
T1 AD-060, source column ─ T2 match_evaluate ─ T3 list functions ─┬─ T4 seed + speed
                                                                  │
                                    T3 ─ T5 matching service ─ T6 section on opportunity ─ T7 add as candidate
                                                                                                │
                                                                       T7 ─ T8 E2E (deal side)
                                    T5, T7 ─ T9 section on property (cut 3, extends T8's E2E)
                                         T7 ─ T10 "from matches" marker (cut 2)
                                         T7 ─ T11 Not suitable (cut 1)
```

## Task list
Full tasks with acceptance criteria are in `tasks/todo.md`.

### Phase 1: Matching engine
- [x] Task 1: AD-060, `opportunity_properties.source` and the docs
- [x] Task 2: `match_evaluate`: per-criterion results and score
- [x] Task 3: `match_properties` and `match_opportunities`
- [ ] Task 4: Seed every match result and measure the speed target

**Checkpoint 1:** `db reset` + `test:db` green; speed numbers recorded; the founder reviews AD-060
and the seeded Alpha buyer's matches (scores and chips as SQL output) before any UI.

### Phase 2: Opportunity side
- [ ] Task 5: Matching service and criteria chips
- [ ] Task 6: Matches section on the opportunity page
- [ ] Task 7: Add as candidate from matches

**Checkpoint 2:** AC-1, -2, -3, -4 (add part), -6 seen in the browser in BG and EN at 1280 and
390 px; `/review` of Phases 1–2.

### Phase 3: E2E and cut items
- [ ] Task 8: E2E for the deal-side match loop
- [ ] Task 9: Matching deals on the property page (cut 3)
- [ ] Task 10: "from matches" marker on links (cut 2)
- [ ] Task 11: Not suitable from matches (cut 1)

**Checkpoint 3:** every AC met, the full Definition of Done, `/review`; then close the module.

## Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Scoring feels wrong to brokers once seen (tolerances, equal weights, "?" on must-haves) | High | All rules in one SQL function with constants; Checkpoint 1 shows real seed rows to the founder before UI; assumptions A2–A4 are measured through `source` |
| A list function leaks across agencies | High | `SECURITY INVOKER` so RLS applies, plus an explicit `current_agency_id()` filter; pgTAP calls both as a Beta broker with Alpha ids (AC-7) |
| Speed target missed on the reverse side (every requirement evaluated per property) | Med | `match_evaluate` is pure and inlinable; Task 4 measures with `EXPLAIN ANALYZE` on 2,000 + 2,000 rows before any UI depends on it; fallback is a narrowing pre-filter on offer type, settlement and must-have budget |
| Adding properties to the seed changes counts other suites assert (property list, ⌘K, E2E) | Med | Task 4 only adds rows with their own codes and runs `test:services` and `test:e2e` before ticking |
| Section result drifts from the function (chips recompute something) | Low | `criteria.ts` only maps; Vitest feeds it raw function output from a pgTAP-proven fixture |
| `source` is spoofable on insert (a member can send `match`) | Low | Accepted: it only feeds a measurement (A1), no rule depends on it; noted in AD-060 |
| About 50 new i18n keys | Low | Keys go in with each task; lint `i18next/no-literal-string`; glossary terms in Task 1 |

## Open questions
- None blocking. Branch base resolved (founder, 2026-11-06): `feat/matching` starts from
  `feat/requirements`, so a merge of `feat/requirements` into `main` must come before (or with)
  `feat/matching`.
