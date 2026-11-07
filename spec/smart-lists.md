# Spec: smart-lists

> **Status:** Approved scope (founder, 2026-11-07). Decision: AD-062. Q1 and Q2 still
> open; the defaults below stand until the founder answers.
> Requirements: FR-LST-01…09.
> **Evidence:** business brief "Saved operational filters and Smart Lists" (pilot included scope,
> with a list of example lists), benchmark B-01 (FUB Smart Lists, "work the list to zero") and B-08
> (task queue), gap analysis §5.1 #13, `SPEC.md` §2 pilot gate.
> Scope answers from the founder (2026-11-07): Smart Lists stay in the pilot gate; built-in lists
> **and** custom saved lists; custom lists are personal, and owners and managers can share one with
> the agency; a step-through work mode; lists hold opportunities and inquiries. Assumptions A1–A5
> are unvalidated.

## Objective

A broker opens **Списъци**, sees how many records sit in each list ("No next action 4",
"Overdue 2", "Buyers with new matches 6"), opens one and works through it record by record until
it is empty. A record leaves the list as soon as it no longer fits (a next action was set, the
inquiry was contacted), so the count is the work left. Managers do the same across the agency and
share the lists the team should work. This turns the Today and Exceptions definitions, and
matching, into a routine people can run, and is the last product item of the pilot gate.

**Users:** brokers (their own lists, worked daily), owners and managers (agency-wide lists and
shared lists for the team).

