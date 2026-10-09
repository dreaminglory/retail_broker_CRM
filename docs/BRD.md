# Business Requirements Document — BrokerCRM

> **Status:** In Progress — Populated incrementally alongside development
> **Last updated:** 2026-10-02

## 1. Executive Summary

BrokerCRM is a Bulgarian-first CRM for residential real estate agencies. It ensures every
active opportunity has an owner, a next action, and a complete history so brokers lose fewer
opportunities and managers can run the agency from reliable operational data.

See `docs/business-description.md` for the full founding brief.

## 2. Business Objectives

- Reduce lost/forgotten opportunities in Bulgarian residential agencies
- Provide brokers with a single daily work screen (Today Screen)
- Give managers exception-based visibility without manual status checking
- Ensure agency data ownership and continuity when brokers leave

## 3. Personas & User Stories

### Broker User Stories

#### Sprint 5 — Hardening, Import & i18n
- **US-B050:** ✅ As an invited broker, clicking my invitation link activates my membership and takes me safely into the app.
- **US-B051:** ✅ As a broker, imported inquiries assigned to me as "New" appear on my Today screen and link to the matching contact.
- **US-B052:** ✅ As a user, I can choose Bulgarian or English in my profile, and the choice follows me to every device.
- **US-B053:** ✅ As a Bulgarian broker, the whole application speaks Bulgarian by default, including errors, empty states and emails.
- **US-B054:** ✅ As a broker, dates, times, numbers and prices appear in the Bulgarian format I'm used to.
- **US-B055:** ✅ As a broker, "Today" means today in Sofia, no matter where the server runs.


#### Sprint 0 — Authentication
- **US-B001:** ✅ As a broker, I can sign up and create my agency so I can start using BrokerCRM.
- **US-B002:** ✅ As a broker, I can log in to my existing account so I can access my workspace.
- **US-B003:** ✅ As a broker, I can log out securely so my account is protected.

#### Sprint 1 — Core Domain
- **US-B010:** ✅ As a broker, I can create a new contact (person or organization) with phone numbers and emails so I have a record of the people I work with.
- **US-B011:** ✅ As a broker, I can search contacts by name, phone, or email so I can quickly find who I'm looking for.
- **US-B012:** ✅ As a broker, I can view a contact's profile with all their contact methods and linked opportunities so I have full context before a call.
- **US-B013:** ✅ As a broker, I can edit a contact's information so records stay accurate.
- **US-B014:** ✅ As a broker, I can create a new inquiry from a phone call, walk-in, or referral so every lead is captured.
- **US-B015:** ✅ As a broker, I can link an inquiry to an existing contact or create a new contact from the inquiry so leads are connected to people.
- **US-B016:** ✅ As a broker, I can convert an inquiry into an opportunity so I can track the commercial pursuit.
- **US-B017:** ✅ As a broker, I can create an opportunity with a type (buyer/seller/landlord/tenant), stage, and assigned broker so pipeline tracking begins.
- **US-B018:** ✅ As a broker, I can change an opportunity's stage so I can track progress through the pipeline.
- **US-B019:** ✅ As a broker, I can add notes to an opportunity so important context is preserved.
- **US-B020:** ✅ As a broker, I can add a basic task with a due date to an opportunity so I know my next action.
- **US-B021:** ✅ As a broker, I can mark a task as completed so my progress is tracked.
- **US-B022:** ✅ As a broker, I can view all opportunities assigned to me with their current stage so I know my workload.

#### Sprint 2 — Daily Operations
- **US-B023:** ✅ As a broker, I can see my overdue, due today, and upcoming tasks on the Today Screen so I know what to work on.
- **US-B024:** ✅ As a broker, I can complete a task and record an outcome + schedule the next action in one flow.
- **US-B025:** ✅ As a broker, I am warned of potential duplicate contacts before creating a new record.

#### Sprint 3 — Activity & Audit
- **US-B030:** ✅ As a broker, I can add a note to a contact so important context is preserved over time.
- **US-B031:** ✅ As a broker, I can add a note to an opportunity so I can record observations, conversations, and decisions.
- **US-B032:** ✅ As a broker, I can view a chronological timeline on a contact showing notes, tasks, stage changes, and inquiries so I have full context before a call.
- **US-B033:** ✅ As a broker, I can view a chronological timeline on an opportunity showing notes, tasks, stage changes, and assignment changes.
- **US-B034:** ✅ As a broker, I can edit or delete my own notes so I can correct mistakes.
- **US-B035:** ✅ As a broker, I can pin an important note so it stays visible at the top.
- **US-B036:** ✅ As a broker, I can see all opportunities linked to a contact on the contact detail page so I understand the full relationship.

