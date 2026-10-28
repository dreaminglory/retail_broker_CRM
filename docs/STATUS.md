# BrokerCRM — Current Status

> **Last refreshed:** 2026-10-28 (by sprint-planning Phase 1, before Sprint 6)
> Keep this file to one page. It is the first thing every agent session reads.

## Where we are
- **Last completed sprint:** 5 — "Pilot-ready: lock the doors, load the data, speak Bulgarian"
  (plan in `docs/archive/`; code done, prod deploy not done)
- **Pilot status:** not started. Paid pilot gate = core-loop defects fixed + reminders + light
  property record + requirements + matching (AD-039). Target: end of Sprint 8 (`docs/roadmap.md`).
- **Production:** Supabase project `emflwmivjachbnaqumnn` (eu-west-2). **Migrations in sync: NO.**
  Prod is on the Sprint 4 schema (14 tables, no migration-history table); Sprint 5 migrations
  `20261005000001`…`20261007000004` were never applied. App hosting (Vercel) not confirmed in repo.
- **Checks on 2026-10-28 (this session):** typecheck ✅ · lint ✅ (0 errors, 80 warnings) ·
  Vitest ✅ 19 passed / 2 todo (2 files) · pgTAP ✅ 93/93 locally (14 files).

## Built (high level)
- Tenancy, roles, invitations, profiles, team management ✅ (resend invitation missing)
- Contacts + duplicate warning + merge with history ✅ (BG mobile numbers only)
- Manual inquiries + conversion ✅ (no edit/reassign UI; phone/email not normalised)
- Opportunities, custom stages, participants, close/reopen ✅ (no pagination; 200-row cap)
- Tasks + next-action trigger + Today + Exceptions ✅ (Today defects; no edit/reschedule UI)
- Notes, unified timeline, audit triggers ✅
- Global search ⌘K ✅ (hidden on mobile)
- CSV import of contacts and inquiries with revert ✅ (revert notes guard broken)
- BG/EN i18n, agency timezone and EUR ✅ (some English leaks)
- CI: typecheck, lint, Vitest, pgTAP on every PR ✅
- Not built: reminders, Smart Lists, properties, requirements, matching, intake, routing, reports,
  GDPR tools, PWA, click-to-call

## Carry-over / known gaps
| Item | Source | Severity |
|---|---|---|
| Prod still has Sprint 5 F-01 (any user can insert an owner membership into any agency), F-02 (forged audit rows), F-03 (anon-executable SECURITY DEFINER functions), F-06 (cross-agency profile/email read) | Sprint 5 close not done; verified on prod 2026-10-28 | **Critical** |
| `src/proxy.ts` session refresh never committed | AD-030, FR-AUT-03 | High |
| `audit_log` `tenant_insert` RLS lets members insert audit rows (AD-020) | Inventory §4 #13 | High |
| Brokers can edit stages, lead sources and merge contacts | Gap analysis §5.0 | Medium |
| Nine core-loop defects (Today, task completion, tz, pagination, import revert…) | Gap analysis §5.0 | Medium |
| Cloud session setup script fails (`npm ci` outside the repo); Docker not started | This session | Medium |
| Vitest covers 2 files; no domain service tests (FR-TST-03 ⚠️) | Inventory §5 | Medium |
| BRD rows claim unbuilt features: FR-OPP-11, SRC-03, TEM-07, CON-10, INQ-05/11, TSK-04, LOC-01/04, PRF-03 | Inventory §4 | Docs |
| Sprint 5 unticked: founder `bg.json` review, BG click-through at 390 px, onboarding dry run, `translateDefaultNamesAction` (Should) | `archive/sprint-5-task-list.md` | Low |
| `pilot-feedback.md` empty: no E3 evidence yet | — | Process |

## Open decisions
AD-040 … AD-045 (Proposed in `docs/sprint-6-implementation-plan.md` §5).

## Next sprint
Sprint 6 — "Make the loop trustworthy": `docs/sprint-6-implementation-plan.md`,
`docs/sprint-6-task-list.md`. Roadmap to the pilot gate: `docs/roadmap.md`.
