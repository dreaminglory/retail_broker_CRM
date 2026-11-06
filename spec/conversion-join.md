# Spec: conversion-join

> **Status:** Approved scope (founder, 2026-11-06). Decisions: AD-061 (to write before
> the migration). Requirements: FR-INQ-15…17, FR-TEM-07.
> **Evidence:** business brief "Pilot Acceptance Criteria" ("An inquiry can be matched to a
> contact and **create or join** an opportunity"), SPEC.md pilot gate, BRD FR-TEM-07 ⚠️.
> Scope answers from the founder (2026-11-06): join active and nurture deals (nurture is
> reactivated); an optional call-back task, not required; the deal's owner keeps the deal;
> resend by whoever may send that invitation, at most once per 5 minutes.
> Assumptions A1–A4 are unvalidated.

## Objective

A known client calls again, or a buyer who is already being worked asks about another listing on
imot.bg. Today the broker can only convert that inquiry into a **new** opportunity, so one search
splits into two deals with two owners and two next actions, or the broker dismisses the inquiry
and its history is lost. This module lets a conversion **join** the client's existing open
opportunity instead: the inquiry closes, lands on that deal's timeline, and the deal's owner is
told and can schedule a call back. Pilot-gate item.

It also closes FR-TEM-07: a pending invitation whose email was lost or whose link expired can be
**resent** from the team page, instead of cancelling and inviting again.

**Users:** any member converting an inquiry (brokers in the inbox, owners and managers in the
inbox and Exceptions); the deal's owner, who gets the repeat inquiry; owners and managers on the
team page.

**Not in this module:** joining at CSV import, automatic join without a person deciding,
splitting a joined inquiry back out, moving an inquiry from one deal to another, merging two
opportunities, inquiry audit history (domain model §6 gap 2), portal intake (`lead-intake`).

## Data model (AD-061)

No new table. A join reuses the existing columns:

```
inquiries.opportunity_id ──> opportunities      (origin or joined: every inquiry that ended in this deal)
opportunities.inquiry_id ──> inquiries          (origin only: the inquiry the deal was created from; unchanged)
```

- A joined inquiry gets `status = 'converted'`, `contact_id` = the chosen contact and
  `opportunity_id` = the joined deal. No new status: `converted` already means "closed into a
  deal", and I3 (`converted` is final) and every Today, Exceptions and digest count stay right
  without a change. Origin vs joined is derived: `opportunities.inquiry_id = inquiries.id`.
- `agency_memberships.invitation_sent_at timestamptz`: set when an invitation is sent and on
  each resend; backfilled from `created_at` for pending invitations. `NULL` on memberships
  created at signup.
- New RPC `join_inquiry(p_agency_id, p_inquiry_id, p_contact_id, p_opportunity_id, p_task jsonb)`
  next to `convert_inquiry` (which is not changed): locks the inquiry and the opportunity, checks
  the rules below, reactivates a nurture deal, sets the deal's owner if it had none, closes the
  inquiry and creates the optional task, all or nothing (AD-050 pattern). Returns i18n keys on
  refusal.

## Business rules

1. **Joinable deals.** The conversion dialog offers "Join an existing opportunity" only for an
   existing contact (picked, or chosen from the duplicate suggestion). It lists the agency's
   `active` and `nurture` opportunities where the contact is the primary contact or a contact
   participant, newest activity first, with type, stage, owner and next action. Won, lost and
   archived deals aren't listed; the broker creates a new opportunity instead. A new contact has
   no deals, so it can only create.
2. **Locked check.** The RPC refuses, with a translated message, an inquiry that isn't `new` or
   `contacted` (I3), an opportunity of another agency, one that isn't `active` or `nurture` at
   the moment of the join, and a contact that isn't on that opportunity. The inquiry and the
   opportunity are locked (`FOR UPDATE`, in id order), so a simultaneous close or a second
   conversion can't slip through.
3. **Nurture comes back.** Joining a `nurture` deal sets it to `active` and clears `closed_at`,
   exactly as the opportunity's Reactivate action does (stage unchanged, audited by the existing
   trigger). The dialog says so before the broker confirms.
4. **Ownership.** The deal's owner doesn't change. A deal with no owner takes the inquiry's
   assignee, if any (audited as an assignment). The dialog shows the deal's owner and hides the
   assignee field when joining.
5. **Call back (soft, AD-014).** The join form has "Schedule a call back", on by default: a call
   task "Обратно обаждане по запитване" / "Call back about the inquiry", due in 1 hour in agency
   time, editable, assigned to the deal's owner (the person acting when the deal has none). The
   broker can switch it off; the deal's existing tasks stay as they are. The task trigger keeps
   `next_action_at` right (O3).