#### Sprint 4 — Team & Search
- **US-B040:** ✅ As a broker, I can update my display name from my profile settings so my real name appears across the system.
- **US-B041:** ✅ As a broker, I can see real names (not "Team Member") on timeline entries, notes, and task assignments.
- **US-B042:** ✅ As a broker, I can press ⌘K / Ctrl+K to search across contacts, opportunities, and inquiries from any screen.
- **US-B043:** ✅ As a broker, I can view my team members and their roles on the Team page.

### Manager User Stories

#### Sprint 5 — Import & Team
- **US-M050:** ✅ As a manager, I can invite brokers. Only the owner can grant manager or owner roles.
- **US-M051:** ✅ As a manager, I can upload the contacts spreadsheet we've kept in Excel/Google Sheets, map its columns, and preview problems before anything is saved.
- **US-M052:** ✅ As a manager, contacts that already exist (same phone or email, in any format) are not duplicated when I import, even if I import the same file twice.
- **US-M053:** ✅ As a manager, I can download the rejected rows with reasons, fix them, and import just those.
- **US-M054:** ✅ As a manager, I can import historical or portal-exported inquiries with their original source, reference number and date preserved.
- **US-M055:** ✅ As a manager, re-importing an inquiry export doesn't create duplicate inquiries.
- **US-M056:** ✅ As a manager, I can see who imported what, when, and with what result.
- **US-M057:** ✅ As a manager, I can see how many imported inquiries will land in each broker's Today screen before I commit.


#### Sprint 1 — Core Domain
- **US-M010:** ✅ As a manager, I can view all contacts in my agency so I have visibility into the customer database.
- **US-M011:** ✅ As a manager, I can view all inquiries and their status (new/contacted/converted/dismissed) so I can spot unhandled leads.
- **US-M012:** ✅ As a manager, I can assign an inquiry to a broker so leads are distributed.
- **US-M013:** ✅ As a manager, I can view the opportunity pipeline for the whole agency so I can see deal flow.
- **US-M014:** ✅ As a manager, I can filter opportunities by broker, stage, type, and temperature so I can focus on specific segments.

#### Sprint 2 — Oversight
- **US-M020:** ✅ As a manager, I can view the exceptions dashboard to see unassigned inquiries, stale opportunities, and overdue tasks grouped by broker.
- **US-M021:** ✅ As a manager, I can see workload distribution across brokers.

#### Sprint 3 — Activity & Audit
- **US-M030:** ✅ As a manager, I can see when an opportunity's broker assignment was changed, including who made the change and when.
- **US-M031:** ✅ As a manager, I can see when an opportunity's stage was changed, including old and new stage, who made the change, and when.
- **US-M032:** ✅ As a manager, I can see a complete audit trail of status changes (active → won/lost/nurture) for any opportunity.
- **US-M033:** ✅ As a manager, I can see the complete activity history on any contact or opportunity.

### Owner User Stories

#### Sprint 5 — Hardening, Defaults & Revert
- **US-O050:** ✅ As an agency owner, I can trust that nobody outside my agency can join it, read its data, or write into its history.
- **US-O051:** ✅ As an owner, I can show prospects and auditors automated proof that agencies are isolated from each other.
- **US-O052:** ✅ As an owner, only managers and owners can bulk-import data into the agency.
- **US-O053:** ✅ As an owner, I can undo a mistaken import within 7 days without touching records my team has already worked on.
- **US-O054:** ✅ As a new agency owner, my default pipeline stages and lead sources are created in Bulgarian.
- **US-O055:** ✅ As an owner, invitation and password-reset emails reach my team in Bulgarian.


#### Sprint 0 — Authentication
- **US-O001:** ✅ As an owner, I can create an agency during signup so my workspace is established.
- **US-O002:** ✅ As an owner, I can see my agency name and role on the dashboard so I know I'm in the right workspace.

#### Sprint 1 — Core Domain
- **US-O010:** ✅ As an owner, I can manage lead sources (add, edit, deactivate) so my agency's channel taxonomy is accurate.
- **US-O011:** ✅ As an owner, I have all the same capabilities as a manager for contacts, inquiries, and opportunities.

