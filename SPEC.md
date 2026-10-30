# Spec: BrokerCRM

> Last updated 2026-10-30. The product spec: what we build, in which order, and where it stands.
> Module specs: `spec/<module-id>.md`. Active plan: `tasks/plan.md` + `tasks/todo.md`.

## 1. Objective

A Bulgarian-first CRM for residential sales agencies (2–30 brokers): a full agency system
with follow-up discipline as its edge (AD-039). Personas and pilot scope:
`docs/research/business-description.md`.

- **Core loop:** inquiry arrives → contact matched or created → opportunity → broker assigned
  → next action scheduled → shown on Today → outcome recorded → next action or stage change →
  manager sees exceptions. Property side: property and mandate → portals → buyer requirement →
  matches → viewing → offer → won or lost.
- **North star:** share of active opportunities with a next action inside the follow-up window.
- **Success:** a paid pilot that meets the brief's *Pilot Success Criteria*.
- **Non-goals:** native apps, WhatsApp/Viber inbox, commission accounting, AI lead scoring,
  marketing automation, document generation and e-signatures, transaction management, AML,
  MLS-like marketplace, multi-country.

## 2. Pilot gate

The paid pilot starts when every row is Done. Recruiting can start once `properties` is in progress.

| Gate item | Module | Status |
|---|---|---|
| Core-loop defects fixed | `trustworthy-loop` | Done |
| Reminders and daily digest | `reminders` | Next |
| Light property record linked to opportunities | `properties` | Planned |
| Buyer/tenant requirements | `requirements` | Planned |
| Inquiry can create **or join** an opportunity | `conversion-join` | Planned |
| Requirement ↔ property matching | `matching` | Planned |
| Smart Lists | `smart-lists` | Planned |
| Onboarding dry run with a real agency export | `go-live` | Planned |

## 3. Capability map

Build order, top to bottom. **In progress** = has `tasks/plan.md`. **Later** = after the pilot
starts; pilot evidence sets the order.

| Module | Scope | Depends on | Status |
|---|---|---|---|
| `trustworthy-loop` | International phones (AD-041), inquiry edit and reassign, pagers and contact picker at volume, import revert and i18n fixes, service tests in CI | — | Done |
| `reminders` | Daily digest and inquiry-assigned email via Resend, tested with Mailpit (AD-042) | `trustworthy-loop` | Next |
| `properties` | Light property record and parties, linked to opportunities (candidate / viewed / offered / rejected / selected). Starts with a data-model AD. Seed and E2E grow with it | `trustworthy-loop` | Planned |
| `requirements` | Buyer requirement on an opportunity: budget, areas, types, rooms, m² | `trustworthy-loop` | Planned |
| `phone-loop` | `tel:`/`viber://`/`wa.me`/`mailto:` links, post-call prompt (answered? → outcome + next action), `inquiries.contacted_at` | `trustworthy-loop` | Planned |
| `conversion-join` | Join an existing opportunity when converting an inquiry; resend invitation | `trustworthy-loop` | Planned |
| `matching` | Two-way requirement ↔ property matches with a score and an "already offered" state | `properties`, `requirements` | Planned |
| `smart-lists` | Saved filters with counts, worked through one by one | `matching` | Planned |
| `property-import` | Property CSV import on the existing pipeline (AD-034) | `properties` | Planned |
| `go-live` | Domain, Resend domain, hosting, crons, prod env; E2E and coverage gate in CI; founder review of `bg.json`; dry run | `reminders`, `smart-lists`, `property-import` | Planned |
| `lead-intake` | Portal inquiry emails (homes.bg, imot.bg, alo.bg) and a website form → inquiries; parser fixtures per portal | pilot | Later |
| `routing` | Round robin, on-duty broker, escalation, shared pool | `lead-intake` | Later |
| `gdpr` | Legal basis, export, erasure, retention purge | pilot | Later |
| `pwa` | Installable app, mobile search, then push | pilot | Later |
| `mandates`, `viewings`, `offers`, `syndication`, `action-plans`, `reports` | Remaining committed modules (AD-039) | pilot | Later |

**Founder decisions before `properties`:** the portal syndication approach (alo.bg first; an
imot.bg call) and pricing (€20 per broker vs a flat fee per agency).

## 4. Ideas backlog

Candidates from `/feature-ideas`, not yet on the map. Promote one by adding a map row.

| Idea | Evidence | Score | Notes |
|---|---|---|---|

## 5. Current state

**Built:** tenancy, roles, invitations, team; contacts with duplicate warning and merge;
manual inquiries and conversion; opportunities with custom stages, participants, close and
reopen; tasks with the next-action trigger, Today (Mine/Agency) and Exceptions; notes,
timeline and audit triggers; ⌘K search (desktop); CSV import with revert; BG/EN, agency
timezone, EUR; local QA stack and E2E smoke; international and landline phones; inquiry edit
and reassign; pagers and agency-wide contact pickers; atomic conversion and merge (AD-050); CI
runs typecheck, lint, Vitest, pgTAP and the service integration suites.

**Known gaps:** resend invitation (`conversion-join`); five services have no tests yet
(FR-TST-03). BRD rows marked ⚠️ say where each is handled.

**Production:** Supabase `emflwmivjachbnaqumnn` (eu-west-2); migration history equals the repo
(AD-040), changes go through migrations only. `main` now holds migrations through
`20261102000009`: confirm and apply them with `/ship` before deploying this code, which calls the
AD-050 RPCs. Leaked-password protection is still off
(founder). No app hosting yet.

**Go-live prerequisites (founder):** a domain verified in Resend, hosting that allows two daily
crons (or the pg_cron fallback, AD-042), production env vars.

**Open decisions:** Smart Lists are in the gate, though AD-039 named only properties, requirements and matching (founder
to confirm).

## 6. Pilot evidence

The strongest input for `/feature-ideas` (E3). One line per observation: what happened, not the fix.

| Date | Agency | Role | Observation | Loop step | How often | Severity |
|---|---|---|---|---|---|---|

## 7. Risks

- The property data model is the biggest design risk: a mistake costs every later module.
- Portal access (imot.bg pricing, OLX lead API) is unknown.
- Prod drifts again if anything bypasses migrations (AD-040).
- No pilot evidence yet: re-rank the Later modules once §6 has entries.
