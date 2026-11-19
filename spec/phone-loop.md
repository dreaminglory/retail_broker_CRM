# Spec: phone-loop

> **Status:** Approved scope (founder, 2026-11-19). Decisions: AD-065 (to write before the
> migration). Requirements: new FR-COM-01…05.
> **Evidence:** gap analysis #2 (click-to-call, `viber://`, `wa.me`, `mailto:` plus a post-call
> prompt), benchmark B-05, B-07, B-09, B-10, feature inventory ("no `tel:` anywhere in `src/`",
> "speed-to-lead can't be computed"), `smart-lists` A3 ("calls logged outside the CRM aren't
> seen").
> Scope answers from the founder (2026-11-19): a logged call is a **completed `call` task** (no
> new table); an inquiry is contacted at the **first attempt**, answered or not; Viber and
> WhatsApp on **every mobile number**; "No answer" **offers a retry task**.
> Assumptions A1–A5 are unvalidated.

## Objective

Bulgarian brokers work from their phone: they see a name, call or Viber the client, and the
CRM never hears what happened. Every phone and email in the app is plain text today, so calling
means copying a number, and logging the call means finding the deal, opening a task and typing
an outcome. Most calls are never logged, Today's next actions go stale, and nobody can say how
fast an inquiry was first contacted.

This module makes every phone and email one tap from a call, a Viber or WhatsApp chat or an
email, and asks **"Did you reach them?"** the moment the broker comes back to the app. One
answer logs the call and sets the next action: answered → outcome and next step; no answer → a
retry in one tap. The first logged attempt on an inquiry stamps `inquiries.contacted_at`, so
speed to lead becomes measurable (the data `reports` and a later smart-list filter need).

It serves the north star directly: a call that ends in the prompt ends with a next action.

**Users:** every member, mainly brokers on a 390 px phone; owners and managers read the result
(timelines, Today, contacted times).

**Not in this module:** a dialer, call recording or telephony integration, reading call
duration or the phone's call log, a Viber/WhatsApp inbox or sending templated messages (non-goal),
SMS, inbound call detection (an inbound call is logged with the manual "Log call"), reports and
speed-to-lead dashboards (`reports`), a "not contacted within N hours" smart-list filter or
Exceptions section (follow-up once `contacted_at` exists), links on property party rows and list
tables.

## Data model (AD-065)

No new table. A logged call reuses `tasks`, which already carry an outcome, an assignee, the
timeline and the next-action trigger.

```
tasks.inquiry_id ──> inquiries   (NEW, nullable, ON DELETE SET NULL: a call made before conversion)
tasks.channel                    (NEW, nullable: phone | viber | whatsapp | email)
inquiries.contacted_at           (NEW, nullable timestamptz: first outreach, set once, never moved)
```

- **`tasks.channel`**: how the outreach happened. Set only by the post-call prompt and "Log
  call"; `NULL` for every other task. `phone`, `viber` and `whatsapp` use `task_type = 'call'`
  (a Viber chat is still a call attempt in broker terms); `email` uses `task_type = 'email'`.
- **`tasks.inquiry_id`**: a call on an inquiry that has no contact or deal yet. Same agency as
  the task (checked in the trigger and RLS, FKs don't see RLS). Index `(agency_id, inquiry_id)`
  partial on `inquiry_id IS NOT NULL`.
- **`inquiries.contacted_at`** is set by triggers only (like `next_action_at`), never from app
  code:
  - `trg_task_marks_inquiry_contacted` (AFTER INSERT OR UPDATE OF status on `tasks`): a task that
    is `completed`, has `inquiry_id` and `task_type IN ('call','email')` sets
    `contacted_at = COALESCE(contacted_at, completed_at)` and moves `new → contacted`. It never
    touches a `converted` or `dismissed` inquiry's status.
  - `trg_inquiry_contacted_at` (BEFORE UPDATE OF status on `inquiries`): a move to `contacted`
    or `converted` with `contacted_at` still `NULL` sets it to `now()`. So the existing "Mark
    contacted" and a conversion without a logged call still give a time (A3).
  - No backfill: existing `contacted` and `converted` inquiries keep `NULL` ("unknown"); their
    `updated_at` is moved by edits and merges and would lie.
- **Conversion carries the calls along.** `trg_inquiry_tasks_follow` (AFTER UPDATE OF
  `opportunity_id, contact_id, status` on `inquiries`):
  - when an inquiry gets an `opportunity_id` (convert or join), its tasks get that
    `opportunity_id` and the inquiry's `contact_id` where theirs are `NULL`; the existing tasks
    trigger then recomputes the deal's `next_action_at` (O3) for a pending retry.
  - when an inquiry is `dismissed`, its `pending` tasks become `cancelled` with outcome
    `phoneLoop.cancelledByDismiss` (an i18n key, rendered translated).
  - `convert_inquiry` and `join_inquiry` are **not** changed (their signatures and bodies stay).

## Business rules

1. **Links everywhere a number is shown** (scope of this module): the contact page's methods,
   the inquiry card (inbox, Today's New inquiries, Exceptions), the opportunity page's primary
   contact and contact participants, and Today's `call` task cards (the task's contact's primary
   phone, else the inquiry's caller phone).
   - Phone: **Call** → `tel:+359…` (E.164).
   - Mobile phone (libphonenumber type `MOBILE` or `FIXED_LINE_OR_MOBILE`), and every method
     saved as `viber` or `whatsapp`: also **Viber** → `viber://chat?number=%2B359…` and
     **WhatsApp** → `https://wa.me/359…` (digits only). A landline gets Call only.
   - Email: **Email** → `mailto:`.
   - A legacy number that doesn't parse (domain model gap 4) gets Call with its digits and no
     messenger buttons.
   - Buttons are real `<a href>` links (long-press and "open with" work), at least 44 × 44 px
     at 390 px, with an `aria-label` naming the action and the person.
2. **Context of a tap.** Each link carries its context, which the prompt logs against:
   inquiry card → the inquiry; opportunity page → the deal and the tapped contact; contact page
   → the contact, plus its one `active` deal if it has exactly one (a picker in the prompt when
   it has several, "no deal" allowed); Today call task → that task's deal/contact/inquiry **and
   that task**.
3. **When the prompt appears.** Tapping Call, Viber or WhatsApp stores one pending intent
   (`{context, channel, label, tappedAt}`) in `sessionStorage`; a newer tap replaces it. The
   prompt opens when the page becomes visible again after being hidden for at least 5 seconds
   and within 2 hours of the tap. If the page doesn't hide within 3 seconds (desktop, a `tel:`
   confirmation dialog), a `sonner` toast "Log the call with <name>" with a **Log** button stays
   for 2 minutes instead. `mailto:` never prompts by itself (writing an email takes longer than a
   return trip); it can be logged with "Log call". Logging or closing the prompt clears the
   intent. Nothing is written until the broker answers.
4. **"Log call" by hand.** The same contexts have a **Log call** action (inquiry card menu,
   opportunity page, contact page) opening the same prompt with a channel picker (default
   phone). It covers inbound calls and calls from the broker's own contacts app.
5. **The prompt.** Title "Did you reach <name>?" / "Свързахте ли се с <име>?". Three choices:
   - **Answered:** outcome (required, K1; textarea, focus on open), then **Next action**:
     presets *tomorrow 09:00*, *+2 days*, *next Monday 09:00*, *custom* (agency time,
     `reschedule.ts` and `parseAgencyLocal`), or *none*. On a deal, an optional stage change, as
     in `completeWithNext`. The next task defaults to `call`, title "Follow up with <name>",
     assigned to the person acting.
   - **No answer:** outcome prefilled "No answer" / "Не вдига" (editable). **Retry** presets
     *in 1 h*, *today 18:00* (shown only before 17:00 agency time), *tomorrow 09:00*, or *no
     retry*; default *in 1 h*. A retry is a pending `call` task, title "Call again: <name>".
   - **Not now:** closes the prompt and clears the intent, logs nothing.
6. **What is written.** One Server Action `logCall` → `CallService.log` in one call to the
   existing `completeWithNext` path (no new RPC unless the plan shows two writes must be atomic):
   - If the context has a **pending `call` task assigned to the person acting** (the tapped
     Today task, else the earliest by `due_at` on that deal or inquiry), the prompt says
     "Completes: <task title>" and completes **that** task with the outcome and the channel
     (a switch lets the broker log a separate call instead).
   - Otherwise it inserts a completed `call` (or `email`) task with the outcome, `channel`,
     `completed_at = now()`, the context's `opportunity_id`, `contact_id`, `inquiry_id`, assigned
     to and created by the person acting; title "Call with <name>" / "Обаждане с <име>" in the
     actor's language (as AD-061's call back).
   - Then the optional next or retry task and stage change, exactly as `completeWithNext`.
   - The `tasks` triggers do the rest: `next_action_at` (O3) and, for an inquiry,
     `contacted_at` and `new → contacted`.
7. **No silent dead end (AD-014, soft).** Answered on an `active` deal with *none* as next
   action and no other pending task shows an inline warning "This deal will have no next action"
   before saving; saving is still allowed (it then shows on At risk as today).
8. **Closed contexts.** A `won`, `lost` or `archived` deal still gets links and can log a call
   (a client calls after the sale); the prompt hides stage change and next action defaults to
   *none*. A `converted` inquiry's context is its deal; a `dismissed` inquiry can log a call
   but offers no retry.
9. **Inquiry card shows the contact time.** A contacted inquiry shows "Contacted after 2 h 10
   min" / "Свързан след 2 ч 10 мин" (`contacted_at − received_at`, `useFormatter`), and its
   last logged call ("No answer · 14:05"). A `new` inquiry with a pending retry shows the retry
   time.
10. **Timeline.** Completed call tasks already appear on the deal and contact timelines; they
    gain the channel icon and label ("Viber"). An inquiry's calls appear on the deal timeline
    after conversion, because rule "conversion carries the calls along" gives them the deal.
11. **Permissions and tenancy.** Whoever may mark that inquiry contacted or add a task on that
    deal may log a call on it (no new role rule). Every query filters by `agency_id`; the
    trigger and RLS check that `tasks.inquiry_id` belongs to the task's agency.
12. **Privacy.** No phone number goes into a URL of ours, a query string, a log line or
    analytics; `sessionStorage` holds ids and a display name only, never the number.

## Screens

- **Contact links** (`ContactLinks`, one component everywhere): a row of icon buttons Call ·
  Viber · WhatsApp · Email next to the value; at 390 px icon-only with labels for screen
  readers, at 1280 px icon plus short label on the contact page, icon-only on cards.
- **Post-call prompt** (`PostCallSheet`): a bottom sheet at 390 px (thumb reach: the three
  choices as full-width buttons at the bottom), a dialog at 1280 px. Answered and No answer
  expand in place; one primary button "Save" / "Запази". Error and success via `sonner`.
- **Inquiry card:** links in the contact row; "Log call" in the menu; contacted time and last
  call per rule 9.
- **Opportunity page / contact page:** links on contact rows; a "Log call" button in the header
  actions.
- **Today:** Call and Viber buttons on `call` task cards; tapping them prompts with that task.
- **Glossary** (`docs/domain-model.md` §7): call log entry = **Обаждане**; post-call prompt =
  **Свързахте ли се?**; contacted (time) = **Свързан (след …)**; no answer = **Не вдига**
  [ASSUMPTION A5: founder confirms the wording in review].

## Where it lives

- Migration `supabase/migrations/20261119000001_phone_loop.sql` (`tasks.inquiry_id`,
  `tasks.channel`, `inquiries.contacted_at`, the three triggers, index, RLS check); pgTAP
  `supabase/tests/database/106-phone-loop.sql`.
- `src/lib/contact-links.ts`: pure builders `telHref`, `viberHref`, `whatsAppHref`, `mailtoHref`
  and `isMobile` on top of `normalizePhone()` (`src/lib/phone`).
- `src/domain/calls/`: `types.ts`, `validation.ts` (`logCallSchema`), `service.ts`
  (`CallService.log`: picks the pending task to complete, builds the inserts, delegates to the
  task service). No repository of its own; it uses `src/domain/tasks/repository.ts`.
- `src/domain/inquiries/`: `contacted_at` in types and queries; retry time for the card.
- UI: `src/components/domain/calls/contact-links.tsx`, `post-call-sheet.tsx`,
  `use-call-intent.ts` (the `sessionStorage` intent and the `visibilitychange` listener), mounted
  once in the dashboard layout; touches `contact-method-list.tsx`, `inquiry-card.tsx`,
  `task-card.tsx`, `participant-list.tsx` and the opportunity and contact page headers.
- Server Action `logCall` in `src/app/(dashboard)/calls/actions.ts` (`ActionResult`,
  `toActionError`, `revalidatePath` of the context's pages and `/today`).
- Keys under `phoneLoop.*` in both `messages/bg.json` and `messages/en.json`.
- Commands, code style and the mutation pattern: `AGENTS.md`.

## Success criteria

- **AC-1** On a 390 px phone, a seeded `new` inquiry with a mobile caller shows Call, Viber and
  WhatsApp; Call opens `tel:+359…`, Viber `viber://chat?number=%2B359…`, WhatsApp
  `https://wa.me/359…`. A landline shows Call only; an email shows Email (FR-COM-01).
- **AC-2** After tapping Call and returning to the tab (hidden ≥ 5 s), the prompt asks "Did you
  reach <caller>?". *No answer* with the default retry: the inquiry is `contacted`,
  `contacted_at` is set, a completed `call` task with `channel = 'phone'` and a pending retry in
  1 h assigned to me exist, and the retry is on Today (FR-COM-02, FR-COM-03).
- **AC-3** A second logged call on the same inquiry doesn't move `contacted_at`
  (pgTAP and service suite) (FR-COM-04).
- **AC-4** Converting that inquiry, and separately joining it to a deal, gives its calls the
  deal's id and contact; the pending retry sets the deal's `next_action_at`; the deal timeline
  shows the calls. Dismissing another inquiry cancels its pending retry (pgTAP).
- **AC-5** On an opportunity with a pending call task of mine, *Answered* says "Completes:
  <task>" and completes it with the outcome; with *tomorrow 09:00* the deal's next action is
  tomorrow 09:00 agency time. With *none* and no other task, the warning of rule 7 shows and the
  deal appears on At risk after saving.
- **AC-6** "Mark contacted" and a conversion of an inquiry with no logged call both set
  `contacted_at`; existing inquiries keep `NULL` after the migration (pgTAP).
- **AC-7** A broker of Beta can't log a call on, or set `tasks.inquiry_id` to, an Alpha
  inquiry (pgTAP RLS and trigger).
- **AC-8** On desktop (page never hides), tapping Call shows the "Log the call" toast; its Log
  button opens the same prompt. "Log call" from the inquiry menu logs an inbound call with
  channel Viber.
- **AC-9** The inquiry card shows "Contacted after …" and the last call; BG and EN at 1280 and
  390 px; buttons ≥ 44 px; no hardcoded strings; no phone number in any URL of ours,
  `sessionStorage` or server log (FR-COM-05).

**FR rows (BRD):** new FR-COM-01 call, Viber, WhatsApp and email links on every phone and email
shown; FR-COM-02 post-call prompt logs the outcome and the next action; FR-COM-03 a missed call
offers a one-tap retry task; FR-COM-04 an inquiry records its first contact time; FR-COM-05
manual "Log call" for inbound and outside calls.

## Testing strategy

- **Vitest (pure):** `contact-links.ts` (BG mobile, BG landline, foreign mobile, legacy
  unparseable, `+` encoding in Viber, digits in wa.me); `logCallSchema` (outcome required for
  answered, prefilled for no answer, retry presets, channel enum); the intent logic of
  `use-call-intent.ts` with fake timers and `visibilitychange` (5 s threshold, 2 h expiry, 3 s
  toast fallback, newest tap wins); the "today 18:00 only before 17:00" preset in agency time.
- **Service suite (local stack):** `CallService.log` picks the right pending task (tapped task
  first, then earliest of mine; never someone else's), inserts otherwise, creates the retry,
  respects closed contexts (rule 8), filters by agency; the `logCall` action
  (`ActionResult`, `toActionError`).
- **pgTAP `106-phone-loop.sql`:** the three triggers (first attempt sets `contacted_at` and
  `contacted`, a second one doesn't move it, `converted`/`dismissed` status untouched, status
  change sets it when `NULL`); conversion and join re-point tasks and recompute
  `next_action_at`; dismiss cancels pending tasks; cross-agency `inquiry_id` refused; `channel`
  check; existing rows keep `NULL`; `convert_inquiry` and `join_inquiry` results unchanged.
- **E2E (Playwright):** extend the core loop at 390 px: tap Call on a seeded inquiry (the test
  intercepts `tel:` navigation), hide and show the page, log *No answer* with the retry, see it
  on Today, log *Answered* from the retry's Call button with a next action, convert, see both
  calls on the deal timeline. BG and EN, 1280 (toast path) and 390.
- **Seed:** per agency, a `new` inquiry with a BG mobile caller, one with a landline, a contact
  with a saved Viber method and one active deal, and a pending call task due today for the
  seeded broker.

## Boundaries

- Always: the `supabase-patterns` checklist for the migration and triggers; write AD-065
  before the migration; filter by `agency_id` in code; update `docs/domain-model.md` (§2.2 and
  §2.3 columns, §3.1 contacted note, a new invariant for `contacted_at` and one for inquiry
  tasks following conversion, glossary, migration count) in the migration commit.
- Ask first: changing `convert_inquiry` or `join_inquiry`; a new task type or inquiry status; a
  new dependency (including switching `libphonenumber-js` metadata to `max` if `min` can't tell
  mobile from landline, see open question 1); a new RPC; any analytics or tracking of taps.
- Never: set `contacted_at`, `next_action_at` or write `audit_log` from app code; put a phone
  number in a URL of ours, a query string, `sessionStorage` or a log; write anything when the
  broker picks "Not now"; complete another member's task from the prompt; modify `raw_payload`.

## Out of scope

Dialer, recording, call duration, reading the device call log, inbound call detection, Viber
or WhatsApp message templates or bots, SMS, a "not contacted within N hours" smart-list filter
or Exceptions row, speed-to-lead reports and per-broker averages (`reports`), links on property
parties, the contact and opportunity list tables and ⌘K results, quick outcome chips, a
"wrong number" outcome, a power-hour call queue (B-08), backfilling `contacted_at`.

## Cut order if time runs short

1. The desktop toast fallback (desktop keeps the manual "Log call").
2. "Contacted after …" and last call on the inquiry card (the data is still recorded).
3. The stage change inside the prompt (next action stays).
4. Links on Today task cards (inquiry card, contact and opportunity pages stay).

## Assumptions

- **A1** Returning to the tab after ≥ 5 s means a call happened often enough that the prompt
  isn't a nuisance. Validate: share of prompts closed with "Not now".
- **A2** Most calls are made by tapping a link in the app. Validate: share of logged calls from
  "Log call" vs from a tap.
- **A3** A conversion with no logged call is a fair "contacted" time. Validate: conversions
  with `contacted_at` set by the conversion itself.
- **A4** A Viber chat counts as a contact attempt like a call. Validate: pilot feedback.
- **A5** The BG wording of the glossary lines reads naturally to brokers.

## Open questions (for the plan, not the founder)

1. **Mobile detection.** Does the `libphonenumber-js` metadata the app already loads return
   `MOBILE` for BG numbers, or only `undefined`? First plan task is a 15-minute check; if it
   needs `max` metadata (bundle size), fall back to a BG prefix rule (`+3598[789]`, `+35943`
   etc.) plus "any non-BG number gets messengers" — an ask-first.
2. **Viber link form.** Confirm `viber://chat?number=%2B…` opens the chat on Android and iOS
   (some versions want `viber://chat/?number=`); test on a real phone before the UI task.
3. **iOS Safari return.** `tel:` on iOS shows a confirmation sheet and may not fire
   `visibilitychange` until the call ends; confirm the prompt appears after the call, else the
   toast fallback must also run on iOS.
4. **One write or two.** If completing the found task and inserting the retry must be atomic
   (a failure between them leaves a call without its retry), the plan adds a small RPC instead of
   two service writes; decide after reading `completeWithNext`.
