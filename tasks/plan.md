# Implementation Plan: smart-lists

> **Spec:** `spec/smart-lists.md` · **Checklist:** `tasks/todo.md`
> **Status:** Plan approved (founder, 2026-11-07). Approved scope (founder, 2026-11-07).
> Decisions: AD-062 (written in Task 1). Branch: `feat/smart-lists`, cut from
> `feat/conversion-join` (founder, 2026-11-07; `main` doesn't have `requirements`, `matching` or
> `conversion-join` yet, so they merge into `main` before or with `feat/smart-lists`).

## Overview
Lists of deals and inquiries with live counts, worked through one by one. Three phases.
Phase 1 builds and proves the list engine in the database: the `smart_lists` table and its RLS,
"last touch", the two list functions, the counts call, a seed that lands in every built-in list,
and the speed targets. The all-deal `new-matches` count is the module's risk, so Task 3 measures
it right after the opportunity function exists, and Checkpoint 1 decides whether it stays. Phase
2 delivers the built-in lists as vertical slices: overview with counts, the list page, the queue.
Phase 3 adds custom lists (the opportunity filters they need, save, share), then the E2E test and
the spec's cut items, so any of those can be dropped without touching the rest.

**Model per task** (see memory: Opus where a mistake is silent or hard to undo, Sonnet for the
rest). Tasks 1–4 run on **Opus** (RLS, SQL functions holding the rules, the speed work). Tasks
5–14 run on **Sonnet**; Task 10 is marked for Opus review because it moves an existing page onto
a new query.

## Architecture decisions
Where the plan sharpens the spec. Task 1 records these as AD-062 and updates
`spec/smart-lists.md` where they change it; AC-1…AC-10 stay as they are.

- **`smart_lists` table.** `entity TEXT CHECK (entity IN ('opportunity','inquiry'))`, `filter
  JSONB NOT NULL`, `shared BOOLEAN NOT NULL DEFAULT false`, `created_by UUID NOT NULL`. Unique
  index `(agency_id, created_by, lower(name))`. `updated_at` trigger as on other tables. Not
  audited (spec).
- **RLS, per `supabase-patterns`:**
  - SELECT: `agency_id = current_agency_id() AND (created_by = auth.uid() OR shared)`.
  - INSERT: own agency, `created_by = auth.uid()`, and `shared = false` unless
    `current_user_role() IN ('owner','manager')`.
  - UPDATE / DELETE: own personal list (`created_by = auth.uid() AND NOT shared`), or a shared
    list for owner/manager. The UPDATE `WITH CHECK` repeats the `shared` role rule, so a broker
    can't share by updating. A manager can't read or change someone's personal list.
  - 50-per-member cap: a `BEFORE INSERT` trigger raising an i18n key (`smartLists.errors.limit`),
    plus the same check in the service for the friendly message.
