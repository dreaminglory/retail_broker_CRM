# Spec: matching

> **Status:** Approved scope (founder, 2026-11-05). Decisions to write: AD-060.
> Requirements: FR-MAT-01…08.
> **Evidence:** gap analysis §5.1 #7 (two-way matching with required criteria, a score and an
> "already offered" list is a core purchase reason in BG), benchmark B-12, business brief
> "Pilot operationally complete" ("a buyer or tenant requirement can be matched against the
> agency's properties, and the broker sees the matches"), AD-039 pilot gate.
> Scope answers from the founder (2026-11-05): near misses on soft criteria get half credit,
> must-haves stay strict; a property missing the data for a must-have still shows, marked "?";
> active and reserved listings match, reserved sort below active; no new-match alerts in this
> module. Assumptions A1–A5 are unvalidated.

## Objective

A broker opens a buyer's or tenant's opportunity and sees which of the agency's properties fit
the client's search, best first, with what fits and what doesn't, and what was already
offered. From a property they see which active buyers or tenants it fits. Either way, one
click adds the property to that deal as a candidate. This replaces "I remember a client who
wanted something like this" and it is the last data piece of the pilot gate (AD-039).
`smart-lists` builds on it ("buyers with matches not yet offered").

**Users:** brokers (find properties for their clients and clients for their properties),
owners and managers (the same across the agency, e.g. when a new exclusive listing comes in).

**Not in this module:** alerts or a "new match" state, lists of buyers by match (`smart-lists`),
sending properties to the client, agency-configurable weights or tolerances.

## Data model (AD-060)

No match table. A match is computed when it is read, in Postgres, from the rows that are the
truth: `requirements` and `requirement_locations` (AD-059), `properties`, `listings` and
`opportunity_properties`. A listing price change, a new property or an edited requirement is
reflected at the next read, with nothing to keep in sync.

- **`match_evaluate`** (SQL, `IMMUTABLE` on its inputs): takes a requirement with its location
  keys, a property and a listing; returns the per-criterion results and the score. The one place
  the rules below live. Both directions and, later, `smart-lists` call it.
- **`match_properties(opportunity_id, include_linked, limit, offset)`**: the matches for one
  buyer or tenant deal, sorted, paged, with the total. `SECURITY INVOKER` (RLS applies, AD-050)
  and filtered by the caller's agency.
- **`match_opportunities(property_id, include_linked, limit, offset)`**: the buyer and tenant
  deals one property fits, per open listing (sale → buyers, rent → tenants).
- Each result row: property (code, type, rooms, m², settlement, area), listing (id, offer type,
  price, status), opportunity (id, title, contact, assigned broker, status) on the reverse side,
  `score` (0–100), `criteria` (jsonb: one entry per set criterion with its result), and
  `link_status` (the existing link's status, or NULL).
- **Sharpened by the plan (AD-060):** location is read from `requirements.location_keys`, not a
  join; reserved listings sort after all active ones; each list call also returns
  `total_count` and `unlinked_count`; names are resolved in the service, not in SQL.
- **`opportunity_properties.source`**: `manual | match | viewing`, default `manual`, set on
  insert only (no `UPDATE` privilege, AD-058). `match` when a link is created from a match list;
  `viewing` when the viewing trigger creates it (properties rule 7). Lets us measure A1 and
  shows "from matches" on the link.

## Business rules

1. **What can match.** A buyer deal matches properties with an open **sale** listing, a tenant
   deal those with an open **rent** listing (the offer type follows the deal type, AD-059).
   Open means `active` or `reserved`. The property is `active` (archived ones have no open
   listings anyway). Only deals with a requirement and status `active` or `nurture` match;
   nurture deals are marked as such on the property side.
2. **Per-criterion result.** Each criterion set on the requirement gets one result:
   `match`, `close`, `miss`, `unknown` (the property lacks the value) or `n/a` (the criterion
   doesn't apply to this property type).

   | Criterion | `match` | `close` | `unknown` | `n/a` |
   |---|---|---|---|---|
   | Budget | listing price within min–max | up to 10% outside a bound | — | — |
   | Location | property's settlement is a whole-settlement location, or its area is a listed area | — | the settlement is listed only with areas and the property has no area | — |
   | Type | property type in the list | — | — | — |
   | Rooms | within min–max | one room outside | — | the property isn't an apartment (requirements rule 5) |
   | m² | built-up m² within min–max (plot m² for a plot) | up to 10% outside a bound | value not recorded | — |
   | Floor | within min–max and, if asked, not the top floor | — | floor not recorded, or floors total missing for "not top floor" | the type has no floor (house, plot); "not top floor" alone is n/a for a garage (no floors total) |
   | Construction | in the list | — | not recorded | plot, garage |

   Anything else is `miss`. The tolerances are fixed constants in `match_evaluate`.
   [ASSUMPTION A2: 10% on price and m², ±1 room is what brokers call "close". Validate: share
   of candidates added from matches that were `close` on some criterion]
3. **Must-haves filter.** A property is listed only if no must-have criterion is `miss` or
   `close`. A must-have that is `unknown` or `n/a` doesn't exclude it; `unknown` shows "?".
   [ASSUMPTION A3: brokers prefer seeing incompletely recorded properties to losing them.
   Validate: candidates added from matches with an unknown must-have]
4. **Score.** Over the applicable criteria (not `n/a`): `match` = 1, `close` = ½, `miss` and
   `unknown` = 0; score = round(100 × points ÷ applicable). Every criterion weighs the same.
   A property with no applicable criterion, or a score of 0, isn't listed.
   [ASSUMPTION A4: equal weights rank well enough for the pilot. Validate: position in the list
   of the matches brokers add]
5. **Order.** Active listings before reserved ones; within each, score descending, then the
   newest listing (`listed_at`) first on the opportunity side, the most recently updated deal
   first on the property side. Reserved listings carry a "Reserved" badge.
6. **Already linked.** A property already linked to the deal (any status) isn't a new match. By
   default lists show only unlinked matches; a "Show already offered" toggle adds the linked
   ones with their link status (candidate, viewed, offered, rejected, selected).
7. **Actions.** Any member may, from either list:
   - **Add as candidate**: creates a `candidate` link with `source = match` (properties
     rule 5 applies, the existing audit shows it on both timelines);
   - **Not suitable** (opportunity side only): creates the link as `rejected` with an optional
     reason, so the property stops showing as new and the history keeps why.
   Neither action exists for a closed deal or an archived property.
8. **Read-only and closed deals.** A won, lost or archived deal shows no matches section and
   doesn't appear on the property side. A deal without a requirement shows a prompt to add one.
9. **Tenancy.** Matches come only from the caller's agency: the functions run as the caller
   (RLS) and also filter by agency. Nothing new is written except links through the existing
   service.
10. **Speed.** For one deal or one property the list returns in under 300 ms (p95) on an agency
    with 2,000 properties and 2,000 requirements. [ASSUMPTION A5: pilot agencies stay below that.
    Validate: row counts in the onboarding dry run]

## Screens

- **Opportunity detail (buyer/tenant with a requirement, active or nurture):** a "Подходящи
  имоти" section between Изисквания and Properties, with the count of new matches in the header.
  The first 10 rows, then "Show all" with a pager of 20. A row: code, type, rooms, m², settlement
  and area, price and listing status, score, and one chip per criterion (✓ match, ≈ close,
  ✗ miss, ? not recorded; n/a hidden), must-haves marked. Actions: open property, Add as
  candidate, Not suitable (asks for an optional reason). Toggle "Show already offered". Empty:
  "No properties match yet" with a link to the requirement. Mobile: cards, actions in a menu.
- **Property detail (with an open listing):** "Подходящи купувачи" (sale) and/or "Подходящи
  наематели" (rent): per row the deal title, contact, assigned broker, deal status if nurture,
  score, chips and link status; action Add to this deal. Same pager and toggle.
- **Link on the opportunity's Properties section and the property's linked deals:** "from
  matches" next to links with `source = match`.
- **Glossary:** Match = **Подходящ имот** (on a deal) / **Подходящ купувач / наемател** (on a
  property); Score = **Съвпадение** (shown as "Съвпадение 85%"); Close = **Близо**. Added to
  `docs/domain-model.md` §7 in the migration commit (founder to confirm the terms, Q1).

## Where it lives

- Migration `supabase/migrations/<date>_matching.sql` (functions, `opportunity_properties.source`,
  any index the speed target needs); pgTAP `supabase/tests/database/080-matching.sql`.
- `src/domain/matching/` (`types.ts`, `repository.ts` calling the two functions,
  `service.ts`, `criteria.ts` mapping the `criteria` jsonb to chips; tests beside them).
- UI in `src/components/domain/matching/`. Actions reuse
  `src/app/(dashboard)/opportunities/[id]/properties/actions.ts` (add candidate gains `source`,
  plus a "not suitable" action) and revalidate both pages.
- Keys under `matching.*` in both `messages/bg.json` and `messages/en.json`.
- `docs/domain-model.md`: a §2.9 Matching (functions, rules, `source`), invariants, glossary.
- Commands, code style and the mutation pattern: `AGENTS.md`.

## Success criteria

- **AC-1** The seeded Alpha buyer (apartment or maisonette, 2–3 rooms, Sofia – Lozenets or
  Iztok, €150,000–€200,000, must-haves budget, location, type) sees an active Lozenets
  2-room apartment at €185,000 as a 100% match, and a Lozenets 3-room at €209,000 only if
  budget isn't a must-have (then as "close" on budget) (FR-MAT-01, -02, -03).
- **AC-2** A Lozenets apartment with no m² recorded, against an m² must-have, shows with "?" on
  m² and scores below an otherwise identical one with m² recorded (FR-MAT-03).
- **AC-3** A reserved listing shows with a badge below all active matches; a withdrawn or closed
  listing, an archived property, or a rent listing for a buyer never shows (FR-MAT-01).
- **AC-4** Add as candidate creates a `candidate` link marked "from matches", visible on both
  timelines, and the property leaves the new matches; "Show already offered" brings it back with
  its status. Not suitable creates a `rejected` link with the reason (FR-MAT-05, -06).
- **AC-5** On the €185,000 property, Alpha's matching buyer deal is listed with its broker; a won
  deal and a seller deal are not; Add to this deal links it (FR-MAT-04).
- **AC-6** Changing the listing price from €185,000 to €230,000 removes it from that buyer's
  matches at the next load, without any other step (FR-MAT-02).
- **AC-7** A broker of agency Beta gets no Alpha property or deal from either function, even
  with an Alpha id (pgTAP) (FR-MAT-07).
- **AC-8** Both lists return within the speed target on the scaled seed (rule 10) (FR-MAT-08).
- **AC-9** Both sections work in BG and EN at 1280 and 390 px; no hardcoded strings.

**FR rows (BRD, area FR-MAT):** 01 buyer ↔ open sale and tenant ↔ open rent listings, active and
reserved, active deals and nurture only; 02 per-criterion result and score computed on read; 03
must-haves filter, near misses half credit, unrecorded values marked; 04 two-way: matches on the
deal and on the property; 05 one-click add as candidate from either side, marked as from matches;
06 already-offered state and not-suitable from matches; 07 tenant isolation; 08 speed target.

## Testing strategy

- **pgTAP `080-matching.sql`:** `match_evaluate` per criterion and result (every row of the rule 2
  table, including the 10% and ±1 edges and `n/a` by type); the must-have filter (rule 3); the
  score formula and the zero-score exclusion (rule 4); ordering (rule 5); linked properties and the
  toggle (rule 6); open listing and offer type selection, closed deals and archived properties
  (rules 1, 8); `source` set on insert and not updatable; cross-agency results empty (rule 9).
- **Vitest:** `criteria.ts` (jsonb → chips, must-have marks, n/a hidden) in BG and EN;
  `MatchingService` in the service suites (paging and total, include-linked, add candidate with
  `source = match`, not suitable with a reason, refusal on a closed deal).
- **Performance:** a script that scales the seed to 2,000 properties and 2,000 requirements and
  runs `EXPLAIN ANALYZE` on both functions; the numbers go in the plan's checkpoint (rule 10).
- **E2E (Playwright):** extend the core loop: on the seeded buyer deal see the matches, add one as
  candidate, see it under Properties marked "from matches"; open that property and see the deal on
  the buyers list. BG and EN, 1280 and 390.
- **Seed:** both agencies get properties that hit each result for the seeded requirements: an exact
  match, a near miss on price, one with no m², a reserved listing, a rent-only listing and an
  already linked candidate.

## Boundaries

- Always: the matching rules only in `match_evaluate` (no copy in TypeScript); `SECURITY INVOKER`
  functions plus an `agency_id` filter; the `supabase-patterns` checklist for the migration;
  `source` as `CHECK` + Zod + TS + both message files; links created only through
  `OpportunityPropertyService`; write AD-060 before the migration; update `docs/domain-model.md`
  in the migration commit.
- Ask first: storing matches or scores in a table (cache or materialized view); any change to
  `requirements`, `properties` or `listings` columns; agency-configurable weights or tolerances; a
  new dependency (search engine, extension).
- Never: write `audit_log` from app code; change a requirement or a listing from the match lists;
  show another agency's rows; use financing or wishes in the score (AD-059).

## Out of scope

Alerts, digest lines or a "new since last seen" state; lists or counts of deals by match on the
opportunities list (`smart-lists`); sending matches to the client (email, PDF, link); per-agency
weights, tolerances or criterion priority; matching by price per m², distance or neighbouring
areas; matching properties to seller deals or deals without a requirement; history of past match
scores.

## Cut order if time runs short

1. "Not suitable" from matches (the broker can add and then reject).
2. "from matches" marker in the UI (`source` is still stored).
3. The reverse list on the property page (the AC-5 path), keeping the function for `smart-lists`.

## Assumptions

- **A1** Brokers add candidates from the match list rather than by searching for the property.
  Validate: share of candidate links with `source = match`.
- **A2** 10% on price and m², ±1 room is "close" (rule 2).
- **A3** Showing properties with unrecorded must-have data, marked "?", is better than hiding them
  (rule 3).
- **A4** Equal weights rank well enough (rule 4).
- **A5** Pilot agencies stay under 2,000 properties and 2,000 requirements (rule 10).

## Resolved questions (founder confirmed, 2026-11-05)

- **Q1** BG terms: "Подходящи имоти / купувачи / наематели", "Съвпадение 85%", "Близо".
- **Q2** Reserved listings sort below *all* active matches, whatever their score (rule 5).
