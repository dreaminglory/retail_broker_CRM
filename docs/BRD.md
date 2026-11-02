# Business Requirements Document — BrokerCRM

> **Last updated:** 2026-10-29 (Sprint 6 work recorded; planned rows come from `spec/`)
> **Purpose:** what the product must do, with stable IDs that plans, code and migrations
> reference. Product context is in `research/business-description.md`. Entities, states and rules
> are in `domain-model.md`. Reasons behind decisions are in `decisions-log.md`.

## 1. Summary and objectives

BrokerCRM is a Bulgarian-first CRM for residential real estate agencies. It ensures every
active opportunity has an owner, a next action and a complete history.

- Reduce lost and forgotten opportunities.
- Give brokers one daily work screen (Today).
- Give managers exception-based visibility without chasing status.
- Keep customer history with the agency when brokers leave.

## 2. Conventions

- **IDs are permanent.** Never renumber or reuse one. New requirements continue the numbering
  in their area (FR-XXX-NN); new areas get a new three-letter code.
- **Status:** every requirement below is done unless marked ⚠️ (partial) or ❌ (not done).
  A planned requirement is added with ❌ and its module id when that module's spec
  (`spec/<module-id>.md`) is approved, and becomes ✅ when the module is done.
- **User stories** (US-B/M/O/Tnnn) live in the module spec. The Sprint 0–6 stories are in
  git history and `archive/`.
- **Retired IDs** (schema-only rows, now described in `domain-model.md`): FR-AUT-06, FR-AUT-08,
  FR-SRC-01, FR-CON-01, FR-CON-02, FR-CON-12 (constraint dropped, AD-018), FR-INQ-01,
  FR-OPP-01, FR-OPP-13 (same as FR-TSK-07), FR-SET-01, FR-SET-05 (same as FR-LOC-01),
  FR-TSK-01, FR-STG-01, FR-STG-02 (same as FR-OPP-03), FR-ACT-01, FR-AUD-01.

## 3. Functional requirements

### FR-AUT: Authentication and tenancy (Sprint 0)

| ID | Requirement |
|----|------------|
| FR-AUT-01 | Email/password signup creates the agency and its owner membership atomically |
| FR-AUT-02 | Email/password login |
| FR-AUT-03 | ✅ Session management via Supabase Auth; `src/proxy.ts` refreshes the session on every request (AD-030, Sprint 6) |
| FR-AUT-04 | Auth callback route for email confirmation |
| FR-AUT-05 | Dashboard routes redirect unauthenticated users to login |
| FR-AUT-07 | No user can read or write another agency's data |

### FR-SRC: Lead sources (Sprint 1)

| ID | Requirement |
|----|------------|
| FR-SRC-02 | Default lead sources are seeded on agency creation, in the signup language |
| FR-SRC-03 | ⚠️ Settings page to add, rename, deactivate and reorder lead sources. Reorder is not built |
| FR-SRC-04 | Inquiry and opportunity forms offer only active sources |
| FR-SRC-05 | Each source has a channel: portal, referral, website, phone, social, email, walk-in, other |

### FR-CON: Contacts (Sprint 1)

| ID | Requirement |
|----|------------|
| FR-CON-03 | Contact list with search and status filter |
| FR-CON-04 | Contact detail shows profile, contact methods and linked opportunities |
| FR-CON-05 | Create a contact (person or organization) with contact methods inline |
| FR-CON-06 | Edit a contact's name, type, notes and status |
| FR-CON-07 | Add and remove contact methods |
| FR-CON-08 | Person and organization have type-specific fields |
| FR-CON-09 | Display name is generated from first + last name, or company name |
| FR-CON-10 | ✅ Contact list is paginated, 50 per page with `?page=` and a pager (module `trustworthy-loop`) |
| FR-CON-11 | Contacts are archived (soft), not deleted |
| FR-CON-13 | Warn about likely duplicates (phone, email, similar name) before creating a contact (Sprint 2) |
| FR-CON-14 | Merge duplicates: the loser is archived and snapshotted in merge history (Sprint 2) |
| FR-CON-15 | ✅ International and landline phone numbers are accepted and stored as E.164 (AD-041, module `trustworthy-loop`) |

