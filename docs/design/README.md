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

When a screen changes on the canvas, export it again under the same file name: ask Claude Code to
"re-export the design screens" (it renders the canvas artboards with Playwright), or use the canvas's
Share › Export.
