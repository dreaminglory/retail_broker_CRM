# BrokerCRM — Product and Business Brief

The founding brief: who we serve, what problem we solve, what the pilot must prove and how
we will sell it. Use it to decide **what to build next**. For what is built, see `BRD.md`.
For how it works, see `domain-model.md` and `decisions-log.md`.

Unless marked as validated, market claims, customer behaviour, pricing and targets here are
hypotheses to test with Bulgarian agencies. Record evidence in `pilot-feedback.md`.

## Executive Summary

BrokerCRM is a Bulgarian-first CRM for residential real estate agencies. It ensures every
active opportunity has an owner, a next action and a complete history, so brokers lose fewer
opportunities and managers can run the agency from reliable operational data.

It is not a property portal, MLS, accounting system, transaction platform or messaging app.
It focuses on one repeatable operating loop:

> Capture the inquiry, identify the contact, assign the opportunity, schedule the next action,
> record the outcome, advance the stage, and expose anything at risk of being forgotten.

The first commercial goal is to prove that a narrowly defined Bulgarian brokerage will pay
for this workflow and keep using it after the pilot.

## Initial Target Customer

Beachhead hypothesis:

> A Bulgarian residential sales agency with 5–15 active brokers, one hands-on owner or sales
> manager, leads from portals, referrals, websites, phone calls and social channels, and a
> current workflow of Excel, personal phones, notebooks, Viber or WhatsApp.

A three-person founder-led office and a thirty-person multi-team brokerage differ in
permissions, onboarding, reporting and purchasing, so the segment is deliberately narrow.
Rental-focused agencies, solo brokers, developers, commercial agencies and multi-office
organisations are not the initial design centre.

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

## Product Thesis And Positioning

The value is a disciplined daily workflow, not a large feature list.

> Every broker opens the CRM and immediately knows which new inquiries need attention, who to
> call, which follow-ups are overdue, and which opportunities have no next action.

> Every manager can see unassigned work, overdue follow-ups, stale opportunities and workload
> without reconstructing the agency from conversations.

This borrows the Follow Up Boss pattern (people, opportunities, sources, next actions and
history organised around daily work), adapted to Bulgarian workflows. Never copy another
product's interface, branding, copy or implementation.

A Bulgarian UI is an entry requirement, not an advantage. The wedge to test combines: very
fast broker adoption, Bulgarian real estate terminology and workflows, reliable import with
deduplication and merge history, local lead-source attribution, mobile-efficient daily work,
hands-on onboarding, and multi-party deals as practised in Bulgaria.

Positioning to test:

> The easiest way for a Bulgarian residential agency to ensure that no active opportunity is
> unowned or forgotten.

## Product Principles

- The broker must get immediate personal value from the CRM.
- Daily work is driven by next actions and exceptions, not by browsing records.
- Contacts are durable people; opportunities represent commercial intent and own the stage.
- Properties matter, but the product is not property-first at the expense of follow-up.
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
- Lightweight buyer/tenant requirement
- Optional lightweight property or listing reference on an opportunity
- Bulgarian interface
- Responsive desktop and mobile web

A viewing can be a task plus a property reference in the pilot. Full property inventory,
viewings, offers and transaction management wait until usage proves the need.

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
- A manager sees unassigned inquiries, overdue tasks and opportunities without a next action.
- Ownership, stage, assignment and merge changes are traceable.
- Automated tests prove one agency can't access another agency's records.
- Failed or repeated imports don't silently create duplicates.

## Candidate V1 Features After Pilot Validation

Prioritise from observed pilot behaviour, not because established CRMs have them:

- Structured property inventory, listings and listing history
- Dedicated viewings and offers/negotiation records
- Simple action-plan templates
- Email and calendar sync
- Lead assignment and routing rules
- Expanded manager reporting (conversion, source, productivity)
- Property matching between requirements and listings
- Basic API and webhooks
- Multi-touch source attribution

### Future data model direction

When these arrive, extend `domain-model.md` following these rules, already agreed:

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

