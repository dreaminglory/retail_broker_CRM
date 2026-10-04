# [Working Name] - Real Estate CRM for Bulgarian Brokerages

## Document Purpose And Status

This document is the founding product and business brief for the company. It aligns founders, customer-development work, product design, software architecture, and AI-assisted development around the same direction.

It defines:

- The customer and problem we intend to serve
- The product promise and daily operating workflow
- The fastest sellable pilot
- The core CRM foundations and domain model
- Initial technical, privacy, and operational principles
- Go-to-market, pricing, and validation hypotheses
- Success measures, risks, and open decisions

It is not a complete business plan, legal opinion, UI specification, database schema, API contract, or developer implementation specification. Those should be created as separate documents after customer discovery and pilot validation.

Unless explicitly marked as validated, market claims, customer behavior, pricing, and success targets in this document are hypotheses to test with Bulgarian agencies.

## Executive Summary

[Working Name] is a Bulgarian-first CRM for residential real estate agencies. It ensures every active opportunity has an owner, a next action, and a complete history so brokers lose fewer opportunities and managers can run the agency from reliable operational data.

The first product will not attempt to be a property portal, MLS, accounting system, transaction platform, or messaging application. It will focus on one repeatable operating loop:

> Capture the inquiry, identify the contact, assign the opportunity, schedule the next action, record the outcome, advance the stage, and expose anything at risk of being forgotten.

The initial commercial goal is to prove that a narrowly defined Bulgarian brokerage will pay for this workflow and continue using it after the pilot.

## One-Line Description

A Bulgarian-first CRM for residential brokerages that ensures every opportunity has an owner, a next action, and a complete history.

The product does not try to look like Viber, WhatsApp, or Messenger. Brokers use those tools because they lack a professional operating system. The CRM should provide structure, ownership, reminders, history, and team visibility while allowing communication from external channels to be recorded.

## Initial Target Customer

The initial beachhead customer is a hypothesis:

> A Bulgarian residential sales agency with 5-15 active brokers, one hands-on owner or sales manager, leads arriving from portals, referrals, websites, phone calls, and social channels, and an existing workflow based on Excel, personal phones, notebooks, Viber, or WhatsApp.

This segment is intentionally narrower than "agencies with 3-30 brokers." A three-person founder-led office and a thirty-person multi-team brokerage have materially different permissions, onboarding, reporting, and purchasing needs.

The target may change after interviews and pilots. Rental-focused agencies, solo brokers, developers, commercial agencies, and multi-office organizations are not the initial design center.

## Core Personas

### Economic Buyer: Owner Or Managing Director

Pain:

- Cannot reliably see lead ownership, follow-up quality, pipeline health, or broker workload
- Fears losing customer history when a broker leaves
- Cannot compare lead sources or identify missed revenue

Desired result:

- Fewer forgotten opportunities
- Clear accountability without manually checking every broker
- A business database owned by the agency
- Evidence that the software improves conversion or operational control

Likely objections:

- Brokers will not use it
- Setup and migration will take too much time
- A spreadsheet or generic CRM is cheaper
- Reporting may create conflict inside the team

### Operational Champion: Team Lead Or Office Manager

Pain:

- Manually distributes leads and asks brokers for updates
- Reconstructs status from calls, chats, and spreadsheets
- Spends time chasing incomplete records and overdue work

Desired result:

- A single queue for new and at-risk work
- Fast assignment and reassignment
- Exception-based management instead of constant status meetings

### Daily User: Broker

Pain:

- Must remember follow-ups across personal messages, calls, notes, and portal inquiries
- Re-enters information and searches through conversations
- May see management software as surveillance or extra administration

Desired result:

- Open one screen and immediately know what to do next
- Record outcomes in seconds from phone or desktop
- Keep useful client context without duplicating work
- Receive value personally, not only provide reports to management

## Problem Hypothesis

We believe many Bulgarian residential agencies operate through scattered conversations, personal phones, notebooks, spreadsheets, portal messages, and Viber/WhatsApp chats. This may create the following problems:

- New inquiries are lost or left unassigned.
- Follow-up depends on memory instead of a system.
- Managers cannot see which opportunities have no next action.
- Customer history disappears when a broker leaves.
- Contacts, requirements, properties, viewings, offers, and outcomes are disconnected.
- Agencies cannot reliably measure response time, source quality, pipeline progress, or lost reasons.
- Imported records contain duplicates and inconsistent information.

These statements must be validated through interviews, observation, and examination of anonymized agency data. The highest-risk assumption is not that a database would be useful; it is that brokers will consistently use the workflow during a normal working day.

## Current Alternatives And Competition

The primary competitor is the status quo:

- Personal phones and address books
- Viber, WhatsApp, Messenger, and email
- Excel or Google Sheets
- Paper notes and memory
- Portal inboxes
- Verbal reporting and team meetings

Other alternatives to investigate include:

- Generic CRMs such as Bitrix24, HubSpot, Zoho, Pipedrive, and customized systems
- Bulgarian property, listing, or agency-management software
- International real estate CRMs such as Follow Up Boss, kvCORE, onOffice, and Salesforce configurations
- Internally built spreadsheets, Airtable bases, and low-code tools

We should not claim that any named product dominates Bulgarian agencies until customer research proves it. Interviews must establish what agencies have tried, why those attempts failed, and what switching cost exists.

## Product Thesis

The first sellable product should be a focused real estate CRM. Its value is a disciplined daily workflow, not a large feature list.

> Every broker opens the CRM and immediately knows which new inquiries need attention, who to call, which follow-ups are overdue, and which opportunities have no next action.

> Every manager can see unassigned work, overdue follow-ups, stale opportunities, and workload without reconstructing the agency from conversations.

This is the core pattern to borrow from Follow Up Boss: organize people, opportunities, lead sources, follow-up actions, and communication history around clear daily work. We should adapt the pattern to Bulgarian workflows rather than clone another product's interface, branding, copy, or proprietary implementation.

## Positioning And Differentiation Hypotheses

"Bulgarian UI" is an entry requirement, not a durable competitive advantage. The stronger initial wedge should combine:

- Very fast adoption by brokers
- Bulgarian terminology and real estate workflows
- Reliable import, deduplication, and merge history
- Local lead-source capture and attribution
- Mobile-efficient daily work
- Hands-on setup and onboarding
- Multi-party transaction support appropriate to Bulgarian practice
- Later integrations with local portals and communication channels
- Accumulated workflow knowledge from Bulgarian agencies

The positioning to test is:

> The easiest way for a Bulgarian residential agency to ensure that no active opportunity is unowned or forgotten.

## Product Principles

- The broker must receive immediate personal value from using the CRM.
- Daily work should be driven by next actions and exceptions, not by browsing records.
- Contacts are durable people; opportunities represent commercial intent and own the pipeline stage.
- Properties are important records, but the product is not property-first at the expense of follow-up.
- Managers should manage exceptions, not use the system as a surveillance feed.
- Imports and onboarding are part of the product experience.
- Important business history must belong to the agency, subject to permissions and law.
- External communication channels should feed the CRM, not dictate its interface.
- Automation and AI should support a proven workflow, not compensate for an unclear one.

## Design Direction

The application should use the structure and logic of a modern operational CRM:

- Left navigation for primary modules
- A broker "Today" screen for new, due, overdue, and at-risk work
- An inquiry inbox for unhandled inbound items
- Contacts list with search, filters, and saved views
- Contact profile with opportunities and chronological history
- Opportunity profile with owner, stage, participants, source, requirement, next action, and related properties
- Pipeline table or board
- Tasks and reminders
- A minimal manager exception view
- Settings for team membership, permissions, sources, stages, and later automations

The interface should be clean, dense, and operational. Brokers must be able to scan, call, update, and move on quickly. Mobile web forms should preserve drafts or clearly recover from failed submissions so a weak connection does not silently destroy work.

## Follow Up Boss-Inspired CRM Foundations

### 1. Inquiry Inbox

