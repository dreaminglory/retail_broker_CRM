# Spec: ui-bright

> **Status:** Approved scope (founder, 2026-11-25). Decision to write in phase 1: AD-066
> (Bright tokens mapped onto the shadcn theme). Requirements: none new; this module changes how
> existing FRs look, not what they do.
> **Evidence:** founder decision (E1). Design source: `docs/design/` (README, `tokens.json`,
> 26 PNGs) and the design system https://claude.ai/artifact/DmBeMNsJjGTvpizArucMPu.
> Scope answers from the founder (2026-11-25): visuals only, no schema or rule changes; existing
> screens laid out to match their PNG; pages without a PNG derived from the tokens; PNG parts with
> no data are **left out** and logged as ideas; three whole screens plus part of Табло become
> marked **Скоро** placeholders; light only; phones adapt the desktop; existing text unchanged;
> one module in four phases, built before `go-live`; the founder approves each phase on a
> side-by-side review page.

## Objective

The app still runs the stock shadcn theme: grey, dense in places, unlike the Bright design the
founder signed off. The pilot agency should meet the final look on day one, and the `go-live`
dry run should test the UI brokers will keep.

This module restyles **what is already built** to Bright: white page, `#f6faff` sidebar, primary
blue `#2b63c6`, hairline `#dce1e7` borders and no shadow on cards, Sofia Sans with tabular figures,
and the 3px `#f7d154` yellow offset under the one main action of each view. Red, amber and green
are used only for the follow-up loop (overdue, due, done).

**Users:** every member. Brokers mostly on a 390 px phone and on Today and the deal page; owners
and managers on Exceptions, Табло and Settings.

**Success:** every live screen matches its PNG (or, without one, the tokens and its nearest PNG),
in `bg` and `en`, at 1280 and 390 px, approved by the founder at each phase checkpoint, with no
change to data, rules or existing text.

## Design source rules

1. `tokens.json` and the design system win over a PNG where they disagree.
2. A PNG decides **layout**: what goes where, grouping, order, column count, which action is the
   main one.
3. A PNG never decides **content**. Only data the app already loads is shown. Every PNG element
   without data is left out (see *Left out*), except the four Скоро placeholders below.
4. Existing message keys keep their text. New keys are allowed only for: sidebar group headings,
   the Скоро badge and banner, placeholder sample data, and tab labels the deal page needs
   (reusing existing section titles where one exists). Every new key goes in both `bg.json` and
   `en.json`.
5. The yellow `shadow-action` appears **at most once per view**, on the action the table below
   names. Primary buttons elsewhere are plain primary.

## Screens

### Phase 1 — Theme and shell (everything inherits it)

| Part | What changes |
|---|---|
| `src/app/globals.css` | shadcn variables mapped from the Bright tokens (`--background`←bg, `--card`←surface, `--popover`←surface-raised, `--primary`←primary, `--accent`←accent, `--border`←border, `--input`←border-strong, `--ring`←focus, `--destructive`←danger, `--sidebar*`←sidebar/accent/primary…); the status, info and highlight tokens added as named colours; radius 4/6/8; `shadow-action`, `shadow-float`; dark values under `.dark`, never switched on |
| Fonts (`src/app/layout.tsx`) | Geist replaced by Sofia Sans (latin + cyrillic) and Sofia Sans Semi Condensed via `next/font/google`; `tabular-nums` on every number, money, date and time |
| Type scale | display 28/34, title 22/28 and the rest of `tokens.json → type` as utilities |
| `src/components/ui/*` (19 primitives) | Button (primary, outline, ghost, destructive; optional `action` emphasis = yellow offset), Badge as the PNG's status pill, Input/Select/Textarea with `border-strong` edges, Card flat with a hairline, Table with muted uppercase headers and 12px rows, Dialog/Sheet/Dropdown with `shadow-float`, tabs underline in primary |
| Sidebar | Grouped as in the PNGs: **Моят ден** (Днес, Запитвания), **Работа** (Сделки, Списъци), **База** (Контакти, Имоти), **Агенция** (Табло, Отчети·Скоро, Изключения, Настройки). Active item on `accent`. Count bubbles only where a count is already loaded. Existing collapse kept, styled as `today-collapsed.png`. User block at the foot (name, role, settings link) |
| Header | Breadcrumb (group › page › item) as in the PNGs; existing header actions kept. No bell, no + Ново |
| Phone | Existing mobile menu, restyled; 16px gutters; no bottom bar |

### Phase 2 — Screens with a PNG