#### Sprint 4 — Team Management
- **US-O040:** ✅ As an owner, I can view all team members with their names, emails, roles, and statuses.
- **US-O041:** ✅ As an owner, I can invite new brokers or managers to my agency by email.
- **US-O042:** ✅ As an owner, I can change a member's role (broker ↔ manager ↔ owner).
- **US-O043:** ✅ As an owner, I can deactivate a member so they lose access without losing their historical data.
- **US-O044:** ✅ As an owner, I can cancel or resend pending invitations.

### Technical User Stories

#### Sprint 5 — Testing
- **US-T050:** ✅ As the product team, we can rebuild a production-identical database locally in one command, so every change is tested before it reaches pilot agencies.

## 4. Functional Requirements

### FR-AUT: Authentication & Tenant Management ✅ Sprint 0

| ID | Requirement | Status |
|----|------------|--------|
| FR-AUT-01 | Email/password signup with agency creation | ✅ Done |
| FR-AUT-02 | Email/password login | ✅ Done |
| FR-AUT-03 | Session management via Supabase Auth + middleware | ✅ Done |
| FR-AUT-04 | Auth callback route for email confirmation | ✅ Done |
| FR-AUT-05 | Protected dashboard routes (redirect to login if unauthenticated) | ✅ Done |
| FR-AUT-06 | Agency + AgencyMembership created on signup (owner, active) | ✅ Done |
| FR-AUT-07 | Tenant isolation via `agency_id` + RLS on all tables | ✅ Done |
| FR-AUT-08 | SECURITY DEFINER helpers: `current_agency_id()`, `current_user_role()` | ✅ Done |

### FR-SRC: Lead Source Management ✅ Sprint 1

| ID | Requirement | Status |
|----|------------|--------|
| FR-SRC-01 | `lead_sources` table with `agency_id`, name, channel type, active flag, sort order | ✅ Done |
| FR-SRC-02 | Seed default lead sources on agency creation | ✅ Done |
| FR-SRC-03 | Settings page for managing lead sources (add, edit name, deactivate, reorder) | ✅ Done |
| FR-SRC-04 | Lead source selector on Inquiry and Opportunity forms (shows only active sources) | ✅ Done |
| FR-SRC-05 | Channel type categorization (portal, referral, website, phone, social, email, walk-in, other) | ✅ Done |

### FR-CON: Contact Management ✅ Sprint 1

| ID | Requirement | Status |
|----|------------|--------|
| FR-CON-01 | `contacts` table with person/organization type, names, status, agency_id + RLS | ✅ Done |
| FR-CON-02 | `contact_methods` table for phones, emails, and other identifiers | ✅ Done |
| FR-CON-03 | Contact list page with search and filter by status | ✅ Done |
| FR-CON-04 | Contact detail page showing profile, contact methods, and linked opportunities | ✅ Done |
| FR-CON-05 | Create contact form with inline contact method entry | ✅ Done |
| FR-CON-06 | Edit contact information (name, type, notes, status) | ✅ Done |
| FR-CON-07 | Add/remove contact methods from contact detail | ✅ Done |
| FR-CON-08 | Contact type-specific fields (person vs. organization) | ✅ Done |
| FR-CON-09 | `display_name` generated from first+last (person) or company_name (organization) | ✅ Done |
| FR-CON-10 | Pagination on contact list | ✅ Done |
| FR-CON-11 | Archive contact (soft status change) | ✅ Done |
| FR-CON-12 | Unique constraint on `(agency_id, type, value)` in contact_methods | ✅ Done |

### FR-INQ: Inquiry Management ✅ Sprint 1

| ID | Requirement | Status |
|----|------------|--------|
| FR-INQ-01 | `inquiries` table with source, status, contact/opportunity links, agency_id + RLS | ✅ Done |
| FR-INQ-02 | Inquiry inbox page with status filtering | ✅ Done |
| FR-INQ-03 | Manual inquiry creation form (caller info, source, subject, description) | ✅ Done |
| FR-INQ-04 | Inquiry status lifecycle: new → contacted → converted → dismissed | ✅ Done |
| FR-INQ-05 | Assign inquiry to a broker | ✅ Done |
| FR-INQ-06 | Link inquiry to existing contact (search and select) | ✅ Done |
| FR-INQ-07 | Create new contact from inquiry data (pre-fill name, phone, email) | ✅ Done |
| FR-INQ-08 | Convert inquiry to opportunity (creates opportunity linked to inquiry + contact) | ✅ Done |
| FR-INQ-09 | Dismiss inquiry with optional reason | ✅ Done |
| FR-INQ-10 | Inquiry preserves original source data in `raw_payload` (JSONB) | ✅ Done |
| FR-INQ-11 | Inquiry card/row shows: caller info, source, status badge, assigned broker, age | ✅ Done |
| FR-INQ-12 | External reference field for portal IDs or other tracking numbers | ✅ Done |