- **The filter shape gains `sort`.** Built-in lists need their own order, so the filter carries
  `sort`: `created_desc` (default, the opportunity list's order today), `last_touch_asc`,
  `next_action_asc`, and for inquiries `received_asc`, `received_desc`.
  Every sort ends with `id`.
- **`me` is resolved in SQL** as `auth.uid()`, so a shared "mine" list is per viewer and no
  caller can pass someone else as "me". The Mine / Agency scope of the built-in lists is the
  service setting `assigned_to: 'me'` or dropping it (rule 1, AD-044).
- **Day windows in SQL, pinned to `getTodayWindows`.** `overdue`: `next_action_at < now()`;
  `today`: `now() ≤ next_action_at <` next agency midnight; `upcoming`: next midnight to
  midnight +4 days, all from `agencies.timezone`. A Vitest integration test compares the SQL
  windows with `getTodayWindows` at fixed instants around Sofia midnight and the DST switch.
- **Last touch as a function, not a column.** `opportunity_last_touch(opportunities) RETURNS
  timestamptz` (`STABLE`, invoker): greatest of the latest completed task's `completed_at` and
  the latest note's `created_at` on the deal, else `created_at`. Uses the existing
  `idx_notes_opportunity` and an index on `tasks (opportunity_id, completed_at DESC) WHERE status
  = 'completed'` if Task 2's measure needs it.
- **Three functions, all `LANGUAGE sql STABLE SECURITY INVOKER`** with `agency_id =
  current_agency_id()` on every table read, granted to `authenticated` only (AD-050, AD-060):
  - `smart_list_opportunities(p_filter jsonb, p_limit int, p_offset int, p_after jsonb)` returns
    the deal columns the table shows, `last_touch`, `new_matches` (null unless asked for),
    `sort_key jsonb` and `total_count`.
  - `smart_list_inquiries(p_filter jsonb, p_limit int, p_offset int, p_after jsonb)`, the same
    for inquiries.
  - `smart_list_counts(p_lists jsonb)`: `[{ key, entity, filter }]` in, `(key, count)` out,
    each count `LIMIT 1000` so "999+" stays cheap (rule 6).
  Unknown filter keys are ignored by SQL; Zod refuses them before saving.
- **`new-matches` via `match_evaluate`.** A deal's `new_matches` = count of open listings of its
  offer type where `match_evaluate(...)->>'listed'` and no link exists, exactly as
  `match_properties` computes `unlinked_count`. Task 3 extracts that join into one internal SQL
  function used by both, so the rule exists once. If the scaled overview misses 1 s, Checkpoint 1
  picks: a cheaper pre-filter (offer type, settlement keys, must-have budget), or the founder
  decides on a cache (Ask first) or cut 4.
- **Queue in the URL.** `/opportunities/[id]?list=<id>&pos=<n>`. Next and Skip call the function
  with `p_after` = the current deal's `sort_key` and `limit 1`, so a deal that left the list
  doesn't break the order. "3 of 17" = position from the start + `total_count`. Previous uses the
  reversed order (cut 2). No table, no client state.
- **The opportunity list moves to `smart_list_opportunities`** (Task 10) rather than keeping two
  query paths: the new filters (source, next action, no touch, new matches) need SQL, and one
  path means the list and a saved list always agree. Parity with today's filters and search is
  the task's main acceptance.
- **Writes** go through `SmartListService` and `src/app/(dashboard)/lists/actions.ts`
  (`ActionResult`, `toActionError`, `requireRole` for share). No other write path.

## Dependency graph
```
T1 AD-062, smart_lists + RLS ─ T2 smart_list_opportunities + last touch ─ T3 new matches + speed ─┐
                                └─ T4 smart_list_inquiries + counts ──────────────────────────────┴─ T5 seed + speed
T2–T4 ─ T6 service, built-in.ts ─ T7 overview + sidebar ─ T8 list page ─ T9 queue bar
                           T6 ─ T10 opportunity list on the function ─ T11 save, rename, delete ─ T12 share
                                                                                    T11 ─ T13 inquiry custom lists (cut 1)
                                                                          T9, T11 ─ T14 E2E
```

## Task list
Full tasks with acceptance criteria are in `tasks/todo.md`.

### Phase 1: List engine (Opus)
- [x] Task 1: AD-062, `smart_lists` table, RLS and the docs
- [x] Task 2: `smart_list_opportunities` and last touch
- [x] Task 3: `new_matches` and the speed spike
- [x] Task 4: `smart_list_inquiries` and `smart_list_counts`
- [x] Task 5: Seed every built-in list and measure the targets (Sonnet)

**Checkpoint 1:** `db reset` + `test:db` green; speed numbers recorded; the founder reviews
AD-062, each built-in list's rows on the seed (SQL output), and decides on `new-matches` if the
target is missed.

### Phase 2: Built-in lists (Sonnet)
- [x] Task 6: Smart list domain: validation, built-in presets, read service
- [x] Task 7: Списъци overview with counts and the sidebar entry
- [x] Task 8: List page for built-in lists
- [x] Task 9: Work through: the queue bar

**Checkpoint 2:** AC-1, -2, -3, -6, -7 seen in the browser in BG and EN at 1280 and 390 px;
`/review` of Phases 1–2.

### Phase 3: Custom lists, E2E, cut items (Sonnet)
- [ ] Task 10: Opportunity list reads through `smart_list_opportunities`, new filters
- [ ] Task 11: Save as list, rename, edit, delete
- [ ] Task 12: Share a list (owner/manager)
- [ ] Task 13: Custom lists for inquiries (cut 1)
- [ ] Task 14: E2E for the list loop

**Checkpoint 3:** every AC met, the full Definition of Done, `/review`; then close the module.

## Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| All-deal `new-matches` misses the 1 s overview target (2,000 deals × open listings) | High | Measured in Task 3, before any UI; pre-filter fallback; cache only with founder approval; cut 4 keeps everything else |
| RLS lets a manager read personal lists, or a broker share by UPDATE | High | Policies written as in the plan; pgTAP covers each role × own/other × shared/personal × insert/update/delete, and cross-agency |
| Built-in counts drift from Today and Exceptions | Med | Day windows pinned to `getTodayWindows` by a test; the Today-consistency integration test (rule 2) runs in `test:services` |
| Moving the opportunity list to the function changes its results or search | Med | Task 10 starts with parity tests on the seed (each existing filter and search) and runs the existing E2E; Opus review on that task |
| Last touch is slow without an index | Med | Measured in Task 2 and Task 5; partial index on completed tasks if needed |
| Seed rows for every list change counts other suites assert (Today, Exceptions, digest, E2E) | Med | Task 5 adds rows with their own titles and runs `test:services` and `test:e2e` before ticking |
| A saved filter breaks when the shape changes later | Low | Zod parse on read shows the "edit this list" state (rule 5); tested |
| About 70 new i18n keys | Low | Keys go in with each task; lint `i18next/no-literal-string` |

## Open questions
- Resolved (founder, 2026-11-07): `feat/smart-lists` starts from `feat/conversion-join`.
- Spec Q1 (BG terms) and Q2 (broker Agency toggle) are still open; Tasks 7–9 use the defaults.