### FR-INQ: Inquiries (Sprint 1)

| ID | Requirement |
|----|------------|
| FR-INQ-02 | Inquiry inbox with status filter |
| FR-INQ-03 | Manual inquiry creation: caller info, source, subject, description |
| FR-INQ-04 | Status lifecycle: new → contacted → converted, or dismissed |
| FR-INQ-05 | ✅ Assign an inquiry to a broker, at creation, at conversion and later from the inbox and Exceptions (module `trustworthy-loop`) |
| FR-INQ-06 | Link an inquiry to an existing contact |
| FR-INQ-07 | Create a contact from inquiry data (prefilled) |
| FR-INQ-08 | Convert an inquiry into an opportunity linked to the inquiry and contact |
| FR-INQ-09 | Dismiss an inquiry with an optional reason |
| FR-INQ-10 | Original source data is preserved unchanged in `raw_payload` |
| FR-INQ-11 | ✅ Inquiry rows show caller, source, status, assigned broker's name and age (module `trustworthy-loop`) |
| FR-INQ-12 | External reference for portal IDs and other tracking numbers |
| FR-INQ-13 | ✅ Edit an inquiry and reassign it from the inbox and Exceptions; the card shows the assignee's name (module `trustworthy-loop`) |
| FR-INQ-14 | ✅ Inquiry caller phone and email are normalised, and the conversion duplicate check uses them (module `trustworthy-loop`) |

### FR-OPP: Opportunities and pipeline (Sprint 1)

| ID | Requirement |
|----|------------|
| FR-OPP-02 | Several contacts and users can take part in one opportunity |
| FR-OPP-03 | Default pipeline stages are seeded for new agencies |
| FR-OPP-04 | Opportunity list with stage, type and temperature |
| FR-OPP-05 | Create an opportunity with type, stage, source, broker and primary contact |
| FR-OPP-06 | Detail page with stage, participants, linked inquiry and notes |
| FR-OPP-07 | Change an opportunity's stage |
| FR-OPP-08 | Add and remove participants with roles |
| FR-OPP-09 | Status: active, won, lost, nurture, archived |
| FR-OPP-10 | Temperature: hot, warm, cold |
| FR-OPP-11 | ✅ Filter by status, stage, type, broker and temperature (module `trustworthy-loop`) |
| FR-OPP-12 | Close as won, lost (reason required) or nurture, and reactivate |
| FR-OPP-14 | Keeps a reference to the inquiry it came from |
| FR-OPP-16 | ✅ The opportunity list is paginated, and contact pickers search the whole agency (module `trustworthy-loop`) |
| FR-OPP-15 | Optional expected value and currency |

### FR-STG: Pipeline stages (Sprints 1–2)

| ID | Requirement |
|----|------------|
| FR-STG-03 | Stage settings: add, rename, reorder, delete (guarded, see `domain-model.md` S2) |

### FR-TSK: Tasks and next actions (Sprints 1–2)

| ID | Requirement |
|----|------------|
| FR-TSK-02 | Create a task with title, type, due date and optional description |
| FR-TSK-03 | Opportunity detail shows pending, completed and overdue tasks |
| FR-TSK-04 | ✅ Complete a task with an outcome, and optionally schedule the next task or change stage, in one flow, on Today and the opportunity page (Sprint 6) |
| FR-TSK-05 | Status: pending, completed, cancelled |
| FR-TSK-06 | Overdue = pending and due date in the past |
| FR-TSK-07 | `opportunities.next_action_at` always equals the earliest pending task's due date |
| FR-TSK-08 | ✅ Edit, reschedule (presets: +1 h, tomorrow 09:00, +2 days, next Monday 09:00, agency time) and cancel (optional reason) a pending task, from Today and the opportunity page. Completed and cancelled tasks are final (Sprint 6) |
| FR-TSK-09 | ✅ Due dates entered in the app are read in the agency's timezone, not the server's (Sprint 6) |