### FR-OPP: Opportunity & Pipeline ✅ Sprint 1

| ID | Requirement | Status |
|----|------------|--------|
| FR-OPP-01 | `opportunities` table with type, stage, source, status, assigned broker, agency_id + RLS | ✅ Done |
| FR-OPP-02 | `opportunity_participants` table for multi-party involvement | ✅ Done |
| FR-OPP-03 | Default stages seeded for new agencies | ✅ Done |
| FR-OPP-04 | Opportunity list page showing all opportunities with stage, type, temperature | ✅ Done |
| FR-OPP-05 | Create opportunity form with type, stage, source, assigned broker, primary contact | ✅ Done |
| FR-OPP-06 | Opportunity detail page with stage indicator, participants, linked inquiry, notes | ✅ Done |
| FR-OPP-07 | Change opportunity stage | ✅ Done |
| FR-OPP-08 | Add/remove participants with roles | ✅ Done |
| FR-OPP-09 | Opportunity status: active, won, lost, nurture, archived | ✅ Done |
| FR-OPP-10 | Temperature indicator: hot, warm, cold | ✅ Done |
| FR-OPP-11 | Filter opportunities by: status, stage, type, assigned broker, temperature | ✅ Done |
| FR-OPP-12 | Close opportunity as Won or Lost (with lost reason for Lost) | ✅ Done |
| FR-OPP-13 | `next_action_at` denormalized field updated when tasks are created/completed | ✅ Done |
| FR-OPP-14 | Link to source inquiry (immutable reference) | ✅ Done |
| FR-OPP-15 | Expected value and currency fields | ✅ Done |

### FR-SET: Agency Settings & Localization ✅ Sprint 5
| Req ID | Description | Status |
|---|---|---|
| FR-SET-01 | Agency specific settings jsonb column | ✅ Done |
| FR-SET-02 | Default Timezone for all date bounds (`Europe/Sofia` by default) | ✅ Done |
| FR-SET-03 | Default Currency (`EUR`) | ✅ Done |
| FR-SET-04 | Default user profile locale (`bg` for Bulgarian, `en` fallback) | ✅ Done |
| FR-SET-05 | Full system localization (Bulgarian) using `next-intl` | ✅ Done |

### FR-TSK: Tasks & Next Actions ✅ Sprint 1 & 2

| ID | Requirement | Status |
|----|------------|--------|
| FR-TSK-01 | `tasks` table with title, due date, status, outcome, owner, opportunity link, agency_id + RLS | ✅ Done |
| FR-TSK-02 | Create a task on an opportunity with title, due date, and optional description | ✅ Done |
| FR-TSK-03 | View tasks on opportunity detail page (pending, completed, overdue) | ✅ Done |
| FR-TSK-04 | Mark task as completed with outcome notes + schedule next action in one flow | ✅ Done |
| FR-TSK-05 | Task status: pending, completed, cancelled | ✅ Done |
| FR-TSK-06 | Overdue indicator (due date in past + status is pending) | ✅ Done |
| FR-TSK-07 | When a task is completed or created, update `opportunities.next_action_at` | ✅ Done |

### FR-STG: Pipeline Stages ✅ Sprint 1 & 2

| ID | Requirement | Status |
|----|------------|--------|
| FR-STG-01 | `stages` table with name, sort order, terminal flags, agency_id + RLS | ✅ Done |
| FR-STG-02 | Seed migration creates default stages for new agencies | ✅ Done |
| FR-STG-03 | Stage configuration UI (add, rename, reorder, delete) | ✅ Done |

### FR-TOD: Today Screen ✅ Sprint 2

| ID | Requirement | Status |
|----|------------|--------|
| FR-TOD-01 | Broker sees tasks due today and overdue tasks | ✅ Done |
| FR-TOD-02 | Broker sees at-risk opportunities (no next action scheduled) | ✅ Done |
| FR-TOD-03 | Quick-complete tasks and schedule next actions directly from the dashboard | ✅ Done |

