# Implementation Plan: ui-bright

> **Spec:** `spec/ui-bright.md` (approved 2026-11-25) · **Tasks:** `tasks/todo.md`
> **Branch:** `feat/ui-bright` · commits `feat(ui-bright): ...`, one per task.
> **Design source:** `docs/design/` (README, `tokens.json`, `screens/*.png`).

## Overview

Restyle what is already built to the Bright design: tokens onto the shadcn theme, Sofia Sans,
flat hairline cards, the grouped sidebar, then each screen laid out to its PNG, then four marked
**Скоро** placeholders. Visuals only: no schema, migration, RLS, service, validation or existing
message value changes. Four phases; the founder approves each on a side-by-side review page
(PNG | built, `bg` and `en`, 1280 and 390 px) before the next phase starts.

## What the code looks like today

- `src/app/globals.css`: stock shadcn neutral theme in `oklch`, radius 0.625rem, Geist fonts.
- `src/app/(dashboard)/layout.tsx`: sidebar + header + `main` on `bg-muted/20`; the
  `CallIntentProvider` renders the post-call `PostCallSheet` globally.
- `src/components/layout/sidebar.tsx`: one flat `navItems` list (9 routes, `roles` filter, an
  unused `badge` field), collapse state, mobile `Sheet` menu. No counts are loaded, so **no
  count bubbles** are added (spec: only where a count is already loaded).
- `src/components/ui/`: 19 primitives. 88 Tailwind palette classes in 24 `.tsx` files and 8
  hex/`oklch` literals in `src/` outside `globals.css`.
- Settings already has its own `settings-sidebar.tsx` sub-nav.
- `e2e/`: **7** specs (the spec says 8), 274 locator calls; selectors move with the layout.
- AD-065 is the last decision; AD-066 is free.

## Architecture decisions

1. **Tokens live once, in `globals.css`.** Bright names (`--bg`, `--surface`, `--ink`, `--muted`,
   `--border-strong`, `--primary`, `--accent`, `--focus`, status/info/highlight…) are defined in
   `:root` and `.dark`; the shadcn variables point at them; `@theme inline` exposes both. Recorded
   as **AD-066** in task 1. Answers to the spec's first open question:
   `--secondary` ← sidebar tint with `ink` text, `--muted` ← sidebar tint, `--muted-foreground` ←
   `muted`, `--chart-1..5` ← primary, info, success, warning, muted (only placeholders use them).
2. **Status colours as named utilities** (`text-overdue`, `bg-overdue-tint`, `due`, `done`,
   `at-risk`, severity) so the follow-up meaning is in the class name and the grep guard can
   forbid palette classes everywhere.
3. **The yellow offset is a Button prop** (`emphasis="action"` → `shadow-action`), never a raw
   class in pages, so "at most one per view" is greppable.
4. **One URL-state helper** for master-detail (`?id=`) and deal tabs (`?tab=`) in
   `src/lib/url-state.ts`, unit-tested, used by contacts, inquiries and the deal page.
5. **Master-detail panels reuse the existing services.** When `?id=` is set, the list page's
   Server Component calls the same service methods `/contacts/[id]` and the inquiry card already
   use, with the same `agencyId` filter. No new repository query, RPC or Server Action. (If a
   panel needs anything the detail page doesn't already load, stop and ask: spec "Ask first".)
6. **Inline post-call prompt on Today** reuses the post-call form body: `PostCallSheet` is split
   into the form and the sheet shell; the provider exposes the current target; Today renders the
   form under the matching task row and the provider skips the sheet while Today claims it.
   One save path, unchanged.
7. **Placeholders are dumb.** `src/components/layout/coming-soon.tsx` (badge + banner) and
   placeholder pages are Server Components with no Supabase import; sample data comes from
   message keys; every control is `disabled`. Deleting the route and nav entry removes one.

### Answers to the spec's other open questions

- **Deal page right column on phones:** the contact card (call/Viber/email) goes directly under
  the header card, above the tabs, so a broker can call without scrolling; viewed properties go
  below the tabs.
- **Today's yellow action:** none. Today has no primary button today (only the empty-state
  outline links), and the PNG gives it to Маршрут, which is left out. "At most one" allows zero.

### Spec drift to fix in task 1

The spec says Phase 3 pages have no PNG, but commit `832193a` added approved PNGs for all of
them (`login`, `deals`, `lists`, `list-detail`, `contact-detail`, `property-detail`,
`property-form`, `settings-*`). Per design-source rule 2, a PNG decides layout, so Phase 3 follows
those PNGs; their extra content (minimum price, loss-reason counts, list tabs, deal-stage strip)
is left out, per `docs/design/README.md`. Task 1 updates `spec/ui-bright.md` (Phase 3 table and
"12 PNGs") and the e2e count.