### FR-TOD: Today screen (Sprint 2)

| ID | Requirement |
|----|------------|
| FR-TOD-01 | Broker sees new inquiries, overdue tasks, tasks due today and upcoming tasks |
| FR-TOD-02 | Broker sees at-risk opportunities (no next action) |
| FR-TOD-03 | Complete tasks and schedule the next action directly from Today |
| FR-TOD-04 | ✅ Owners and managers see their own work by default and switch to the agency's with a Mine / Agency toggle (`?scope=agency`, AD-044, Sprint 6) |
| FR-TOD-05 | ✅ Each task appears in exactly one Today section: overdue (before now), due today (now to agency midnight), coming up (Sprint 6) |

### FR-MGR: Manager exceptions (Sprint 2)

| ID | Requirement |
|----|------------|
| FR-MGR-01 | Exceptions dashboard, owner and manager only |
| FR-MGR-02 | Unassigned inquiries, at-risk and stale (7+ days) opportunities |
| FR-MGR-03 | Overdue tasks by broker, and workload per broker |

### FR-ACT: Notes and timeline (Sprint 3)

| ID | Requirement |
|----|------------|
| FR-ACT-02 | Add, edit, delete and pin notes on a contact or opportunity |
| FR-ACT-03 | One chronological timeline of notes, tasks, audit events and inquiries |
| FR-ACT-04 | Timeline on both contact and opportunity pages |
| FR-ACT-05 | Timeline loads more on demand |

### FR-AUD: Audit trail (Sprint 3)

| ID | Requirement |
|----|------------|
| FR-AUD-02 | Opportunity owner, stage and status changes are logged automatically |
| FR-AUD-03 | Contact archive and restore are logged automatically |
| FR-AUD-04 | Audit entries show readable names, not IDs |

### FR-PRF: User profiles (Sprint 4)

| ID | Requirement |
|----|------------|
| FR-PRF-01 | Every user automatically gets a profile |
| FR-PRF-02 | Users edit their own display name and language |
| FR-PRF-03 | ✅ Real names appear on timeline, notes, tasks and audit entries. A new signup's name falls back from display name to full name, then first and last name, then the email prefix (module `trustworthy-loop`) |
| FR-PRF-04 | A profile is visible only to its user and their colleagues (AD-029) |

### FR-TEM: Team and invitations (Sprint 4)

| ID | Requirement |
|----|------------|
| FR-TEM-01 | Team page: name, email, role, status, joined date |
| FR-TEM-02 | Owner changes member roles |
| FR-TEM-03 | Owner deactivates and reactivates members; history is kept |
| FR-TEM-04 | Owner can't deactivate themselves; an agency always keeps an owner |
| FR-TEM-05 | Invite members by email (magic link) |
| FR-TEM-06 | Accepting an invitation activates the membership |
| FR-TEM-07 | ⚠️ Pending invitations can be resent or cancelled. Resend is not built (module `conversion-join`) |
| FR-TEM-08 | No duplicate invitations or re-inviting existing members |

### FR-SRH: Global search (Sprint 4)

| ID | Requirement |
|----|------------|
| FR-SRH-01 | Command palette (⌘K / Ctrl+K) from any screen |
| FR-SRH-02 | Search contacts by name, phone or email |
| FR-SRH-03 | Search opportunities by title |
| FR-SRH-04 | Search inquiries by caller name or subject |
| FR-SRH-05 | Results only from the user's agency |
| FR-SRH-06 | A result opens the record |

### FR-SEC: Security hardening (Sprint 5)

| ID | Requirement |
|----|------------|
| FR-SEC-01 | A user has at most one active membership |
| FR-SEC-02 | Signup and invitation acceptance are atomic |
| FR-SEC-03 | Roles are validated before an invitation is sent |
| FR-SEC-04 | Only owners grant owner or manager roles; managers invite brokers |
| FR-SEC-05 | Every database function has a fixed `search_path` and explicit grants |
| FR-SEC-06 | Exploit regression tests block known attacks |
| FR-SEC-07 | ✅ The prod schema equals the repo migrations, with history; prod changes go only through migrations (AD-040, Sprint 6) |