### FR-MGR: Manager Dashboard ✅ Sprint 2

| ID | Requirement | Status |
|----|------------|--------|
| FR-MGR-01 | Role-gated exceptions dashboard for managers/owners | ✅ Done |
| FR-MGR-02 | Surface unassigned inquiries and stale opportunities (> 7 days inactive) | ✅ Done |
| FR-MGR-03 | Surface overdue tasks grouped by broker and workload distribution | ✅ Done |

### FR-ACT: Activity Timeline & Notes ✅ Sprint 3

| ID | Requirement | Status |
|----|------------|--------|
| FR-ACT-01 | `notes` table with content, pin status, author, timestamps | ✅ Done |
| FR-ACT-02 | Add, edit, delete notes on a contact or opportunity | ✅ Done |
| FR-ACT-03 | Unified chronological timeline view of notes, tasks, audit events, and inquiries | ✅ Done |
| FR-ACT-04 | Timeline support on both contact and opportunity detail pages | ✅ Done |
| FR-ACT-05 | Pagination on timeline (load more) | ✅ Done |

### FR-AUD: Audit Trail ✅ Sprint 3

| ID | Requirement | Status |
|----|------------|--------|
| FR-AUD-01 | `audit_log` table tracking entity changes | ✅ Done |
| FR-AUD-02 | Trigger-based logging for opportunity ownership, stage, and status changes | ✅ Done |
| FR-AUD-03 | Trigger-based logging for contact status changes | ✅ Done |
| FR-AUD-04 | Human-readable metadata resolution in triggers | ✅ Done |

### FR-PRF: User Profiles ✅ Sprint 4

| ID | Requirement | Status |
|----|------------|--------|
| FR-PRF-01 | `profiles` table synced from `auth.users` via PostgreSQL trigger | ✅ Done |
| FR-PRF-02 | User can update their own display name from Settings → Profile | ✅ Done |
| FR-PRF-03 | Author name resolution across timeline, notes, tasks, and audit log | ✅ Done |
| FR-PRF-04 | RLS: any authenticated user can SELECT, only owner can UPDATE own profile | ✅ Done |

### FR-TEM: Team Management & Invitations ✅ Sprint 4

| ID | Requirement | Status |
|----|------------|--------|
| FR-TEM-01 | Team members list page showing name, email, role, status, joined date | ✅ Done |
| FR-TEM-02 | Owner can change member roles (broker ↔ manager ↔ owner) | ✅ Done |
| FR-TEM-03 | Owner can deactivate/reactivate members | ✅ Done |
| FR-TEM-04 | Safeguards: owner can't deactivate self, agency must retain one owner | ✅ Done |
| FR-TEM-05 | Invite new members by email via Supabase Auth magic link | ✅ Done |
| FR-TEM-06 | Auth callback handles invitation acceptance and membership activation | ✅ Done |
| FR-TEM-07 | Pending invitations visible with resend/cancel actions | ✅ Done |
| FR-TEM-08 | Duplicate invitation and existing member checks | ✅ Done |

### FR-SRH: Global Search ✅ Sprint 4

| ID | Requirement | Status |
|----|------------|--------|
| FR-SRH-01 | Command palette (⌘K / Ctrl+K) accessible from any screen | ✅ Done |
| FR-SRH-02 | Search contacts by name, phone, or email | ✅ Done |
| FR-SRH-03 | Search opportunities by title | ✅ Done |
| FR-SRH-04 | Search inquiries by caller name or subject | ✅ Done |
| FR-SRH-05 | Results scoped to user's agency via RLS | ✅ Done |
| FR-SRH-06 | Clicking a result navigates to the entity's detail page | ✅ Done |


### FR-SEC: Security Hardening & Isolation ✅ Sprint 5

| ID | Requirement | Status |
|----|------------|--------|
| FR-SEC-01 | Partial unique index limits each user to 1 active membership | ✅ Done |
| FR-SEC-02 | Atomic RPCs for signups and member activation | ✅ Done |
| FR-SEC-03 | Non-atomic role validation before sending invitations | ✅ Done |
| FR-SEC-04 | Only owners can grant owner/manager roles | ✅ Done |
| FR-SEC-05 | Search path strictly defined on all functions | ✅ Done |
| FR-SEC-06 | Exploit regression test suite blocking regressions | ✅ Done |

