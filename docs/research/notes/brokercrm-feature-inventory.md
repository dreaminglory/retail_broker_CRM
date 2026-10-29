# BrokerCRM feature inventory (as built)

> **Outdated snapshot (2026-10-28).** Evidence behind the gap analysis, not the current state.
> Several findings are fixed (Sprint 6.0–6.2: `src/proxy.ts`, role checks, Today defects).
> Current state and known gaps: `SPEC.md` §5.

> **Purpose:** the "our product" side of a competitive gap analysis against Follow Up Boss,
> onOffice, Reapit, Pipedrive and Eastern European real-estate CRMs.
> **Snapshot:** commit `5444897` (2026-10-28), after Sprint 5. 33 migrations, last one
> `20261007000004_localized_defaults_tz_currency.sql`.
> **Method:** read-only review of `src/`, `supabase/migrations/`, `supabase/seed.sql`,
> `supabase/templates/`, `messages/*.json` and `docs/`. The app was **not run**. Where docs and code
> disagree, the code wins and the mismatch is listed in §4. Findings marked "by reading" are
> inferred from the code and were not run.

Status legend: **Built** = usable end-to-end from the UI. **Partial** = exists, but is limited,
not wired into the UI, or has a defect that blocks part of the job. **Missing** = no code.

---

## 1. Summary

BrokerCRM is a pilot-stage, multi-tenant web CRM for Bulgarian residential brokerages. It is built
on Next.js 16.3.3 (App Router, React 19.2, Server Actions), Supabase Postgres and Supabase Auth
(email/password and invite links), Tailwind 4 with shadcn/Base UI, next-intl 4, Zod 3, date-fns
with `@date-fns/tz`, papaparse (CSV), cmdk (command palette) and dnd-kit (used only to reorder
stages). It does not use Supabase Storage, Edge Functions, Realtime or pg_cron. All agencies share
one database. Every one of the 16 public tables has `agency_id`, with RLS `ENABLE` and `FORCE`
through the `current_agency_id()` / `current_user_role()` helpers. Tenant isolation is proven by 14
pgTAP files. A user can hold only one active agency membership. There are three roles: owner,
manager and broker. Every member sees all of the agency's records (AD-001); role checks only gate
team management, import, the Exceptions screen and hard deletes. The UI is in Bulgarian (the
default) and English, with 761 message keys in each locale. Each user's language is stored in
`profiles.locale` and copied to the `NEXT_LOCALE` cookie; URLs carry no locale. Agency timezone
(Europe/Sofia) and currency (EUR) are read from `agencies.settings`, but no screen lets anyone edit
them. The core loop is built: inquiry → contact → opportunity → task/next action → Today →
manager exceptions. Everything around it is missing: properties, communications, automation,
reporting, integrations, notifications and billing.

---

## 2. Capability inventory