- Native iOS or Android apps
- Full WhatsApp or Viber two-way inbox
- Listing syndication or a public property portal
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
- Private file storage with signed access, once attachments exist
- Integration adapters that isolate portal and messaging providers
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
6. Ask for payment or a signed paid-pilot commitment before expanding scope.

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
| Local portal integrations can wait | High | Map where qualified inquiries originate |
| Responsive web is adequate for field use | Medium | Observe brokers on real devices and weak connections |
| One pipeline is understandable across the segment | Medium | Test with buyer and seller cases |
| Setup and support can be delivered economically | High | Track onboarding and weekly support time per agency |
| A real estate-specific workflow beats a configured generic CRM | High | Interview agencies that tried generic CRMs |

## Go-To-Market Starting Point

Target 3–5 paid pilot agencies that fit the beachhead profile:

- Import and clean their existing data with them.
- Configure sources, stages, permissions and Smart Lists.
- Train one daily habit: open Today and clear due work.
- Meet the owner and brokers weekly during the pilot.
- Track usage, missing workflow steps, support effort and outcomes.
- No custom development for one agency unless the need repeats across the segment.

## Pricing And Packaging Hypotheses

Not validated. Initial tests:

- Agency subscription: EUR 99–249 per month depending on users and capabilities
- Additional users: EUR 15–25 per user per month
- Setup, import and onboarding: EUR 150–500 one-time
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
| Scope | Expanding into portals, messaging, transactions, accounting or AI before the loop is proven | Require pilot evidence before any major module |
| Data quality | Imports with duplicates, inconsistent phones, missing sources, conflicting ownership | Mapping, validation, deduplication, merge history and onboarding as first-class features |
| Trust and ownership | Owners want continuity; brokers want control of relationships | Explain the agency-wide visibility policy (AD-001) before onboarding |
| Integration | Portals and messaging providers lack stable APIs or cost too much | Validate access separately; keep providers behind adapters |
| Security and compliance | Cross-agency exposure or mishandled personal data could be fatal | Tenant isolation, RLS, automated authorisation tests, audit trail, legal review |
| Support economics | Hands-on onboarding wins pilots but doesn't scale | Measure support hours, standardise onboarding, automate repeated steps |

## Outcome-Based Roadmap

Each phase starts only after the previous outcome is demonstrated.

0. **Discovery and prototype:** target customer, daily loop, willingness to pay and data relationships confirmed.
1. **Paid pilot CRM:** brokers consistently manage ownership and next actions; managers see exceptions.
2. **Real estate workflow depth:** property, listing, viewing, offer and matching improve conversion without slowing daily use.
3. **Automation and integrations:** action plans, routing, email/calendar sync, portals and approved channels reduce manual work.
4. **Brokerage operating platform:** transactions, reporting, commissions, documents, compliance, client portals and selected AI deepen retention.

## Open Decisions

- Final beachhead segment and city coverage
- Whether stages differ by opportunity type (buyer, seller, landlord, tenant)
- Required portal import formats
- Whether a minimal viewing record is needed in the pilot
- Reminder timing beyond the AD-025 defaults
- Offline draft and retry behaviour for mobile forms
- Pricing and packaging
- Hosting region, retention periods and subprocessors
- What evidence is needed before adding property inventory or integrations

Resolved: record visibility is agency-wide (AD-001); all four opportunity types from the
start (AD-009); duplicate matching and archive-loser merge (AD-015, AD-017); notifications
are email-only for the pilot (AD-025).

## Long-Term Vision

First make the daily broker workflow reliable: every inquiry handled, every opportunity
owned, every active opportunity with a next action, every important outcome in the agency's
history. Then expand into listings, matching, portal distribution, communication capture,
marketing automation, transactions, commissions, compliance, client portals and carefully
chosen AI, and later into similar Central and Eastern European markets.

> Do not build a smaller copy of a famous CRM. Build the smallest operating system that a
> narrowly defined Bulgarian brokerage will pay for, use every day, and be unwilling to
> return to working without.