### FR-TST: Migration Baseline & Test Harness ✅ Sprint 5

| ID | Requirement | Status |
|----|------------|--------|
| FR-TST-01 | Clean `supabase db reset` builds production-ready schema | ✅ Done |
| FR-TST-02 | pgTAP test suite testing RLS on all tenant-owned tables | ✅ Done |
| FR-TST-03 | Vitest suite for business logic (phone parsing, timezone logic) | ✅ Done |

### FR-IMP: Import Foundation & Execution ✅ Sprint 5

| ID | Requirement | Status |
|----|------------|--------|
| FR-IMP-01 | Contacts upload, validation, mapping and idempotent commit | ✅ Done |
| FR-IMP-02 | Inquiries upload, validation, mapping and idempotent commit | ✅ Done |
| FR-IMP-03 | Duplicate detection against both database and in-file rows | ✅ Done |
| FR-IMP-04 | Import Jobs history and status tracking | ✅ Done |
| FR-IMP-05 | Import Revert action (7-day window, untouched records only) | ✅ Done |
| FR-IMP-06 | Role-gating for imports (owner/manager only) | ✅ Done |

### FR-LOC: Localization & Formatting ✅ Sprint 5

| ID | Requirement | Status |
|----|------------|--------|
| FR-LOC-01 | `bg` default language across all components (next-intl) | ✅ Done |
| FR-LOC-02 | Currency display formatting based on agency defaults | ✅ Done |
| FR-LOC-03 | Timezone-aware date calculations for "Today" boundaries | ✅ Done |
| FR-LOC-04 | Auth emails sent in localized language | ✅ Done |

## 5. Non-Functional Requirements

| ID | Requirement | Priority |
|----|------------|----------|
| NFR-01 | All tenant-owned tables have `agency_id` column and RLS policies | Must |
| NFR-02 | No cross-agency data leakage — enforced by RLS + foreign key constraints | Must |
| NFR-03 | TypeScript strict mode — no `any` types | Must |
| NFR-04 | Zod validation on all user input (forms + server actions) | Must |
| NFR-05 | Server Actions for all mutations (not client-side API calls) | Must |
| NFR-06 | Responsive layout (desktop-first, mobile-usable) | Should |
| NFR-07 | Page load under 3 seconds on standard connection | Should |
| NFR-08 | All `updated_at` triggers on mutable tables | Must |

## 6. Deferred Items (Future Sprints)

| Item | Target | Notes |
|------|--------|-------|
| Notifications & Reminders | Sprint 6 | Architecture decided (AD-025: email-only via Resend, pg_cron). |
| Smart Lists | Sprint 6 | Custom saved filters for inquiries and opportunities |
| Opportunity Import | Sprint 6+ | Import opportunities via CSV |
| Retention Purge Job | Sprint 6 | Purge reverted import rows and soft-deleted data |
| Requirement/Property reference | Sprint 7 | Link contacts to what they want to buy/sell |
| pg_trgm move | Backlog | Move pg_trgm to extensions schema |
| Offline Draft & Retry | Post-pilot | Mobile form behavior when offline |
| Property Inventory & Integrations | Post-pilot | Pending evidence of core loop adoption |

## 7. Glossary

| Term | Definition |
|------|-----------|
| **Agency** | A real estate brokerage — the tenant/workspace in BrokerCRM |
| **Broker** | A real estate agent who works with contacts and manages opportunities |
| **Contact** | A durable person or organization the agency works with |
| **Contact Method** | A phone, email, or other communication identifier for a contact |
| **Inquiry** | An original inbound lead event (immutable once created) |
| **Lead Source** | The channel through which an inquiry arrived (portal, referral, etc.) |
| **Opportunity** | A commercial pursuit: buyer search, seller listing, rental, etc. |
| **Participant** | A contact or user involved in an opportunity with a specific role |
| **Profile** | A user's public identity (display name, avatar) stored in `public.profiles` |
| **RLS** | Row-Level Security — PostgreSQL feature enforcing tenant data isolation |
| **Stage** | A step in the opportunity pipeline (New → Won/Lost) |
| **Task** | A follow-up action with an owner and due date, linked to an opportunity |
| **Temperature** | Opportunity urgency indicator: hot, warm, cold |
| **Today Screen** | The broker's daily work queue showing due, overdue, and at-risk items |
