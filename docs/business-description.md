# BrokerCRM — Product and Business Brief

The founding brief: who we serve, what problem we solve, what the pilot must prove and how
we will sell it. Use it to decide **what to build next**. For what is built, see `BRD.md`.
For how it works, see `domain-model.md` and `decisions-log.md`.

Unless marked as validated, market claims, customer behaviour, pricing and targets here are
hypotheses to test with Bulgarian agencies. Record evidence in `pilot-feedback.md`.

## Executive Summary

BrokerCRM is a Bulgarian-first agency system for residential real estate agencies:
properties, buyers, portals, deals and daily follow-up in one place (AD-039). Its edge is
follow-up discipline. Every active opportunity has an owner, a next action and a complete
history, so brokers lose fewer opportunities and managers can run the agency from reliable
operational data.

It is not a public property portal, MLS, accounting system, transaction platform or
messaging app. Everything is organised around one repeatable operating loop:

> Capture the inquiry, identify the contact, assign the opportunity, schedule the next action,
> record the outcome, advance the stage, and expose anything at risk of being forgotten.

The property side feeds that loop: the agency's properties and mandates, published to the
portals, matched against buyers' requirements, through viewings and offers to a won or lost
deal.

The first commercial goal is to prove that Bulgarian agencies will replace their current
listing tool or spreadsheets with BrokerCRM, pay for it, and keep using it after the pilot.

## Initial Target Customer

Beachhead hypothesis:

> A Bulgarian residential sales agency with 2–30 active brokers, one hands-on owner or sales
> manager, leads from portals, referrals, websites, phone calls and social channels, and a
> current workflow of a listing tool, Excel, personal phones, notebooks, Viber or WhatsApp.

The segment was widened from 5–15 brokers (AD-039). Eurostat counts about 3,300 Bulgarian
agencies averaging about 2 people each, and per-broker pricing makes small agencies
economical. A two-person office and a thirty-person multi-team brokerage still differ in
permissions, onboarding, reporting and purchasing: features such as routing, manager
exceptions and team reports must stay useful, or out of the way, at both ends.
Rental-focused agencies, solo brokers, developers, commercial agencies and multi-office
organisations are not the initial design centre. Other Eastern European markets come after
Bulgaria.

## Core Personas

| Persona | Pain | Wants | Likely objections |
|---|---|---|---|
| **Owner / managing director** (economic buyer) | Can't see lead ownership, follow-up quality, pipeline health or workload. Fears losing history when a broker leaves. Can't compare sources. | Fewer forgotten opportunities, accountability without checking every broker, a database the agency owns, proof the software helps. | Brokers won't use it. Setup takes too long. A spreadsheet or generic CRM is cheaper. Reporting may cause team conflict. |
| **Team lead / office manager** (operational champion) | Distributes leads by hand, chases updates, rebuilds status from calls and chats. | One queue for new and at-risk work, fast (re)assignment, exceptions instead of status meetings. | |
| **Broker** (daily user) | Remembers follow-ups across messages, calls and notes. Re-enters data. May see the CRM as surveillance. | Open one screen and know what to do. Record outcomes in seconds on phone or desktop. Personal value, not just reports for management. | |

## Problem Hypothesis

Many Bulgarian residential agencies run on scattered conversations, personal phones,
notebooks, spreadsheets, portal messages and Viber/WhatsApp. As a result:

- New inquiries are lost or left unassigned.
- Follow-up depends on memory.
- Managers can't see which opportunities have no next action.
- Customer history leaves with the broker.
- Contacts, requirements, properties, viewings, offers and outcomes are disconnected.
- Response time, source quality, pipeline progress and lost reasons can't be measured.
- Imported records are duplicated and inconsistent.

The highest-risk assumption is not that a database would be useful, but that **brokers will
consistently use the workflow during a normal working day**.

## Competition

The main competitor is the status quo: personal phones, Viber/WhatsApp/Messenger, Excel or
Google Sheets, paper, portal inboxes and verbal reporting.

