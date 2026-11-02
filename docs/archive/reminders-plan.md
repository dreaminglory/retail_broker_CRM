# Implementation Plan: reminders

> **Spec:** `spec/reminders.md` · **Checklist:** `docs/archive/reminders-todo.md`
> **Status:** Done (2026-10-31). Plan approved (founder, 2026-10-30). Approved scope (founder, 2026-10-28). Delivery mechanism: AD-042.

## Overview
Brokers learn about due work and new inquiries by email without opening the app. Three phases,
each one a vertical piece that can be merged and checked on its own: the daily digest end to end
in Mailpit, the per-user opt-out with the owner and manager counts, and the immediate
inquiry-assigned email. Phase 3 is the spec's first cut if time runs short, so it goes last.

## Architecture decisions
Where the code changes or sharpens the spec. Task 2 records these in a new AD and corrects
`spec/reminders.md`; acceptance criteria AC-1…AC-4 don't change.

- **Idempotency key differs per email.** The spec's unique `(user_id, kind, period_key)` with
  `period_key` = local date works for the digest, but would stop a broker's second inquiry email
  of the day. So: `daily_digest` → `YYYY-MM-DD`; `inquiry_assigned` →
  `<inquiry_id>:YYYY-MM-DD`; import summary (also `inquiry_assigned`) → `import:<job_id>`.
- **Claim, then send.** The spec's statuses can't express "in flight", so add `pending`. A send
  first inserts `pending` (`ON CONFLICT DO NOTHING`); only the winner sends, then sets `sent` or
  `failed`. `sent` and `pending` block a repeat; `failed` and `skipped` can be claimed again by a
  later run. A crash mid-send leaves `pending`, so that user misses one email rather than getting two.
- **`skipped` means an empty digest.** It answers "why didn't X get an email?". A user who turned
  the digest off, or a deactivated member, gets no row at all.
- **Digest data is loaded once per agency**, not per recipient: all pending tasks due before
  agency midnight, and all `new` inquiries, grouped in memory. Same definitions as
  `docs/domain-model.md` §4, using `getTodayWindows`, but no N+1 and an injectable `now`. It pages past
  PostgREST's 1,000-row cap so "+N more" stays right after a large import. It doesn't reuse
  `ExceptionsRepository.getDashboardData`, which loads five sections and ignores `now`.
- **No `getAgencySettings` in the cron route.** It reads through the cookie-bound session client,
  so without a session it would silently return the default timezone. The digest repository reads
  `agencies.settings` with the admin client and parses it with `agencySettingsSchema`.
- **Mail transports.** Local: `nodemailer` over SMTP to Mailpit (new dependency). The stack exposes only
  Mailpit's web port today, so `supabase/config.toml` needs `[inbucket] smtp_port`. Production:
  Resend through plain `fetch`, no SDK. It sends one at a time, paced for Resend's rate limit.
- **The route stays off until `go-live`.** `vercel.json` crons run on the first deploy, so the
  switch is `CRON_SECRET`: when it isn't set the route refuses every call. It accepts `GET` with
  `Authorization: Bearer`, which is what Vercel Cron sends. `?now=` is ignored when
  `NODE_ENV=production`.
- **The assignment email fires only on a real change.** Actions compare the assignee before and
  after, so editing a caller's name never sends mail. Sending and recording use the admin client inside
  `after()`, because members can't write `notification_deliveries` (AD-042 allows this use). Every
  error is caught and logged, so a failed email never fails the action.
- **Links:** digest → `/today`; agency counts → `/exceptions`; inquiry → `/inquiries` (there is no
  inquiry detail page); conversion → the opportunity page.
- **Conversion:** `convert_inquiry` assigns the *opportunity* and leaves `inquiries.assigned_to` alone.
  The email goes out when the converted opportunity's owner differs from the inquiry's current
  assignee and from the person acting.
- **Email content.** Task titles and caller names only, HTML-escaped in templates. Inquiry subject,
  description, phone and email are never included (rule 3). A nameless caller shows a translated
  fallback.

## Dependency graph
```
Task 1 mail transport ─────────────────────┐
Task 2 schema + RLS ───────────────────────┤
Task 3 builder + schedule ─ Task 4 template ┼─ Task 5 digest service ─ Task 6 route ─┐
                                           │                                         ├─ Task 7 toggle
                                           │                                         └─ Task 8 agency counts
                                           └─ Task 9 reassign/edit email ─ Task 10 create/convert
                                                                         └─ Task 11 import summary
```

## Task list

### Phase 1: The daily digest, end to end
- [x] Task 1: Mail transport (SMTP to Mailpit, Resend)
- [x] Task 2: `notification_deliveries` and `digest_enabled`
- [x] Task 3: Digest builder and schedule helpers
- [x] Task 4: Digest email in BG and EN
- [x] Task 5: Idempotent digest service
- [x] Task 6: Cron route and `npm run digest:run`

### Checkpoint: digest
- [x] AC-1 and AC-2 pass in Mailpit
- [x] Review with the founder before Phase 2

### Phase 2: Opt-out and agency counts
- [x] Task 7: Digest toggle in Profile
- [x] Task 8: Agency counts for owners and managers

### Checkpoint: digest complete
- [x] AC-4 (digest half) passes; rules 1–3, 5 and 6 hold

### Phase 3: Immediate inquiry-assigned email (spec's first cut)
- [x] Task 9: Email on reassign and edit
- [x] Task 10: Email on create and convert
- [x] Task 11: One summary per assignee after an import

### Checkpoint: module done
- [x] AC-1…AC-4 pass; run the Definition of Done; close the module (AGENTS.md *Workflow* step 6)

## Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| The service role bypasses RLS in the cron route, so a missing filter leaks across agencies | High | Every query filters by `agency_id` (spec boundary); an integration test with two seeded agencies proves it; check it in `/review` |
| Personal data reaches an email or the `error` column | High | The builder's output type has no phone, note or subject field, and a test asserts it; `error` stores the provider's message only |
| SMTP port setting doesn't apply on the pinned CLI (`supabase@2.122.0`) | Med | Task 1 checks it first; fall back to Mailpit's HTTP send API behind the same `Mailer` interface |
| `after()` work is lost if the platform ends the function early | Low | Hosting is chosen in `go-live`; the spec accepts a missed immediate email, and the inquiry still appears in the next digest |
| Function timeout with many recipients, since sends are paced | Med | Agencies are small (2–30 brokers); check against the host's limit in `go-live`; a rerun only retries what wasn't sent |
| Resend path can't be tested end to end without a domain | Med | Adapter tested with a stubbed `fetch`; the spec accepts this; the real send is checked in `go-live` |
| Table grows by about one row per member per day | Low | Purge belongs to `gdpr` |

## Open questions
- None block the build. `nodemailer` is the one new dependency; say so at review if you'd rather
  use Mailpit's HTTP API locally. Scheduling in production stays in `go-live` (spec boundary).
