# Design: BrokerCRM — Bright

The target look for the app. Read this before building or changing any UI.

- **Design system** (tokens, type, components, rules): https://claude.ai/artifact/DmBeMNsJjGTvpizArucMPu
  Agents with claude.ai access read its `project/README.md`, then the cards it indexes.
- **Reference screens** (canvas with every Bright screen): https://claude.ai/code/artifact/82196426-453b-43ea-beb6-2110e42e45b5
  Each artboard's source is `project/<File>.dc.html` on that canvas.
- **PNG copies** of those screens: `screens/` below, 1280 px wide, full height. Any tool can view them, even without claude.ai access.
- **Token snapshot**: `tokens.json`, copied from the design system on 2026-11-24 (colours light + dark, type,
  spacing, radius, shadow, each with a usage note). The design system stays the source; refresh this copy
  when it changes.

In short: white page, `#f6faff` sidebar, primary blue `#2b63c6`, a hairline `#dce1e7` border on cards
and no shadow, Sofia Sans for all text with tabular figures for numbers, and a 3px `#f7d154` yellow
offset under the one main action of a view. The status colours (red, amber, green) are only for the
follow-up loop. The app still runs the stock shadcn theme; the design system's
"Applying it to the app" section maps the tokens onto `src/app/globals.css`.

Where a PNG and the design system's tokens disagree, the tokens win.

## Screens

| File | Screen | Canvas artboard |
|---|---|---|
| `screens/deal.png` | Сделка (deal page) | Main |
| `screens/today.png` | Днес | Today |
| `screens/today-collapsed.png` | Днес, collapsed sidebar | TodayCollapsed |
| `screens/properties-list.png` | Имоти, table | Properties |
| `screens/properties-grid.png` | Имоти, cards | PropertiesGrid |
| `screens/contacts.png` | Контакти | Contacts |
| `screens/inquiries.png` | Запитвания | Requests |
| `screens/dashboard.png` | Табло | Dashboard |
| `screens/reports.png` | Отчети, broker ranking | Reports |
| `screens/exceptions.png` | Изключения | Exceptions |
| `screens/settings-rules.png` | Настройки, follow-up rules | Settings |
| `screens/settings-portals.png` | Настройки, portals | SettingsPortals |

### Screens built from code

These have no canvas artboard. They are rendered from `src/` (the same sidebar, tokens and spot art as the
canvas screens) with `node docs/design/src/render.mjs [name ...]`, which writes the PNGs into `screens/`.
Change them in `src/`, not by hand. Approved 2026-11-25.

| File | Screen | Route |
|---|---|---|
| `screens/contact-detail.png` | Контакт (opened contact) | `/contacts/[id]` |
| `screens/deals.png` | Сделки, list | `/opportunities` |
| `screens/property-detail.png` | Имот (opened property) | `/properties/[id]` |
| `screens/property-form.png` | Нов имот / редакция | `/properties/new`, `/properties/[id]/edit` |
| `screens/lists.png` | Списъци | `/lists` |
| `screens/list-detail.png` | Списък, worked one by one | `/lists/[id]` |
| `screens/settings-team.png` | Настройки, users and roles | `/settings/team` |
| `screens/settings-stages.png` | Настройки, deal stages | `/settings/stages` |
| `screens/settings-lead-sources.png` | Настройки, lead sources | `/settings/lead-sources` |
| `screens/settings-areas.png` | Настройки, areas | `/settings/areas` |
| `screens/settings-import.png` | Настройки, import history | `/settings/import` |
| `screens/settings-import-new.png` | Настройки, import wizard (columns step) | `/settings/import/new` |
| `screens/settings-profile.png` | Настройки, my profile | `/settings/profile` |
| `screens/login.png` | Вход | `/login` (also the look for signup, forgot/update password) |

These screens show a few things the app does not have yet: minimum price, loss-reason counts, the list
tabs and the deal-stage strip. Under `ui-bright` (visuals only), leave those out or show them as
"Скоро" placeholders. The Settings menu also lists Моят профил, Източници, Квартали and Импорт,
because those routes exist.

When a screen changes on the canvas, export it again under the same file name: ask Claude Code to
"re-export the design screens" (it renders the canvas artboards with Playwright), or use the canvas's
Share › Export.