| Route | PNG | Layout | Main (yellow) action |
|---|---|---|---|
| `/today` | `today.png` | Greeting (display) and summary line; sections as cards in the PNG's order and style: Закъсняло (red tint), Днес, Без следваща стъпка (amber), Нови запитвания and Coming up in the right column. Task rows: checkbox, type icon, title, context line, time, one row action. **The post-call prompt opens inline under its task row on Today** (same fields, same single save); elsewhere it stays the sheet | Existing primary action of the view |
| `/opportunities/[id]` | `deal.png` | Header card (type and status pills, title, budget/owner line, Move forward), **tabs Път / Имоти / Изисквания / История**: Път holds the stage path (the agency's own stages) and the next-step card; Имоти the property links; Изисквания the requirement; История the timeline with + Бележка. Right column: contact card with call/Viber/email links, then viewed properties. Nothing removed, only regrouped | Mark next step done (Готово) |
| `/inquiries` | `inquiries.png` | **Master-detail on desktop:** list (source pill, name, message line, time pill, assignee) on the left, the selected inquiry's panel on the right (message, existing fields, convert/assign/reject). Status tabs only for statuses that exist. Phone: list → existing card/page | Convert / take (existing action) |
| `/contacts` | `contacts.png` | **Master-detail on desktop:** filters bar (existing filters only), rows (initials avatar, name, role pill if loaded, summary line, last activity, owner), the selected contact's panel (methods with links, requirement summary, linked deals, recent timeline). The full `/contacts/[id]` page stays one click away. Phone: list → page | Нов контакт |
| `/properties` | `properties-list.png` | Table only: icon by type, title and settlement, area, price (tabular), owner, status pill; existing filters as the PNG's pill selects; pager in the footer | Нов имот |
| `/exceptions` | `exceptions.png` | Each existing exception section as a collapsible card (severity pill, title, rule line, count, rows with one action). Main column only | — |
| `/dashboard` (Табло) | `dashboard.png` | Top: the 4 real counts as KPI tiles. Below: one **Скоро** section (phase 4) | — |

### Phase 3 — Pages with a code-rendered PNG (added 2026-11-25, `832193a`; parts without data left out)

| Route | Follows |
|---|---|
| `/login`, `/signup`, `/onboarding`, `/forgot-password`, `/update-password` | `login.png`: split screen (spot art, promise and three points on the left from `auth.hero`; БГ/EN toggle and a 400px form on the right; the left half is hidden below 1024px), primary button with the yellow offset |
| `/opportunities` | `deals.png` table (no deal-stage strip, no loss-reason counts) |
| `/lists`, `/lists/[id]` | `lists.png`, `list-detail.png` (no list tabs) |
| `/properties/[id]` | `property-detail.png`: header card, tabs from its existing sections, right column with parties |
| `/properties/new`, `/properties/[id]/edit`, all create/edit forms and dialogs | `property-form.png` (no minimum price); its field style everywhere else: label above, `border-strong` inputs, grouped in cards |
| `/contacts/[id]` | `contact-detail.png` |
| `/settings/*` (profile, team, stages, lead sources, areas, import) | `settings-{profile,team,stages,lead-sources,areas,import,import-new}.png`: sub-nav on the left, content in cards |

### Phase 4 — Скоро placeholders

Visible to everyone who can open that section today. Each has a **Скоро** badge in its nav entry,
a banner ("Още не работи — показва примерни данни"), sample data from message keys, every control
disabled, and **no queries**.

| Where | PNG |
|---|---|
| `/reports` (new route, Агенция › Отчети) | `reports.png` |
| `/settings/rules` (new sub-nav entry) | `settings-rules.png` |
| `/settings/portals` (new sub-nav entry) | `settings-portals.png` |
| Табло, below the real tiles | `dashboard.png` charts and lists (commissions, funnel, sources, portfolio health, team today) as one Скоро section |

Charts in placeholders are plain CSS/SVG bars. No chart library.

## Left out (logged in the SPEC.md ideas backlog, 2026-11-25)

Today: week strip, "Най-важно сега" card, route map and timeline, type filter tabs.
Shell: broker status (Свободен / На оглед / Зает), "Последно отворени", notification bell, agency
switcher, global + Ново, theme toggle. Inquiries: KPI tiles, parsed message fields, matching
properties in the panel, routing rules button. Contacts: KPI summary line, role tabs with counts,
temperature, "Изпрати всички". Properties: grid view and illustrations, portal badges and sync,
price-change chips, buyer counts, map view, deposit/sold/archive tabs. Exceptions: KPI tiles, filter
chips, "Само моите", snooze, weekly chart, by-broker panel, new rule types (deposit without
contract, portal price drift, GDPR consent, exclusive expiring). Spot illustrations and dark mode.

## Where it lives

- Theme: `src/app/globals.css`, `src/app/layout.tsx`.
- Primitives: `src/components/ui/*`. Shell: `src/components/layout/{sidebar,header}.tsx`.
- Screens: the existing page and `*-page-client.tsx` files and `src/components/domain/*`.
  Master-detail panels: `src/components/domain/{contacts,inquiries}/*-panel.tsx`.
- Placeholders: `src/app/(dashboard)/reports/page.tsx`, `settings/{rules,portals}/page.tsx`,
  shared `src/components/layout/coming-soon.tsx` (badge + banner).
- Decision: AD-066 in `docs/decisions-log.md`.

## Success criteria

1. `globals.css` holds every Bright colour token for light (and dark under `.dark`); no hex or
   `oklch` literal and no Tailwind palette colour (`blue-600`, `amber-…`) remains in `src/`
   outside `globals.css` (grep check).
2. All text renders in Sofia Sans, Cyrillic included; numbers, money, dates and times use tabular
   figures.
3. Cards have a hairline border and no shadow in light; only floating layers use `shadow-float`.
4. Each view has at most one element with `shadow-action`, and it is the one named above.
5. Status colours appear only on follow-up states (overdue, due, done, at risk, exception severity).
6. Every Phase 2 screen matches its PNG in layout, and every Phase 3 page follows its row in the
   table; the founder approves each on the phase review page (PNG | built, `bg`, 1280 and 390 px).
7. Every action that works today still works, with the same result, from the new layout
   (Vitest and the 7 e2e specs green, selectors updated where the layout moved).
8. Contacts and Inquiries show list + panel at ≥ 1024 px and list → page below it; selecting a row
   updates the URL (`?id=`), so a refresh or a shared link keeps the selection.
9. Deal tabs are reachable by keyboard and by URL (`?tab=`); the default tab is Път.
10. On Today the post-call prompt opens inline under its task row; on every other screen it opens
    as before.
11. Placeholders run no Supabase query, have every control disabled, show the banner, and the
    nav shows Скоро. Removing a placeholder is deleting its route and nav entry.
12. Existing message values are byte-identical (`git diff messages/` shows only added keys).
13. Text contrast ≥ 4.5:1 and control edges ≥ 3:1 (the token pairs from `tokens.json`); visible
    focus ring on every control; nothing scrolls sideways at 390 px.
14. `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e` pass.

## Testing strategy

- **Vitest:** the sidebar group config (every existing route appears once, in its group); the
  master-detail URL helper; the placeholder component renders the banner and disabled controls.
  Existing tests updated only where markup moved, never weakened.
- **Playwright (`npm run test:e2e`):** existing specs keep passing in `bg` and `en`, 1280 and 390
  px; add one spec for the deal tabs and the contacts/inquiries panel selection, and one smoke that
  `/reports` shows the Скоро banner.
- **Browser check per screen** (Definition of Done 3), screenshots placed on the phase review page
  next to the PNG. No visual-regression tool is added.
- **Greps in review:** colour literals and palette classes outside `globals.css`; more than one
  `shadow-action` per view; changed values in `messages/*.json`.

## Boundaries

- **Always:** tokens before PNG; existing data only; both message files; one task per screen,
  committed on `feat/ui-bright` as `feat(ui-bright): ...`; browser check in `bg` and `en` at 1280
  and 390 px before ticking a task.
- **Ask first:** any new dependency (fonts come from `next/font`, so none expected); moving an
  action to a different screen; hiding something a user can do today; any new query or Server
  Action; changing an existing message value.
- **Never:** schema, migration, RLS, service or validation changes; new features beyond the four
  placeholders; sample data outside a placeholder; switching dark mode on; entries in
  `eslint-suppressions.json`.

## Cut order if time runs short

1. Phase 4 placeholders (Reports, settings rules and portals, the Табло Скоро section).
2. Master-detail: contacts and inquiries keep separate pages, restyled to the PNG's list and panel.
3. Phase 3 layouts: those pages keep only the phase 1 token restyle.

The theme, the shell and the Phase 2 screens are never cut.

## Assumptions

- A1 [ASSUMPTION — validate in pilot: brokers tell Скоро placeholders from live screens; log any
  question about the sample ranking or KPIs in SPEC.md §6].
- A2 Master-detail at ≥ 1024 px is faster for managers than separate pages
  [ASSUMPTION — validate in pilot: watch whether managers open the full contact page anyway].
- A3 Tabs on the deal page don't hide something brokers need at a glance
  [ASSUMPTION — validate in pilot: ask brokers which tab they open first].

## Open questions (for the plan, not the founder)

- Exact shadcn variable for each secondary token (`secondary`, `muted`, chart colours).
- Whether the deal page's right column moves under the tabs or below the header on phones.
- Which existing primary action is Today's yellow one (the PNG gives it to Маршрут, which is left
  out).
