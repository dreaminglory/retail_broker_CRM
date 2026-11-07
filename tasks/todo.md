# Tasks: smart-lists

> **Plan:** `tasks/plan.md` · **Spec:** `spec/smart-lists.md`
> Every task also clears the Definition of Done in `AGENTS.md`. Tick a task only after that.
> Migrations: the next free timestamps after `20261107000003`, in order (`20261108000001`…).
> pgTAP: `090-smart-lists.sql` (table, RLS), `091-smart-list-functions.sql`.
> **Model:** each task names the model it should run on. A Sonnet session that finds it needs to
> change a migration, a policy or a SQL function stops and hands that part to Opus.

## Phase 1: List engine

## Task 1: AD-062, `smart_lists` table, RLS and the docs — **Opus**
**Description:** Create `feat/smart-lists` from `feat/conversion-join` and mark `smart-lists`
In progress in `SPEC.md`. Write AD-062 in `docs/decisions-log.md` from the plan's architecture
decisions and update `spec/smart-lists.md` where they sharpen it (the `sort` key, the URL queue,
the opportunity list moving to the function). Add FR-LST-01…09 to `docs/BRD.md`, not built.
Migration `<ts>_smart_lists.sql` per `supabase-patterns`: the table, the unique name index, the
`updated_at` trigger, RLS as in the plan, the 50-per-member `BEFORE INSERT` trigger. Start
`090-smart-lists.sql`. `docs/domain-model.md`: §2.10 Smart Lists stub (table, planned functions,
last touch), invariants for `shared` and the cap, glossary (Списък / Списъци, Обработи),
migration count.

**Acceptance criteria:**
- [x] pgTAP: a broker inserts a personal list; inserting or updating to `shared = true` as a broker fails; owner and manager can; a member sees own + shared only; a manager can't select, update or delete another member's personal list; a broker can't update or delete a shared list; Beta sees nothing of Alpha
- [x] Duplicate name for the same member (case-insensitive) fails; the 51st list fails with `smartLists.errors.limit`; `entity` outside the list fails
- [x] AD-062, the BRD rows, the spec adjustments and the domain-model stub are in the same commit

**Verification:**
- [x] `npx supabase db reset` then `npm run test:db`
- [x] `npm run typecheck`, `npm run lint`, `npm run test`

**Dependencies:** None
**Files likely touched:** `SPEC.md`, `docs/decisions-log.md`, `docs/BRD.md`, `spec/smart-lists.md`, `docs/domain-model.md`, `supabase/migrations/<ts>_smart_lists.sql`, `supabase/tests/database/090-smart-lists.sql`
**Estimated scope:** M (the docs are edits only)

## Task 2: `smart_list_opportunities` and last touch — **Opus**
**Description:** Migration `<ts>_smart_list_opportunities.sql`:
- `opportunity_last_touch(o opportunities) RETURNS timestamptz`, `STABLE`, invoker: greatest of
  the latest `completed` task `completed_at` and the latest note `created_at` on the deal, else
  `o.created_at`. Never `updated_at`.