### 2.1 Lead / inquiry capture and sources

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Manual inquiry entry | Built | `src/app/(dashboard)/inquiries/actions.ts:14-42`; `src/components/domain/inquiries/inquiry-form.tsx`; `src/domain/inquiries/validation.ts:14-40`; migration `20260901000006_create_inquiries.sql` | Fields: caller name, phone and email, subject, description, source, external ref, assignee. Requires either caller info or content. `caller_phone` is not normalized to E.164 and `caller_email` is not lowercased (`validation.ts:18-20`). Manual entries always store `raw_payload = {}`. |
| Inquiry inbox `/inquiries` | Partial | `src/app/(dashboard)/inquiries/page.tsx:17-65`; `inquiries-page-client.tsx:59-303`; `src/domain/inquiries/repository.ts:22-29` | Status filter and text search only. No source, broker or date filters. The repository's default limit is 50 and the page has no pagination. There is no `/inquiries/[id]` route: the code revalidates that path, but the page uses `?id=`. |
| Status lifecycle new → contacted → converted / dismissed | Built | `src/domain/inquiries/validation.ts:5-10`; `service.ts:73-95,179-187` | Transitions are enforced in the service, not in the DB. An invalid transition throws a plain `Error`, so the user sees an untranslated English message. "Mark contacted" records no timestamp, and inquiries have no audit trigger. |
| Dismiss with reason | Built | `inquiries/actions.ts:86-103`; `service.ts:82-95` | The reason is free text; there is no reason list. |
| Convert inquiry → contact + opportunity | Partial | `src/domain/inquiries/service.ts:102-175`; `src/components/domain/inquiries/convert-inquiry-dialog.tsx`; `inquiries/actions.ts:109-158` | Runs 4 sequential writes with no transaction. It can only create a new opportunity, not join an existing one, although the pilot brief asks for "create or join". It copies the raw `caller_phone`/`caller_email` into `contact_methods` without normalizing them (`service.ts:143-148`). The duplicate check passes only name fields (`actions.ts:142`), so phone/email matching does not run at conversion, the point where most duplicates are created. |
| Edit or reassign an inquiry after creation | Missing (UI) | `updateInquiryAction` in `inquiries/actions.ts:44-73` and `reassignInquiryAction` in `exceptions/actions.ts:32-58`: neither is imported by any component | Assignment can only be set at creation or at conversion. The inquiry card shows a generic "Assigned" label without the broker's name (`inquiry-card.tsx:215-219`). |
| Lead source taxonomy | Partial | `20260901000001_create_lead_sources.sql` (8 channels); defaults including Imot.bg and OLX seeded in BG/EN (`20261007000004_localized_defaults_tz_currency.sql`); `/settings/lead-sources` (`settings/lead-sources/actions.ts:12-70`) | Create, edit and deactivate work. **Reorder is missing**: there is no action or UI, although FR-SRC-03 claims it. Single-touch attribution only. Not role-gated: brokers can add and edit sources, because RLS insert/update has no role check and the settings nav shows the page to everyone. |
| Idempotent inquiry key (portal ID) | Built (schema) | `20261007000001_inquiry_import_idempotency.sql` (`uq_inquiries_source_external_ref`) | Ready for portal feeds, but only CSV import uses it. |
| Web forms / website capture | Missing | The only route handlers are `src/app/(auth)/auth/callback/route.ts` and `src/app/(dashboard)/settings/import/[id]/errors.csv/route.ts` | No public endpoint or embeddable form. |
| Email-to-lead (parse inbound email) | Missing | none | |
| Portal integrations (imot.bg, OLX, homes.bg, alo.bg…) | Missing | none; only seeded source names | Portal leads arrive only by manual entry or CSV. |
| API / webhooks for lead intake | Missing | none | |
| CSV import of inquiries | Built | See §2.11 | Keeps the source, external ref and received date. |

### 2.2 Contacts, deduplication, GDPR

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Person and organization contacts, create / edit / archive | Built | `20260901000004_create_contacts.sql`; `src/app/(dashboard)/contacts/actions.ts:14-99`; `src/components/domain/contacts/contact-form.tsx`; `contacts/[id]/contact-detail-client.tsx` | Fields: first/last name, company and notes only. No address, tags, language, birthday, contact source, custom fields or segments. Deletion is an archive (soft); the UI cannot hard-delete. |
| Contact methods (phone, email, viber, whatsapp, other; label; primary) | Built | `20260901000005_create_contact_methods.sql`; `src/components/domain/contacts/contact-method-list.tsx` | Viber and WhatsApp are stored as phone numbers; nothing integrates with them. |
| Phone normalization to E.164 | Partial | `src/domain/contacts/phone.ts:29-51`; `validation.ts:46-74,81-92`; `phone.test.ts:17-25,35-36` | **Bulgarian numbers only** (`+359` plus 9 digits). Foreign numbers (`+44…`, `+49…`) are rejected by validation, so foreign buyers' phones can't be saved. Sofia/Plovdiv landlines are rejected too (`it.todo`). The inquiry intake path doesn't normalize at all. |
| Email lowercase | Partial | `validation.ts:88-90`; `src/domain/imports/service.ts:116-117,258` | Lowercased for contact methods and imports, but not for inquiries or the conversion copy. |
| Duplicate warning on contact create | Built | `src/domain/contacts/duplicate-detection.ts:11-115`; `contacts/actions.ts:46`; `duplicate-suggestion-modal.tsx`; pg_trgm `20260924000002_add_pg_trgm.sql` | Exact phone/email match plus `ILIKE %name%`. It only warns: the unique constraint was dropped (`20260925000001_drop_uq_contact_method.sql`). |
| Merge duplicates | Partial | `src/domain/contacts/merge.ts:73-195`; `contacts/merge-actions.ts`; `merge-dialog.tsx`; `20260924000003_create_merge_history.sql` | Moves methods, opportunities, participants, inquiries and tasks, then archives the loser and snapshots it to `merge_history`. Gaps: the writes are sequential and not atomic (comment at `merge.ts:71`); **notes are not transferred**; nothing is written to `audit_log` (`'merged'` is in the CHECK list but never used); no un-merge; any role can merge; the merge actions bypass `getAuthContext` and throw instead of returning `ActionResult` (`merge-actions.ts:8-43`). |
| Contact list (search, status filter, pagination) | Partial | `contacts/page.tsx:18,28-51`; `contacts-page-client.tsx:76-200` | The server pages by `?page=` (50 per page), but the UI has no next/prev controls. |
| Contact pickers scale | Partial | `opportunities/page.tsx:71` and `inquiries/page.tsx:65` load `limit: 200` active contacts into selects | With more than 200 contacts, the opportunity form and convert dialog can't offer the rest. |
| GDPR: consent / legal-basis fields | Missing | none in any migration | |
| GDPR: data export / portability (DSAR) | Missing | No export code anywhere | There is no CSV/JSON export of any entity. |
| GDPR: erasure / anonymisation | Missing | RLS allows owner/manager `DELETE` on contacts (`20260901000004…:67-71`), but there is no UI or anonymisation routine | `audit_log` and `merge_history.loser_snapshot` keep personal data after an archive. |
| GDPR: retention / purge | Missing | `import_rows.raw` keeps PII with no purge (`20261006000001_create_import_tables.sql`); BRD §5 defers the purge job | |

