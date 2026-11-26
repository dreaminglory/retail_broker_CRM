# Tasks: ui-bright

> **Plan:** `tasks/plan.md` · **Spec:** `spec/ui-bright.md` · **Design:** `docs/design/`
> Every task also clears the Definition of Done in `AGENTS.md`. Tick a task only after that.
> Every UI task's verification includes: `npm run typecheck`, `npm run lint`, `npm run test`, and
> a browser check of the touched pages in `bg` and `en` at 1280 and 390 px next to the PNG.
> Never: schema/RLS/service/validation changes, changed message values, new queries or Server
> Actions (ask first), `eslint-suppressions.json` entries.

## Phase 1: Theme and shell

## Task 1: Bright tokens and AD-066
**Description:** Replace the shadcn neutral variables in `globals.css` with the Bright tokens from
`tokens.json` (light in `:root`, dark in `.dark`, never switched on) and map the shadcn variables
onto them as in plan decision 1. Add status, info and highlight tokens, radius 4/6/8,
`shadow-action` (3px `#f7d154` offset) and `shadow-float`. Write AD-066. Fix the spec drift
(Phase 3 PNGs exist, 7 e2e specs).

**Acceptance criteria:**
- [x] Every colour token in `tokens.json` has a CSS variable for light and dark; shadcn variables reference them, no `oklch` left
- [x] `bg-surface`, `text-ink`, `border-border-strong`, `shadow-action`, `shadow-float`, `rounded-{sm,md,lg}` = 4/6/8 px work as utilities
- [x] AD-066 in `docs/decisions-log.md`; `spec/ui-bright.md` Phase 3 table names its PNGs

**Verification:**
- [x] Browser: `/today` renders white page, primary `#2b63c6` buttons (computed style check)
- [x] `grep -n oklch src/app/globals.css` is empty

**Dependencies:** None
**Files likely touched:** `src/app/globals.css`, `docs/decisions-log.md`, `spec/ui-bright.md`
**Estimated scope:** M

## Task 2: Sofia Sans, type scale, tabular figures
**Description:** Swap Geist for Sofia Sans and Sofia Sans Semi Condensed (latin + cyrillic) via
`next/font/google`. Add the `tokens.json → type` scale as utilities (display 28/34, title 22/28,
…). Apply `tabular-nums` to number, money, date and time output (the shared formatters'
call sites and `Table` cells).

**Acceptance criteria:**
- [x] Computed `font-family` is Sofia Sans on body text in `bg` (Cyrillic) and `en`
- [x] No Geist reference left in `src/`
- [x] Type utilities exist for every `type` entry in `tokens.json`

**Verification:**
- [x] `grep -rn -i geist src` empty
- [x] Browser: `/today` and `/properties` prices and times line up in columns

**Dependencies:** Task 1
**Files likely touched:** `src/app/layout.tsx`, `src/app/globals.css`, number/date display components
**Estimated scope:** S

## Task 3: Status colours on the follow-up screens
**Description:** Replace the palette classes and colour literals in the follow-up-loop files
(`today`, `exceptions`, `dashboard`, `domain/{tasks,opportunities,calls,timeline}`, about 10
files) with the named status utilities from Task 1 (`text-overdue`, `bg-overdue-tint`, `due`,
`done`, `at-risk`, severity). Neutral greys/blues there become `ink`/`muted`/`primary`.

**Acceptance criteria:**
- [x] No palette class or hex/`oklch` literal left in those folders (grep)
- [x] Red/amber/green appear only on overdue, due, done, at-risk and exception severity

**Verification:**
- [x] Browser: Today overdue/at-risk, a deal's next step and Exceptions read as before in meaning
- [x] Existing tests in those folders green

**Dependencies:** Task 1
**Files likely touched:** the follow-up-loop files from the grep (~10)
**Estimated scope:** M