- `smart_list_opportunities(p_filter jsonb, p_limit int, p_offset int, p_after jsonb)`,
  `LANGUAGE sql STABLE SECURITY INVOKER`, `agency_id = current_agency_id()` on every table.
  Filter keys: `status[]`, `type[]`, `stage_id[]`, `temperature[]`, `assigned_to` (`me` →
  `auth.uid()`, `unassigned` → null, or a uuid), `source_id[]`, `next_action` (`none | overdue |
  today | upcoming`, windows from `agencies.timezone` as in the plan), `no_touch_days`, `search`
  (same match as the opportunity list's search today — read `OpportunityRepository.filtered`),
  `sort` (`created_desc | last_touch_asc | next_action_asc`; `new_matches_desc` arrives in Task
  3). Returns the columns the opportunity table shows, `last_touch`, `sort_key jsonb`,
  `total_count`. `p_after` returns rows strictly after that key; `limit` capped at 100.
- Grants: `authenticated` only. Start `091-smart-list-functions.sql`.

**Acceptance criteria:**
- [x] pgTAP: each filter key alone narrows to the expected seeded rows; an empty filter equals the active deals; `me` is the caller; a Beta broker with Alpha ids gets nothing
- [x] Last touch: a note or completed task moves it; a merge or an edit (`updated_at`) doesn't; a cancelled task doesn't
- [x] `today` / `overdue` / `upcoming` edges asserted at fixed `now()` values around Sofia midnight; each sort's order and the `p_after` key return the next row even after the current one left the list

**Verification:**
- [x] `npx supabase db reset` then `npm run test:db`
- [x] `EXPLAIN ANALYZE` on the local seed noted in the commit message

**Dependencies:** Task 1
**Files likely touched:** `supabase/migrations/<ts>_smart_list_opportunities.sql`, `supabase/tests/database/091-smart-list-functions.sql`
**Estimated scope:** M

## Task 3: `new_matches` and the speed spike — **Opus**
**Description:** Migration `<ts>_smart_list_new_matches.sql`: extract the unlinked-match join of
`match_properties` into one internal SQL function (e.g. `deal_new_matches(o opportunities)
RETURNS int`, invoker, agency filter) and re-create `match_properties` to use it for
`unlinked_count`, unchanged in output. Add `has_new_matches` and `sort = new_matches_desc` to
`smart_list_opportunities`, with `new_matches` returned only when either is used. Extend
`scripts/matching/scale.sql` (or a new `scripts/smart-lists/scale.sql` reusing its setup) to time
`smart_list_opportunities` with `has_new_matches` over 2,000 deals, 2,000 requirements and 2,000
properties as a broker: min / median / p95 / max. If the p95 is over 1 s, try the pre-filter in
the plan; record both numbers.

**Acceptance criteria:**
- [x] `081-match-lists.sql` still passes unchanged (the matching output didn't move)
- [x] pgTAP: `new_matches` equals `match_properties(...).unlinked_count` for every seeded buyer and tenant deal; adding a candidate or a not-suitable link lowers it
- [x] Scale numbers recorded in the commit message and in the Checkpoint 1 notes below

**Verification:**
- [x] `npx supabase db reset` then `npm run test:db`
- [x] `docker exec -i supabase_db_retail_broker_crm_application psql -U postgres -d postgres -v ON_ERROR_STOP=1 < scripts/smart-lists/scale.sql`

**Dependencies:** Task 2
**Files likely touched:** `supabase/migrations/<ts>_smart_list_new_matches.sql`, `supabase/tests/database/091-smart-list-functions.sql`, `scripts/smart-lists/scale.sql`
**Estimated scope:** M

## Task 4: `smart_list_inquiries` and `smart_list_counts` — **Opus**
**Description:** Migration `<ts>_smart_list_inquiries.sql`:
`smart_list_inquiries(p_filter, p_limit, p_offset, p_after)` with `status[]`, `assigned_to`,
`source_id[]`, `search` (same match as `InquiryService.list` today), `sort` (`received_asc |
received_desc`), same return shape rules as Task 2. `smart_list_counts(p_lists jsonb)`: for each
`{ key, entity, filter }` the count, capped by `LIMIT 1000`. Both invoker, agency-filtered,
`authenticated` only.

**Acceptance criteria:**
- [x] pgTAP: each inquiry filter key; `me`; cross-agency empty
- [x] `smart_list_counts` returns, for a mixed array of opportunity and inquiry filters, the same numbers as `total_count` of the list functions, and 1000 for a list with more rows
- [x] An invalid `entity` in the array raises an i18n key, not a SQL error text

**Verification:**
- [x] `npx supabase db reset` then `npm run test:db`

**Dependencies:** Task 2 (Task 3 for the `new-matches` count)
**Files likely touched:** `supabase/migrations/<ts>_smart_list_inquiries.sql`, `supabase/tests/database/091-smart-list-functions.sql`
**Estimated scope:** S

## Task 5: Seed every built-in list and measure the targets — **Sonnet**
**Description:** In `supabase/seed.sql`, give both agencies rows that land in each built-in list
of the spec, and one just outside each threshold: a deal with no task, one overdue, one due today,
a hot deal touched 2 days ago and one 4 days ago, a seller touched 13 and 15 days ago, an
unassigned deal, new and unassigned inquiries, and one personal and one shared smart list. Use
titles prefixed `SL ` so other suites can ignore them. Add inquiries, tasks and notes to the scale
script and time the counts call (every built-in list) and each list function.

**Acceptance criteria:**
- [x] Each built-in preset (written as raw jsonb in a pgTAP block) returns exactly its seeded `SL` rows for Alpha's broker
- [x] `npm run test:services` and `npm run test:e2e` still pass (counts other suites assert were updated or unaffected)
- [x] Overview p95 (all counts) and list p95 recorded against rule 10 (1 s, 300 ms)

**Verification:**
- [x] `npx supabase db reset`, `npm run test:db`, `npm run test:services`, `npm run test:e2e`

**Dependencies:** Tasks 3, 4
**Files likely touched:** `supabase/seed.sql`, `supabase/tests/database/091-smart-list-functions.sql`, `scripts/smart-lists/scale.sql`, suites whose counts move
**Estimated scope:** M

## Checkpoint 1: List engine
- [x] `npx supabase db reset` + `npm run test:db` green; typecheck, lint, test green
- [x] Speed numbers below; `new-matches` decision made (oldest last touch first)
- [ ] Founder reviews AD-062 and each built-in list's seed output before any UI

Notes (speed) — 2,000 deals, 2,000 requirements, 2,000 properties; ONE broker owns every deal
(worst case: an owner/manager on the Agency scope); `scripts/smart-lists/scale.sql`, local stack:
- `match_evaluate` alone, one deal: ~97 ms (no pre-filter). Through the view with the must-have
  pre-filter: median 11.6 ms, p95 32 ms. `match_properties` after the refactor: p95 ~66 ms
  (matching measured ~150 ms before), output unchanged (`081` passes untouched).
- **`new-matches` count** (deals with at least one new match, 1,907 of 2,000): **0.86 s** as a per-deal
  `LATERAL … LIMIT 1`. The same question asked as a plain `EXISTS` or through a SQL function took
  **39–45 s**: the planner computes every pair, and a function with the required `search_path`
  can't be inlined. So the count is inside the 1 s overview target but with little room for the
  other counts.
- **`new-matches` list sorted by exact count** (spec order "most new matches first"): **56.8 s**.
  Capped count (stop at N matches per deal, show "N+"): N=10 → 4.6 s, N=3 → 1.7 s. Neither meets
  300 ms at this scope. A broker on "Mine" (about 1/30 of the deals) is roughly 30× cheaper.
- **Task 5, full seed shape** (2,000 deals incl. tasks and notes, 5,000 inquiries, one broker owns
  every deal, local stack, p95 unless noted):
  - Built-in list pages (limit 20): due-today 19 ms, overdue 18, unassigned-deals 16,
    unassigned-inquiries 22, sellers-need-update 30, new-inquiries 45, no-next-action 47,
    hot-no-touch 64; "no touch for 14 days" 144; plain list 65. All under the 300 ms target
    except the `new-matches` page (1.3 s: its total_count tests every deal; see the decision above).
  - **Overview, counts for all nine lists in one call: median 1.13 s, p95 1.2–1.4 s (target 1 s).**
    About 0.9 s of that is the `new-matches` count; the other eight together ~0.2 s. On "Mine" for a
    broker with ~70 deals (1/30 of this) the same call is ~35 ms.
  - Before the last-touch view, `hot-no-touch` took 381 ms and `sellers-need-update` 326 ms: a
    SQL function with `SET search_path` isn't inlined (63 ms against 6.7 ms for 150 deals). An
    index on completed tasks made no difference and was not added.
  - The counts call stripped nothing before: with the `new-matches` sort it took 57 s; dropping
    `sort` in `smart_list_counts` made it 1.1 s.

**Founder decision (Checkpoint 1, 2026-11-07): option 1, oldest last touch first with the count shown on the rows of the page.** Built as migration `20261108000007` (the `new_matches_desc` sort is removed). Measured afterwards: a page of 20 of the new-matches list takes ~1.3 s at this worst case (the total over every deal 0.9 s plus 20 counts ~0.4 s), against ~40 ms for the other lists; on Mine for ~70 deals about 1/30 of that. Options that were on the table:
1. Order `new-matches` by oldest last touch (cheap, like the other lists) and show each row's
   count for the 20 rows of the page only; keep the ~0.9 s count (which alone leaves the overview
   just over 1 s at 2,000 deals on Agency scope; fine on Mine). Spec change: order only.
2. Cap the count ("5+") and sort by it: 1.7–4.6 s at Agency scope, fine on Mine. Spec change: "5+".
3. Cache or materialize the counts (Ask first in the spec; AD-060 revisit clause). Exact and fast,
   but a new table or view to keep fresh.
4. Cut `new-matches` (spec cut 4).

## Phase 2: Built-in lists

## Task 6: Smart list domain: validation, built-in presets, read service — **Sonnet**
**Description:** `src/domain/smart-lists/`:
- `types.ts`: `SmartList`, `OpportunityListFilter`, `InquiryListFilter`, `BuiltInListId`,
  `ListRow` types.
- `validation.ts`: Zod for both filter shapes (strict: unknown keys refused), `sort` enums, name
  (trimmed, 1–60), `parseStoredFilter` returning `{ ok, filter } | { ok: false }` for rule 5.
- `built-in.ts`: the nine presets of the spec's table as filters, each with `entity`, `scope`
  (`mine` | `agency-only` for the two unassigned lists), its i18n key and its constants (3 and 14
  days). Nothing else defines a built-in list. `new-matches` sorts by `last_touch_asc` and the page
  shows `new_matches` per row (founder decision at Checkpoint 1).
- `repository.ts`: calls the three functions and selects/inserts/updates/deletes `smart_lists`.
- `service.ts` read paths: `overview(ctx, scope)` (visible built-ins by role + saved lists, one
  `smart_list_counts` call), `page(ctx, listId, scope, page)`, `next(ctx, listId, afterKey)`.
  Mine/Agency per rule 1: brokers always mine; agency-only lists hidden from brokers.
Vitest beside each file; the Today-consistency test (rule 2) and the SQL-vs-`getTodayWindows`
window test in `service.integration.test.ts`.

**Acceptance criteria:**
- [x] Every preset parses with the strict schema; a filter with an unknown key or a bad enum is refused; a stored filter of an old shape gives `{ ok: false }`
- [x] Broker overview has no unassigned lists and no Agency scope even when asked; manager gets both
- [x] Integration: `no-next-action` and `new-inquiries` counts equal `loadTodayScreenData`; `overdue` and `due-today` equal Today's pending tasks mapped to deals per spec rule 2 (the viewer's deals, each in the section of its earliest pending task; the seed has a deal with a today task behind an overdue one and tasks assigned to someone other than the deal's owner), for broker mine, manager mine and manager agency
- [x] Saving a 6th `has_new_matches` list gives the friendly `smartLists.errors.matchListLimit` before the trigger does; a `no_touch_days` that isn't an integer ≥ 1 is refused by Zod
- [x] `smartLists.errors.matchListLimit` is in both `messages/bg.json` and `messages/en.json` with the other `smartLists.errors.*` keys; `overview` calls `smart_list_counts` in chunks of at most 100 lists (shared lists from other members can push one viewer past 100)

**Verification:**
- [x] `npx vitest run src/domain/smart-lists`, `npm run test:services`
- [x] `npm run typecheck`, `npm run lint`

**Dependencies:** Tasks 2–5
**Files likely touched:** `src/domain/smart-lists/{types,validation,built-in,repository,service}.ts` and tests
**Estimated scope:** M

## Task 7: Списъци overview with counts and the sidebar entry — **Sonnet**
**Description:** Route `src/app/(dashboard)/lists/page.tsx` (Server Component): "Built-in" and
"Saved" groups, each row name, entity icon and count ("999+" above 999), Mine / Agency toggle
for owners and managers as `?scope=agency` (as Today does). Sidebar item "Списъци" between Today
and Contacts. Keys under `smartLists.*` in both message files; Metadata title.

**Acceptance criteria:**
- [x] Alpha broker sees seven built-in lists with the seeded counts; Alpha manager sees nine and the toggle; switching to Agency changes the counts
- [x] Empty saved group shows the hint; no hardcoded strings (lint)
- [x] Works at 1280 and 390 px in BG and EN

**Verification:**
- [x] `npm run typecheck`, `npm run lint`, `npm run test`
- [x] Browser: `/lists` as broker and manager, `NEXT_LOCALE=bg` and `en`, both widths

**Dependencies:** Task 6
**Files likely touched:** `src/app/(dashboard)/lists/page.tsx`, `src/components/domain/smart-lists/list-overview.tsx`, `src/components/layout/sidebar.tsx`, `messages/{bg,en}.json`
**Estimated scope:** M

## Task 8: List page for built-in lists — **Sonnet**
**Description:** `src/app/(dashboard)/lists/[id]/page.tsx`: resolves a built-in id (unknown id →
`notFound()`), shows the count in the header and the rows paged by 20 using the existing
opportunity or inquiry table components (reuse; don't fork them), with `?scope` carried. Inquiry
lists keep their row actions (convert, dismiss, mark contacted, reassign) and the page revalidates
after each, so the row and count update (rule 8). Empty state "Nothing left — well done". A
broker opening an agency-only list gets `notFound()`.

**Acceptance criteria:**
- [x] Each built-in list shows its seeded rows in its order with the right count; page 2 works
- [x] Assigning an inquiry from `unassigned-inquiries` removes it and lowers the count (AC-7)
- [x] BG and EN, 1280 and 390 px

**Verification:**
- [x] `npm run typecheck`, `npm run lint`, `npm run test`
- [x] Browser: two opportunity lists and both inquiry lists, both locales and widths

**Dependencies:** Task 7
**Files likely touched:** `src/app/(dashboard)/lists/[id]/page.tsx`, `src/components/domain/smart-lists/list-page.tsx`, the existing table components (props only), `messages/{bg,en}.json`
**Estimated scope:** M

## Task 9: Work through: the queue bar — **Sonnet**
**Description:** "Обработи" on opportunity list pages opens the first deal at
`/opportunities/[id]?list=<id>&pos=1` (plus `scope`). The opportunity detail page, when `list` is
present, renders a queue bar: list name, "pos of total", Previous, Skip / Next, Exit. Next and
Skip call `SmartListService.next` with the current deal's `sort_key` (fetched for this deal) and
navigate; when nothing is next, "List done" with a link back to `/lists`. Previous uses the
reversed order (cut 2: droppable without touching the rest). Sticky at the bottom on 390 px. No
client state in effects; the bar is a Server Component with links/forms.

**Acceptance criteria:**
- [x] On `no-next-action`: schedule a task on deal 1, press Next → deal 2, total one lower; Skip leaves deal 1 in the list (AC-6)
- [x] After the last deal, "List done"; Exit returns to the list page
- [x] The rest of the detail page behaves as without `?list`; BG and EN, both widths

**Verification:**
- [x] `npx vitest run src/domain/smart-lists` (next/previous/done), `npm run typecheck`, `npm run lint`
- [x] Browser: work through `no-next-action` as Alpha broker in BG and EN at 1280 and 390 px

**Dependencies:** Task 8
**Files likely touched:** `src/app/(dashboard)/opportunities/[id]/page.tsx`, `src/components/domain/smart-lists/queue-bar.tsx`, `src/domain/smart-lists/service.ts`, `messages/{bg,en}.json`
**Estimated scope:** M

## Checkpoint 2: Built-in lists
- [ ] AC-1, -2, -3, -6, -7 seen in the browser, BG and EN, 1280 and 390 px
- [x] typecheck, lint, test, `test:services`, `test:e2e` green
- [ ] `/review` of Phases 1–2 (Opus, fresh session)

Notes (2026-11-07, build session): seen in the browser — AC-1 (broker 7 lists, manager 9 with
Mine / Agency), AC-6 (Skip, Previous, Next after a scheduled task: count 2 -> 1, List done), AC-7
(reassigning from `unassigned-inquiries`: 2 -> 1); overdue and new-matches rows in order with
counts. AC-2 and AC-3 are asserted by pgTAP (`094`, `092`) and the services suite, not clicked
through in the browser: AC-3 (add a candidate, the buyer leaves `new-matches`) is still to see.
`npx supabase db reset` + `test:db` 717/717, `test:services` 931/931, `test:e2e` 64/64.

## Phase 3: Custom lists, E2E, cut items

## Task 10: Opportunity list reads through `smart_list_opportunities`, new filters — **Sonnet, Opus review**
**Description:** Start with parity tests: for each existing filter (status, stage, type, broker,
temperature) and search on the seed, record `OpportunityRepository.findPage` results, then switch
`OpportunityService.listPage` to the function and keep the tests green. Add the new URL filters
to the page and its client: source, next action (none / overdue / today / upcoming), no touch for
N days, has new matches; parsed like `parseOpportunityListFilters` (bad value → no filter).
The requirement summary and other row data still load as today.

**Acceptance criteria:**
- [ ] Parity: every existing filter and search returns the same rows and order as before the switch (integration test)
- [ ] Each new filter narrows the list as the function does; combining them works; bad values are ignored
- [ ] Existing E2E (`core-loop`, `matching`, `requirements`, `properties`) pass; BG and EN, both widths

**Verification:**
- [ ] `npm run test:services`, `npm run test:e2e`, typecheck, lint, test
- [ ] Browser: opportunity list with each new filter

**Dependencies:** Task 6
**Files likely touched:** `src/domain/opportunities/{service,repository,validation}.ts` and tests, `src/app/(dashboard)/opportunities/{page,opportunities-page-client}.tsx`, `messages/{bg,en}.json`
**Estimated scope:** M

## Task 11: Save as list, rename, edit, delete — **Sonnet**
**Description:** "Save as list" on the opportunity list: a dialog with the name, storing the
current URL filters as an `OpportunityListFilter` (`sort = created_desc`). Actions in
`src/app/(dashboard)/lists/actions.ts`: `saveList`, `renameList`, `updateListFilter`,
`deleteList` (confirm dialog), each `getAuthContext()` → Zod → service → `revalidatePath`,
returning `ActionResult`. The overview's Saved group lists them with counts; the list page serves
saved ids too (unknown or invisible id → `notFound()`); "Edit filters" opens the opportunity list
with the filters and an "Update list" button. A stored filter that doesn't parse shows the "edit
this list" state (rule 5).

**Acceptance criteria:**
- [ ] AC-4: a broker saves a list from filters, sees it with the right count after reload; another broker doesn't see it
- [ ] Rename to a duplicate name and the 51st list show the i18n error toast; delete removes it
- [ ] Service tests: save, rename, update filter, delete, stale filter; BG and EN, both widths

**Verification:**
- [ ] `npx vitest run src/domain/smart-lists`, `npm run test:services`, typecheck, lint
- [ ] Browser: save, rename, edit, delete in BG and EN

**Dependencies:** Tasks 8, 10
**Files likely touched:** `src/app/(dashboard)/lists/actions.ts` (+ test), `src/domain/smart-lists/service.ts`, `src/components/domain/smart-lists/save-list-dialog.tsx`, `src/app/(dashboard)/opportunities/opportunities-page-client.tsx`, `messages/{bg,en}.json`
**Estimated scope:** M

## Task 12: Share a list (owner/manager) — **Sonnet**
**Description:** `shareList` / `unshareList` actions with `requireRole(ctx, MANAGER_ROLES)` and
the same check in the service (RLS is the safety net). Share toggle on the list page for owners
and managers; shared lists show the creator's name in the overview. Brokers see no edit, share or
delete control on a shared list.

**Acceptance criteria:**
- [ ] AC-5: a manager shares; every Alpha member sees it; a broker has no edit/share/delete controls and the actions refuse them
- [ ] A broker calling `shareList` gets the forbidden error; unshare hides it from others again
- [ ] Action tests for both roles; BG and EN

**Verification:**
- [ ] `npx vitest run "src/app/(dashboard)/lists"`, `npm run test:services`, typecheck, lint
- [ ] Browser: share as manager, view as broker

**Dependencies:** Task 11
**Files likely touched:** `src/app/(dashboard)/lists/actions.ts` (+ test), `src/domain/smart-lists/service.ts`, `src/components/domain/smart-lists/list-page.tsx`, `messages/{bg,en}.json`
**Estimated scope:** S

## Task 13: Custom lists for inquiries (cut 1) — **Sonnet**
**Description:** "Save as list" on the inquiry list with its filters (status, search, plus
assigned-to and source if the page shows them), stored as `InquiryListFilter`; the list page and
overview handle `entity = inquiry` saved lists. Reuses Task 11's dialog and actions.

**Acceptance criteria:**
- [ ] A broker saves "New from imot.bg" and sees the right rows and count
- [ ] Edit filters opens the inquiry list with the filters applied
- [ ] BG and EN, both widths

**Verification:**
- [ ] `npx vitest run src/domain/smart-lists`, typecheck, lint
- [ ] Browser in BG and EN

**Dependencies:** Task 11
**Files likely touched:** `src/app/(dashboard)/inquiries/{page,inquiries-page-client}.tsx`, `src/domain/smart-lists/validation.ts`, `messages/{bg,en}.json`
**Estimated scope:** S

## Task 14: E2E for the list loop — **Sonnet**
**Description:** `e2e/smart-lists.spec.ts`: open Списъци and see the counts; work through
`no-next-action` (schedule a task, Next, count one lower, then "List done" on a filtered seed
list); save a custom list from the opportunity filters and reopen it; a manager shares a list and
a broker sees it read-only. BG and EN, 1280 and 390 px, using `e2e/fixtures.ts`.

**Acceptance criteria:**
- [ ] The spec passes in all four projects (bg/en × 1280/390)
- [ ] It leaves the seed as it found it or runs on rows no other spec asserts
- [ ] The full `npm run test:e2e` passes

**Verification:**
- [ ] `npm run test:e2e`

**Dependencies:** Tasks 9, 12
**Files likely touched:** `e2e/smart-lists.spec.ts`, `e2e/fixtures.ts`
**Estimated scope:** S

## Checkpoint 3: Complete
- [ ] AC-1…AC-10 met; full Definition of Done (typecheck, lint, test, `db reset` + `test:db`, `test:services`, `test:e2e`, browser in bg and en)
- [ ] `docs/domain-model.md` §2.10 and §4 as built; BRD FR-LST rows set
- [ ] `/review` (Opus, fresh session); then close: `SPEC.md` Done, archive `tasks/*` to `docs/archive/smart-lists-*.md`
