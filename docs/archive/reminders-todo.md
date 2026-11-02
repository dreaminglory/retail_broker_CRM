# Tasks: reminders

> **Plan:** `docs/archive/reminders-plan.md` · **Spec:** `spec/reminders.md`
> Every task also clears the Definition of Done in `AGENTS.md`. Tick a task only after that.

## Task 1: Mail transport
**Description:** Mark `reminders` In progress in `SPEC.md`. Expose Mailpit's SMTP port in
`supabase/config.toml` and confirm it works on the pinned CLI. Add `src/domain/notifications/mailer.ts`:
a `Mailer` interface, an SMTP adapter (`nodemailer`) and a paced Resend adapter (`fetch`), chosen
by `MAIL_TRANSPORT`. Add the new env vars to `.env.example` and `scripts/stack-up.sh`.

**Acceptance criteria:**
- [x] A test message sent through the SMTP adapter appears in Mailpit (`localhost:54324`)
- [x] The Resend adapter sends the right request, and returns the provider's id or a failure (stubbed `fetch`)
- [x] A missing or unknown `MAIL_TRANSPORT` fails with a clear error

**Verification:**
- [x] `npx vitest run src/domain/notifications/mailer.test.ts`
- [x] Manual: send once after restarting the stack; see it in Mailpit

**Dependencies:** None
**Files likely touched:** `SPEC.md`, `supabase/config.toml`, `package.json`, `src/domain/notifications/mailer.ts`, `mailer.test.ts`, `.env.example`, `scripts/stack-up.sh`
**Estimated scope:** M

## Task 2: `notification_deliveries` and `digest_enabled`
**Description:** Migration `20261102000010_notifications.sql` per `supabase-patterns`: the tenant
table with `status` `pending|sent|failed|skipped`, unique `(user_id, kind, period_key)`, members
read their own rows, owners and managers the agency's, no client writes; plus
`profiles.digest_enabled`. Add the table to `010-rls-catalog.sql`. New pgTAP file
`071-notification-deliveries.sql` (`070` is taken). Update `docs/domain-model.md`, add the new AD for
the plan's decisions, and correct `spec/reminders.md` to match.

**Acceptance criteria:**
- [x] A broker reads only their own rows, a manager the agency's, and no one reads another agency's
- [x] No member can insert, update or delete a row
- [x] A second row with the same `(user_id, kind, period_key)` is rejected

**Verification:**
- [x] `npx supabase db reset` then `npm run test:db`

**Dependencies:** None
**Files likely touched:** `supabase/migrations/20261102000010_notifications.sql`, `supabase/tests/database/010-rls-catalog.sql`, `071-notification-deliveries.sql`, `docs/domain-model.md`, `docs/decisions-log.md`, `spec/reminders.md`
**Estimated scope:** M

## Task 3: Digest builder and schedule helpers
**Description:** A pure `digest-builder.ts`: from a member, their tasks and inquiries, and `now`,
return overdue, due-today and new-inquiry sections, capped at 10 rows plus "+N more", or nothing
when all are empty. Add `isDigestTime(timezone, now)` (08:xx, Mon–Fri) and the local date key to
`agency-day.ts`.

**Acceptance criteria:**
- [x] All sections empty means no digest; 11 rows means 10 plus "+1"
- [x] A task falls in the same section as on Today, including around agency midnight
- [x] `isDigestTime` holds at 08:xx Sofia in winter and summer, and is false at weekends

**Verification:**
- [x] `npx vitest run src/domain/notifications/digest-builder.test.ts src/lib/time/agency-day.test.ts`

**Dependencies:** None
**Files likely touched:** `src/domain/notifications/digest-builder.ts`, `digest-builder.test.ts`, `types.ts`, `src/lib/time/agency-day.ts`, `agency-day.test.ts`
**Estimated scope:** S

## Task 4: Digest email in BG and EN
**Description:** `templates.ts` renders a digest to subject, HTML and text with next-intl
`createTranslator` and `createFormatter`, per the recipient's locale and the agency's timezone.
`notifications.*` keys in both message files. The link opens `/today` on `NEXT_PUBLIC_APP_URL`.

**Acceptance criteria:**
- [x] The same digest renders in `bg` and `en`, with dates in agency time
- [x] A task title containing `<script>` comes out escaped
- [x] The output never contains a phone, note or inquiry subject

**Verification:**
- [x] `npx vitest run src/domain/notifications/templates.test.ts src/lib/i18n-keys.test.ts`

**Dependencies:** Task 3
**Files likely touched:** `src/domain/notifications/templates.ts`, `templates.test.ts`, `messages/bg.json`, `messages/en.json`
**Estimated scope:** M

## Task 5: Idempotent digest service
**Description:** `repository.ts` loads an agency's timezone, eligible members (active,
`digest_enabled`), tasks and new inquiries, paging past the 1,000-row cap, and claims and settles
delivery rows. `service.ts` runs one agency: claim, build, render, send, record.

**Acceptance criteria:**
- [x] Two runs send one digest per user (fake mailer); concurrent runs too
- [x] A failed send records `failed`, doesn't stop the other members, and is retried by the next run
- [x] Deactivated members get nothing; agency Beta's data never reaches an Alpha digest

**Verification:**
- [x] `npm run test:services -- src/domain/notifications`

**Dependencies:** Tasks 1, 2, 3, 4
**Files likely touched:** `src/domain/notifications/repository.ts`, `service.ts`, `service.integration.test.ts`
**Estimated scope:** M

