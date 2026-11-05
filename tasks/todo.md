# Tasks: matching

> **Plan:** `tasks/plan.md` · **Spec:** `spec/matching.md`
> Every task also clears the Definition of Done in `AGENTS.md`. Tick a task only after that.
> Migrations: the next free timestamps after `20261105000003`, in order (e.g. `20261106000001`…).
> pgTAP: `080-matching.sql`, `081-match-lists.sql`.

## Phase 1: Matching engine

## Task 1: AD-060, `opportunity_properties.source` and the docs
**Description:** Create `feat/matching` from `feat/requirements` and mark `matching`
In progress in `SPEC.md`. Write AD-060 in `docs/decisions-log.md` with the plan's architecture
decisions (read-time matching, rules in `match_evaluate` only, location from `location_keys`,
order with reserved last, `source` insert-only and accepted as unverified), and update
`spec/matching.md` where they sharpen it. Add FR-MAT-01…08 to `docs/BRD.md`, not built.
Migration `<ts>_matching_source.sql` per `supabase-patterns`:
- `opportunity_properties.source TEXT NOT NULL DEFAULT 'manual'`, `CHECK (source IN ('manual',
  'match', 'viewing'))`; existing rows stay `manual`.
- Column `UPDATE` grant unchanged (`status, rejected_reason`), so `source` is set on insert only.
- `mark_property_viewed()` re-created with `source = 'viewing'` on the link it inserts (body as in
  `20261103000003`, grants carried over).

Mirror `LINK_SOURCES` + type in `src/domain/opportunity-properties/` and the labels in both
message files. Start `080-matching.sql`. Update `docs/domain-model.md`: a §2.9 Matching stub (the
three functions as planned, `source`), invariant for `source`, glossary (Подходящ имот, Подходящ
купувач / наемател, Съвпадение, Близо), migration count.

**Acceptance criteria:**
- [x] A link inserted without `source` is `manual`; an unknown value is refused; a member's `UPDATE` of `source` is refused (privilege)
- [x] Completing a viewing task that creates a link sets `source = 'viewing'`; the existing viewing tests still pass
- [x] AD-060, the BRD rows, the spec adjustments and the domain-model stub are in the same commit

**Verification:**
- [x] `npx supabase db reset` then `npm run test:db`
- [x] `npm run typecheck`, `npm run lint`, `npm run test`

**Dependencies:** None
**Files likely touched:** `SPEC.md`, `docs/decisions-log.md`, `docs/BRD.md`, `spec/matching.md`, `docs/domain-model.md`, `supabase/migrations/<ts>_matching_source.sql`, `supabase/tests/database/080-matching.sql`, `src/domain/opportunity-properties/{types,validation}.ts`, `messages/{bg,en}.json`
**Estimated scope:** M (the docs are edits only)

## Task 2: `match_evaluate`: per-criterion results and score
**Description:** Migration `<ts>_match_evaluate.sql`: `match_evaluate(r requirements,
p properties, l listings) RETURNS jsonb`, `LANGUAGE sql IMMUTABLE PARALLEL SAFE`, reading only
its arguments. It returns `{ score, listed, criteria }`:
- `criteria`: one entry `{ criterion, result, must }` per criterion set on the requirement, in the
  summary's reading order (type, rooms, m², location, budget, floor, construction), with `result`
  in `match | close | miss | unknown | n/a` per the spec's rule 2 table
- the property-type applicability from `src/domain/properties/validation.ts` `FIELDS`: rooms only
  for apartments; floor `n/a` for house and plot; "not top floor" `n/a` without floors total by
  type (garage); construction `n/a` for plot and garage; m² is `plot_m2` for a plot
- `score` per rule 4 (applicable criteria only; match 1, close ½, else 0; rounded)
- `listed` = no must-have is `miss` or `close`, at least one applicable criterion, and score > 0

`EXECUTE` revoked from `PUBLIC` and `anon`, granted to `authenticated`. Extend `080-matching.sql`
with one assertion per cell of the rule 2 table plus the edges.

**Acceptance criteria:**
- [x] Every cell of the rule 2 table is asserted, including exactly 10% over/under (close), just past 10% (miss), ±1 and ±2 rooms, and `n/a` by type (AC-1, AC-2 at the DB layer)
- [x] A must-have `close` or `miss` gives `listed = false`; a must-have `unknown` keeps `listed = true` with score lower than the same property with the value recorded (AC-2)
- [x] A rooms-only requirement against a house, and a property scoring 0, give `listed = false`; financing and wishes never appear in `criteria`

**Verification:**
- [x] `npx supabase db reset` then `npm run test:db`

**Dependencies:** Task 1
**Files likely touched:** `supabase/migrations/<ts>_match_evaluate.sql`, `supabase/tests/database/080-matching.sql`
**Estimated scope:** S (two files, but the test is long)