## Task 3b: Remaining palette classes and the guard test
**Description:** Replace the rest (imports, members, matching, contacts, inquiries, smart-lists,
settings, auth: about 14 files) with tokens; none of these are follow-up states, so no status
colours. Then add a Vitest guard that scans `src/**/*.{ts,tsx}` (excluding `globals.css`) and
fails on palette classes, hex or `oklch` literals.

**Acceptance criteria:**
- [x] Guard test passes, and fails when a `bg-red-500` is added to any file (tried once, reverted)
- [x] Import wizard error/success states still distinguishable (token `danger`/`success`, not palette)

**Verification:**
- [x] `npx vitest run src/lib/design-guard.test.ts`
- [x] Browser: import wizard, team settings, matching panel

**Dependencies:** Task 3
**Files likely touched:** `src/lib/design-guard.test.ts`, the remaining files from the grep (~14)
**Estimated scope:** M

## Task 4: Control primitives
**Description:** Restyle Button (primary, outline, ghost, destructive; `emphasis="action"` adds
`shadow-action`), Badge as the PNG status pill (neutral, primary, status variants), Input,
InputGroup, Select, Textarea, Switch, RadioGroup, Label with `border-strong` edges and the
`focus` ring.

**Acceptance criteria:**
- [x] Control edges ≥ 3:1 and visible focus ring on every control (keyboard tab through a form)
- [x] `emphasis="action"` is the only way `shadow-action` is applied (grep)

**Verification:**
- [x] Existing component tests green; browser: contact form and inquiry form in both locales

**Dependencies:** Task 1
**Files likely touched:** `src/components/ui/{button,badge,input,input-group,select,textarea,switch,radio-group,label}.tsx`
**Estimated scope:** M

## Task 5: Surface primitives
**Description:** Card flat with a hairline and no shadow; Table with muted uppercase headers and
12px rows; Dialog, AlertDialog, Sheet, DropdownMenu, Command with `surface-raised` and
`shadow-float`; Alert, Avatar (initials), ListPager restyled; tabs underline in primary.

**Acceptance criteria:**
- [x] No card has a shadow in light; only floating layers use `shadow-float`
- [x] Table header and row metrics match `properties-list.png`

**Verification:**
- [x] Browser: `/properties` table, a dialog (new contact), a sheet (post-call) and a dropdown

**Dependencies:** Task 1
**Files likely touched:** `src/components/ui/{card,table,dialog,alert-dialog,sheet,dropdown-menu,command,alert,avatar,list-pager}.tsx`
**Estimated scope:** M

## Task 6: Grouped sidebar
**Description:** Move nav items into a typed group config (Моят ден: Днес, Запитвания; Работа:
Сделки, Списъци; База: Контакти, Имоти; Агенция: Табло, Изключения, Настройки), keeping the
`roles` filter. `#f6faff` background, active item on `accent`, collapse styled as
`today-collapsed.png`, user block at the foot (name, role, settings link), mobile menu restyled.
New keys: the four group headings (both message files). Отчети is added in Task 26.

