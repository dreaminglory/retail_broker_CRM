# Tasks: conversion-join

> **Plan:** `tasks/plan.md` · **Spec:** `spec/conversion-join.md`
> Every task also clears the Definition of Done in `AGENTS.md`. Tick a task only after that.
> Migrations: the next free timestamps after `20261106000003`, in order (`20261107000001`…).
> pgTAP: `082-conversion-join.sql`, `083-invitation-resend.sql`.

## Phase 1: Database and seed

## Task 1: Resend spike, AD-061, branch and doc stubs
**Description:** Create `feat/conversion-join` from `feat/matching` (founder, 2026-11-06) and mark `conversion-join` In progress in `SPEC.md`.

The spike: on the local stack, invite a new email, then call `auth.admin.inviteUserByEmail` again
for the same unconfirmed user. Record whether it sends a second email with a new working link
(check Mailpit) or refuses, and write the result under this task.
- **If it refuses:** stop. Ask the founder about `auth.admin.generateLink({ type: 'invite' })`
  plus our own email through the `reminders` pipeline (spec boundary, ask first). Don't continue
  to Task 3.

Then:
- Write AD-061 in `docs/decisions-log.md` from the plan's architecture decisions and the spike
  result, and adjust `spec/conversion-join.md` where they sharpen it: `invitation_sent_at` is
  backfilled from `invited_at`, and the resend mechanism.
- Add FR-INQ-15…17 to `docs/BRD.md`, not built, and change the FR-TEM-07 note to point at this
  plan.
- `docs/domain-model.md`:
  - the join stub: `inquiries.opportunity_id` is origin or joined, `opportunities.inquiry_id` is
    origin only;
  - §3.1 "converted" covers the join;
  - a new invariant I7 for the join, enforced by RPC `join_inquiry`;
  - the glossary entry "Присъединяване".

**Spike result (2026-11-06, local stack): it sends.** A second `inviteUserByEmail` for the same
unconfirmed user returned the same user id and Mailpit held two invitation emails with different
`invite` tokens. Resend therefore uses `inviteUserByEmail` (AD-061).

**Acceptance criteria:**
- [x] The spike result (sends or refuses, with the Mailpit evidence) is written under this task
- [x] AD-061, the BRD rows, the spec adjustments and the domain-model stub are in one commit
- [x] No code or migration yet

**Verification:**
- [x] `npm run typecheck`, `npm run lint`, `npm run test` (unchanged code, docs only)

**Dependencies:** None
**Files:** `SPEC.md`, `docs/decisions-log.md`, `docs/BRD.md`, `docs/domain-model.md`,
`spec/conversion-join.md`, `tasks/todo.md`
**Scope:** S

---

## Task 2: `join_inquiry` RPC with pgTAP
**Description:** Migration `20261107000001_join_inquiry.sql` per `supabase-patterns`:
`join_inquiry(p_agency_id, p_inquiry_id, p_contact_id, p_opportunity_id, p_task jsonb)` exactly as
the plan describes it (SECURITY INVOKER, lock order, refusals as i18n keys, nurture reactivation,
owner fallback, inquiry closed, optional `call` task). `REVOKE` from `PUBLIC, anon`, `GRANT` to
`authenticated`. `convert_inquiry` is not touched. Write `082-conversion-join.sql`.

**Acceptance criteria:**
- [x] A `new` or `contacted` inquiry joins an active deal: the inquiry is `converted` with the
  deal's id and the contact, there is no new opportunity, the `call` task exists for the deal's
  owner, and `next_action_at` = its due date when that is the earliest
- [x] A nurture deal becomes `active` with `closed_at` and `lost_reason` cleared, and the audit
  row exists. A deal with no owner takes the inquiry's assignee. `p_task = NULL` creates no task
- [x] Each refusal raises its key and changes nothing: a converted or dismissed inquiry; a won,
  lost or archived deal; a contact not on the deal; a Beta caller with Alpha ids (AC-4, AC-5).
  The grants are as stated, and a `convert_inquiry` assertion from `070` still passes