**Not in this module:** contact lists (past clients to re-engage), lists that need modules not
built yet (offers awaiting response, viewing feedback, inquiries not contacted within N hours,
which needs `phone-loop`'s `contacted_at`), bulk actions on a list, list alerts or digest lines,
a step-through mode for inquiries.

## Data model (AD-062)

- **`smart_lists`**: `id`, `agency_id`, `created_by`, `name` (1–60 chars), `entity`
  (`opportunity | inquiry`), `filter` (jsonb), `shared` (bool, default false), `created_at`,
  `updated_at`. Unique `(agency_id, created_by, lower(name))`. Holds custom lists only.
- **Built-in lists are code, not rows:** a fixed set of ids (below), each a preset of the same
  filter shape, defined once in `src/domain/smart-lists/built-in.ts`. Nothing to seed per agency
  and nothing to migrate when a definition changes.
- **One filter shape per entity** (Zod in `validation.ts`, mirrored by the SQL that reads it):
  - opportunity: `status[]`, `type[]`, `stage_id[]`, `temperature[]`, `assigned_to`
    (`me | unassigned | <user id>`), `source_id[]`, `next_action` (`none | overdue | today |
    upcoming`), `no_touch_days` (int), `has_new_matches` (bool), `search`.
  - inquiry: `status[]`, `assigned_to` (`me | unassigned | <user id>`), `source_id[]`, `search`.
  - both: `sort` (opportunity `created_desc` default, `last_touch_asc`, `next_action_asc`,
    `new_matches_desc`; inquiry `received_asc | received_desc`). Every order ends with `id`.
  `me` is resolved to the viewer at read time (`auth.uid()` in SQL), so a shared list "my overdue"
  works for everyone.
- **Evaluated on read in Postgres**, like matching (AD-060): `smart_list_opportunities(filter,
  limit, offset)` and `smart_list_inquiries(filter, limit, offset)`, `SECURITY INVOKER` plus an
  explicit `current_agency_id()` filter, returning the page, `total_count`, and each row's sort key
  (for the queue). `smart_list_counts(p_lists jsonb)` takes `[{ key, entity, filter }]` and returns
  the counts for the overview in one call. Day windows are agency-local and identical to Today's
  (`getTodayWindows`), computed in SQL from the agency timezone setting (`agencies.settings`) and pinned to `getTodayWindows` by
  a test (AD-062). The opportunity list reads through `smart_list_opportunities` too (Task 10),
  so a list and its saved copy always agree.
- **Last touch** (new derived value, not stored): the latest of a completed task's `completed_at`
  and a note's `created_at` on the deal, else the deal's `created_at`. Not `updated_at`, which
  merges and edits move. `has_new_matches` = the deal's `unlinked_count` from matching is above 0,
  computed by `match_evaluate` (no copy of the rules).
- Not audited: a saved list is a view preference, not a record of the business.

## Built-in lists

| Id | Entity | Definition | Order |
|---|---|---|---|
| `no-next-action` | opportunity | `active`, `next_action_at` null (Today "At risk") | oldest last touch first |
| `overdue` | opportunity | `active`, `next_action_at` < now | oldest `next_action_at` first |
| `due-today` | opportunity | `active`, `next_action_at` within today (agency tz) | `next_action_at` |
| `hot-no-touch` | opportunity | `active`, `hot`, last touch 3+ days ago | oldest last touch first |
| `sellers-need-update` | opportunity | `active` seller or landlord, last touch 14+ days ago | oldest last touch first |
| `new-matches` | opportunity | `active` or `nurture` buyer or tenant with a requirement and new matches | most new matches first |
| `unassigned-deals` | opportunity | `active`, `assigned_to` null | newest first |
| `new-inquiries` | inquiry | `status = new` | oldest `received_at` first |
| `unassigned-inquiries` | inquiry | `status = new`, `assigned_to` null | oldest `received_at` first |

Every order ends with `id` so pages and the queue are stable.
[ASSUMPTION A2: 3 days for hot and 14 days for sellers are what agencies call "no recent activity".
Validate: pilot feedback; the numbers are constants in `built-in.ts`, not settings]

## Business rules

1. **Scope.** Built-in lists show "mine" by default (assigned to the viewer). Owners and managers
   get a Mine / Agency toggle; a broker always sees their own, as on Today (AD-044). Exceptions:
   `unassigned-deals` and `unassigned-inquiries` have no owner, so they are agency-wide and shown
   to owners and managers only, like Exceptions.
2. **Same numbers as Today.** For the same viewer and scope, `no-next-action`, `overdue` (counted
   by deal, not by task), `due-today` and `new-inquiries` agree with Today's sections. A test pins
   this so the two can't drift.
3. **Custom lists.** "Save as list" on the opportunity list and the inquiry list stores the
   current filters under a name. The opportunity list gains the filters it doesn't have yet:
   source, next action state, no touch for N days, has new matches. Any member saves personal
   lists; at most 50 per member per agency.
4. **Sharing.** Only owners and managers can set `shared`. A shared list is visible to every
   member of the agency; only owners and managers can rename, edit or delete it. Unsharing hands
   the list back to its creator alone, so only the creator can unshare it (RLS: the changed row
   must still be visible to the one who changes it); another manager deletes it instead. A
   personal list is visible to and changed by its creator only — not by a manager (RLS).
   Deleting a list is a hard delete; it only removes the view.
5. **Stale filters.** A saved filter that no longer parses (shape changed) shows an "edit this
   list" state instead of results. Ids that no longer exist (a deleted stage or source) simply
   match nothing; a deactivated broker's deals still match.
6. **Counts.** The overview shows every visible list with its live count, computed when the page
   loads. Counts are exact up to 999 and shown as "999+" above.
7. **Work through (opportunities).** "Work through" opens the first deal of the list on its normal
   detail page with a queue bar: list name, "3 of 17", Previous, Skip / Next, Exit. Next takes the
   first row after the current one's sort key, re-running the list at that moment, so a deal that
   no longer fits has dropped off and new ones appear in order. When nothing is left: "List done",
   back to the overview. The queue state lives in the URL (`?list=<id>&pos=<n>`; Next asks for the
   row after the current deal's sort key), nothing is stored. Everything on the detail page works as usual (complete task with next, close, etc.).
8. **Inquiry lists** open as the inquiry list filtered to the list, with its existing row actions
   (convert, dismiss, mark contacted, reassign); the count updates on each action. No queue bar.
9. **Tenancy.** Lists and their results come only from the caller's agency (RLS on
   `smart_lists`, invoker functions plus the agency filter). A shared list never leaves its agency.
10. **Speed.** At 2,000 deals, 2,000 requirements, 2,000 properties and 5,000 inquiries: a list
    page and a queue step under 300 ms (p95); the overview with every count under 1 s (p95),
    `new-matches` included. [ASSUMPTION A5: matching across all deals meets this without a
    cache. Validate: the scale script; if it misses, ask before adding a cache (AD-060 revisit
    clause) or cut the list]

## Screens

- **Sidebar:** "Списъци" between Today and Contacts.
- **`/lists` overview:** two groups, "Built-in" and "Saved" (shared ones marked with the creator),
  each a row with name, entity icon and count; Mine / Agency toggle for owners and managers.
  Empty saved group: "Save a filter from Opportunities or Inquiries".
- **`/lists/[id]`:** the list's rows in the opportunity or inquiry table (paged by 20, existing
  columns), the count in the header, "Work through" for opportunity lists, and for custom lists
  Rename, Edit filters (opens the entity list with the filters applied and "Update list"), Share
  (owner/manager), Delete (confirm). Empty: "Nothing left — well done".