**Acceptance criteria:**
- [x] Vitest: every existing dashboard route appears exactly once, in its group; role filter unchanged (broker doesn't see Изключения)
- [x] Collapsed and phone menu work as before

**Verification:**
- [x] `npx vitest run src/components/layout/nav-config.test.ts`
- [x] Browser: collapsed vs `today-collapsed.png`; phone menu at 390 px; `git diff messages/` adds keys only

**Dependencies:** Tasks 2, 4, 5
**Files likely touched:** `src/components/layout/sidebar.tsx`, `src/components/layout/nav-config.ts(+test)`, `messages/{bg,en}.json`
**Estimated scope:** M

## Task 7: Header breadcrumb and main area
**Description:** Header shows group › page › item breadcrumb (item from the page title where one
exists), existing actions kept, no bell or + Ново. `main` on white with 16px phone gutters.

**Acceptance criteria:**
- [x] Breadcrumb correct on every dashboard route, including detail pages
- [x] Nothing scrolls sideways at 390 px on any route

**Verification:**
- [x] `npm run test:e2e` green (shell changes touch every spec)
- [x] Browser: header vs `today.png` and `deal.png`

**Dependencies:** Task 6
**Files likely touched:** `src/components/layout/header.tsx`, `src/app/(dashboard)/layout.tsx`
**As built:** breadcrumb is group › page (the page links back on detail routes); the third level (item name) comes with the detail pages in Tasks 11, 20 and 21. Search moved into the sidebar at checkpoint 1 (founder). The header profile menu moved to the sidebar user block (settings, sign out). `main` became `relative`, fixing a page-level scroll from `sr-only` spans on /opportunities.
**Estimated scope:** S

### Checkpoint 1: shell
- [x] typecheck, lint, test, `test:e2e` green
- [x] Review page published (every route, `bg`/`en`, 1280/390); founder approves
  Approved 2026-11-26 (https://claude.ai/artifact/Cyhp2kvKjKiyvfqP9yiEnk). Founder decisions: search moves into the sidebar as in the PNG (done; on phones it sits in the menu, which closes before search opens); the profile menu stays in the sidebar user block; the breadcrumb item name arrives with the detail pages (Tasks 11, 20, 21).

## Phase 2: Screens with a PNG

## Task 8: Today layout
**Description:** Greeting (display) and summary line; sections as cards in the PNG's order:
Закъсняло (red tint), Днес, Без следваща стъпка (amber) in the main column; Нови запитвания and
Coming up in the right column. Task rows: checkbox, type icon, title, context line, time, one
row action. Scope toggle kept. No yellow action (plan).

**Acceptance criteria:**
- [x] Layout matches `today.png`; every section and action that exists today still works
- [x] Phone: one column in the same order

**Verification:**
- [x] `npx vitest run src/app/(dashboard)/today`; core-loop e2e green

**Dependencies:** Checkpoint 1
**Files likely touched:** `src/app/(dashboard)/today/today-page-client.tsx`, `src/components/domain/tasks/*`
**As built:** the task card became the Today row (checkbox opens completion, type icon, title, context line, time, call links and menu), laid out by its card width (container queries) so the side column and phones stack it. The summary line reuses the existing count keys; no greeting key exists, so the title stays "Днес" under the date. No `due today` tasks in the seed at the time of the check.
**Estimated scope:** M

## Task 9: Inline post-call prompt on Today ⚑ Opus
**Description:** Split `PostCallSheet` into the form body and the sheet shell. The provider
exposes the current target; on Today the form renders inline under the matching task row and
the provider skips the sheet; elsewhere (and on Today when no row matches) the sheet opens as
before. Same fields, same single save.

**Acceptance criteria:**
- [ ] Calling from a Today task opens the prompt under that row, not as a sheet; save behaves exactly as before
- [ ] From the deal page and contacts the sheet still opens; a page discarded during a call still reopens the prompt

**Verification:**
- [ ] Failing test first: provider renders no sheet while Today claims the target
- [ ] `npx vitest run src/components/domain/calls`; core-loop e2e green

**Dependencies:** Task 8
**Files likely touched:** `src/components/domain/calls/{post-call-sheet,call-intent-provider}.tsx`, new `post-call-form.tsx`, Today client
**Estimated scope:** M

## Task 10: URL state helper and deal tabs ⚑ Opus
**Description:** `src/lib/url-state.ts` reads/writes `?id=` and `?tab=` (replace, not push),
unit-tested. Deal page gets tabs Път (stage path + next-step card) / Имоти / Изисквания /
История (timeline + + Бележка), default Път, keyboard-reachable. New keys only for tab labels
without an existing section title.

**Acceptance criteria:**
- [ ] `?tab=istoriya`-style URL opens that tab; unknown tab falls back to Път
- [ ] Arrow keys move between tabs; nothing on the page removed

**Verification:**
- [ ] `npx vitest run src/lib/url-state.test.ts`
- [ ] New e2e: deal tabs by click, keyboard and URL; existing specs touching the deal page green

**Dependencies:** Checkpoint 1
**Files likely touched:** `src/lib/url-state.ts(+test)`, `src/app/(dashboard)/opportunities/[id]/opportunity-detail-client.tsx`, `e2e/deal-tabs.spec.ts`
**Estimated scope:** M

## Task 11: Deal header and right column
**Description:** Header card (type and status pills, title, budget/owner line, Move forward);
right column with the contact card (call/Viber/email links) and viewed properties. Phone: contact
card under the header, viewed properties after the tabs. Готово on the next step carries the
yellow offset.

**Acceptance criteria:**
- [ ] Matches `deal.png`; exactly one `emphasis="action"` on the page (Готово)
- [ ] Call links still start the call intent

**Verification:**
- [ ] core-loop, matching, requirements e2e green; browser at 390 px

**Dependencies:** Task 10
**Files likely touched:** `src/app/(dashboard)/opportunities/[id]/{page,opportunity-detail-client}.tsx`, `src/components/domain/opportunities/*`
**Estimated scope:** M

## Task 12: Inquiries master-detail ⚑ Opus
**Description:** At ≥ 1024 px: list (source pill, name, message line, time pill, assignee) left,
selected inquiry's panel right (message, existing fields, convert/assign/reject), selection in
`?id=`. Status tabs only for existing statuses. Below 1024 px: list → existing card. Panel data
from what the page already loads. Convert/take carries the yellow offset.

**Acceptance criteria:**
- [ ] Selecting a row updates `?id=`; refresh keeps it; an id from another agency or unknown shows no panel
- [ ] Convert, assign, reject work from the panel with the same result

**Verification:**
- [ ] New e2e: panel selection survives reload; existing inquiry flows in core-loop green

**Dependencies:** Task 10
**Files likely touched:** `src/app/(dashboard)/inquiries/{page,inquiries-page-client}.tsx`, `src/components/domain/inquiries/inquiry-panel.tsx`
**Estimated scope:** M

## Task 13: Contacts master-detail ⚑ Opus
**Description:** Filters bar (existing filters only), rows (initials avatar, name, role pill if
loaded, summary, last activity, owner); at ≥ 1024 px the selected contact's panel (methods with
links, requirement summary, linked deals, recent timeline) via the services `/contacts/[id]`
uses, with `agencyId`. Link to the full page. Нов контакт carries the yellow offset.

**Acceptance criteria:**
- [ ] Same `?id=` behaviour as Task 12; panel loads no query the detail page doesn't already run
- [ ] Phone: list → `/contacts/[id]`

**Verification:**
- [ ] e2e panel selection case; smart-lists and core-loop contact steps green

**Dependencies:** Task 10
**Files likely touched:** `src/app/(dashboard)/contacts/{page,contacts-page-client}.tsx`, `src/components/domain/contacts/{contact-panel,contact-list-table}.tsx`
**Estimated scope:** M

## Task 14: Properties table
**Description:** Table only: type icon, title and settlement, area, price (tabular), owner,
status pill; existing filters as pill selects; pager in the footer. Нов имот yellow.

**Acceptance criteria:**
- [ ] Matches `properties-list.png` minus left-out parts; filters and pager behave as before

**Verification:**
- [ ] properties e2e green

**Dependencies:** Checkpoint 1
**Files likely touched:** `src/app/(dashboard)/properties/properties-page-client.tsx`, `src/components/domain/properties/*`
**Estimated scope:** S

## Task 15: Exceptions cards
**Description:** Each existing section as a collapsible card (severity pill, title, rule line,
count, rows with one action). Main column only. No yellow action.

**Acceptance criteria:**
- [ ] Matches `exceptions.png` layout; every row action works; collapse is keyboard-operable

**Verification:**
- [ ] Browser as manager@alpha.bg; component tests green

**Dependencies:** Checkpoint 1
**Files likely touched:** `src/app/(dashboard)/exceptions/exceptions-page-client.tsx`
**Estimated scope:** S

## Task 16: Табло KPI tiles
**Description:** The 4 real counts as KPI tiles at the top of `/dashboard`, in the PNG's tile
style. Space below left for Task 28.

**Acceptance criteria:**
- [ ] Same four numbers as today, tabular; owner notice kept

**Verification:**
- [ ] Browser as owner and broker

**Dependencies:** Checkpoint 1
**Files likely touched:** `src/app/(dashboard)/dashboard/page.tsx`
**Estimated scope:** XS

### Checkpoint 2: core screens
- [ ] typecheck, lint, test, full `test:e2e` green
- [ ] At most one `emphasis="action"` per view (grep)
- [ ] Review page published; founder approves

## Phase 3: Pages with code-rendered PNGs
Each follows its PNG for layout; parts with no data (minimum price, loss-reason counts, list
tabs, deal-stage strip) are left out.

## Task 17: Auth pages
**Description:** `/login`, `/signup`, `/onboarding`, `/forgot-password`, `/update-password`:
white page, centred 400 px card, sidebar logo mark, primary submit with the yellow offset.
**Acceptance criteria:**
- [ ] Matches `login.png`; sign-in, sign-up and reset flows still work
**Verification:**
- [ ] e2e login fixture green; browser all five pages
**Dependencies:** Checkpoint 2 · **Files:** `src/app/(auth)/*` · **Scope:** S

## Task 18: Deals list
**Description:** `/opportunities` as the `deals.png` table (existing columns and filters only).
**Acceptance criteria:**
- [ ] Filters, sorting, pager unchanged in behaviour
**Verification:**
- [ ] core-loop green; browser
**Dependencies:** Checkpoint 2 · **Files:** `src/app/(dashboard)/opportunities/opportunities-page-client.tsx` · **Scope:** S

## Task 19: Lists and list detail
**Description:** `/lists` and `/lists/[id]` as `lists.png` and `list-detail.png`, without tabs.
**Acceptance criteria:**
- [ ] Working a list one by one behaves as before
**Verification:**
- [ ] smart-lists e2e green
**Dependencies:** Checkpoint 2 · **Files:** `src/app/(dashboard)/lists/**`, `src/components/domain/smart-lists/*` · **Scope:** M

## Task 20: Property detail
**Description:** `/properties/[id]` as `property-detail.png`: header card, tabs from existing
sections (reuse Task 10 helper), parties in the right column.
**Acceptance criteria:**
- [ ] Every existing section reachable; `?tab=` works
**Verification:**
- [ ] properties and matching e2e green
**Dependencies:** Checkpoint 2 · **Files:** `src/app/(dashboard)/properties/[id]/*` · **Scope:** M

## Task 21: Contact detail
**Description:** `/contacts/[id]` as `contact-detail.png`, reusing the Task 13 panel parts.
**Acceptance criteria:**
- [ ] Methods, properties, deals, timeline, merge (config roles) all present and working
**Verification:**
- [ ] core-loop contact steps green; browser as broker and manager
**Dependencies:** Checkpoint 2 · **Files:** `src/app/(dashboard)/contacts/[id]/*` · **Scope:** M

## Task 22: Forms and dialogs
**Description:** Property new/edit as `property-form.png` (label above, grouped cards); the same
field style in contact, inquiry, task, requirement and convert dialogs.
**Acceptance criteria:**
- [ ] Validation errors still show per field; submit results unchanged
**Verification:**
- [ ] properties and requirements e2e green; browser each dialog at 390 px
**Dependencies:** Checkpoint 2 · **Files:** `src/components/domain/*/*-form.tsx`, `*-dialog.tsx`, `src/app/(dashboard)/properties/{new,[id]/edit}` · **Scope:** M

## Task 23: Settings frame, profile, team
**Description:** Settings sub-nav left, content in cards (`settings-profile.png`,
`settings-team.png`).
**Acceptance criteria:**
- [ ] Sub-nav role filter unchanged; invite and role change work
**Verification:**
- [ ] settings-team e2e green
**Dependencies:** Checkpoint 2 · **Files:** `src/app/(dashboard)/settings/{layout,settings-sidebar,profile,team}*` · **Scope:** M

## Task 24: Settings stages, lead sources, areas
**Description:** As `settings-stages.png`, `settings-lead-sources.png`, `settings-areas.png`.
**Acceptance criteria:**
- [ ] Reorder, add, archive behave as before (owner/manager only)
**Verification:**
- [ ] Browser as manager; component tests green
**Dependencies:** Task 23 · **Files:** `src/app/(dashboard)/settings/{stages,lead-sources,areas}/*`, related domain components · **Scope:** M

## Task 25: Settings import and wizard
**Description:** As `settings-import.png` and `settings-import-new.png`.
**Acceptance criteria:**
- [ ] Import wizard steps and history unchanged in behaviour
**Verification:**
- [ ] settings-import e2e green
**Dependencies:** Task 23 · **Files:** `src/app/(dashboard)/settings/import/**`, `src/components/domain/imports/*` · **Scope:** S

### Checkpoint 3: all live pages
- [ ] typecheck, lint, test, full `test:e2e` green
- [ ] Review page published; founder approves (and confirms who sees `/reports`)

## Phase 4: Скоро placeholders

## Task 26: Coming-soon component and `/reports` ⚑ Opus
**Description:** `coming-soon.tsx` (Скоро badge + banner "Още не работи — показва примерни
данни"); `/reports` as `reports.png` with sample data from message keys, CSS/SVG bars, every
control disabled, no Supabase import; Отчети·Скоро in the Агенция group.
**Acceptance criteria:**
- [ ] Vitest: component renders the banner and disabled controls
- [ ] `/reports` imports nothing from `@/lib/supabase` or `@/domain` (test or grep)
**Verification:**
- [ ] e2e smoke: `/reports` shows the banner in `bg` and `en`
**Dependencies:** Checkpoint 3 · **Files:** `src/components/layout/coming-soon.tsx(+test)`, `src/app/(dashboard)/reports/page.tsx`, nav config, messages · **Scope:** M

## Task 27: Settings rules and portals placeholders
**Description:** `/settings/rules` and `/settings/portals` as their PNGs, sub-nav entries with
Скоро.
**Acceptance criteria:**
- [ ] Same placeholder rules as Task 26
**Verification:**
- [ ] Browser; nav-config test updated
**Dependencies:** Task 26 · **Files:** `src/app/(dashboard)/settings/{rules,portals}/page.tsx`, `settings-sidebar.tsx`, messages · **Scope:** S

## Task 28: Табло Скоро section
**Description:** Below the real tiles, one Скоро section with the PNG's commissions, funnel,
sources, portfolio health and team-today blocks as sample data.
**Acceptance criteria:**
- [ ] Real tiles unaffected; the section runs no query
**Verification:**
- [ ] Browser as owner and broker
**Dependencies:** Task 26, Task 16 · **Files:** `src/app/(dashboard)/dashboard/page.tsx`, `src/components/layout/coming-soon.tsx` · **Scope:** S

## Task 29: Final sweep ⚑ Opus
**Description:** Check all 14 success criteria: palette guard, one action per view, status
colours only on follow-up, `git diff main -- messages/` shows only added keys, contrast pairs,
focus rings, no sideways scroll at 390 px on every route. Update `docs/domain-model.md` only if
something there describes UI (expected: nothing).
**Acceptance criteria:**
- [ ] Every success criterion checked with its evidence noted here
**Verification:**
- [ ] typecheck, lint, test, `test:e2e` green in this session
**Dependencies:** Tasks 26–28 · **Files:** as found · **Scope:** S

### Checkpoint 4: module done
- [ ] Founder approves the phase 4 review page
- [ ] Close: SPEC.md module Done, `tasks/*` → `docs/archive/ui-bright-{plan,todo}.md`