**Verification:**
- [x] `npx supabase db reset` then `npm run test:db`
- [x] `npm run typecheck`, `npm run lint`, `npm run test`

**Dependencies:** Task 1
**Files:** `supabase/migrations/20261107000001_join_inquiry.sql`,
`supabase/tests/database/082-conversion-join.sql`
**Scope:** M

---

## Task 3: `invitation_sent_at` and `claim_invitation_resend` with pgTAP
**Description:** Migration `20261107000002_invitation_resend.sql`:
- `agency_memberships.invitation_sent_at TIMESTAMPTZ`, backfilled from `invited_at` where
  `status = 'invited'`.
- `claim_invitation_resend(p_membership_id)`, `SECURITY DEFINER`, `SET search_path = public`, as
  the plan describes it (agency check, role check, one conditional `UPDATE`, i18n keys), granted
  to `authenticated` only.

`MemberRepository.createInvitation` sets `invitation_sent_at`, and the `AgencyMembership` type
gets the field. Write `083-invitation-resend.sql`.

**Acceptance criteria:**
- [x] An owner claims any pending invitation and a manager claims a broker's; a manager claiming
  a manager's raises `errors.forbidden`; a broker raises `errors.forbidden`
- [x] A second claim within 5 minutes raises `errors.members.resend_too_soon`; an active,
  deactivated or another agency's membership raises `errors.members.only_pending_resend` or
  `errors.not_found`
- [x] The backfill leaves signup memberships `NULL`, and a new invitation from the service has
  the field set

**Verification:**
- [x] `npx supabase db reset` then `npm run test:db`
- [x] `npm run typecheck`, `npm run lint`, `npx vitest run src/domain/members`

**Dependencies:** Task 1 (the spike passed)
**Files:** `supabase/migrations/20261107000002_invitation_resend.sql`,
`supabase/tests/database/083-invitation-resend.sql`, `src/domain/members/repository.ts`,
`src/domain/members/types.ts`
**Scope:** S

---

## Task 4: Seed: repeat callers, a nurture deal, a stale invitation
**Description:** In `supabase/seed.sql`, per agency:
- one `new` inquiry whose caller phone matches a contact with an active buyer deal that has an
  owner;
- one `new` inquiry matching a contact whose deal is `nurture`;
- that same contact also has a `won` deal, which must not be listed (AC-3);
- one pending invitation with `invitation_sent_at` 1 day ago.

Keep the existing seeded counts that tests assert on, or update those tests in the same commit.

**Acceptance criteria:**
- [x] After `db reset`, as Alpha's broker, the two inquiries show in the inbox, the duplicate
  check suggests the right contacts, and `join_inquiry` succeeds on both seeded deals
- [x] `npm run test:services` and `npm run test:e2e` still pass with the new rows

**Verification:**
- [x] `npx supabase db reset`, `npm run test:db`, `npm run test:services`, `npm run test:e2e`

**Dependencies:** Tasks 2, 3
**Files:** `supabase/seed.sql` (plus any test asserting seeded counts)
**Scope:** S

---

## Checkpoint 1: Database
- [ ] `npx supabase db reset` + `npm run test:db` green; typecheck, lint, test green
- [ ] Founder reviews AD-061 and the spike result before any screen

## Phase 2: Join

## Task 5: Joinable deals, `InquiryService.join` and `joinInquiryAction`
**Description:**
- `InquiryRepository.findJoinableOpportunities(agencyId, contactId)`, the query the plan
  describes, with stage name and owner name resolved as the opportunities list already does.
- `joinInquirySchema` in `validation.ts`: `contact_id` and `opportunity_id` UUIDs, and
  `task: { title (1–300), due_at (ISO) } | null`.
- `InquiryService.join(id, agencyId, input)`: parse, the I3 fast fail, then the RPC, with
  `rpcFailure` for the keys. Returns `{ opportunityId, ownerId, previousAssignee, callerName,
  reactivated }`.