- **Opportunity and inquiry lists:** "Save as list" button next to the filters; the new opportunity
  filters (rule 3).
- **Queue bar** on the opportunity detail page when opened from a list; sticky at the bottom on
  390 px.
- **Glossary:** Smart List = **Списък** (nav "Списъци"); Work through = **Обработи**; built-in list
  names in both languages added to `docs/domain-model.md` §7 (founder to confirm, Q1).

## Where it lives

- Migration `supabase/migrations/<date>_smart_lists.sql` (table, RLS, the three functions, indexes
  the speed target needs); pgTAP `supabase/tests/database/090-smart-lists.sql`.
- `src/domain/smart-lists/` (`types.ts`, `validation.ts`, `built-in.ts`, `repository.ts`,
  `service.ts`; tests beside them).
- Routes `src/app/(dashboard)/lists/` (`page.tsx`, `[id]/page.tsx`, `actions.ts`); UI in
  `src/components/domain/smart-lists/`; the queue bar mounted by the opportunity detail page.
- Keys under `smartLists.*` in both `messages/bg.json` and `messages/en.json`.
- `docs/domain-model.md`: a §2.10 Smart Lists, a §4 entry for the built-in definitions and "last
  touch", invariants, glossary. AD-062 in `docs/decisions-log.md`.
- Commands, code style and the mutation pattern: `AGENTS.md`.

## Success criteria

- **AC-1** Alpha's broker sees every built-in list they may see with counts; `no-next-action`,
  `overdue`, `due-today` and `new-inquiries` equal Today's sections for the same scope, and Agency
  scope equals Exceptions' counts where they overlap (FR-LST-01, -02).
- **AC-2** Each built-in list holds exactly the seeded records its definition names, in its order;
  a hot deal touched 2 days ago is not in `hot-no-touch`, one touched 4 days ago is (FR-LST-01).
- **AC-3** `new-matches` holds the seeded Alpha buyer with an unoffered match and drops it once the
  match is added as candidate or marked not suitable (FR-LST-01).
- **AC-4** A broker saves "My warm buyers in Lozenets-source" from the opportunity filters; it
  appears under Saved with the right count, survives a reload and is invisible to another broker
  (FR-LST-03, -04).
- **AC-5** A manager shares a list; every Alpha member sees it, a broker can't edit, unshare or
  delete it (UI and RLS), and a broker can't create a shared list even by calling the action
  (FR-LST-04).
- **AC-6** Working through `no-next-action`: scheduling a task on deal 1 and pressing Next shows
  deal 2 and the count goes down by one; Skip keeps deal 1 in the list; after the last deal "List
  done" appears (FR-LST-05).
- **AC-7** `unassigned-inquiries`: assigning one from the list removes it and lowers the count
  (FR-LST-06).
- **AC-8** A Beta member gets no Alpha list, row or count, even with an Alpha list id (pgTAP)
  (FR-LST-07).
- **AC-9** The speed targets of rule 10 hold on the scaled seed (FR-LST-08).
- **AC-10** Overview, list page and queue bar work in BG and EN at 1280 and 390 px; no hardcoded
  strings (FR-LST-09).

