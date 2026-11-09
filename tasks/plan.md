# Implementation Plan: property-import

> **Spec:** `spec/property-import.md` · **Checklist:** `tasks/todo.md`
> **Status:** Plan approved (founder, 2026-11-08). Approved scope (founder, 2026-11-08).
> Decisions: AD-064 (written in Task 1). Branch: `feat/property-import`, cut from
> `feat/smart-lists` (that branch isn't in `main` yet, so it merges first or with this one).

## Overview
A third import type on the AD-034 pipeline: one CSV row becomes a property, its sale and/or rent
listing, and an owner party, with new areas created on the way. The work has three phases.

- **Phase 1** builds and proves the pipeline without UI: the schema, the parsers, validation, the
  commit and revert RPCs, and a 2,000-row speed run. The risky parts all live here: one address
  rule shared by validation and commit, all-or-nothing rows, a revert that never deletes worked-on
  records, and speed. Checkpoint 1 is where you see them before any screen is built.
- **Phase 2** adds the screens as vertical slices: start and map, preview, commit and results,
  then the property timeline entry.
- **Phase 3** adds the E2E test and the closing docs.

**Model per task** (memory: Opus where a mistake is silent or hard to undo, Sonnet for the rest).
Tasks 1, 4, 5 and 6 run on **Opus**: migrations, the address rule, the commit and revert RPCs.
The rest run on **Sonnet**. Task 3 is marked for Opus review because settlement resolution must
never guess.

## Architecture decisions
These are the places where the plan makes the spec more concrete. Task 1 records them as AD-064.

- **Validation in TypeScript, writes in one RPC.** The pattern is the same as contacts. The
  service validates each page of rows and stores a `normalized` payload with every id already
  resolved: `settlement_id`, the area (`area_id`, or `new_area: { settlement_id, name }`),
  `assigned_to`, the listings, and the owner (`owner_contact_id`, or `new_owner: {...}`). Then
  `import_commit_properties(p_job_id, p_limit)` writes each row inside its own `BEGIN … EXCEPTION`
  block. A row that fails becomes `error` and leaves nothing behind (AD-050), as in
  `import_commit_contacts`.
- **One address rule, in SQL.** `property_address_key(text) RETURNS text` is `IMMUTABLE`. It
  lowercases, removes `ул.`, `бул.`, `ж.к.`, `№`, punctuation and whitespace, and returns null for
  a blank address. `properties.address_key` is a stored generated column from it, with the index
  `(agency_id, settlement_id, address_key) WHERE address_key IS NOT NULL`. Validation calls
  `import_property_address_matches(p_items jsonb)`. It takes `[{ row, settlement_id, address }]`
  and returns each row's key and the existing property with that key, if there is one. The service
  then detects in-file duplicates from those keys. The commit re-checks with the same column. So
  no copy of the rule exists in TypeScript.
- **Owner and area sharing happens at commit.** The RPC re-matches the owner by phone and email
  against `contact_methods` before it creates a contact. So the second row with the same new owner
  finds the contact the first row created, with no in-file bookkeeping needed. Areas work the same
  way: insert with `ON CONFLICT` on the unique `(agency_id, settlement_id, lower(name))`, then
  select. The preview still groups new owners and new areas so its counts match what happens.
- **Unticked new areas** are stored in `import_jobs.options.create_areas`, as the
  `settlement_id:name` keys you kept. The commit creates only those areas, and imports the other
  rows with no area. No row has to be re-validated.
- **Settlement lookup.** The repository loads the settlements whose `lower(name_bg)` or
  `lower(name_en)` is in the file's distinct names, after stripping `гр.`/`с.`/`град`/`село`. It
  also loads by EKATTE code. Resolution is a pure function and Vitest covers every branch:
  unique, ambiguous, narrowed by municipality or province, and not found.
- **Header detection takes the entity.** `detectHeaders(headers, entity)` gets a separate
  dictionary per entity. Property columns such as "type", "description" and "id" would clash with
  the merged dictionary used today. Contact and inquiry mapping must not change, and a test pins
  that.
- **Audit carries the job.** `audit_property_changes` and `audit_listing_changes` add
  `import_job_id` to the INSERT row's `metadata` when the new row has one. `describeAudit` uses it
  for "Imported from <file>". Nothing else in those triggers changes, and existing timeline tests
  guard that.
- **"Untouched" for revert** has two parts:
  - The property's `updated_at` is at or before `completed_at`.
  - Nothing has been attached to it since: no note, task or opportunity link, no listing without this job's id or with a later `updated_at`, and no party that is
    ended, created after the commit or from outside the job.
  Properties go first, and their listings and parties cascade. Then the existing contact rule
  runs, which now finds those owners free of parties. Last come the job's areas that no property
  and no `requirement_locations` row uses. `RevertResult` gains `properties` and `areas`.
- **Limits** stay as they are: 5 MB, 5,000 rows, 500-row chunks (`IMPORT_LIMITS`).

## Task list

### Phase 1: Pipeline (no UI)
- [x] Task 1: AD-064, schema, address key, audit metadata — **Opus**
- [x] Task 2: Parsers: header synonyms, value resolvers, row mapper — Sonnet
- [x] Task 3: Validation: location, listings, assignee — Sonnet (Opus review)
- [x] Task 4: Validation: duplicates and owners — **Opus**
- [x] Task 5: `import_commit_properties` — **Opus**
- [x] Task 6: Revert for property jobs — **Opus**
- [x] Task 7: Fixtures and the 2,000-row scale run — Sonnet

### Scale run (Task 7, 2026-11-08, local stack)
`PROPERTY_IMPORT_SCALE=1 npm run test:services -- scripts/property-import/measure.test.ts`,
2,000 rows (`scripts/property-import/generate-scale.ts`), owner@alpha.bg:

| Step | Time | Rule 11 |
|---|---|---|
| Stage (4 × 500-row chunks) | 0.4 s | — |
| Validate | 3.3 s | |
| Preview read (2 × 1,000-row pages) | 0.2 s | validate + preview 3.5 s < 30 s ✅ |
| Commit (10 × 200-row batches) | 8.0 s | < 2 min ✅ |
| Revert | 2.7 s | — |

The run found two bugs, fixed in Task 7: GET filters with 500 phones exceeded the URL limit
(lookups now go 100 at a time, settlement names 10), and the validation summary read rows back
through the 1,000-row PostgREST cap (now counted per status). The measure is a gated vitest
file, not a `tsx` script: it needs the `@/` aliases and the test client, and the repo has no
TypeScript runner.

### Checkpoint 1 (founder)
- [x] Integration suite stages, validates, commits and reverts every fixture
- [x] Scale numbers against rule 11; address and settlement results on the edge-case fixture
- [x] `/review` of Phase 1, then founder go for the UI

### Phase 2: Screens
- [x] Task 8: Start and map a property import — Sonnet
- [x] Task 9: Property preview — Sonnet
- [x] Task 10: Commit, results and revert on the job page — Sonnet
- [x] Task 11: "Imported from" on the property timeline, matches right after import — Sonnet

### Checkpoint 2
- [ ] The whole flow in the browser in `bg` and `en`, at 1280 and 390 px

### Phase 3: Proof and close
- [x] Task 12: E2E property import and revert — Sonnet
- [x] Task 13: Docs complete (domain model, BRD, spec as built) — Sonnet

### Checkpoint 3
- [ ] `/review` of the module; AC-1…AC-10 each traced to a test or a browser check

## Cut list (if time runs short, in this order)
1. Near-duplicate area warning (rule 3, A1). The new areas list still shows every name.
2. The BGN conversion count in the preview. The conversion itself stays.
3. Per-row "owner: matched X" text. The counts stay.

## Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Address key too loose (merges different flats) or too strict (misses real duplicates) | High: silent duplicates, or rows skipped | Edge-case fixture with real-looking Bulgarian addresses in Task 4; duplicates default to `skip` and the preview lists them; the rule is one SQL function, easy to tune |
| Village names are ambiguous (hundreds of repeats) | Med: many invalid rows | Ambiguity names the municipalities; the EKATTE column works; the dry run in `go-live` measures how often it happens |
| Per-row PL/pgSQL commit is too slow at 2,000 rows | Med | Task 7 measures before any UI; batch size is a parameter; indexes on `address_key` and `contact_methods (agency_id, type, value)` |
| Changing the audit triggers breaks the property or listing timeline | Med | Only the INSERT `metadata` changes; existing timeline and pgTAP audit tests must stay green |
| Revert deletes something that was worked on | High: lost data | Task 6 pgTAP has one kept-case per kind of work; the guard is the spec's list, not "anything changed" |
| Header detection change regresses contact and inquiry mapping | Med | Task 2 pins the current mappings with a test before the refactor |

## Open questions
None. Spec Q1 and Q2 are resolved.