- In `inquiries/actions.ts`:
  - `listJoinableOpportunitiesAction(contactId)`;
  - `joinInquiryAction(id, prev, formData)`, following the mutation pattern. It calls
    `notifyIfAssignedToColleague` as conversion does and revalidates `/inquiries`,
    `/opportunities`, `/opportunities/<id>` and `/today`.
- Keys `errors.inquiries.join_*` in both message files.

**Acceptance criteria:**
- [ ] Validation tests: the task on and off, a missing id and an empty title are refused with keys
- [ ] Service suite: join happy path, nurture `reactivated = true`, a closed deal and a converted
  inquiry refused with the RPC key (AC-4), and the joinable list excludes won, lost and archived
  deals and includes a participant's deal (AC-3)
- [ ] Action tests: `ActionResult` on success and on each error. The notification goes to the
  deal's owner only when they are neither the previous assignee nor the actor (AC-6, Mailpit in
  the service suite)

**Verification:**
- [ ] `npm run typecheck`, `npm run lint`, `npx vitest run src/domain/inquiries src/app/(dashboard)/inquiries`
- [ ] `npm run test:services`

**Dependencies:** Tasks 2, 4
**Files:** `src/domain/inquiries/{repository,validation,service}.ts` and tests,
`src/app/(dashboard)/inquiries/actions.ts` and `actions.test.ts`, `messages/{bg,en}.json`
**Scope:** M

---

## Task 6: Join step in the convert dialog and "Joined to" on the inquiry card
**Description:** The dialog changes:
- New `src/components/domain/inquiries/join-opportunity-step.tsx`, rendered by
  `convert-inquiry-dialog.tsx`.
- With an existing contact that has joinable deals, a "New opportunity" / "Join an existing one"
  choice appears; New is the default.
- Join shows:
  - the deal rows: title, type, stage, owner, next action;
  - the deal's owner, in place of the assignee field;
  - the nurture reactivation notice;
  - "Schedule a call back", on by default, with an editable title and due time (now + 1 h in
    agency time);
  - a "Join" / "Присъедини" button that calls `joinInquiryAction` and redirects to the deal.

The duplicate suggestion's "use this contact" returns to the dialog with that contact selected
instead of converting straight away. The create-only path still converts in one step. On the
inquiry card, a converted inquiry whose `opportunity_id` isn't the deal's origin says "Joined to
<deal>". Keys under `inquiries.join.*` in both files.

**Acceptance criteria:**
- [ ] On a seeded repeat caller: pick the suggested contact, choose Join, keep the call back,
  join. You land on the deal, and the task is on Today for its owner (AC-1)
- [ ] The seeded nurture deal shows the notice and is active after joining (AC-2); the won deal
  isn't listed and a new contact sees no join choice (AC-3)
- [ ] BG and EN at 1280 and 390 px, no hardcoded strings, no synchronous `setState` in
  `useEffect` (AC-9 part)