**FR rows (BRD, area FR-LST):** 01 built-in lists computed on read; 02 Mine/Agency scope as on
Today, counts consistent with Today and Exceptions; 03 custom lists saved from the opportunity and
inquiry filters; 04 personal lists and owner/manager-shared lists; 05 step-through work mode for
opportunity lists; 06 inquiry lists with row actions; 07 tenant isolation; 08 speed targets;
09 BG/EN and mobile.

## Testing strategy

- **pgTAP `090-smart-lists.sql`:** RLS on `smart_lists` (own, shared, broker can't share, can't
  touch another's personal list, cross-agency); each filter key in both functions; last touch from
  tasks, notes and creation, ignoring `updated_at`; agency-day edges for `today` and `overdue`;
  `has_new_matches` against `match_properties`'s `unlinked_count`; ordering and the `after` key;
  counts; empty results for another agency's ids.
- **Vitest:** `validation.ts` (filter shapes, stale shape, `me` resolution, name rules, 50 cap);
  `built-in.ts` (each preset parses, scope rules by role); `SmartListService` in the service suites
  (save, rename, share by role, delete, queue next/previous, done); the Today-consistency test
  (rule 2) against the seeded stack.
- **Performance:** extend `scripts/matching/scale.sql` with inquiries, tasks and notes and run
  `EXPLAIN ANALYZE` on the counts call and each function; numbers in the plan's checkpoint.
- **E2E (Playwright):** open Списъци, see counts, work through `no-next-action` (schedule a task,
  Next, count down), save a custom list from the opportunity filters, reopen it. BG and EN, 1280
  and 390.
- **Seed:** both agencies get deals and inquiries that land in every built-in list, one deal just
  outside each threshold, one personal and one shared list.

## Boundaries

- Always: built-in definitions only in `built-in.ts`, evaluated only by the SQL functions (no
  second implementation in TypeScript); matching rules only via `match_evaluate`; `SECURITY
  INVOKER` plus an `agency_id` filter; the `supabase-patterns` checklist; `shared` checked in RLS
  **and** in the service; Today's day windows reused; write AD-062 before the migration; update
  `docs/domain-model.md` in the migration commit.
- Ask first: storing results, counts or matches (cache, materialized view); making thresholds or
  built-in lists agency-configurable; changing Today, Exceptions or the digest to read from lists;
  any new column on `opportunities`, `inquiries` or `tasks` (e.g. a stored `last_touch_at`); a new
  dependency.
- Never: write `audit_log` or `next_action_at` from app code; let a list action bypass the
  existing services; show another agency's lists or rows; let a manager read a member's personal
  lists.

## Out of scope

Contact lists and past-client re-engagement; offers, viewings-feedback and speed-to-contact lists
(their modules come first); bulk actions; a queue for inquiries; list alerts, digest lines or
badges in the sidebar; per-agency thresholds; sorting a custom list by a chosen column; list
history or "worked" statistics.

## Cut order if time runs short

1. Custom lists for inquiries (built-in inquiry lists stay).
2. Previous in the queue bar (Next, Skip and Exit stay).
3. `sellers-need-update` and `hot-no-touch` (last touch stays, for `no-next-action`'s order).
4. `new-matches`, if rule 10 can't be met without a cache.

## Assumptions

- **A1** Brokers work a list through the queue rather than opening rows from the table. Validate:
  share of detail-page visits with `?list=`.
- **A2** 3 days (hot) and 14 days (sellers) are the right "no recent activity" thresholds.
- **A3** Completed tasks and notes are a good enough "touch"; calls logged outside the CRM aren't
  seen. `phone-loop` will add calls.
- **A4** Fifty personal lists per member is far above need.
- **A5** All-deal matching meets the overview target without a cache (rule 10).

## Open questions (founder)

- **Q1** BG terms: "Списъци" for the nav and "Обработи" for work through, and the nine built-in
  names (proposed: Без следващо действие, Просрочени, За днес, Горещи без контакт, Продавачи за
  обновяване, Нови подходящи имоти, Неразпределени сделки, Нови запитвания, Неразпределени
  запитвания).
- **Q2** Should brokers also get the Agency toggle on built-in lists? This spec follows AD-044
  (no); every member can already see every deal on the opportunity list.