Also investigate: generic CRMs (Bitrix24, HubSpot, Zoho, Pipedrive), Bulgarian agency
software, international real estate CRMs (Follow Up Boss, kvCORE, onOffice), and home-made
spreadsheets or low-code tools. Don't claim any product dominates until interviews show it;
find out what agencies tried, why it failed, and what switching would cost.

First findings (2026-10-28, `docs/research/crm-competitive-gap-analysis.md`): Bulgarian
agency software exists and is cheap (OptiEstate, Estate Assistant, EstatePlus,
PropertyManager: €0–32 per broker per month). It leads with property inventory, portal
syndication, buyer matching and inter-agency networks. None of the international real
estate CRMs sells in Bulgaria. All evidence about local products is vendor marketing, so
interviews must still confirm what agencies actually use.

## Product Thesis And Positioning

The product is a full agency system (AD-039). Its value, and its difference from local
agency software, is a disciplined daily workflow on top of the property work.

> Every broker opens the CRM and immediately knows which new inquiries need attention, who to
> call, which follow-ups are overdue, and which opportunities have no next action.

> Every manager can see unassigned work, overdue follow-ups, stale opportunities and workload
> without reconstructing the agency from conversations.

This borrows the Follow Up Boss pattern (people, opportunities, sources, next actions and
history organised around daily work), adapted to Bulgarian workflows. Never copy another
product's interface, branding, copy or implementation.

A Bulgarian UI, property inventory, portal syndication and buyer matching are entry
requirements, not advantages: local tools already offer them. The wedge to test combines:
very fast broker adoption, follow-up discipline no local product proves, Bulgarian real
estate terminology and workflows, reliable import with deduplication and merge history, local
lead-source attribution, mobile-efficient daily work, hands-on onboarding, and multi-party
deals as practised in Bulgaria.

Positioning to test:

> The complete system for Bulgarian residential agencies (properties, buyers, portals and
> deals), built so that no client or opportunity is ever forgotten.

## Product Principles

- The broker must get immediate personal value from the CRM.
- Daily work is driven by next actions and exceptions, not by browsing records.
- Contacts are durable people; opportunities represent commercial intent and own the stage.
- Properties are a full module, but never at the expense of follow-up: every property,
  requirement, viewing and offer connects back to an owned opportunity with a next action.
- Managers manage exceptions; the system is not a surveillance feed.
- Imports and onboarding are part of the product experience.
- Business history belongs to the agency, subject to permissions and law.
- Viber, WhatsApp and other channels feed the CRM; they don't dictate its interface. The
  pilot records that a conversation happened; integrations come later where APIs, cost and
  law allow.
- Automation and AI support a proven workflow; they don't compensate for an unclear one.
- The interface is clean, dense and operational: scan, call, update, move on. Mobile forms
  must not silently lose work on a weak connection.

## Pilot MVP: Fastest Sellable Version

One complete operational loop, not a miniature of every future module.

### Included

- Agency workspace, invitations and memberships
- Roles: owner, manager, broker
- Contacts and contact methods
- Duplicate suggestions, controlled merge and merge history
- Manual inquiry creation
- CSV import with mapping, validation and error reporting
- Opportunities with type, owner, stage, source, temperature and next action
- Multiple opportunities per contact
- Tasks and reminders
- Notes and manually recorded calls/messages
- Contact and opportunity timelines
- Saved operational filters and Smart Lists
- Broker Today screen
- Minimal manager exception report
- Light property record (address or area, type, rooms, area in m², price, owner contacts),
  linked to opportunities
- Buyer/tenant requirements, matched against the agency's properties
- Bulgarian interface
- Responsive desktop and mobile web

The paid pilot starts when these ship, together with fixes for the known core-loop defects
(AD-039). A viewing can be a task plus a property link in the pilot. The other committed
modules (mandates, viewings, offers, syndication, lead intake, routing and the rest) follow
in roadmap order, during or after the pilot.

Smart Lists should cover at least: new inquiries not contacted, unassigned opportunities,
no next action, due today, overdue, hot with no recent activity, sellers needing an update,
viewings needing follow-up, offers awaiting response, past clients to re-engage, and
opportunities by source or campaign.