### FR-TST: Test harness (Sprint 5)

| ID | Requirement |
|----|------------|
| FR-TST-01 | `supabase db reset` builds the full schema and seed data from scratch |
| FR-TST-02 | pgTAP tests prove tenant isolation on every table |
| FR-TST-03 | ⚠️ Vitest tests for business logic. Phone, timezone, validation and every service changed in `trustworthy-loop` are covered (tasks, inquiries, contacts, merge, opportunities, imports, search, timeline); the `agencies`, `lead-sources`, `members`, `notes` and `stages` services have no tests yet |
| FR-TST-04 | CI runs typecheck, lint, Vitest, pgTAP and the service integration suites on every pull request and push to `main` |
| FR-TST-05 | ✅ One command brings up the app with local Supabase and seeded logins on a local machine (AD-043, AD-048, Sprint 6) |
| FR-TST-06 | ✅ An E2E smoke test covers the core loop in `bg` and `en` at 1280 and 390 px (AD-043, Sprint 6) |

### FR-IMP: CSV import (Sprint 5)

| ID | Requirement |
|----|------------|
| FR-IMP-01 | Contacts: upload, map columns, validate, preview, commit idempotently |
| FR-IMP-02 | Inquiries: same, keeping original source, reference and date |
| FR-IMP-03 | Duplicates detected against the database and within the file |
| FR-IMP-04 | Import history: who, when, result |
| FR-IMP-05 | Revert within 7 days, removing only untouched records |
| FR-IMP-06 | Owner and manager only |

### FR-SET / FR-LOC: Settings and localization (Sprint 5)

| ID | Requirement |
|----|------------|
| FR-SET-02 | Agency timezone (default Europe/Sofia) defines "today" |
| FR-SET-03 | Agency default currency (EUR) |
| FR-SET-04 | Each user chooses `bg` or `en`; the choice follows them across devices |
| FR-SET-06 | ✅ Stages, lead sources and contact merge are restricted to owners and managers (AD-045, Sprint 6) |
| FR-LOC-01 | ✅ Bulgarian is the default language everywhere, including errors and empty states (module `trustworthy-loop`) |
| FR-LOC-02 | Money is formatted with the agency currency and the user's locale |
| FR-LOC-03 | Date boundaries ("today", "overdue") use the agency timezone |
| FR-LOC-04 | ⚠️ Auth emails are sent in the user's language. The templates are Bulgarian only |

### FR-NTF: Notifications (module `reminders`)

| ID | Requirement |
|----|------------|
| FR-NTF-01 | A daily digest email on working days at about 08:00 agency time (AD-042) |
| FR-NTF-02 | An immediate email when an inquiry is assigned to you by someone else |
| FR-NTF-03 | Each user can turn off the digest |

## 4. Non-functional requirements

| ID | Requirement | Priority |
|----|------------|----------|
| NFR-02 | No cross-agency data leakage, proven by automated tests | Must |
| NFR-06 | Responsive layout: desktop-first, usable on a phone | Should |
| NFR-07 | Pages load in under 3 seconds on a standard connection | Should |

Engineering rules (former NFR-01, 03, 04, 05, 08: RLS on every table, strict TypeScript, Zod
on all input, Server Actions for mutations, `updated_at` triggers) are enforced through
`AGENTS.md` and the test suites.

## 5. Deferred items

What gets built next, and in which order, is the capability map in `SPEC.md`. Items that are
not modules there:

| Item | Target | Notes |
|------|--------|-------|
| Retention purge job | Module `gdpr` | Purge reverted import rows and soft-deleted data |
| Opportunity import | Backlog | No evidence; property import matters more for onboarding |
| `pg_trgm` to the `extensions` schema | Module `gdpr` (hardening) | Supabase advisor finding; touches the duplicate-detection functions |
| Lead-source reorder (FR-SRC-03) | Backlog | Small; pick up with nearby work |
| Offline draft and retry | Post-pilot | Mobile form resilience |

Known gaps in the built product are listed in `domain-model.md` §6.