6. **Notification.** The deal's owner gets the assignment email for the inquiry, linking to the
   opportunity, under the conversion rule of AD-053: when they are neither the inquiry's assignee
   nor the person acting. A failed email never fails the join.
7. **Timeline.** The opportunity timeline shows every inquiry with `opportunity_id` = the deal
   (origin and joined) as an inquiry entry at its `received_at`: source, caller, message, and
   "joined" with the date for a joined one. The contact timeline already shows them. Today the
   opportunity timeline shows no inquiry at all; this fixes the origin one too.
8. **Merge and import.** Merging contacts already moves inquiries to the winner (C4) and doesn't
   touch `opportunity_id`. An import revert already skips converted inquiries; a joined one is
   converted, so it's skipped too. Nothing to change; tests prove both.
9. **Resend invitation.** On the team page an `invited` membership shows "Sent on …" and
   "Resend". Whoever may send that invitation may resend it (owner: any role; manager: brokers
   only, FR-SEC-04). It sends a fresh invitation link to the same email with the same role and
   sets `invitation_sent_at`. At most once per 5 minutes per invitation: the write is conditional
   on `invitation_sent_at` (as K3), so two clicks can't both send; a refusal says when it can be
   sent again. An accepted, cancelled or deactivated membership can't be resent.
10. **Tenancy.** Every query filters by `agency_id`; the RPC checks every id against the caller's
    agency (FKs don't see RLS); RLS stays the safety net.

## Screens

- **Convert dialog (inquiry inbox, Exceptions):** after the contact step, for an existing contact
  with joinable deals, a choice "New opportunity" / "Join an existing one" (default: new). Join
  shows the deal list from rule 1, then the call-back block from rule 5 and, for a nurture deal,
  the reactivation notice. The button reads "Join" / "Присъедини". On success it goes to the
  opportunity, like a conversion. Mobile (390 px): the same steps, the deal list as stacked rows.
- **Inquiry card:** a converted inquiry links to its deal as today; a joined one says
  "Joined to <deal>" / "Присъединено към <сделка>".
- **Opportunity timeline:** inquiry entries per rule 7.
- **Team page:** "Sent on <date>" and "Resend" on pending invitations, with a toast on success
  and on the cooldown refusal.
- **Glossary:** join = **Присъединяване** (verb "присъедини към сделка"), added to
  `docs/domain-model.md` §7 [ASSUMPTION A4: brokers read "присъедини" as intended; founder to
  confirm the term in review].

## Where it lives

- Migration `supabase/migrations/20261107000001_conversion_join.sql` (`join_inquiry`,
  `invitation_sent_at` with backfill); pgTAP `supabase/tests/database/082-conversion-join.sql`.
- `src/domain/inquiries/` (`joinInquirySchema` in `validation.ts`, `join()` in `service.ts`,
  joinable-deals query in `repository.ts`); `src/domain/timeline/service.ts` for rule 7;
  `src/domain/members/` for resend.
- UI: `src/components/domain/inquiries/convert-inquiry-dialog.tsx` (split the join step into its
  own component if the dialog grows past ~450 lines); team page under
  `src/app/(dashboard)/settings/team/`.
- Server Actions: `joinInquiry` in `src/app/(dashboard)/inquiries/actions.ts`,
  `resendInvitation` in `src/app/(dashboard)/settings/team/actions.ts`.
- Keys under `inquiries.join.*`, `timeline.inquiry.*` and `team.resend.*` in both
  `messages/bg.json` and `messages/en.json`.
- Commands, code style and the mutation pattern: `AGENTS.md`.

## Success criteria

- **AC-1** An inquiry from a caller whose phone matches a contact with an active buyer deal:
  the broker picks the suggested contact, chooses "Join", picks the deal, keeps the call back and
  joins. The inquiry is converted, the deal has a pending call task in 1 hour for its owner, its
  next action moved if the task is earlier, and its timeline shows the inquiry as joined. No new
  opportunity exists (FR-INQ-15).
- **AC-2** Joining a nurture deal makes it active, says so beforehand, and the timeline shows the
  reactivation (FR-INQ-15).
- **AC-3** The deal list shows only the contact's active and nurture deals (primary or
  participant); a won deal of the same contact isn't listed. A new contact sees no join option.
- **AC-4** Joining a deal that someone closed while the dialog was open, or an inquiry someone
  converted meanwhile, is refused with a translated message and changes nothing (pgTAP and
  service suite) (FR-INQ-16).
- **AC-5** A broker of Beta can't join an Alpha inquiry, deal or contact through the RPC, and a
  contact that isn't on the deal is refused (pgTAP).
