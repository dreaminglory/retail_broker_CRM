# CRM Pattern Benchmark — What to Borrow (Patterns, Not Products)

Use this catalogue to find proven solutions for weak loop steps. Borrow the **pattern**
and adapt it to Bulgarian agencies. Never copy text, branding, or proprietary UI.
Treat the "Status" column as a hint only: **verify it in the code**. Used by the `feature-ideas` skill.

Product names are listed for research only. The founding brief forbids
claiming any of them dominates the Bulgarian market without evidence.

## Products worth studying

| Product | Type | Why study it |
|---|---|---|
| **Follow Up Boss** | US real-estate CRM | Main inspiration in the brief: Smart Lists, Action Plans, lead routing, speed-to-lead |
| **BoldTrail (ex-kvCORE)** | US real-estate platform | Behavioural alerts, past-client nurture |
| **onOffice** | German real-estate software | European agency workflow: search profiles ↔ property matching, process manager |
| **Reapit / Alto** | UK estate-agency CRMs | Viewings with feedback chasing, vendor/landlord update reports, offers recording |
| **Pipedrive** | Generic sales CRM | Activity-based selling, "no next activity" warnings, rotting deals |
| **HubSpot** | Generic CRM | Task queues, saved views, required fields on stage change |
| **Close** | Sales CRM | Smart Views, calling-first workflow |
| **Salesforce** | Enterprise CRM | Path guidance per stage, assignment rules, validation rules |
| **Bitrix24** | Generic CRM, common in Eastern Europe | Learn what local agencies tried and why it felt too complex |

## Pattern catalogue

Loop step = which step of the 9-step core loop the pattern strengthens.

| # | Pattern | Seen in | Loop step | Brief / BRD position | Status hint |
|---|---|---|---|---|---|
| B-01 | **Smart Lists**: saved dynamic filters with counts, "work the list to zero" | FUB, Close, HubSpot | 6, 9 | Brief: *core pilot feature*; module `smart-lists` | Gap |
| B-02 | **Daily email digest + due/overdue reminders** | FUB, Pipedrive, HubSpot | 6 | Module `reminders` (AD-042) | Gap |
| B-03 | **Action Plans**: reusable task sequences applied to an opportunity | FUB, BoldTrail | 5, 8 | Brief: committed module (AD-039, "simple action-plan templates") | Gap |
| B-04 | **Lead routing**: round-robin / first-to-claim pond / by source | FUB, Salesforce | 4 | Brief: committed module (AD-039) | Gap |
| B-05 | **Speed-to-lead metric**: time from inquiry to first contact, per broker | FUB | 1→7, 9 | Brief success metric "uncontacted after 1 business day" | Verify |
| B-06 | **Rotting / stale highlighting**: per-stage max days, visual decay | Pipedrive | 9 | Manager exceptions (stale) exist | Partial |
| B-07 | **"No next activity" guard**: prompt for the next action whenever a task is completed | Pipedrive | 7→8 | North-star metric | Verify |
| B-08 | **Task queue / power hour**: step through due calls one by one, log outcome, next | HubSpot, Close | 6–8 | Broker adoption | Gap |
| B-09 | **Quick outcome sheet (mobile)**: one tap for outcome + next action date presets | FUB mobile, Close | 7–8 | Brief: "record outcome … quickly from phone" | Verify |
| B-10 | **Click-to-call / tel: links + call logging prompt** on return to the app | FUB, Close | 7 | Brief: manual call recording | Verify |
| B-11 | **Buyer/tenant requirement** (budget, area, rooms, type) on an opportunity | onOffice, Reapit | 3 | Brief: *pilot included*; module `requirements` | Gap |
| B-12 | **Requirement ↔ property matching** | onOffice, Reapit | 3, 8 | Brief: *pilot included* (AD-039; needs the light property record) | Gap |
| B-13 | **Viewing records + feedback chasing** | Reapit, Alto | 8 | Brief: viewing as task in pilot; module is V1 | Partial via tasks |
| B-14 | **Lost-reason capture + analysis** | Pipedrive, Salesforce | 8, 9 | Brief: "lost reasons should be preserved" | Verify |
| B-15 | **Stage-change requirements** (e.g. Lost needs a reason; Viewing needs a date) | HubSpot, Salesforce | 8 | Data quality | Verify |
| B-16 | **Email-to-inquiry / web-form capture** with source tagging | FUB, Pipedrive | 1 | Brief: committed module (AD-039, portal/email lead intake) | Gap |
| B-17 | **Past-client re-engagement list** (closed X months ago, no touch) | FUB, BoldTrail | 6 | Brief Smart List example | Gap (via B-01) |
| B-18 | **Broker offboarding reassignment wizard** | Salesforce, HubSpot | 4, 9 | Brief: "history disappears when a broker leaves" | Verify |
| B-19 | **Opportunity board (kanban)** with drag-to-stage | Pipedrive | 8, 9 | Brief: "pipeline table or board" | Verify |
| B-20 | **Weekly owner report email** (new, won/lost, overdue, by source) | Pipedrive Insights, FUB | 9 | Owner persona; payment justification | Gap |
| B-21 | **Bulk actions** (assign, add task, change stage) from lists | All | 4, 9 | Manager efficiency post-import | Verify |
| B-22 | **Usage telemetry for the pilot** (weekly active brokers, next-action coverage) | Internal | — | Brief Pilot Success Criteria, PostHog "later" | Gap |

## Excluded patterns (non-goals; do not propose)

AI lead scoring or assistants, WhatsApp/Viber two-way inbox, a public property portal,
marketing drip automation, commission accounting, e-signatures, document generation,
AML/KYC document handling, transaction management, MLS-like marketplace, multi-country
expansion, native mobile apps.

Portal **syndication** is no longer excluded: it is a committed module (AD-039). More
patterns found in the 2026-10-28 market research (proposed IDs N-01…N-12, not yet
numbered here) are in §7 of `docs/research/crm-competitive-gap-analysis.md`.

## Bulgarian adaptation checklist

- Terminology follows the glossary signed off in Sprint 5 (AD-038).
- Lead sources include local portals (e.g. imot.bg, homes.bg, OLX.bg). These are
  configured as names only; integrations are post-pilot.
- Phone-first culture: calls and Viber are the main channels. Optimise logging calls
  over logging email.
- Working week and holidays: Sofia timezone, and Bulgarian public holidays for reminders and digests.
- GDPR: lawful basis and retention apply to any new personal-data table or export.