## Task 3: `match_properties` and `match_opportunities`
**Description:** Migration `<ts>_match_lists.sql`, both `LANGUAGE sql STABLE SECURITY INVOKER`,
filtered by `current_agency_id()` on every table, granted to `authenticated` only:
- **`match_properties(p_opportunity_id uuid, p_include_linked boolean DEFAULT false, p_limit int
  DEFAULT 20, p_offset int DEFAULT 0)`**: the deal must be buyer/tenant, `active` or `nurture`,
  with a requirement, else no rows. Open listings (`active`, `reserved`) of the deal's offer type
  on `active` properties, `match_evaluate(...)->>'listed'`, `link_status` from a left join on
  `opportunity_properties`, linked rows only with `p_include_linked`.
- **`match_opportunities(p_property_id uuid, …same)`**: for each open listing of an active
  property, the requirements on `active`/`nurture` deals of the matching type (sale → buyer,
  rent → tenant); returns the opportunity id, status, title, `primary_contact_id`, `assigned_to`.
- Both return the property fields the chips need, listing id/offer type/price/status/`listed_at`,
  `score`, `criteria`, `link_status`, `total_count`, `unlinked_count`, ordered per the plan
  (reserved last, score, recency, id).

Write `081-match-lists.sql`.

**Acceptance criteria:**
- [x] Closed, withdrawn and wrong-offer-type listings, archived properties, won/lost/archived deals and seller/landlord deals never appear; a nurture deal does (AC-3, AC-5 at the DB layer)
- [x] Linked properties are hidden by default and returned with `link_status` when included; `total_count` and `unlinked_count` match; reserved rows come after all active rows; paging is stable (AC-4 at the DB layer)
- [x] A Beta broker calling either function with an Alpha id gets no rows; a price change to €230,000 drops the property from a €150–200k must-have buyer at the next call (AC-6, AC-7)

**Verification:**
- [x] `npx supabase db reset` then `npm run test:db`

**Dependencies:** Task 2
**Files likely touched:** `supabase/migrations/<ts>_match_lists.sql`, `supabase/tests/database/081-match-lists.sql`, `supabase/tests/database/010-rls-catalog.sql` (only if it lists functions)
**Estimated scope:** S

## Task 4: Seed every match result and measure the speed target
**Description:** Extend `supabase/seed.sql` (new rows only, own codes and ids). For Alpha's buyer
(Opp 1: apartment or maisonette, 2–3 rooms, Lozenets or Center, €150–200k, not top floor, brick):
an unlinked 2-room Lozenets apartment at €185,000 (100%), a 3-room Lozenets at €209,000 (close on
budget, so hidden while budget is a must-have), a Lozenets apartment with no m² and no
construction (`?`), a reserved match, a rent-only Lozenets apartment; Beta's buyer and tenant get
an exact match, a near miss and an unknown each. Add `scripts/matching/scale.sql`: run against
the local stack only (refuses unless `current_database()` is the local one), adds 2,000 properties
with listings and 2,000 requirements to a scratch agency, then `EXPLAIN (ANALYZE, BUFFERS)` both
functions; record p95 of 20 runs in this task. Add an index in a new migration only if the target
(300 ms) is missed.

**Acceptance criteria:**
- [ ] `select * from match_properties('<Alpha Opp 1>')` as Alpha's broker shows the 100% row first, the `?` row below it, the reserved row last and no rent-only row (AC-1, AC-2, AC-3 data)
- [ ] Both functions meet 300 ms p95 on the scaled data; the numbers are written under this task
- [ ] `npm run test:services` and `npm run test:e2e` still pass with the new seed rows

**Verification:**
- [ ] `npx supabase db reset`, `npm run test:db`, `npm run test:services`, `npm run test:e2e`
- [ ] The scale script run and its numbers recorded here

**Dependencies:** Task 3
**Files likely touched:** `supabase/seed.sql`, `scripts/matching/scale.sql`, (maybe) `supabase/migrations/<ts>_match_indexes.sql`
**Estimated scope:** S

## Checkpoint 1: Matching engine
- [ ] `npx supabase db reset` + `npm run test:db` green; typecheck, lint, test green
- [ ] Speed numbers recorded in Task 4
- [ ] Founder reviews AD-060 and the Alpha buyer's matches (scores, chips as SQL output) before any UI

## Phase 2: Opportunity side

## Task 5: Matching service and criteria chips
**Description:** `src/domain/matching/`:
- `types.ts`: `MatchCriterion`, `MatchResult`, `PropertyMatch`, `OpportunityMatch`, `MatchPage`
  (rows, total, unlinked, page)
