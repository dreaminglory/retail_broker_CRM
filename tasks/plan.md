# Implementation Plan: conversion-join

> **Spec:** `spec/conversion-join.md` · **Checklist:** `tasks/todo.md`
> **Status:** Plan approved (founder, 2026-11-06). Approved scope (founder, 2026-11-06).
> Decisions: AD-061 (written in Task 1). Branch: `feat/conversion-join`, cut from `feat/matching`
> (founder, 2026-11-06; `main` doesn't have `requirements` or `matching` yet).

## Overview
When an inquiry comes from a contact who already has an open deal, the broker can join it to that
deal instead of creating a second one. The deal's timeline then shows the inquiry, and the deal's
owner gets the email and an optional call back. Separately, a pending invitation can be resent.
Three phases:
- **Phase 1: database and seed.** It builds the two database functions that decide everything,
  and the seed rows every later test uses. It starts with a short spike on the one unknown: how
  Supabase resends an invitation.
- **Phase 2: the join, as vertical slices.** Service and action, then the dialog, then the deal
  timeline.
- **Phase 3: resend and E2E.** The resend slice on the team page, then the E2E test and the docs
  as built.

## Architecture decisions
Where the plan sharpens the spec. Task 1 records these as AD-061 and adjusts
`spec/conversion-join.md` where they change it. Acceptance criteria AC-1…AC-9 stay as they are.

- **`join_inquiry` is its own RPC, beside `convert_inquiry`.** It is `LANGUAGE plpgsql`,
  `SECURITY INVOKER` (as `convert_inquiry`; RLS applies) and `SET search_path = public`, granted to
  `authenticated` only. Signature:
  `join_inquiry(p_agency_id, p_inquiry_id, p_contact_id, p_opportunity_id, p_task jsonb)
  RETURNS jsonb { opportunity_id, owner_id, reactivated, task_id }`. Steps:
  - Lock order is always the inquiry first, then the opportunity (`FOR UPDATE`), so two joins
    can't deadlock.
  - Refusals raise i18n keys:
    - `errors.not_found`: wrong agency or a missing id.
    - `errors.inquiries.invalid_transition`: the inquiry isn't `new` or `contacted`.
    - `errors.inquiries.join_closed_opportunity`: the deal isn't `active` or `nurture`.
    - `errors.inquiries.join_contact_not_on_opportunity`: the contact is neither the primary
      contact nor a contact participant.
  - A `nurture` deal gets `status = 'active', closed_at = NULL, lost_reason = NULL`, the same
    update as `OpportunityRepository.reactivate`. The existing audit trigger records it.
  - A deal with no owner gets `assigned_to` = the inquiry's assignee.
  - The inquiry gets `status = 'converted'`, `contact_id`, and `opportunity_id` = the deal.
  - If `p_task` is not null, it inserts a `task_type = 'call'` task on the deal and the contact,
    with title and `due_at` from `p_task`. The assignee is the deal's owner after the step above,
    else `auth.uid()`. The task trigger sets `next_action_at` (O3).
- **The task title comes from the form.** The RPC doesn't see the locale, so the dialog prefills
  the translated title and sends it. That matches the spec: the title is editable. `due_at`
  defaults to now + 1 h, computed with the agency timezone helpers (`src/lib/time/agency-day.ts`).
- **Joinable deals come from one repository query.** It reads the agency's `active` and `nurture`
  opportunities where `primary_contact_id` = the contact, or which have a participant with that
  `contact_id`. It returns type, stage, owner and `next_action_at`, ordered by `updated_at` desc,
  with at most 20 rows (A1: a contact rarely has more). The RPC re-checks all of it: the query
  only shapes the list.
- **Notification reuses `notifyIfAssignedToColleague`.** It is called with the inquiry's
  `previousAssignee` and the deal's owner, exactly as conversion does (AD-053). That already gives
  rule 6: no email when the owner is the inquiry's assignee or the person acting.
- **The timeline marks a joined inquiry.** `getOpportunityTimeline` reads `inquiries` where
  `opportunity_id` = the deal, plus that deal's `inquiry_id`. An entry is `joined` when its id
  differs from the deal's `inquiry_id`. The "joined on" date is the inquiry's `updated_at`: I3
  makes a converted inquiry final, so `updated_at` is the conversion time. No new column.
- **Resend claims first, then sends.** Memberships are owner-only for `UPDATE` (RLS policy
  `owners_can_update_memberships`), but managers resend broker invitations. So a new
  `claim_invitation_resend(p_membership_id) RETURNS jsonb { email, role, user_id }` is
  `SECURITY DEFINER` and checks everything itself:
  - The caller's agency, and the role: an owner may resend any invitation, a manager only a
    broker's.
  - One conditional `UPDATE ... SET invitation_sent_at = now() WHERE status = 'invited' AND
    (invitation_sent_at IS NULL OR invitation_sent_at < now() - interval '5 minutes')`. When no
    row is updated, it raises `errors.members.resend_too_soon` or
    `errors.members.only_pending_resend`.

  Only after a successful claim does `MemberService.resendInvitation` send the email. Two clicks
  can't both send.
- **`invitation_sent_at` has no default.** It is backfilled from `invited_at` for `invited` rows.
  `MemberRepository.createInvitation` sets it on insert. Signup memberships stay `NULL`, as the
  spec says. (The spec said "from `created_at`"; `invited_at` already exists and is the better
  source.)

## Task list
Full tasks with acceptance criteria and verification: `tasks/todo.md`.

### Phase 1: Database and seed
- [ ] Task 1: Resend spike, AD-061, branch and doc stubs (S)
- [x] Task 2: `join_inquiry` RPC with pgTAP (M)
- [x] Task 3: `invitation_sent_at` and `claim_invitation_resend` with pgTAP (S)
- [x] Task 4: Seed: repeat callers, a nurture deal, a stale invitation (S)

### Checkpoint 1: Database
- [ ] `npx supabase db reset`, `npm run test:db`, typecheck, lint and test green; `test:services`
  and `test:e2e` still green with the new seed
- [ ] Founder reviews AD-061 and the spike result before any screen

### Phase 2: Join
- [x] Task 5: Joinable deals, `InquiryService.join` and `joinInquiryAction` (M)
- [ ] Task 6: Join step in the convert dialog and "Joined to" on the inquiry card (M)
- [ ] Task 7: Inquiries on the opportunity timeline (S)

### Checkpoint 2: Join end to end
- [ ] AC-1…AC-7 seen in the browser on seeded data, BG and EN, 1280 and 390 px
- [ ] `npm run test:services` green

### Phase 3: Resend and close-out
- [ ] Task 8: Resend invitation on the team page (M)
- [ ] Task 9: E2E and the docs as built (S)

### Checkpoint 3: Complete
- [ ] Every DoD item in `AGENTS.md` seen passing; AC-1…AC-9 met
- [ ] `/review` before closing the module

## Dependencies
```
T1 ─┬─ T2 ─┬─ T5 ─── T6
    │      ├─ T7
    │      └─ T4 (seed uses the shape only; can run after T2 and T3)
    └─ T3 ─── T8
T4 ─── T6, T8 (browser checks), T9
T6, T7, T8 ─── T9
```
Tasks 7 and 8 don't touch Task 6's files. Once Phase 1 is done, either could run in parallel with
Task 6. The migrations stay sequential (Tasks 2 and 3).

## Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| `inviteUserByEmail` refuses an auth user who already exists | High: resend needs another email path (an ask-first item) | Task 1 spike on the local stack before anything else. If it refuses, stop and ask the founder about `generateLink` + our email pipeline |
| A claimed resend whose email then fails blocks a retry for 5 minutes | Low | The toast says when it can be retried; the failure is logged. Revisit if pilots hit it |
| The duplicate modal's "use this contact" converts straight away today | Med: the join choice never appears on the main path | Task 6 changes it to return to the dialog with the contact selected; the create-only path keeps its test |
| `convert-inquiry-dialog.tsx` is already 428 lines | Low | The join step goes in its own `join-opportunity-step.tsx` |
| A deadlock between a join and a close of the same deal | Low | One lock order (inquiry, then opportunity); a close locks only the opportunity |
| `MemberRepository.getMembership` reads by id without `agency_id` (existing) | Low: RLS still scopes it | Resend goes through the RPC's agency check; noted for `/review`, not fixed here |

## Open questions
None. The branch base was resolved by the founder on 2026-11-06: `feat/matching`.