A central work queue for new and unresolved inbound events. Sources may include manual entry, website forms, portal inquiries, referrals, phone calls, email, social campaigns, and later approved messaging integrations.

An inquiry is an incoming event, not the permanent customer record. It should be matched to an existing contact or used to create a new contact and opportunity while preserving original source data.

### 2. People And Opportunities

The contact is the durable person or organization. A contact may be a buyer, seller, landlord, tenant, investor, past client, partner, or several of these over time.

A contact can have multiple concurrent opportunities. For example, the same person may sell an apartment, search for a larger home, and refer another buyer. The primary commercial stage belongs to each opportunity, not to the contact.

The contact may still have non-commercial labels such as active client, past client, partner, or archived.

### 3. Smart Lists

Saved dynamic views tell brokers and managers what requires attention:

- New inquiries not contacted
- Unassigned opportunities
- Opportunities without a next action
- Follow-ups due today
- Overdue follow-ups
- Hot opportunities with no recent activity
- Seller opportunities needing an update
- Viewings requiring follow-up
- Offers awaiting a response
- Past clients to re-engage
- Opportunities from a specific source or campaign

Smart Lists are a core pilot feature because they turn stored data into daily work.

### 4. Stages And Pipelines

Every opportunity has an owner, type, stage, source, and status. A provisional shared pipeline may begin with:

- New
- Attempting contact
- Qualified
- Active
- Viewing
- Offer
- Negotiation
- Won
- Lost
- Nurture

The exact stages must be validated with pilot agencies. Buyer, seller, landlord, and tenant pipelines may later diverge. Stage history and lost reasons should be preserved.

### 5. Next Action And Tasks

Every active opportunity should normally have a clear next action with an owner and due time. Tasks may exist for a contact or agency operation without an opportunity, but the opportunity-level next action is the central operating mechanism.

Simple reusable task sequences can follow after the manual workflow is proven. Complex automation is not required for the first pilot.

### 6. Activity Timeline

The product should present a chronological history of relevant events:

- Inquiries
- Calls and manually recorded messages
- Notes
- Tasks and outcomes
- Stage changes
- Assignments
- Viewings
- Offers
- Imports and merges

The timeline is a unified read experience. It does not require every domain event to be stored in one oversized activity table.

### 7. Team Accountability

Managers initially need exception visibility rather than a large analytics suite:

- New inquiries without an owner
- Uncontacted new opportunities
- Active opportunities without a next action
- Overdue follow-ups
- Stale opportunities
- Workload by broker
- Basic progression and outcome counts

Advanced productivity, conversion, source, and financial reporting should follow validated demand.

### 8. Source Attribution

The original inquiry should retain:

- Source and channel
- Portal or campaign
- External reference
- Original timestamp
- Raw imported reference where appropriate
- First-touch attribution

Later attribution can include additional touches. Source names must be configurable because agency channels differ.

## Pilot MVP: Fastest Sellable Version

The first paid pilot should implement one complete operational loop rather than a miniature version of every future module.

### Included

- Agency workspace
- User invitations and agency membership
- Roles for owner/admin, manager, and broker
- Contacts and contact methods
- Duplicate suggestions, controlled merge, and merge history
- Manual inquiry creation
- CSV import with mapping, validation, and error reporting
- Opportunities with type, owner, stage, source, temperature, and next action
- Multiple opportunities per contact
- Tasks and reminders
- Notes and manually recorded calls/messages
- Contact and opportunity activity timelines
- Saved operational filters and Smart Lists
- Broker "Today" screen
- Minimal manager exception report
- Lightweight buyer/tenant requirement
- Optional lightweight property or listing reference on an opportunity
- Bulgarian interface copy
- Responsive desktop and mobile web experience

In the pilot, a scheduled viewing may be represented through an opportunity task/activity and a property reference. A full property inventory, viewing module, offer workflow, and transaction management system are deferred until usage proves they are necessary.

### Pilot Acceptance Criteria

The pilot is operationally complete when:

- An inquiry can be created manually or imported without losing its original source.
- The system suggests likely duplicate contacts before creating another record.
- An inquiry can be matched to a contact and create or join an opportunity.
- An opportunity can be assigned to a broker with a stage and next action.
- A broker can see new, due, and overdue work on the Today screen.
- A broker can record an outcome and schedule the next action quickly from phone or desktop.
- A contact can hold more than one concurrent opportunity.
- A manager can see unassigned inquiries, overdue tasks, and active opportunities without next actions.
- Important ownership, stage, assignment, and merge changes are traceable.
- Automated tests prove that one agency cannot access another agency's records.
- Failed or repeated imports do not silently create uncontrolled duplicates.

## Candidate V1 Features After Pilot Validation

- Structured property inventory
- Separate listings and listing history
- Dedicated viewing records and workflows
- Offer and negotiation records
- Simple action-plan templates
- Email and calendar sync
- Lead assignment and routing rules
- Expanded manager reporting
- Property matching between requirements and listings
- Basic API and webhooks

These features should be prioritized from observed pilot behavior, not merely because established CRMs contain them.

## Explicitly Not In The Pilot

- Native iOS or Android applications
- Full WhatsApp or Viber two-way inbox
- Listing syndication
- Public property portal
- Complex marketing automation
- Commission accounting
- E-signatures
- AI lead scoring
- AI-generated workflows
- Document generation
- Advanced transaction management
- AML/KYC document handling
- MLS-like marketplace
- Multi-country or multi-language expansion

## Domain Model Direction

The schema must preserve durable relationships without forcing all future features into the first migration.

### Core Entities

- **Agency** - tenant and customer workspace
- **User** - authenticated human identity
- **AgencyMembership** - a user's role, status, invitation, and membership in an agency
- **Contact** - durable person or organization
- **ContactMethod** - phone, email, or external communication identifier
- **PrivacyRecord** - processing purpose, legal basis where required, requests, and retention metadata
- **Inquiry** - original inbound lead event and source payload
- **Opportunity** - commercial pursuit with type, owner, stage, source, status, and value hypothesis
- **OpportunityParticipant** - contact or user participation with a role such as buyer, seller, landlord, tenant, co-owner, representative, or broker
- **Requirement** - criteria for a buyer or tenant search
- **Property** - physical real estate asset
- **PropertyParty** - contact relationship to a property, including ownership or representation where appropriate
- **Listing** - time-bound agency mandate or marketed offering for a property
- **OpportunityProperty** - candidate, viewed, offered, rejected, or selected property/listing relationship
- **Viewing** - scheduled or completed viewing involving an opportunity, property/listing, participants, and outcome
- **Offer** - structured proposal or negotiation event associated with an opportunity and property/listing
- **Task** - owned follow-up action with due time and outcome
- **Activity** - normalized timeline representation or event reference
- **LeadSource** - configurable origin taxonomy
- **SourceAttribution** - original and later source metadata
- **Pipeline/Stage** - configurable opportunity lifecycle
- **ActionPlan** - reusable workflow template introduced after validation
- **MergeHistory** - duplicate resolution and record lineage
- **AuditLog** - security and compliance-sensitive change history

### Relationship And Lifecycle Rules

- Every tenant-owned record is scoped to an agency.
- A user accesses an agency through AgencyMembership, not through a permanent role stored only on User.
- An inquiry is preserved as the original inbound event even after matching or conversion.
- One contact may have many inquiries and many concurrent opportunities.
- The pipeline stage belongs to Opportunity, not Contact.
- One opportunity may have several contacts and brokers with explicit roles.
- A Bulgarian agency may participate on more than one side of a transaction; the model must not force a single buyer or seller column.
- A Requirement describes a search and is not a Property.
- A Property is the physical asset; a Listing is a time-bound commercial or advertising relationship for that asset.
- A property may have several parties and ownership history; it should not rely on one permanent `owner_contact_id`.
- An active opportunity may relate to several candidate properties. A completed transaction may later identify one selected property/listing.
- Viewings and offers may involve multiple participants and must preserve their own outcomes and history.
- Activity is the common timeline view, while domain records such as Task, Viewing, and Offer retain structured storage.
- Imports and integrations must be idempotent where an external reference is available.
- Duplicate merges must be reversible or at minimum fully traceable.
- Cross-agency relationships are prohibited and enforced through database constraints and authorization policies.

