# Spec: reminders

> **Status:** In progress (`tasks/plan.md`). Approved scope (founder, 2026-10-28, as Sprint 6
> slice 6.7). Plan decisions (claim-then-send, per-email keys): AD-051.
> **Evidence:** gap analysis §5.1 #1, AD-025 events, AD-042 delivery. Assumption A1 is unvalidated.

## Objective

Brokers learn about due work and new inquiries without opening the app, so nothing slips while
they're in the field. This is the "forgetting" failure mode of the core loop (step 6) and a
pilot-gate item (AD-039).

**Users:** brokers (morning digest, assignment emails), owners and managers (agency counts).

## Business rules
1. One digest per active member on working days (Mon–Fri) at about **08:00 agency time**.
   [ASSUMPTION A1 — validate in pilot: weekly owner meeting, "did the email change what you did
   first?"; share of overdue tasks completed before 12:00]
2. Content: the recipient's overdue tasks, tasks due today, and new uncontacted inquiries
   assigned to them. Owners and managers also get agency counts (unassigned inquiries, overdue
   tasks) with a link to Exceptions. At most 10 rows per section, then "+N more".
3. No email when every section and the agency counts are empty, and none to deactivated members. The language is
   `profiles.locale`; dates are in agency time. Emails show names and task titles only, never
   phones or notes (GDPR minimisation).
4. When an inquiry is assigned to someone other than the person acting, the assignee gets an
   immediate email. A bulk import sends one summary per assignee. A failed email never fails
   the action.
5. Each user can turn the digest off (default on), which also stops the agency counts (AD-052). Sends are idempotent per
   (user, kind, period key): the local date for the digest, the inquiry and date for an
   assignment email, the import job for an import summary (AD-051).
6. Bulgarian public holidays are **not** skipped yet. [ASSUMPTION — validate: complaints in
   `SPEC.md` *Pilot evidence*]

## Design (AD-042)
- **Migration** `notifications`: tenant table `notification_deliveries` per `supabase-patterns`
  (`user_id`, `kind` `daily_digest|inquiry_assigned`, `period_key`, `entity_id`, `status`
  `pending|sent|failed|skipped`, `provider_id`, `error`; unique `(user_id, kind, period_key)`).
  A send claims the key with a `pending` row first, then sets `sent` or `failed`; `skipped`
  is an empty digest. Members read their own rows, owners and managers the agency's; no
  client writes. Add `profiles.digest_enabled boolean NOT NULL DEFAULT true`. Add the table to
  `010-rls-catalog.sql`; pgTAP `071-notification-deliveries.sql` (`070` is taken).
- **Domain** `src/domain/notifications/`: `digest-builder.ts` (pure, built on the Today and
  Exceptions queries in agency time); templates rendered with next-intl `createTranslator` per
  recipient locale; `mailer.ts` (interface, SMTP adapter for local Mailpit, Resend adapter for
  production, chosen by `MAIL_TRANSPORT`); `service.ts` (idempotent send).
- **Route** `src/app/api/cron/daily-digest/route.ts`: checks `CRON_SECRET`, uses the service
  role (AD-042 exception), sends to agencies whose local time is 08:xx on a weekday. A `?now=`
  override outside production for testing. `npm run digest:run` calls it locally.
  `vercel.json` crons at 05:00 and 06:00 UTC are written but only switched on in `go-live`.
- **Immediate:** an `inquiry_assigned` email from the inquiry create, update, reassign and
  convert actions, sent with `after()`.
- **UI and env:** digest toggle in Profile; `notifications.*` keys in both locales;
  `MAIL_TRANSPORT`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET` in `.env.example`.

## Success criteria
- **AC-1** Calling the digest route twice on one day sends one digest per eligible user, seen
  in Mailpit (FR-NTF-01).
- **AC-2** A broker with an overdue task gets a BG digest listing it; the link opens Today.
- **AC-3** Assigning an inquiry to a colleague emails them within a minute; self-assignment
  sends nothing (FR-NTF-02).
- **AC-4** Turning the digest off stops it; inquiry-assigned emails still arrive (FR-NTF-03).

## Testing strategy
- Vitest for the digest builder: empty means no send, the 10-row cap and "+N", owner extras,
  timezone edges. Idempotency with a fake mailer.
- pgTAP `071` for RLS on `notification_deliveries`.
- A Mailpit check in BG and EN. No domain or Resend account is needed to accept this module.

## Boundaries
- Always: every query in the cron route filters by `agency_id`, because the service role
  bypasses RLS (check this in review).
- Ask first: switching on a production schedule (that belongs to `go-live`).
- Never: put phones or note text in an email.

## Cut order if time runs short
1. The immediate `inquiry_assigned` email (keep the digest).

## Open questions
- None. FR-NTF-01…03 are in `docs/BRD.md` as ❌.