### Pilot Acceptance Criteria

The pilot is operationally complete when:

- An inquiry can be created manually or imported without losing its original source.
- The system suggests likely duplicate contacts before creating another record.
- An inquiry can be matched to a contact and create or join an opportunity.
- An opportunity can be assigned to a broker with a stage and next action.
- A broker sees new, due and overdue work on the Today screen.
- A broker records an outcome and schedules the next action quickly from phone or desktop.
- A contact can hold more than one concurrent opportunity.
- A property can be recorded and linked to an opportunity.
- A buyer or tenant requirement can be matched against the agency's properties, and the
  broker sees the matches.
- A manager sees unassigned inquiries, overdue tasks and opportunities without a next action.
- Ownership, stage, assignment and merge changes are traceable.
- Automated tests prove one agency can't access another agency's records.
- Failed or repeated imports don't silently create duplicates.

## Committed Modules (AD-039)

BrokerCRM is committed to becoming a full agency system. These modules will be built.
Pilot behaviour decides their **order and details**, not whether they are built:

- Structured property inventory and mandates (listings with exclusivity and expiry)
- Buyer/tenant requirements and matching between requirements and properties
- Viewings with feedback
- Offers and negotiation records
- Portal syndication (publishing the agency's properties to Bulgarian portals)
- Portal and email lead intake, plus a website form
- Lead assignment and routing rules, and a shared lead pool
- Reminders and a daily digest
- Simple action-plan templates
- Saved lists (Smart Lists)
- Expanded manager reporting (speed to lead, conversion, source, productivity)
- GDPR tools (legal basis, export, erasure, retention)
- Installable mobile web app (PWA)

The suggested order and evidence for each module are in §5 of
`docs/research/crm-competitive-gap-analysis.md`.

Still candidates, prioritised from observed pilot behaviour:

- Email and calendar sync
- Basic API and webhooks
- Multi-touch source attribution

### Future data model direction

When these modules are built, extend `domain-model.md` following these rules, already
agreed:

- A **Requirement** describes a search; it is not a Property.
- A **Property** is the physical asset; a **Listing** is a time-bound mandate or marketed
  offering for it.
- A property can have several parties and ownership history; never a single `owner_contact_id`.
- An opportunity can relate to several candidate properties (candidate, viewed, offered,
  rejected, selected); a won deal may identify one.
- **Viewings** and **offers** involve several participants and keep their own outcomes and history.
- A Bulgarian agency may act on more than one side of a deal; never force a single buyer or
  seller column.
- Timeline stays a unified read view; Task, Viewing and Offer keep their own tables.
- Imports and integrations are idempotent wherever an external reference exists.
- A later transaction module may create a Transaction from a won opportunity.
- Privacy records (purpose, legal basis, requests, retention) will be needed before
  integrations or AML features.

## Explicitly Not In The Pilot

These stay non-goals after the pilot too, unless a new AD changes them (AD-039).

- Native iOS or Android apps
- Full WhatsApp or Viber two-way inbox
- A public property portal (portal *syndication* is a committed module, AD-039)
- Complex marketing automation
- Commission accounting
- E-signatures and document generation
- AI lead scoring or AI-generated workflows
- Advanced transaction management
- AML/KYC document handling
- MLS-like marketplace
- Multi-country or multi-language expansion

## Platform Requirements Still Open

Already in place: tenant isolation, membership-based roles, RLS with automated isolation
tests, versioned migrations, seeded test environments and idempotent imports. Still to do
before or during the pilot:

- Monitored background jobs (reminders, notifications, retention): pg_cron + Edge Functions first
- Transactional email (Resend, AD-025), error monitoring (Sentry), product analytics (PostHog)
- Data export, deletion and retention workflows
- Backup and restore expectations, with a tested restore
- Rate limiting and abuse protection
- Private file storage with signed access, needed for property photos and mandate copies
- Integration adapters that isolate portal and messaging providers, and agreements with the
  portals for automated publishing (imot.bg terms and pricing are not public)
- EEA hosting and documented subprocessors, subject to legal review
- Good performance on ordinary broker phones and office computers

## Security, Privacy And Compliance

GDPR is an operating model, not a checkbox. Subject to legal review, the agency is
controller for its customer data and we are primarily processor; we are controller for our
own billing, account, security and product data.

Product and company processes must cover: purpose and legal basis (consent is not always
the right basis), data-processing agreements and subprocessors, least-privilege access,
access/correction/export/restriction/erasure requests, retention with deletion vs
anonymisation, portability when an agency leaves, access and security logging, incident
response and breach notification, and secure handling of imports and exports.

Real estate intermediaries may have Bulgarian and EU anti-money-laundering obligations.
AML/KYC could become a premium area, but it brings sensitive identity data and significant
legal risk. It is a discovery topic, to be designed with qualified counsel.

## Market Validation Plan

1. Interview 10–15 owners or managers and 15–25 brokers.
2. Examine anonymised spreadsheets, lead exports and recent lost-opportunity examples.
3. Observe brokers during an ordinary working day, including on mobile.
4. Map how inquiries arrive, how ownership is decided and where follow-up breaks.
5. Run a concierge pilot with manual import and configuration.
6. Ask for payment or a signed paid-pilot commitment before the pilot starts.

Interview counts are targets, not proof. Evidence means observed behaviour and willingness
to pay, not positive opinions.

## Critical Assumptions And Experiments

| Assumption | Risk | How To Test |
| --- | --- | --- |
| Agencies lose meaningful opportunities because follow-up is missed | High | Review recent inquiries and lost cases with owners |
| Brokers will consistently record outcomes and next actions | Critical | Two-week concierge workflow test |
| Owners value exception visibility enough to pay monthly | High | Request paid pilot commitments |
| Agencies accept agency ownership of shared customer history | High | Interview owners and brokers separately |
| CSV import is enough for initial onboarding | Medium | Inspect real exports and spreadsheets |
| Agencies will switch from their current listing tool to BrokerCRM | Critical | Ask pilot candidates what they use, what it costs, and what would make them switch; track migrations |
| Bulgarian portals allow affordable automated publishing and lead intake | High | Contact imot.bg, homes.bg, OLX and alo.bg (alo.bg publishes an open import spec) |
| Responsive web is adequate for field use | Medium | Observe brokers on real devices and weak connections |
| One pipeline is understandable across the segment | Medium | Test with buyer and seller cases |
| Setup and support can be delivered economically | High | Track onboarding and weekly support time per agency |
| A real estate-specific workflow beats a configured generic CRM | High | Interview agencies that tried generic CRMs |

## Go-To-Market Starting Point

Target 3–5 paid pilot agencies that fit the beachhead profile:

- Import and clean their existing data with them, including properties from their current
  listing tool or spreadsheets.
- Configure sources, stages, permissions and Smart Lists.
- Train one daily habit: open Today and clear due work.
- Meet the owner and brokers weekly during the pilot.
- Track usage, missing workflow steps, support effort and outcomes.
- No custom development for one agency unless the need repeats across the segment.

## Pricing And Packaging Hypotheses

Not validated. Initial tests:

- Subscription: **EUR 20 per broker per month, all modules included** (AD-039). This replaces
  the earlier hypothesis of EUR 99–249 per agency plus EUR 15–25 per extra user. Local anchors
  (2026-10-28): free tiers, about EUR 11–13 per user (Estate Assistant), EUR 15–32 per broker
  (OptiEstate, website and portals included).
- Setup, import and onboarding: EUR 150–500 one-time, still a hypothesis to test. The
  alternative is free migration as a sales tool, as CRM REBS, ASARI and Alto offer.
- Paid pilot: fixed onboarding fee plus a limited pilot subscription

Validation requires an accepted offer, payment or signed commitment, not interview answers.
Track: acquisition cost and founder sales time, import and onboarding hours, monthly support
time per agency, infrastructure and communication costs, gross margin by package, retention
and expansion.

## Pilot Success Criteria

North-star metric:

> Percentage of active opportunities with a completed or scheduled next action inside the
> expected follow-up window.

Supporting measures (targets are hypotheses to calibrate):

- At least 80% of invited brokers active weekly
- At least 90% of active opportunities have an owner and next action
- Fewer new inquiries uncontacted after one business day
- Fewer overdue follow-ups
- Broker retention after 4, 8 and 12 weeks
- Time to import and activate an agency
- Weekly support time per agency
- Share of pilot agencies converting to a paid subscription
- Stage progression (lead → qualified → viewing → offer → won) where data allows

Logins don't validate the product. Repeated use of the loop, an improved outcome and
continued payment do.

## Key Risks And Mitigations

| Risk | Description | Mitigation |
|---|---|---|
| Adoption | Brokers resist data entry or see surveillance | Make Today and next-action updates extremely fast; involve brokers in design; frame reporting as protecting opportunities |
| Scope | The committed modules (AD-039) dilute the follow-up edge or delay the pilot; messaging, transactions, accounting or AI creep in | Build in roadmap order with pilot evidence setting the order; start the pilot once light properties and matching ship; anything outside the committed modules still needs pilot evidence and a new AD |
| Data quality | Imports with duplicates, inconsistent phones, missing sources, conflicting ownership | Mapping, validation, deduplication, merge history and onboarding as first-class features |
| Trust and ownership | Owners want continuity; brokers want control of relationships | Explain the agency-wide visibility policy (AD-001) before onboarding |
| Integration | Portals and messaging providers lack stable APIs or cost too much | Validate access separately; keep providers behind adapters |
| Security and compliance | Cross-agency exposure or mishandled personal data could be fatal | Tenant isolation, RLS, automated authorisation tests, audit trail, legal review |
| Support economics | Hands-on onboarding wins pilots but doesn't scale | Measure support hours, standardise onboarding, automate repeated steps |

## Outcome-Based Roadmap

Phases 1–3 build the committed full agency system (AD-039). Pilot evidence sets the order
and details of the modules inside them, not whether they are built. Phase 4 still needs
evidence and a new AD.

0. **Discovery and prototype:** target customer, daily loop, willingness to pay and data relationships confirmed.
1. **Paid pilot CRM:** core-loop defects fixed, reminders, light property records, requirements and matching. Brokers consistently manage ownership and next actions; managers see exceptions.
2. **Real estate workflow depth:** mandates, viewings, offers, portal syndication and portal/email lead intake improve conversion without slowing daily use.
3. **Automation and reporting:** routing and lead pool, action plans, Smart Lists, reports, GDPR tools and the PWA reduce manual work.
4. **Brokerage operating platform (vision, not committed):** transactions, commissions, documents, compliance, client portals, selected AI, then other Eastern European markets.

## Open Decisions

- City coverage of the beachhead
- Whether stages differ by opportunity type (buyer, seller, landlord, tenant)
- Required portal import and publishing formats, and portal agreements (imot.bg first)
- Whether a minimal viewing record is needed in the pilot
- Reminder timing beyond the AD-025 defaults
- Offline draft and retry behaviour for mobile forms
- Onboarding fee vs free migration
- Hosting region, retention periods and subprocessors
- The property ↔ requirement ↔ opportunity data model (design session before the sprint
  that builds properties)

Resolved: record visibility is agency-wide (AD-001); all four opportunity types from the
start (AD-009); duplicate matching and archive-loser merge (AD-015, AD-017); notifications
are email-only for the pilot (AD-025); full agency system with committed modules, segment of
2–30 brokers, Bulgaria first, and a pricing hypothesis of EUR 20 per broker (AD-039).

## Long-Term Vision

Build the complete agency system Bulgarian agencies run on (properties, buyers, portals,
deals) with a daily broker workflow that is more reliable than any alternative: every inquiry
handled, every opportunity owned, every active opportunity with a next action, every
important outcome in the agency's history. Then expand into communication capture,
transactions, commissions, compliance, client portals and carefully chosen AI, and later
into similar Central and Eastern European markets.

> Do not build a smaller copy of a famous CRM. Build the operating system that a Bulgarian
> brokerage will pay for, use every day, and be unwilling to
> return to working without.