**Verification:**
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`
- [ ] Browser: Alpha broker, both seeded inquiries, `bg` and `en`, 1280 and 390 px

**Dependencies:** Task 5
**Files:** `src/components/domain/inquiries/{convert-inquiry-dialog,join-opportunity-step,inquiry-card}.tsx`,
`messages/{bg,en}.json`
**Scope:** M

---

## Task 7: Inquiries on the opportunity timeline
**Description:** `TimelineService.getOpportunityTimeline` reads `inquiries` where
`opportunity_id` = the deal (with `agency_id`, same paging as the other sources) and the deal's
`inquiry_id`. It passes the inquiries to `mergeAndSort` with a `joined` flag and `joined_at` =
`updated_at`. The inquiry timeline item shows "Joined on <date>" for a joined one. The contact
timeline is unchanged. Keys under `timeline.inquiry.*`.

**Acceptance criteria:**
- [ ] Unit tests: an origin inquiry without the flag, a joined one with the flag and date, paging
  across sources, and the contact timeline unchanged (`service.test.ts`)
- [ ] In the browser, the seeded deal shows its origin inquiry, and after Task 6's join it shows
  the joined one (AC-7)

**Verification:**
- [ ] `npm run typecheck`, `npm run lint`, `npx vitest run src/domain/timeline`
- [ ] Browser: a seeded deal in `bg` and `en`

**Dependencies:** Task 2 (data), Task 4 (seed). Independent of Task 6's files.
**Files:** `src/domain/timeline/{service,types}.ts`, `service.test.ts`, the timeline inquiry item
component, `messages/{bg,en}.json`
**Scope:** S

---

## Checkpoint 2: Join end to end
- [ ] AC-1…AC-7 seen in the browser on seeded data, BG and EN, 1280 and 390 px
- [ ] `npm run test`, `npm run test:services` green
- [ ] Review with the founder before Phase 3

## Phase 3: Resend and close-out

## Task 8: Resend invitation on the team page
**Description:** `MemberService.resendInvitation(ctx, membershipId)`:
- call `claim_invitation_resend`;
- on success, send with the mechanism Task 1 chose (`inviteUserByEmail` with the same `data` and
  `redirectTo` as `inviteMember`);
- on a send failure, log it and throw `errors.members.invite_failed`. The cooldown stands
  (plan risk).

`resendInvitation` action in `settings/team/actions.ts`, following the mutation pattern. On the
team page, pending rows show "Sent on <date>" (`useFormatter`) and a "Resend" button. The toast
shows success, or the cooldown refusal with the time it is allowed again
(`invitation_sent_at` + 5 min, formatted). Keys under `team.resend.*` and `errors.members.*` in
both files.

**Acceptance criteria:**
- [ ] Unit tests (admin client mocked): the claim and then the send are called in that order, a
  claim refusal never sends, and a send failure returns the error. The action returns
  `ActionResult`
- [ ] In the browser and Mailpit: an owner resends the seeded invitation, a second email arrives
  with a working link, and an immediate second resend shows the cooldown toast. A manager sees
  Resend on broker rows only (AC-8)
- [ ] BG and EN at 1280 and 390 px (AC-9 part)

**Verification:**
- [ ] `npm run typecheck`, `npm run lint`, `npx vitest run src/domain/members src/app/(dashboard)/settings/team`
- [ ] Browser + Mailpit as owner and as manager, `bg` and `en`

**Dependencies:** Tasks 3, 4
**Files:** `src/domain/members/service.ts`, `service.test.ts`,
`src/app/(dashboard)/settings/team/{actions,page}.tsx` (plus the team table component if
separate), `messages/{bg,en}.json`
**Scope:** M

---

## Task 9: E2E and the docs as built
**Description:**
- E2E:
  - extend `e2e/core-loop.spec.ts`: join the seeded repeat inquiry to its deal, see the call-back
    task on Today and the joined entry on the deal timeline;
  - extend `e2e/settings-team.spec.ts`: resend the seeded invitation and see the success toast.
  - Both in BG and EN, at 1280 and 390 px.
- Docs:
  - `docs/domain-model.md` as built: I7, §3.1, §3.4 `invitation_sent_at`, the timeline paragraph,
    the migration count;
  - `docs/BRD.md`: FR-INQ-15…17 and FR-TEM-07 ✅;
  - `SPEC.md` §5: remove "resend invitation" from Known gaps.

**Acceptance criteria:**
- [ ] `npm run test:e2e` passes at both widths and in both languages
- [ ] The docs match the code (rule 4 of the `crm-domain-model` skill)

**Verification:**
- [ ] Full DoD: `npm run typecheck`, `npm run lint`, `npm run test`, `npx supabase db reset`,
  `npm run test:db`, `npm run test:services`, `npm run test:e2e`

**Dependencies:** Tasks 6, 7, 8
**Files:** `e2e/core-loop.spec.ts`, `e2e/settings-team.spec.ts`, `docs/domain-model.md`,
`docs/BRD.md`, `SPEC.md`
**Scope:** S

---

## Checkpoint 3: Complete
- [ ] Every DoD item seen passing; AC-1…AC-9 met
- [ ] `/review`, then close the module (SPEC.md Done, BRD rows, archive `tasks/*`)