- `repository.ts`: calls both functions via `.rpc()`, maps rows, throws on error
- `service.ts`: `MatchingService(db)` with `forOpportunity(opportunityId, agencyId, locale,
  { includeLinked, page })` and `forProperty(...)`; resolves settlement and area names
  (`SettlementService`, `AreaService`) and, for the property side, contact and broker names
  (existing contact and member lookups) in batch
- `criteria.ts`: pure `toChips(criteria, opportunityType)` → `{ key, result, must }[]`, dropping
  `n/a`; label keys under `matching.criteria.*`, budget label following the deal type (price or
  rent)

**Acceptance criteria:**
- [ ] `criteria.test.ts` covers every result, must-have marks, `n/a` dropped and the rent/price budget label, from fixture rows copied from the Task 2 function output
- [ ] `service.integration.test.ts` (service suites): paging and totals, include-linked, names resolved in BG and EN, a closed deal and a deal without a requirement return an empty page
- [ ] No rule from the spec's rule 2 table is recomputed in TypeScript

**Verification:**
- [ ] `npm run typecheck`, `npm run lint`, `npx vitest run src/domain/matching`, `npm run test:services`

**Dependencies:** Task 3 (Task 4 for the integration fixtures)
**Files likely touched:** `src/domain/matching/{types,repository,service,criteria}.ts`, `src/domain/matching/criteria.test.ts`, `src/domain/matching/service.integration.test.ts`
**Estimated scope:** M

## Task 6: Matches section on the opportunity page
**Description:** `src/components/domain/matching/property-matches-section.tsx` (Server Component)
with a row/card component and `match-chips.tsx`. The opportunity page loads the first page with
`MatchingService.forOpportunity` for buyer/tenant deals that are active or nurture and have a
requirement; the section goes between Изисквания and Properties in
`opportunity-detail-client.tsx`. Header "Подходящи имоти" with the new-match count; 10 rows, then
"Show all" (`?matches=all`) with a pager of 20 (`?matchesPage=`); toggle "Show already offered"
(`?matchesLinked=1`) showing link status. Empty state with a link to the requirement; a deal with
no requirement shows the "add the client's search" prompt; closed deals show no section. Row:
code, type, rooms, m², settlement and area, price and listing status (Reserved badge), score
("Съвпадение 85%"), chips with must-haves marked, link to the property. Mobile: cards. Keys under
`matching.*` in both message files.

**Acceptance criteria:**
- [ ] On the seeded Alpha buyer the 100% Lozenets row shows first with all chips ✓, the `?` row shows "not recorded" on m², the reserved row is last with its badge (AC-1, -2, -3)
- [ ] The toggle shows the seeded linked candidates with their statuses; the pager and "Show all" work; a won deal shows no section (AC-4 part, rule 8)
- [ ] BG and EN at 1280 and 390 px; no hardcoded strings (AC-9 part)

**Verification:**
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`
- [ ] Browser: Alpha buyer deal in `bg` and `en` at 1280 and 390 px

**Dependencies:** Task 5
**Files likely touched:** `src/components/domain/matching/{property-matches-section,match-row,match-chips}.tsx`, `src/app/(dashboard)/opportunities/[id]/page.tsx`, `src/app/(dashboard)/opportunities/[id]/opportunity-detail-client.tsx`, `messages/{bg,en}.json`
**Estimated scope:** M

## Task 7: Add as candidate from matches
**Description:** `addCandidateSchema` gains optional `source` (`manual` default, `match` allowed;
`viewing` refused from the app). `addPropertyCandidateAction` passes it; the match row's "Add as
candidate" button calls it with `source = 'match'`, toasts on error (sonner), and both pages
revalidate. After adding, the row leaves the new matches and appears under Properties with status
candidate.

**Acceptance criteria:**
- [ ] Adding from the list creates a `candidate` link with `source = 'match'`, shown on the opportunity and property timelines; the new-match count drops by one (AC-4 add part)
- [ ] `validation.test.ts` covers the `source` default and refuses `viewing`; the service suite covers `addCandidate` with `source`
- [ ] Seen in the browser in BG and EN at 1280 and 390 px (button in the card menu on mobile)

**Verification:**
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:services`
- [ ] Browser check as in the criteria

**Dependencies:** Task 6
**Files likely touched:** `src/domain/opportunity-properties/{validation,service,repository}.ts`, `src/domain/opportunity-properties/validation.test.ts`, `src/app/(dashboard)/opportunities/[id]/properties/actions.ts`, `src/components/domain/matching/match-row.tsx`
**Estimated scope:** M

## Checkpoint 2: Opportunity side
- [ ] AC-1, AC-2, AC-3, AC-4 (add part) and AC-6 seen in the browser in BG and EN at 1280 and 390 px
- [ ] typecheck, lint, test, test:services, test:db green
- [ ] `/review` of Phases 1–2