### 2.3 Opportunities, pipeline and stages

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Opportunity entity: buyer / seller / landlord / tenant, temperature, expected value, source, primary contact, owner | Built | `20260901000007_create_opportunities.sql`; `src/domain/opportunities/validation.ts:35-67`; `opportunity-form.tsx` | A contact can have several opportunities. There is no commission, property, probability or expected close date. |
| Participants (contacts or users with roles) | Built | `20260901000008_create_opportunity_participants.sql`; `participant-list.tsx`; `opportunities/actions.ts:142-180` | Roles: buyer, seller, landlord, tenant, co_owner, representative, broker, other. |
| Custom pipeline stages | Built | `20260901000002_create_stages.sql`; `src/domain/stages/service.ts:55-121`; `/settings/stages` (`stages-settings-client.tsx`, dnd-kit reorder) | Add, rename, reorder and delete. Delete is blocked while the stage has active opportunities, and the last won or lost stage can't be removed. **One pipeline per agency**: no `pipelines` table and no separate sales/rental pipelines. Not role-gated: brokers can create and rename stages, since `stages/actions.ts` has no role check and RLS only restricts DELETE. |
| Board / kanban view | Missing | Only the list `src/components/domain/opportunities/opportunity-list-table.tsx`; `@dnd-kit` is imported only in `settings/stages/stages-settings-client.tsx:13-21` | |
| List / table view and filters | Partial | `opportunities/page.tsx:30-73`; `opportunities-page-client.tsx:148-236`; `repository.ts:33-63` | Filters: status, type, stage and title search. **There is no broker or temperature filter in the UI**, although FR-OPP-11 claims both. Hard cap of 200 rows with no pagination. Rows don't show the broker or the contact. |
| Close as won / lost / nurture, and reactivate | Built | `opportunities/repository.ts:192-230`; `close-opportunity-dialog.tsx` | |
| Lost reasons | Partial | `validation.ts:69-83`; `close-opportunity-dialog.tsx:74-87` | A reason is required but is free text. There is no reason taxonomy and no lost-reason report. |
| Stage-change rules | Missing | `changeOpportunityStageAction` (`opportunities/actions.ts:90-102`) does a bare update; detail page uses `StageRepository.findActive` (non-terminal only, `stages/repository.ts:29-38`) | No required fields per stage, no entry/exit rules, no time-in-stage. Stage and status are independent: closing doesn't move the stage, and `completeWithNext` can move an opportunity to a terminal stage while it stays `active` (known gap, `docs/domain-model.md` §6). |
| Archive opportunity | Missing | The `archived` status exists in CHECK and filters, but no action sets it | |
| Currency per deal | Partial | `opportunities/actions.ts:26,38,61,73`; `src/domain/agencies/settings.ts:4-7` | Uses the agency default (EUR) with no picker. The update action rewrites `currency` to the agency default on every edit. |