- **AC-6** The deal's owner gets the assignment email (Mailpit) when they are neither the
  inquiry's assignee nor the one joining; the person acting doesn't email themselves.
- **AC-7** The opportunity timeline shows the origin inquiry of a converted deal and every joined
  one; the contact timeline is unchanged (FR-INQ-17).
- **AC-8** An owner resends a pending manager invitation; Mailpit has a second email with a
  working link; a second resend within 5 minutes is refused with the time it's allowed again; a
  manager can resend a broker invitation but not a manager one (FR-TEM-07).
- **AC-9** Dialog and team page work in BG and EN at 1280 and 390 px; no hardcoded strings.

**FR rows (BRD):** new FR-INQ-15 join an existing active or nurture opportunity at conversion,
with an optional call back; FR-INQ-16 join is atomic and refused on a closed deal or a closed
inquiry; FR-INQ-17 the opportunity timeline shows its inquiries; FR-TEM-07 becomes ✅.

## Testing strategy

- **pgTAP `082-conversion-join.sql`:** `join_inquiry` happy path (inquiry converted with the
  deal's id, task created, `next_action_at` set); nurture reactivation; refusals of rule 2 (each
  with its key); cross-agency ids; a deal with no owner takes the inquiry's assignee;
  `convert_inquiry` behaviour unchanged; grants (`authenticated` only); `invitation_sent_at`
  backfill.
- **Vitest:** `joinInquirySchema` (task on/off, due date, required ids); `InquiryService.join`
  in the service suite (I3 guard, rule 4, notification recipient of rule 6, rule 8 merge and
  revert); timeline mapping of origin and joined inquiries; `MemberService.resendInvitation`
  (roles, cooldown, non-pending refusal) with the admin client mocked; the action tests for
  `joinInquiry` and `resendInvitation` (`ActionResult`, `toActionError`).
- **E2E (Playwright):** extend the core loop: convert the seeded repeat inquiry by joining the
  seeded buyer deal, see the call-back task on Today and the inquiry on the deal timeline. Resend
  a seeded pending invitation. BG and EN, 1280 and 390.
- **Seed:** per agency, one `new` inquiry whose caller phone matches a contact with an active
  deal, one matching a contact with a nurture deal, and one pending invitation with
  `invitation_sent_at` older than 5 minutes.

## Boundaries

- Always: the `supabase-patterns` checklist for the migration and RPC; filter by `agency_id` in
  the repository; Zod + service + RPC for the joinable-deal rules, the RPC being the one that
  decides; update `docs/domain-model.md` (§2 note on `inquiries.opportunity_id`, §3.1 and §3.4,
  I6, a new invariant for the join, glossary, migration count) in the migration commit; write
  AD-061 before the migration.
- Ask first: any change to `convert_inquiry`'s signature or behaviour; a new inquiry status; a
  new dependency; sending the resend email through Resend instead of Supabase Auth (see open
  question 1).
- Never: write `audit_log` or `next_action_at` from app code; modify `raw_payload`; join without
  a person choosing the deal; reuse `opportunities.inquiry_id` for joined inquiries.

## Out of scope

Join at CSV import or from Exceptions bulk actions, auto-join suggestions ranked by score,
joining a won, lost or archived deal, moving a joined inquiry to another deal, merging
opportunities, an inquiry count on the opportunity list, resending accepted or expired-account
invitations, cancelling and resending in bulk, a configurable cooldown.

## Cut order if time runs short

1. "Joined to <deal>" wording on the inquiry card (it still links to the deal).
2. "Sent on" date on the team page (resend and cooldown stay).
3. The participant half of rule 1 (primary contact only).

## Assumptions

- **A1** Active and nurture cover the deals a repeat inquiry belongs to. Validate: new
  opportunities created for a contact that already has a won or lost deal in the last 90 days.
- **A2** A call back in 1 hour is the right default. Validate: share of joins with the task
  switched off or its due date changed.
- **A3** A contact participant (e.g. a spouse) calling about the deal belongs on that deal.
  Validate: joins from participants later moved or complained about.
- **A4** "Присъединяване" is the term brokers understand (glossary).

## Open questions (for the plan, not the founder)

1. **How the resend sends.** Supabase `inviteUserByEmail` for an auth user that already exists
   and hasn't confirmed: re-sends, or refuses? The first plan task is a spike against the local
   stack. Fallback: `auth.admin.generateLink({ type: 'invite' })` and our own email through the
   `reminders` email pipeline (Mailpit locally), which needs an ask-first (boundary above).
2. **Duplicate suggestion → join.** The duplicate modal today replaces the new contact with the
   chosen one and converts; it must instead return to the dialog so the join choice can appear.
   Confirm in the plan that this doesn't change the create-only path.