### Preliminary Lifecycle

1. An Inquiry arrives from an import, portal, form, phone call, referral, or manual entry.
2. The system suggests an existing Contact or creates a new one.
3. The Inquiry creates or attaches to an Opportunity.
4. The Opportunity receives participants, an owner, type, stage, source, and next action.
5. Brokers record outcomes, tasks, candidate properties, and later viewings or offers.
6. The Opportunity becomes won, lost, or nurture while its full history remains available.
7. A later transaction module may create a formal Transaction record from a won Opportunity.

The detailed ER diagram, cardinalities, indexes, deletion behavior, and PostgreSQL schema belong in a separate technical data-model specification.

## Technical Direction

The technology choices are preliminary but appropriate for a lean, AI-assisted product team:

- **Frontend:** Next.js, React, TypeScript
- **UI:** Tailwind CSS, shadcn/ui, lucide icons
- **Application layer:** Next.js server actions and API routes with business rules isolated in domain/service modules
- **Database:** PostgreSQL
- **Platform:** Supabase for managed PostgreSQL, authentication, storage, row-level security, and selected realtime capabilities
- **Background jobs:** Supabase Cron/pg_cron and Edge Functions initially; evaluate a dedicated workflow service only when retries or long-running orchestration justify it
- **Search:** PostgreSQL full-text and trigram search initially
- **Hosting:** Vercel
- **Payments:** Stripe or another provider appropriate to the operating company
- **Transactional email:** Resend, Postmark, or SendGrid
- **Product analytics:** PostHog
- **Error monitoring:** Sentry
- **AI later:** model APIs for summaries, drafts, extraction, and suggestions after the underlying workflow is proven

Realtime updates are optional, not a requirement for every dashboard. The application should prefer clear, reliable state over unnecessary live complexity.

### Architecture Requirements From Day One

- Tenant isolation anchored by agency_id on tenant-owned data
- AgencyMembership-based authorization and a documented role/permission matrix
- Row-level security plus service-layer authorization for sensitive operations
- Database constraints that prevent cross-tenant references
- Version-controlled migrations and seeded test environments
- Automated tenant-isolation and permission tests
- Idempotency for imports, webhooks, and repeated background work
- A monitored job mechanism for reminders, imports, notifications, and later integrations
- Structured audit and activity histories with distinct purposes
- Secure file storage with private buckets and signed access
- Data export, deletion, and retention workflows
- Backup and restore expectations with recovery tests
- Monitoring, incident handling, rate limiting, and abuse protection
- Integration adapters that isolate portal and communication-provider differences
- EEA hosting preference and documented subprocessors, subject to legal and operational review
- Responsive performance on ordinary broker phones and office computers

Precise recovery objectives, scale targets, service-level expectations, API contracts, deployment topology, and incident procedures belong in the technical architecture specification.

## Security, Privacy, And Compliance Direction

GDPR should be treated as an operating model, not a checkbox.

The expected relationship, subject to legal review, is that the agency acts as controller for its customer data and the software company acts primarily as processor. The company may act as controller for its own billing, account, security, and product-operation data.

The product and company processes should address:

- Purpose and legal basis for processing, without assuming consent is always the correct basis
- Data-processing agreements and subprocessor disclosure
- Least-privilege access and agency-configurable visibility
- Access, correction, export, restriction, and erasure requests
- Retention rules and deletion versus anonymization
- Data portability when an agency leaves
- Access and security-event logging
- Incident-response and breach-notification procedures
- Secure handling of imports, attachments, and exports

Real estate intermediaries may also have Bulgarian and EU anti-money-laundering obligations. AML/KYC support could become a premium product area, but it introduces sensitive identity data, retention requirements, and significant legal and security risk. It is a discovery topic, not a pilot feature, and must be designed with qualified Bulgarian/EU counsel.