### 2.4 Assignment, routing and offboarding

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Manual assignment of opportunity, task or inquiry | Partial | Opportunities: `opportunity-form.tsx` + `BrokerSelect`. Tasks inherit the opportunity owner (`tasks/service.ts:76-86`). Inquiries: only at creation or conversion (§2.1). | |
| Reassign from the manager screen | Missing (UI) | `exceptions/actions.ts:32-58` (`reassignInquiryAction`) is unused | The Exceptions screen shows unassigned inquiries but can't assign them. |
| Round-robin / rules-based routing | Missing | none | |
| Lead pond / shared pool / claim | Missing | none | |
| Offboarding (bulk reassign a leaving broker's book) | Missing | `src/domain/members/service.ts:32-47` only sets `status = 'deactivated'` | Records stay assigned to the deactivated user. There is no bulk reassign and no "orphaned records" exception. |

### 2.5 Tasks, next action, reminders, notifications, automation

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Tasks: title, type (call/follow_up/viewing/meeting/email/other), due date, description, assignee | Built (create) | `20260901000009_create_tasks.sql`; `20260924000001_enhance_tasks.sql`; `src/domain/tasks/validation.ts`; `task-list.tsx:120-135` | Tasks are created only from the opportunity detail page. No contact-only tasks in the UI, and no recurrence. |
| Edit / reschedule / cancel a task | Missing (UI) | `updateTaskAction`/`cancelTaskAction` in `opportunities/[id]/tasks/actions.ts:40-70,96+` have no UI caller | A wrong due date can't be fixed. |
| Next action denormalized onto opportunity | Built | Trigger `sync_opportunity_next_action` (`20260901000009_create_tasks.sql`) | |
| Complete with outcome + schedule next + change stage | Partial | `tasks/service.ts:123-159`; `task-complete-dialog.tsx`; Today: `today/actions.ts:120-130` | Works on **Today**. On the **opportunity detail page** the same dialog collects the next task and stage, but `completeTaskAction` (`opportunities/[id]/tasks/actions.ts:72-94`) reads only `outcome`, so the next task and stage change are silently dropped (`task-list.tsx:245-262`). By reading. |
| Due-date entry and timezone | Partial | `task-list.tsx:128` (`datetime-local`); `tasks/validation.ts:20-25` (`new Date(val)`) | A naive local time is parsed in the server's timezone, not the agency's. This is likely off by 2–3 h on a UTC host. By reading. |
| Reminders / notifications (email, in-app, push, SMS) | Missing | No email provider, `supabase/functions`, pg_cron or notification table. AD-025 is a decision only; BRD §5 defers to Sprint 6. | Brokers learn about new work only by opening Today. |
| Action plans / task templates / drip | Missing | none | |
| Smart lists / saved views | Missing | none; BRD §5 defers to Sprint 6 | They are in the pilot brief's "Included" scope. |

### 2.6 Today, manager oversight, reporting

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Today screen: overdue, new inquiries, due today, coming up (+3 days), at risk | Built (with defects) | `src/app/(dashboard)/today/page.tsx:36-55`; `today-page-client.tsx:108-240`; `src/domain/tasks/repository.ts:99-205`; `src/lib/time/agency-day.ts` | "Today" is agency-local and tested. Defects: (1) `task-card.tsx:121` puts the translation call inside a template string, so tasks due today show the literal text `t('dueTodayTime', …)`. (2) Owners and managers get **agency-wide** lists with no "mine" toggle (`today/page.tsx:37-38`). (3) The task card uses date-fns `format`/`formatDistanceToNow` without a locale (English month names in BG) and the browser timezone for `isToday`. (4) A task due earlier today can appear in both Overdue and Due today. |
| Personal dashboard `/dashboard` | Built (minimal) | `src/app/(dashboard)/dashboard/page.tsx:46-160` | Four counts and quick links. No charts. |
| Manager Exceptions `/exceptions` (owner/manager only) | Partial | `exceptions/page.tsx:26-30`; `src/domain/exceptions/repository.ts:65-230`; `exceptions-page-client.tsx` | Shows unassigned inquiries, overdue tasks per broker, at-risk and stale opportunities (no next action, split at 7 days since `updated_at`) and workload per broker. Read-only: nothing can be fixed from this screen. "Stale" is not "no activity"; it is a subset of "no next action". |
| Reporting: conversion, source ROI, pipeline value, win rate, broker productivity | Missing | none | |
| Speed-to-lead / response-time metrics | Missing | No first-contact timestamp on `inquiries`, and no inquiry audit trigger | This can't be computed from the data today. |

### 2.7 Properties, requirements, matching

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Property / listing inventory | Missing | No table; no `property`/`listing` code in `src/` | BRD §5: post-pilot. |
| Buyer / tenant requirements (budget, area, rooms…) | Missing | none | BRD §5 targets Sprint 7. The pilot brief lists it as included. |
| Property reference on an opportunity | Missing | none | Pilot brief: "optional lightweight property reference". |
| Requirement ↔ listing matching | Missing | none | |

### 2.8 Viewings and offers

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Viewings | Partial | `task_type = 'viewing'` (`20260924000001_enhance_tasks.sql`); default stage "Viewing"/"Оглед" | A viewing is just a task: no property, attendee list, feedback form or viewing slip. |
| Offers / negotiation records | Missing | Only the default stages "Offer"/"Negotiation" | No offer amount, status or history. |

### 2.9 Communication

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Click-to-call / `tel:` / `mailto:` / Viber / WhatsApp deep links | Missing | No `tel:`, `mailto:`, `viber:` or `wa.me` anywhere in `src/`; `contact-method-list.tsx` and `inquiry-card.tsx:195-205` render plain text | This hurts a mobile-first "scan, call, update" workflow. |
| Call logging | Partial | `task_type = 'call'` plus required outcome text; free-text notes (`20261002000001_create_notes.sql`) | No call entity, direction, duration or result codes. |
| Email send / 2-way sync / templates | Missing | none | |
| SMS | Missing | none | |
| Viber / WhatsApp messaging | Missing | Handles are stored only (`contact_methods.type`) | The pilot non-goals exclude a full inbox, but even deep links are absent. |

### 2.10 Activity history and audit

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Notes on contact or opportunity: add, edit, delete, pin | Built | `20261002000001_create_notes.sql`; `contacts/[id]/notes/actions.ts`; `opportunities/[id]/notes/actions.ts`; `note-card.tsx:41,57-61` | Author-only editing is enforced in the UI only (`note-card.tsx:41`). RLS and the service let any member edit or delete any note (`notes/service.ts:26-36`). Deletes are hard and not audited. |
| Unified timeline (notes, tasks, audit events, inquiries) with load-more | Built | `src/domain/timeline/service.ts`; `activity-timeline.tsx:14,65-74`; `contact-activity.tsx`, `opportunity-activity.tsx` | The contact timeline includes linked opportunities. Names are resolved from `profiles`. |
| Audit log | Partial | `20261003000001_create_audit_log.sql` (triggers on opportunities: assignee, stage, status, primary contact; on contacts: status); `20261005000003_harden_policies.sql` | Not audited: inquiries, opportunity title/value/type/temperature edits, tasks, notes, contact methods, merges, and role/membership changes. The RLS `tenant_insert` policy lets any member insert audit rows through the API, so the log is not trigger-only. |

### 2.11 Import and migration tools

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| CSV import wizard: contacts | Built | `src/components/domain/imports/import-wizard.tsx`; `src/domain/imports/service.ts`; RPC `import_commit_contacts` (`20261006000002_import_commit_contacts_fn.sql`); `/settings/import`, `/settings/import/new` | UTF-8 or Windows-1251 with delimiter detection. 5 MB cap (`file-drop-zone.tsx:27,128`; CHECK in `20261006000001…`). Header auto-mapping with BG/EN synonyms (`csv/header-detection.ts:4-31`). Rows are staged client-side in 500-row chunks, then validated and committed in batches. |
| CSV import: inquiries | Built | `inquiry-import-options-form.tsx`; RPC `import_commit_inquiries` (`20261007000002_import_commit_inquiries_fn.sql`) | Matches sources and brokers by name (`csv/value-resolvers.ts`) and dedupes on `external_ref`. |
| Duplicate handling in import | Partial | `src/domain/imports/duplicate-classifier.ts`; `20261006000002…:85-108` | Detects duplicates against the DB and within the file. The "update existing" strategy isn't implemented: it skips (`…:100-103`). When the commit-time recheck finds a duplicate it sets `match_reason = 'db_recheck'`, a value not in the `match_reason` CHECK list (`20261006000001…`). The row is then probably caught as `error` instead of `skipped`. By reading; no pgTAP case covers it. |
| Error report download | Built | `settings/import/[id]/errors.csv/route.ts` | |
| Import history | Built | `settings/import/page.tsx` | |
| Revert within 7 days | Partial | RPC `import_revert` (`20261007000003_import_revert_fn.sql`); `revert-import-button.tsx` | The "has notes" guard (`…:73`) only matches empty notes, which `notes_content_check` forbids. A contact a broker added notes to is therefore still deleted, and the notes cascade with it. Row statuses aren't reliably set to `reverted` (`…:49-61`, with leftover "Wait…" comments). By reading. |
| Other formats (XLSX, vCard) and other entities (opportunities, tasks, notes, properties) | Missing | `file-drop-zone.tsx:33` accepts `.csv` only | Opportunity import is deferred (BRD §5). There are no migration templates for competitor CRMs. |
| Export | Missing | none | |

### 2.12 Users, roles, tenancy, settings, billing

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Sign-up creates the agency and its owner atomically | Built | RPC `create_agency_with_owner` (`20261005000001_harden_tenant_provisioning.sql`, `20261007000004…`); `src/domain/agencies/service.ts`; `(auth)/signup/actions.ts` | Defaults are seeded in the sign-up language. If email confirmation is on, `/onboarding` asks for the agency name again. |
| Auth: email/password, reset, invite link | Partial | `(auth)/login`, `forgot-password`, `update-password`, `auth/callback/route.ts` | No SSO/OAuth and no 2FA. No session-refresh proxy (`src/proxy.ts` is absent; known gap in AGENTS.md and FR-AUT-03). |
| Roles owner / manager / broker | Partial | `20260827000002_create_agency_memberships.sql`; `040-role-policies.sql` | Role checks cover team, import, exceptions and hard deletes. Brokers can still change stages and lead sources and merge contacts. Visibility is agency-wide: there is no "my records only" or team scoping. |
| Invitations | Partial | `src/domain/members/service.ts:56-98` (Supabase `inviteUserByEmail`); `invite-dialog.tsx`; `accept_pending_invitations` RPC | Invite and cancel work. **Resend is missing**, although FR-TEM-07 claims it. Managers can invite brokers only. |
| Team management: role change, deactivate, reactivate | Built | `settings/team/actions.ts`; `member-actions.tsx`; `members/service.ts:20-54` | Owner only, with a last-owner guard and a no-self-deactivate guard. No reassignment on deactivation (§2.4). |
| User profile: display name, language | Built | `settings/profile/*`; `20261003000002_create_profiles.sql`; `20261005164955_add_profile_locale.sql` | Sign-up stores `full_name`, but the profile trigger reads `display_name` (`20261003000002…:45`), so profiles start with the email prefix. |
| Agency settings UI (name, timezone, currency, logo) | Missing | `src/domain/agencies/settings.ts` reads `agencies.settings` only; `/settings` lists only Profile, Team, Lead sources, Stages and Import (`settings/page.tsx:26-55`) | Timezone and currency can only be changed in the database. |
| Multi-tenancy isolation | Built | 16 tables with RLS `ENABLE`+`FORCE` (`010-rls-catalog.sql:6-37`); `020/021` isolation, `030` exploit regressions; `uq_one_active_membership_per_user` | One agency per user: no multi-office or franchise hierarchy. |
| Billing / subscriptions / plan limits | Missing | none | The brief prices this at EUR 99–249/month, but nothing is built. |

### 2.13 Localization

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Bulgarian and English UI | Built (with leaks) | `messages/bg.json` and `en.json` have 761 keys each with full parity; `src/i18n/config.ts:1-3` (`defaultLocale = 'bg'`); `src/i18n/request.ts` | Hardcoded English remains: `contact-detail-client.tsx:116` ("Archiving…/Archive"), `opportunities/page.tsx:54`, `exceptions/page.tsx:36`, import wizard and auth toasts (`import-wizard.tsx:97,156,185`, `forgot-password/page.tsx:35`, `update-password/page.tsx:55`), and sidebar `sr-only` labels. Repository `Error(...)` messages reach users untranslated through `toActionError` (`src/lib/actions.ts:78-83`). |
| Is Bulgarian gated by `NEXT_PUBLIC_I18N_BG_ENABLED`? | No | The flag appears only in `.env.example:4` and archived sprint docs; no file in `src/` reads it | Bulgarian is always available and is the default. The env entry is stale. |
| Language per user, synced across devices | Built | `profiles.locale`; `login/sync-locale.ts`; `auth/callback/route.ts:56-71`; `settings/profile/language-switcher.tsx` | The login and sign-up pages have no language switcher. |
| Auth emails | Partial | `supabase/templates/*.html`, `supabase/config.toml` | Bulgarian only, with no per-user language. `config.toml` applies only to local dev; a hosted project needs separate setup. |
| Currency EUR / BGN | Partial | `agencies/settings.ts:4-7` (`EUR` \| `BGN`, default EUR); opportunity currency default EUR (`20261007000004…`); `useFormatter` currency formatting in `opportunity-list-table.tsx:70` and `opportunity-detail-client.tsx:86-87` | No per-deal currency picker and no dual EUR/BGN display. |
| Timezone ("today", overdue) | Built | `src/lib/time/agency-day.ts`; `agency-day.test.ts` (DST cases) | Task due-date input and the task card's `isToday` ignore the agency timezone (§2.5, §2.6). |
| Date / number formatting | Partial | `useFormatter` in most components | `task-card.tsx:6,113,121-122` uses date-fns without a locale. |
| Bulgarian phone formats | Partial | `phone.ts` | Mobile only; landlines and non-BG numbers fail (§2.2). |

### 2.14 Mobile, responsive, PWA

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Responsive layout | Partial | `sidebar.tsx:83` (`hidden md:flex`) with the mobile `Sheet` nav (`sidebar.tsx:173-238`); `(dashboard)/layout.tsx:122` (`p-4 md:p-6`) | Only about a dozen responsive breakpoint classes in all app and domain components. The **global search is hidden below `md`** (`header.tsx:77-78`), and the agency name is hidden on mobile. The Exceptions page uses wide tables. |
| PWA (manifest, service worker, installable, offline) | Missing | No `public/` directory, manifest or service worker | BRD defers offline drafts to after the pilot. |
| Native apps | Missing | none | A pilot non-goal. |

### 2.15 Integrations and public API

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Public REST/GraphQL API, API keys | Missing | none | |
| Webhooks (in or out) | Missing | none | |
| Calendar sync (Google/Outlook) | Missing | none | |
| Email provider (Resend etc.) | Missing | none; AD-025 is a decision only | |
| Portals / listing syndication | Missing | none | Syndication is a pilot non-goal. |
| Zapier / Make | Missing | none | |

### 2.16 Search, bulk actions, files

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Global search (⌘K) across contacts, opportunities, inquiries | Built | `src/components/domain/search/command-palette.tsx`; `src/domain/search/repository.ts`; `20261001174703_sprint_4_search_vectors.sql` | Postgres full-text search with prefix matching, 5 results per type, no ranking. Hidden on mobile. The query isn't normalized, so a local-format phone (`0888…`) probably won't match a stored `+359…` value. By reading. |
| Per-list search and type-ahead | Built | Each list page's `search*QuickAction` | Opportunities: title only. |
| Bulk actions (assign, stage change, tag, delete, export) | Missing | No multi-select anywhere | |
| File attachments / documents | Missing | No Supabase Storage use and no attachment table | Document generation is a pilot non-goal. |
| Tags / custom fields | Missing | none | |

---

## 3. UI/UX observations (from reading components)

- **Navigation.** A left sidebar (collapsible on desktop, a Sheet drawer on mobile) holds Dashboard, Today,
  Contacts, Opportunities ("Сделки"), Inquiries, Settings and Exceptions; Exceptions is shown to
  owners and managers only (`src/components/layout/sidebar.tsx:32-69`). The header shows the agency name, the ⌘K
  palette and a hand-built user dropdown that is not the shadcn `DropdownMenu`
  (`header.tsx:83-132`). The header loads the user client-side in `useEffect`, so it flashes
  "Loading…". Settings has its own sub-nav, which only hides Import from brokers.
- **No inquiry or task detail pages.** Inquiries are cards with a dropdown (mark contacted, convert,
  dismiss). Tasks live only inside opportunity detail and Today. There is no `/tasks` list or calendar view.
- **Empty states** exist on the Contacts, Opportunities, Inquiries, Today, Exceptions, tasks,
  participants and timeline views (`contact-list-table.tsx:26-36`, `opportunity-list-table.tsx:19-29`,
  `today-page-client.tsx:249-255`, …), each with an icon, title and description, plus CTA buttons on Today.
- **Forms** are dialogs driven by `useActionState`, with field errors under inputs and `sonner`
  toasts for results. Inquiry conversion is one large dialog with a "new / existing contact" tab
  (`convert-inquiry-dialog.tsx`, 463 lines). Dates use a native `datetime-local`
  input. Several handlers ignore action results; for example, `handleStageChange` in
  `opportunity-detail-client.tsx:76-79` never checks for failure.
- **List density.** Opportunity rows show title, temperature emoji, type, stage, value and next action,
  but not the owner or contact. Inquiry cards show the source and a generic "Assigned" label. There is
  no column chooser or sorting control, and no pagination UI anywhere.
- **Responsiveness** relies on flex-wrap and stacked layouts with few breakpoints. Search is unavailable
  on phones. There are no sticky actions or bottom nav for one-handed use, and no click-to-call.
- **Visible defects found by reading:** the Today "due today" literal-string bug (`task-card.tsx:121`);
  next-task data dropped on the opportunity page (`task-list.tsx:245-262` → `tasks/actions.ts:72-94`);
  English strings in BG mode (§2.13); dead label maps (`TASK_TYPE_CONFIG.label` in `task-card.tsx:31-38`,
  `CHANNEL_LABELS` in `lead-source-form.tsx:19-28`).

---

## 4. Docs vs code mismatches

1. **FR-OPP-11** (filter by broker and temperature): the UI has status, type and stage filters only (`opportunities-page-client.tsx:188-236`). The repository supports `assignedTo`, but nothing passes it.
2. **FR-SRC-03** (reorder lead sources): there is no reorder action or UI (`settings/lead-sources/actions.ts` has create, update and deactivate only).
3. **FR-TEM-07** (resend invitations): there is no resend code; cancel only.
4. **FR-CON-10** (contact list paginated): server-side `?page=` only, with no pager in the UI.
5. **FR-INQ-05 / FR-INQ-11** (assign an inquiry; rows show the assigned broker): assignment is possible only at creation or conversion, because `updateInquiryAction` and `reassignInquiryAction` are unused. Cards show "Assigned" without a name.
6. **FR-TSK-04** (complete, schedule next and change stage in one flow): this works on Today only. On the opportunity page, the next task and stage are collected but ignored by `completeTaskAction`.
7. **FR-LOC-01** (Bulgarian everywhere, including errors): hardcoded English strings and untranslated repository errors remain (§2.13).
8. **FR-LOC-04** (auth emails in the user's language): templates are Bulgarian only, with no locale branching.
9. **FR-PRF-03** (real names everywhere): sign-up writes `full_name`, but `handle_new_user` reads `display_name`, so the profile name defaults to the email prefix.
10. **`domain-model.md` §3.1 and §6 gap #3** ("the inquiry update schema accepts any status; transitions unchecked"): `InquiryService` enforces `INQUIRY_STATUS_TRANSITIONS` (`service.ts:64-68,179-187`). The gap is only that the DB doesn't enforce it.
11. **`domain-model.md` §4** (Today is "per broker", "my tasks"): owners and managers get agency-wide data (`today/page.tsx:37-38`).
12. **`domain-model.md` C2 / AGENTS.md** (phones stored E.164, emails lowercase): inquiry caller fields aren't normalized and are copied raw into `contact_methods` on conversion (`inquiries/service.ts:143-148`).
13. **`domain-model.md` A1 / AGENTS.md / AD-020** (`audit_log` is append-only and written by triggers): the RLS `tenant_insert` policy (`20261005000003_harden_policies.sql`) lets any agency member insert rows through the API. Merges are recorded only in `merge_history`, never as the `'merged'` audit action.
14. **AD-036 / `domain-model.md` §3.5** (revert deletes only untouched records, with no manual notes, and marks rows reverted): the notes guard tests for empty notes only, which can't exist, and row status updates are incomplete (`20261007000003_import_revert_fn.sql:49-73`).
15. **AD-032** (a client-side `FieldError` component translates Zod keys): no such component exists. Translation happens server-side in `toActionError` (`src/lib/actions.ts:49-67`).
16. **AD-037** (introduces a `PriceDisplay` component): no such component exists. Currency is formatted inline with `useFormatter`.
17. **AD-002** (Next.js 15): `package.json` pins `next` 16.3.3 (AD-030 acknowledges 16).
18. **AD-030 / G-010** (`src/proxy.ts` refreshes sessions): the file is absent. This is already flagged in AGENTS.md and FR-AUT-03.
19. **`.env.example`** lists `NEXT_PUBLIC_I18N_BG_ENABLED=false`, but the flag was removed from code (Sprint 5 task list). It omits `NEXT_PUBLIC_APP_URL`, which `src/domain/members/service.ts:78` uses for invite redirects.
20. **Pilot brief "Included" scope** (`business-description.md` §Pilot MVP): tasks *and reminders*, Smart Lists, a lightweight buyer/tenant requirement, a property reference and manually recorded calls/messages are not built. BRD §5 openly defers them, so this is a scope gap rather than a false claim.
21. **Import `match_reason`** (code vs schema): the commit RPC writes `'db_recheck'` and `'db_recheck_update_not_fully_implemented'`, which the `import_rows.match_reason` CHECK doesn't allow.

---

## 5. Test coverage snapshot

| Suite | Files | Cases | What's covered |
|---|---|---|---|
| Vitest (`*.test.ts`) | **2**: `src/domain/contacts/phone.test.ts`, `src/lib/time/agency-day.test.ts` | 10 `it`/`it.each` blocks, 2 of them `it.todo`, expanding to about 20 assertions | Phone normalization and agency-day boundaries only. No domain service, validation, import, merge or action tests (BRD FR-TST-03 is ⚠️). |
| pgTAP (`supabase/tests/database/*.sql`) | **14** (including `000-setup-tests-hooks.sql` and `001-smoke.sql`) | 93 planned assertions | RLS catalog (16 tables), tenant read/write isolation, exploit regressions, provisioning, role policies, profile visibility, trigger integrity, import RLS, commit and revert. Not covered: import `db_recheck` path, revert with notes, the `next_action_at` trigger under edits, inquiry flows. |
| CI | `.github/workflows/ci.yml` | n/a | Runs typecheck, lint, Vitest and pgTAP on every PR and on pushes to `main`. |
| Lint baseline | `eslint-suppressions.json` | 72 suppressed errors in 29 files (68 `no-explicit-any`) | The i18n literal-string rule is `warn` with `markupOnly`, so string literals outside JSX text aren't caught. |