## Dependency graph

```
T1 tokens ─┬─ T2 fonts/type ─┐
           ├─ T3 status colours ── T3b rest + guard
           ├─ T4 controls ───┼─ T6 sidebar ── T7 header/main ── CP1
           └─ T5 surfaces ───┘
CP1 ─┬─ T8 Today ── T9 inline post-call
     ├─ T10 url-state + deal tabs ── T11 deal header/right column
     ├─ T12 inquiries master-detail (needs T10's helper)
     ├─ T13 contacts master-detail (needs T10's helper)
     ├─ T14 properties   ├─ T15 exceptions   └─ T16 Табло tiles ── CP2
CP2 ── T17..T25 (independent of each other) ── CP3
CP3 ── T26 coming-soon + /reports ─┬─ T27 settings rules/portals
                                   └─ T28 Табло Скоро ── T29 final sweep ── CP4
```

Phase 2 and 3 screens are independent once the shell lands; T12/T13 only need T10's helper.

## Task list

### Phase 1: Theme and shell
T1 Bright tokens and AD-066 · T2 Sofia Sans, type scale, tabular figures · T3 Status colours on
the follow-up screens · T3b Remaining palette classes and the guard test · T4 Control primitives · T5 Surface primitives · T6 Grouped sidebar ·
T7 Header breadcrumb and main area

### Checkpoint 1: shell
Review page for phase 1 (every route at 1280/390, `bg`/`en`, next to `today.png` and
`today-collapsed.png` for the shell). Founder approves before phase 2.

### Phase 2: Screens with a PNG
T8 Today layout · T9 Inline post-call prompt on Today · T10 URL state helper and deal tabs ·
T11 Deal header and right column · T12 Inquiries master-detail · T13 Contacts master-detail ·
T14 Properties table · T15 Exceptions cards · T16 Табло KPI tiles

### Checkpoint 2: core screens
Review page, each screen against its PNG. Full e2e green. Founder approves.

### Phase 3: Pages with code-rendered PNGs
T17 Auth pages · T18 Deals list · T19 Lists and list detail · T20 Property detail ·
T21 Contact detail · T22 Forms and dialogs · T23 Settings frame, profile, team ·
T24 Settings stages, lead sources, areas · T25 Settings import and wizard

### Checkpoint 3: all live pages
Review page. Founder approves.

### Phase 4: Скоро placeholders
T26 Coming-soon component and `/reports` · T27 Settings rules and portals · T28 Табло Скоро
section · T29 Final sweep against the success criteria

### Checkpoint 4: module done
All 14 success criteria checked, founder approves, then **Close** (SPEC.md Done, BRD rows
unchanged since no FR changes, `tasks/*` → `docs/archive/ui-bright-*.md`).

## Model per task

Routine restyles (T2–T8, T14–T25, T27–T28) suit Sonnet. **Flag for Opus:** T1 (token mapping +
AD), T9 (post-call provider split; the phone loop's single save must not change), T10–T13
(URL state, server data for panels, e2e selectors), T26 and T29.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| e2e selectors break as layouts move (274 locators) | High | Each screen task runs the specs that touch it and updates selectors to roles/labels, never weakens an assertion; full `test:e2e` at each checkpoint |
| Inline post-call prompt double-opens or loses the save after a discarded page | High | Keep provider as the single owner of state; Today only claims rendering; existing `post-call-*` tests stay green and gain a "Today claims it" case |
| Master-detail panel pulls a contact from another agency via `?id=` | High | Same service methods with `agencyId` as the detail page; an unknown id shows the list with no panel (test it) |
| Sofia Sans Cyrillic metrics shift tight layouts (long names, phone width) | Med | Check the 390 px pages with the longest seeded names; `min-w-0`/`truncate` where rows overflow (the phone-loop fix in `50ad0e1` is the pattern) |
| Palette guard is too broad (e.g. matches docs or SVG in placeholders) | Low | Guard scans `src/**/*.{ts,tsx}` only, excludes `globals.css`; placeholders use tokens too |
| Phase reviews stall the module before `go-live` | Med | Cut order from the spec: Phase 4, then master-detail, then Phase 3 layouts |

## Open questions

- Who sees `/reports`? The spec says "everyone who can open that section today"; Агенция holds
  Табло (all roles) and Изключения (owner/manager). Plan assumes `/reports` follows Табло (all
  roles). Confirm at checkpoint 3.
- The founder review page: published as a private Artifact per phase (screenshots from the
  browser check). Confirm that is the expected format at checkpoint 1.