## Phase 3: E2E and cut items

## Task 8: E2E for the deal-side match loop
**Description:** `e2e/matching.spec.ts` on the seeded Alpha buyer: see the matches, add the top
one as candidate, see it under Properties, toggle "Show already offered" and see it with status
candidate. BG and EN, 1280 and 390, with the fixtures and selectors style of
`e2e/requirements.spec.ts`. The test cleans up or uses its own property so reruns pass.

**Acceptance criteria:**
- [ ] The spec passes in all four projects (bg/en × 1280/390) and on a rerun without `db reset`
- [ ] The existing E2E specs still pass

**Verification:**
- [ ] `npm run test:e2e`

**Dependencies:** Task 7
**Files likely touched:** `e2e/matching.spec.ts`, `e2e/fixtures.ts`
**Estimated scope:** S

## Task 9: Matching deals on the property page (cut 3)
**Description:** `opportunity-matches-section.tsx` on `/properties/[id]` for each open listing:
"Подходящи купувачи" (sale) and/or "Подходящи наематели" (rent), loaded with
`MatchingService.forProperty`. Row: deal title (link), contact, assigned broker, "nurture" badge,
score, chips, link status; "Add to this deal" with `source = 'match'`. Same pager and toggle
pattern with their own params. Extend `e2e/matching.spec.ts`: open the matched property, see the
Alpha buyer deal, add it.

**Acceptance criteria:**
- [ ] On the €185,000 property the Alpha buyer deal is listed with its broker; a won deal and a seller deal are not; "Add to this deal" links it with `source = 'match'` (AC-5)
- [ ] BG and EN at 1280 and 390 px; E2E extended and green (AC-9 part)

**Verification:**
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e`
- [ ] Browser: the property in `bg` and `en` at 1280 and 390 px

**Dependencies:** Tasks 5, 7, 8
**Files likely touched:** `src/components/domain/matching/{opportunity-matches-section,opportunity-match-row}.tsx`, `src/app/(dashboard)/properties/[id]/page.tsx`, `messages/{bg,en}.json`, `e2e/matching.spec.ts`
**Estimated scope:** M

## Task 10: "from matches" marker on links (cut 2)
**Description:** The opportunity's Properties section (`property-links.tsx`) and the property's
linked deals (`property-opportunities.tsx`) show "from matches" next to links with
`source = 'match'`. The link repositories select `source`.

**Acceptance criteria:**
- [ ] A link added from matches shows the marker on both pages; manual and viewing links don't (AC-4 marker part)
- [ ] BG and EN at 1280 and 390 px

**Verification:**
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`
- [ ] Browser check on both pages

**Dependencies:** Task 7
**Files likely touched:** `src/domain/opportunity-properties/{repository,types}.ts`, `src/components/domain/opportunities/property-links.tsx`, `src/components/domain/properties/property-opportunities.tsx`, `messages/{bg,en}.json`
**Estimated scope:** S

## Task 11: Not suitable from matches (cut 1)
**Description:** `OpportunityPropertyService.rejectFromMatch(agencyId, userId, { opportunity_id,
property_id, rejected_reason? })` creates the link as `rejected` with `source = 'match'`; a
`rejectMatchAction` beside the add action; the match row's "Not suitable" opens a small dialog for
the optional reason (reusing the reject-reason input of the link status control).

**Acceptance criteria:**
- [ ] Not suitable creates a `rejected` link with the reason and `source = 'match'`; it leaves the new matches, shows with status rejected under the toggle, and the timelines show it (AC-4 not-suitable part)
- [ ] The service suite covers `rejectFromMatch`, with and without a reason, and refuses a seller deal
- [ ] BG and EN at 1280 and 390 px

**Verification:**
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:services`
- [ ] Browser check on the Alpha buyer

**Dependencies:** Task 7
**Files likely touched:** `src/domain/opportunity-properties/service.ts`, `src/domain/opportunity-properties/service.integration.test.ts`, `src/app/(dashboard)/opportunities/[id]/properties/actions.ts`, `src/components/domain/matching/{match-row,not-suitable-dialog}.tsx`, `messages/{bg,en}.json`
**Estimated scope:** M

## Checkpoint 3: Complete
- [ ] AC-1…AC-9 met; full Definition of Done (typecheck, lint, test, test:services, `db reset` + test:db, test:e2e, browser in bg and en)
- [ ] `docs/domain-model.md` §2.9 final; AD-060 matches what was built
- [ ] `/review`; then close: `matching` Done in `SPEC.md`, FR-MAT rows ✅ in `docs/BRD.md`, `tasks/*` to `docs/archive/matching-*.md`