## Task 6: Cron route and `npm run digest:run`
**Description:** `src/app/api/cron/daily-digest/route.ts`: checks `CRON_SECRET`, uses the admin
client, runs every agency whose local time passes `isDigestTime`, returns counts per status. `?now=`
outside production. `scripts/digest-run.sh` calls it. Add `vercel.json` with crons at 05:00 and
06:00 UTC.

**Acceptance criteria:**
- [x] AC-1: calling the route twice sends one digest per eligible user, seen in Mailpit
- [x] AC-2: a broker with an overdue task gets a BG digest listing it, and the link opens Today
- [x] A wrong or missing secret gets 401, and no secret configured refuses every call

**Verification:**
- [x] `npx vitest run src/app/api/cron/daily-digest`
- [x] Manual: `npm run digest:run` with a weekday `?now=` after `npx supabase db reset`; check Mailpit in `bg` and `en`

**Dependencies:** Task 5
**Files likely touched:** `src/app/api/cron/daily-digest/route.ts`, `route.test.ts`, `scripts/digest-run.sh`, `package.json`, `vercel.json`
**Estimated scope:** M

## Checkpoint: digest
- [x] AC-1 and AC-2 pass in Mailpit; `npm run typecheck`, `lint`, `test`, `test:db` green
- [x] Review with the founder before Phase 2

## Task 7: Digest toggle in Profile
**Description:** Add a digest switch to `/settings/profile`, with a Server Action returning
`ActionResult`, a Zod schema and a repository method. Default on.

**Acceptance criteria:**
- [x] AC-4: turning the digest off stops it, and turning it on brings it back
- [x] The choice survives a reload; one user's toggle can't change another's

**Verification:**
- [x] `npx vitest run src/domain/profiles`
- [x] Browser check in `bg` and `en` at 1280 and 390 px; `npm run digest:run` shows the effect

**Dependencies:** Task 6
**Files likely touched:** `src/app/(dashboard)/settings/profile/actions.ts`, `page.tsx`, a new `digest-toggle.tsx`, `src/domain/profiles/{repository,types,validation}.ts`, `messages/{bg,en}.json`
**Estimated scope:** M

## Task 8: Agency counts for owners and managers
**Description:** Add unassigned-inquiry and overdue-task counts to owner and manager digests, with
a link to `/exceptions`. An owner with no work of their own still gets a digest if the counts aren't zero.

**Acceptance criteria:**
- [x] Owners and managers see the counts; brokers never do
- [x] Counts match `/exceptions` for the same agency; a digest is sent when only the counts are non-zero

**Verification:**
- [x] `npm run test:services -- src/domain/notifications`
- [x] Manual: check an owner and a broker digest in Mailpit

**Dependencies:** Task 6
**Files likely touched:** `src/domain/notifications/{digest-builder,repository,service,templates}.ts` and tests, `messages/{bg,en}.json`
**Estimated scope:** S

## Checkpoint: digest complete
- [x] AC-4 (digest half) passes; rules 1–3, 5 and 6 hold

## Task 9: Email on reassign and edit
**Description:** A `notifyInquiryAssigned` helper in the notifications service, with its template,
runs inside `after()`. `reassignInquiryAction` and `updateInquiryAction` compare the assignee before and
after. Admin client, filtered by `agency_id`; every failure is caught and logged.

**Acceptance criteria:**
- [x] AC-3: assigning to a colleague emails them, from both the inbox and Exceptions; self-assignment sends nothing
- [x] Editing other fields sends nothing; unassigning sends nothing
- [x] A mail failure doesn't fail the action; a broker's second inquiry on the same day still gets an email

**Verification:**
- [x] `npm run test:services -- src/domain/notifications`; Vitest for the action's failure path
- [x] Manual: reassign from `/exceptions`; the email is in Mailpit within a minute, in the assignee's language

**Dependencies:** Tasks 1, 2
**Files likely touched:** `src/domain/notifications/service.ts`, `templates.ts`, `src/app/(dashboard)/inquiries/actions.ts`, `messages/{bg,en}.json`, tests
**Estimated scope:** M

## Task 10: Email on create and convert
**Description:** Call the helper from `createInquiryAction`, and from `convertInquiryAction` when the
opportunity's owner differs from the inquiry's assignee and from the person acting. A conversion email
links to the opportunity.

**Acceptance criteria:**
- [x] Creating an inquiry assigned to a colleague emails them; assigned to yourself or no one sends nothing
- [x] Converting to a colleague emails them; converting with the same assignee sends nothing
- [x] A duplicate-warning return from convert sends nothing

**Verification:**
- [x] `npm run test:services -- src/domain/notifications`; manual check in Mailpit

**Dependencies:** Task 9
**Files likely touched:** `src/app/(dashboard)/inquiries/actions.ts`, tests
**Estimated scope:** S

## Task 11: One summary per assignee after an import
**Description:** When `commitImportBatchAction` reports `remaining === 0` on an inquiry job, send
each assignee other than the person importing one summary with their count, keyed `import:<job_id>`.

**Acceptance criteria:**
- [x] An import of many inquiries sends one email per assignee, with the right count
- [x] The importer gets none; a contact import sends none; a retried final batch doesn't send twice

**Verification:**
- [x] `npm run test:services -- src/domain/notifications`; manual CSV import, check Mailpit

**Dependencies:** Task 9
**Files likely touched:** `src/app/(dashboard)/settings/import/actions.ts`, `src/domain/notifications/{service,repository,templates}.ts`, `messages/{bg,en}.json`, tests
**Estimated scope:** M

## Checkpoint: module done
- [x] All spec acceptance criteria met
- [x] Close the module (AGENTS.md *Workflow* step 6)