## Record Visibility Decision

One unresolved product and policy question is whether records are:

- Agency-visible by default
- Team-visible with manager override
- Private to the broker unless explicitly shared
- Controlled through a hybrid model

This decision affects trust, sales positioning, RLS policies, collaboration, reassignment, exports, and what happens when a broker leaves. It must be resolved through customer interviews before finalizing authorization rules.

## Communication Strategy

Viber and WhatsApp are external communication channels, not the design model for the CRM.

- Brokers currently use personal messaging because they lack a structured system.
- The CRM provides ownership, next actions, history, and team continuity.
- The pilot allows a broker to record that an external conversation happened.
- Later integrations may capture approved metadata or messages where APIs, permissions, cost, and law make sense.
- The product remains a professional CRM interface.

## Market Validation Plan

Before committing to a broad production build:

1. Interview 10-15 owners or managers and 15-25 brokers.
2. Examine anonymized spreadsheets, lead exports, and recent lost-opportunity examples.
3. Observe several brokers during an ordinary working day, including mobile use.
4. Map how inquiries arrive, how ownership is decided, and where follow-up breaks.
5. Prototype the Today, Contact, Opportunity, and Next Action workflow.
6. Run a concierge pilot with manual import and configuration.
7. Ask for payment or a signed paid-pilot commitment before expanding scope.
8. Finalize detailed lifecycle and schema decisions using real customer data.

Interview counts are planning targets, not proof by themselves. Evidence should include observed behavior and willingness to pay, not only positive opinions.

## Critical Assumptions And Experiments

| Assumption | Risk | How To Test |
| --- | --- | --- |
| Agencies lose meaningful opportunities because follow-up is missed | High | Review recent inquiries and lost cases with owners |
| Brokers will consistently record outcomes and next actions | Critical | Two-week concierge workflow test |
| Owners value exception visibility enough to pay monthly | High | Request paid pilot commitments |
| Agencies will accept agency ownership of shared customer history | High | Interview owners and brokers separately |
| CSV import is sufficient for initial onboarding | Medium | Inspect real exports and spreadsheets |
| Local portal integrations can wait | High | Map where qualified inquiries originate |
| Responsive web is adequate for initial field use | Medium | Observe brokers on real devices and weak connections |
| One initial opportunity pipeline is understandable across the target segment | Medium | Test workflows with buyer and seller cases |
| Setup and support can be delivered economically | High | Track onboarding and weekly support time per agency |
| A real estate-specific workflow beats a configured generic CRM | High | Interview agencies that have tried generic CRMs |

## Go-To-Market Starting Point

The initial sales motion should target 3-5 paid pilot agencies that fit the beachhead profile.

- Import and clean their existing data with them.
- Configure sources, stages, permissions, and Smart Lists.
- Train one daily habit: open Today and clear due work.
- Meet the owner and brokers weekly during the pilot.
- Track usage, missing workflow steps, support effort, and operational outcomes.
- Avoid custom development for one agency unless the need repeats across the target segment.

Hands-on onboarding is part of the early offer. It reduces adoption risk and teaches the product team how real agency data and workflows behave.

## Pricing And Packaging Hypotheses

Pricing is not validated. Initial tests may include:

- Agency subscription: EUR 99-249 per month depending on included users and capabilities
- Additional users: EUR 15-25 per user per month
- Setup, import, and onboarding: EUR 150-500 one-time
- Paid pilot: a fixed onboarding fee plus a limited pilot subscription

The final model may be per agency, per active user, or tiered. Pricing interviews are insufficient; validation requires an accepted offer, payment, or signed commercial commitment.

Early unit economics must track:

- Acquisition cost and founder sales time
- Import and onboarding hours
- Monthly support time per agency
- Infrastructure and communication costs
- Gross margin by package
- Retention and expansion

## Pilot Success Criteria

The targets below are hypotheses to calibrate, not universal benchmarks.

Primary north-star metric:

> Percentage of active opportunities with a completed or scheduled next action inside the expected follow-up window.

Supporting measures:

- At least 80% of invited brokers active weekly during the pilot
- At least 90% of active opportunities have an owner and next action
- Reduction in new inquiries uncontacted after one business day
- Reduction in overdue follow-ups
- Broker retention after 4, 8, and 12 weeks
- Time required to import and activate an agency
- Weekly support time per agency
- Percentage of pilot agencies converting to an ongoing paid subscription
- Lead-to-qualified, qualified-to-viewing, viewing-to-offer, and offer-to-won progression where data quality permits

The product is not validated merely because users log in. It is validated when agencies repeatedly use the operating loop, improve an important outcome, and continue paying.

## Key Risks And Mitigations

### Adoption Risk

Brokers may resist data entry or perceive the system as surveillance.

Mitigation: make Today and next-action updates extremely fast, involve brokers in workflow design, and position manager reporting around exception removal and opportunity protection.

### Scope Risk

The product may expand into property portals, messaging, transaction management, accounting, and AI before proving the core workflow.

Mitigation: require pilot evidence before adding a major module.

### Data Quality Risk

Imports may contain duplicates, inconsistent phone formats, incomplete source information, and conflicting ownership.

Mitigation: make mapping, validation, deduplication, merge history, and onboarding first-class concerns.

### Trust And Ownership Risk

Owners want agency continuity while brokers may expect control over personal relationships.

Mitigation: define record-visibility policy explicitly and communicate it before onboarding.

### Integration Risk

Local portals and messaging providers may lack stable APIs or impose restrictions and cost.

Mitigation: validate integration access separately and keep providers behind adapters.

### Security And Compliance Risk

Cross-agency exposure, excessive permissions, or mishandled personal data could be existential.

Mitigation: tenant isolation, RLS, constraints, automated authorization tests, auditability, secure defaults, and qualified legal review.

### Support Economics Risk

Manual import and onboarding may win pilots but become too expensive to scale.

Mitigation: measure support hours, standardize onboarding, and automate only repeated steps.

## Outcome-Based Roadmap

### Phase 0: Discovery And Prototype

Outcome: confirm the target customer, daily operating loop, willingness to pay, and essential data relationships.

### Phase 1: Paid Pilot CRM

Outcome: brokers consistently manage ownership and next actions while managers can see exceptions.

### Phase 2: Real Estate Workflow Depth

Outcome: validated property, listing, viewing, offer, and matching workflows improve conversion without slowing daily use.

### Phase 3: Automation And Integrations

Outcome: repeated manual work is reduced through action plans, lead routing, email/calendar sync, portals, and approved communication channels.

### Phase 4: Brokerage Operating Platform

Outcome: transaction workflows, reporting, commissions, documents, compliance support, client portals, and selected AI capabilities deepen retention and expansion.

Each phase should begin only after the preceding outcome is demonstrated.

## Open Decisions

- Final beachhead segment and city coverage
- Agency, team, and private record visibility
- Exact opportunity types and initial stages
- Inquiry deduplication and merge rules
- Required portal import formats
- Whether a minimal viewing record is necessary in the pilot
- Notification channels and reminder timing
- Offline draft and retry behavior for mobile forms
- Pricing and packaging
- Hosting region, retention periods, and subprocessor choices
- What evidence must be achieved before adding property inventory or integrations

## Long-Term Vision

Begin by making the daily broker workflow reliable: every inquiry is handled, every opportunity has an owner, every active opportunity has a next action, and every important outcome becomes part of the agency's history.

After that behavior is proven, expand into listings, property matching, portal distribution, communication capture, marketing automation, transaction workflows, commission tracking, compliance support, client portals, and carefully selected AI assistance.

The long-term opportunity is to become the operating system for residential real estate agencies in Bulgaria and later for similar underserved Central and Eastern European markets.

The central discipline is:

> Do not build a smaller copy of a famous CRM. Build the smallest operating system that a narrowly defined Bulgarian brokerage will pay for, use every day, and be unwilling to return to working without.
