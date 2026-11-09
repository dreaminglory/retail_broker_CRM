# Decisions

Decisions that still shape the code. Before changing something an AD covers, read it; to change
the decision, add a new AD that supersedes it (don't edit an Accepted one). Code, migrations and
specs cite these IDs. History before 2026-10-29: `docs/archive/` and git.

**New AD:** next free number, then `Status`, `Decision`, `Why`, and `Revisit if` when there is a
trigger. Two to six lines. Status is Proposed, Accepted or Superseded by AD-NNN.

---

## Product

### AD-039: Full agency system, not a follow-up layer
**Accepted** (founder, 2026-10-28). BrokerCRM replaces the agency's listing tool rather than
sitting next to it, with follow-up discipline as the edge. Committed modules, pilot gate and
non-goals: `SPEC.md` §1–3. Evidence sets the order of committed modules, not whether they are
built. Bulgaria first; residential sales agencies with 2–30 brokers; pricing hypothesis €20 per
broker per month, all modules included.
**Why:** Bulgarian agencies buy property-first (`docs/research/crm-competitive-gap-analysis.md`).

### AD-047: Module-based agent-skills workflow
**Accepted** (founder, 2026-10-29). `/feature-ideas` → `/spec` → `/plan` → `/build` →
`/review` → `/ship`, one module at a time, no sprints. `SPEC.md` is the single product file,
`spec/<module-id>.md` per module, `tasks/` for the active module only. The AGENTS.md Definition
of Done overrides the plugin's.

### AD-048: Local-only development
**Accepted** (founder, 2026-10-29). Development runs only on the founder's machine with Docker
Desktop; `npm run stack:up` doesn't start dockerd. CI still runs typecheck, lint, Vitest, pgTAP.
**Revisit if:** we develop in cloud sessions again.

### AD-054: €15 per broker per month
**Accepted** (founder, 2026-11-03). Pricing hypothesis is €15 per broker per month, all modules
included, billed per broker in the agency. Replaces the €20 in AD-039; the rest of AD-039 stands.
**Why:** below OptiEstate (€22 with website and portals), inside the local €0–32 range.
**Revisit if:** pilot agencies push back on per-broker pricing (flat per-agency fee, N-12).

### AD-055: alo.bg first for portal syndication
**Accepted** (founder, 2026-11-03). `syndication` publishes to alo.bg first, on its open import
spec. imot.bg, homes.bg and OLX follow once prod is live (`go-live` done).
**Why:** alo.bg is the only portal with a public import format; the others need agreements.

## Stack and platform

### AD-002: Next.js + Supabase + Tailwind + shadcn/ui
**Accepted.** Next.js (App Router, now 16) on Vercel, Supabase for Postgres, auth and RLS.
**Why:** native RLS, SQL-first, simple ops, low cost.

### AD-030: `src/proxy.ts` refreshes the session only
**Accepted.** Next 16 replaced middleware with the proxy; it refreshes the Supabase session.
Authorization lives in Server Component layouts and RLS.

### AD-040: Production changes go through migrations only
**Accepted** (founder, 2026-10-28). Prod (`emflwmivjachbnaqumnn`) history was baselined with
`migration repair` and now equals the repo. Never change prod schema outside a migration.
**Revisit if:** a parity check finds unexplained drift.

### AD-043: Local QA stack and E2E smoke
**Accepted.** `npm run stack:up` runs local Supabase and writes `.env.local`; `npm run test:e2e`
runs the Playwright core loop in bg and en at 1280 and 390 px. Service integration tests run
against the same stack as the seeded users. (Its cloud-session part is superseded by AD-048.)
`npm run test:services` switches them on and prints coverage, not gated; plain `npm run test` skips
them. They refuse a non-local URL, and each suite deletes its own rows with the service role.

## Tenancy, security and roles

### AD-001: Records are visible to the whole agency
**Accepted.** Every member sees every record in their agency; one RLS policy per table.
Assignment and Today scope are UI defaults, not visibility (see AD-044).
**Revisit if:** pilot agencies need "own records only".

### AD-004: RLS through SECURITY DEFINER helpers
**Accepted.** Policies call `current_agency_id()` / `current_user_role()` and never query
`agency_memberships` inline (that recursed). Template: `supabase-patterns` skill.

### AD-027: Atomic tenant provisioning
**Accepted.** Sign-up calls one SECURITY DEFINER RPC, `create_agency_with_owner(name, locale)`,
which creates the agency, owner membership and localized default seeds in one transaction.

### AD-028: Explicit function grants
**Accepted.** Revoke EXECUTE from `PUBLIC, anon, authenticated` on every function, then grant
only the RPCs the app calls. Internal helpers are not callable over REST.

### AD-023 / AD-029: `profiles` without `agency_id`, visible to colleagues
**Accepted** (AD-029 revises AD-023). `public.profiles` is created by a trigger on
`auth.users`, has no `agency_id` and no INSERT policy, and is visible to the user and to
colleagues via `shares_agency_with()`.

### AD-024: Invitations through `admin.inviteUserByEmail()`
**Accepted.** A Server Action uses the service-role client (`src/lib/supabase/admin.ts`) to invite
and creates an `invited` membership; the auth callback activates it. The invite creates the auth
user immediately, so the membership is written after the call.

### AD-045: Configuration and merge are owner/manager only
**Accepted** (founder, 2026-10-28). Stages, lead sources and contact merge need owner or manager:
`requireRole(ctx, CONFIG_ROLES)` in actions, hidden in the UI, and RLS on `stages`,
`lead_sources` and `merge_history` writes.
**Open:** a merge is a series of ordinary edits, so RLS blocks only its history row. An atomic,
role-checked merge RPC is in the `SPEC.md` ideas backlog. Answered by AD-050.

### AD-050: Conversion and merge are atomic RPCs
**Accepted** (2026-10-30). `convert_inquiry` and `merge_contacts` do all their writes in one
transaction, as SECURITY INVOKER so RLS and audit triggers still apply. `merge_contacts` checks the
role itself, and both refuse another agency's rows. Validation that needs TypeScript (phone
normalising, assignee check) stays in the service. Failures surface through `rpcFailure()`.
**Why:** checking each write's error would report a failure but leave a half-done merge or a
stranded contact and opportunity, and a retry would then duplicate them.
**Revisit if:** either flow needs work outside the database in the same step.

## Domain

### AD-008: Contacts are persons or organizations
**Accepted.** `contacts.type`; persons use first and last name, organizations `company_name`.
`display_name` is generated.

### AD-009: Four opportunity types
**Accepted.** buyer, seller, landlord, tenant; one shared pipeline.

### AD-006 / AD-007: Stages and lead sources are per-agency tables
**Accepted.** Seeded on provisioning, editable in Settings (owner/manager, AD-045).

### AD-012: Phones stored as E.164, emails lowercase
**Accepted.** Normalized in validation via `normalizePhone()` / `normalizeContactMethodValue()`;
the database doesn't enforce the format. Viber and WhatsApp use the same normalization.

### AD-041: International phone parsing with libphonenumber-js
**Accepted.** `libphonenumber-js` (min
metadata), BG default region, behind the same `normalizePhone()` signature. Landlines and foreign
numbers become valid; unparseable numbers are still rejected. BG numbers must pass `isValid()` or
have 9 national digits, which AD-012 accepted and stored data holds; foreign ones only
`isPossible()`, because min metadata lags new ranges abroad and rejecting a real caller costs more
than storing a typo.
**Revisit if:** bundle size hurts mobile.

### AD-049: A new inquiry assignee must be an active agency member
**Accepted.** Any member may assign (AD-001), and `assigned_to` only references `auth.users`, so
`InquiryService` checks a new assignee against the agency's active members on create, update and
convert. Leaving a deactivated assignee in place is allowed, so an edit doesn't force a reassign.
**Revisit if:** a database check covers every assignable table.

### AD-018: Contacts may share a phone or email
**Accepted.** No unique constraint on `contact_methods`; the duplicate warning ("create anyway")
is the defence. Spouses and colleagues share numbers.

### AD-015 / AD-017: Duplicates and merge
**Accepted.** Similar names found with `pg_trgm` on `display_name`. Merge picks a winner, moves
all related records to it, archives the loser and stores its pre-merge state in `merge_history`.

### AD-013: Task type is a CHECK-constrained text column
**Accepted.** A small fixed set; no lookup table.

### AD-014: Completing a task needs an outcome; the next step is prompted, not forced
**Accepted.** `completeWithNext` requires `outcome`; next task and stage change are optional.
An opportunity left with no pending task shows as at-risk.

### AD-046: Pending tasks are editable; completed and cancelled are final
**Accepted.** Any member can edit, reschedule or cancel a pending task; anything else throws
`errors.task_not_pending`. The cancel reason goes in `tasks.outcome`. Reschedule presets are
computed in agency time. `next_action_at` changes only through the trigger.
**Revisit if:** reports need cancel reasons apart from outcomes.

### AD-044: Today defaults to "mine"
**Accepted** (founder, 2026-10-28). Owners and managers get a Mine / Agency toggle
(`?scope=agency`); a broker always gets their own. Exceptions stays agency-wide.
**Revisit if:** managers ask for a per-broker filter.

### AD-016: Exceptions is a role-gated route
**Accepted.** `/exceptions` is owner/manager only, checked in the Server Component.

### AD-019 / AD-021: Notes table; the timeline is assembled on read
**Accepted.** One `notes` table with `contact_id` and/or `opportunity_id` (at least one). The
timeline merges notes, tasks, inquiries and audit events at read time; no activity table.

### AD-020: `audit_log` is written by triggers only
**Accepted.** AFTER UPDATE triggers on `opportunities` and `contacts`; the app only reads it and
RLS denies inserts from members.

### AD-026: Global search with Postgres full-text search
**Accepted.** Weighted `tsvector` columns kept by triggers (contacts include their contact
methods via a cascading trigger), `'simple'` config for Bulgarian, plus `pg_trgm`.

### AD-037: EUR is the currency
**Accepted.** EUR by default in `agencies.settings` and `opportunities.currency`, formatted with
`useFormatter`. Historical BGN values stay as stored.

### AD-056: Property, listing, parties and opportunity link are separate tables
**Accepted** (founder, 2026-11-03, `spec/properties.md`). `properties` is the physical asset; `listings`
holds sale or rent, price and status (one open listing per offer type); `property_parties`
links contacts with a role and an end date; `opportunity_properties` links opportunities as
`subject` (seller, landlord) or `candidate` (buyer, tenant, with a status). Location is a global
EKATTE `settlements` table plus agency-managed `areas`. No owner or price column on `properties`.
**Why:** mandates, syndication and matching attach to listings and exact areas without a split
migration; several parties and both deal sides stay possible (business brief data rules).

### AD-057: How the property model is enforced
**Accepted** (founder, 2026-11-03, Checkpoint 1 of `tasks/plan.md`). Rules sit in the database: `CHECK`s
for rule 3 and prices, partial unique indexes (one open listing per offer type, one `selected` and
one `subject` per opportunity, one open party per contact), and triggers for the code, audit and
rules 5, 7 and 8. Every reference between agency rows is a composite `(agency_id, x_id)` foreign
key, so a guessed id from another agency is refused (hence `UNIQUE (agency_id, id)` on contacts and
opportunities). A linked property or a used area can't be deleted (`RESTRICT`): archive or
deactivate. `code` comes from `agencies.property_code_seq` (first code 1001). A link status change is
one `opportunity` audit row with `field_name = 'property_link'`, read by both timelines. Settlements
come from the NSI EKATTE export through `scripts/ekatte/build-settlements.ts` with our own
Transliteration Act 2009 names; a contact merge moves property parties (C4).
**Why:** the data model is the module's main risk (`SPEC.md` §7); the strongest layer keeps
`matching`, `mandates` and imports honest without re-checking in each service.

### AD-058: Links and listings are fixed to their property; party history outlives contact deletes
**Accepted** (founder asked for the review fixes, 2026-11-04, Checkpoint 3 of `tasks/plan.md`). Members may update only a
link's `status` and `rejected_reason` and a listing's `price` and `status`: column `UPDATE`
privileges, not a trigger, so moving a link or listing to another property (past the archived
check, unaudited) is refused before any rule runs. A contact who is or was a property party
can't be deleted (`NO ACTION`, so an agency delete still cascades), and `import_revert` counts a
party as work (AD-036). The link audit trigger skips a removal while its agency is being deleted.
**Why:** the review found that an agency with links couldn't be deleted, that a plain `UPDATE`
could re-point links and listings, and that a contact delete erased the ownership history the
spec keeps.

### AD-059: Requirements have one write path and one audit row per save
**Accepted** (founder, 2026-11-05, Checkpoint 1 of `tasks/plan.md`).
Only two `SECURITY DEFINER` RPCs write `requirements` and `requirement_locations`:
`save_requirement` (row and locations in one transaction) and `remove_requirement`, each checking
the agency, the deal type (buyer/tenant) and status (`active`/`nurture`). Members get `SELECT`
only, as for `notification_deliveries` (E2), departing from AD-050's `SECURITY INVOKER` RPCs. The
row keeps `location_keys`, a sorted snapshot of its locations, so `CHECK`s count a location (rules
2, 4) and the audit trigger diffs a save from the row alone. Audit follows the property link
(AD-057): one `opportunity` row, `field_name = 'requirement'`, `metadata = { event, changes }` with
location names in both languages; no new `entity_type`. Triggers refuse a requirement on a seller
or landlord deal and that type change on a deal that has one; composite FKs as in AD-057.
**Why:** `matching` reads these rows as the truth, and a single writer is what makes "one save,
one timeline entry" true; direct writes could change locations unaudited.
**Revisit if:** `matching` needs locations in another shape, or imports need a second writer.

### AD-060: Matching is computed on read, by one SQL function
**Accepted** (founder, 2026-11-06, plan approval of `tasks/plan.md`). Refines `spec/matching.md`.
- **Read-time, no match table.** A match is computed when it is read from `requirements`,
  `properties`, `listings` and `opportunity_properties`; nothing is cached or kept in sync.
- **Rules in `match_evaluate` only.** `match_evaluate(requirements, properties, listings) RETURNS
  jsonb` is `LANGUAGE sql IMMUTABLE PARALLEL SAFE` and reads only its arguments. It returns
  `{ score, listed, criteria }`. The tolerances (10% on price and m², ±1 room) are constants in
  its body. No copy of a rule exists in TypeScript: `criteria.ts` only maps the jsonb to chips.
- **Two list functions.** `match_properties` (deal → properties) and `match_opportunities`
  (property → deals) are `LANGUAGE sql STABLE SECURITY INVOKER`, so RLS applies (AD-050), and
  also filter by `current_agency_id()`. One call returns the page, `total_count` and
  `unlinked_count`. Names are resolved in the service, so SQL carries no locale.
- **Location from `requirements.location_keys`** (AD-059): a property matches when its
  `settlement_id` or `settlement_id:area_id` is a key; `unknown` when the settlement is listed
  only with areas and the property has none.
- **Order:** reserved listings after all active ones, then score, then recency, then id (stable
  paging).
- **`opportunity_properties.source`** (`manual | match | viewing`, default `manual`) is set on
  insert only; the column `UPDATE` grant stays `(status, rejected_reason)` (AD-058). A member could
  send `match` on insert: accepted, because it only feeds a measurement (assumption A1) and no
  rule depends on it. The viewing trigger writes `viewing`.
- **Built as:** the property side is one section for all open listings (titled buyers, tenants or
  both by their offer types), not one per offer type, so the list function needed no type
  filter. A page past the end of a list returns the first page instead of an empty one.
  "Not suitable" inserts a `rejected` link (`rejectFromMatch`); no new table or column.
**Why:** the rules are the module's risk; one pure function means one place to review, test and
tune, and the same call serves both directions and `smart-lists`. Read-time matching can't go
stale when a price or a requirement changes.
**Revisit if:** the speed target (300 ms p95 at 2,000 + 2,000 rows) is missed and an index is not
enough, or `smart-lists` needs counts across all deals.

## Import

### AD-034: Chunked import pipeline
**Accepted.** The client parses the CSV and stages 500-row chunks into `import_rows` (Server
Action bodies max 1 MB), the server validates, and the client loops batch-commit RPCs until
`remaining = 0`.

### AD-035: Inquiry idempotency key
**Accepted.** Unique `(agency_id, source_id, external_ref)` on `inquiries`; re-imports and future
portal feeds skip exact duplicates.

### AD-036: Import revert within 7 days, untouched records only
**Accepted.** The revert deletes only imported records nobody has worked on: a contact with no
edit, note, task, opportunity, participant, inquiry or merge since the import, an inquiry with
no edit or conversion. The note an import row brought in isn't work unless edited. Rows that
created a record become `reverted` or `revert_skipped`. The edit guard on contacts goes beyond
`spec/trustworthy-loop.md` rule 10 because the confirmation dialog promises it.

## i18n

### AD-031: next-intl without locale routing
**Accepted.** `NEXT_LOCALE` cookie, set from `profiles.locale`; Bulgarian is the default. Every key
in both `messages/bg.json` and `messages/en.json`.

### AD-032 / AD-033: Errors travel as i18n keys
**Accepted.** Zod messages and `DomainError.code` are i18n keys; `toActionError()`
(`src/lib/actions.ts`) translates them on the server. RPCs return keys too, since they can't see
the request locale. Repository failures throw `errors.loadFailed`, `saveFailed` or `deleteFailed`
with the database message as the log-only detail; any other error becomes `errors.unexpected`
and is logged, so raw English never reaches the UI. Supabase Auth messages go through
`authErrorKey()`. `src/lib/i18n-keys.test.ts` fails on a key missing from the message files.

### AD-038: "Сделка" for opportunity
**Accepted.** Bulgarian UI uses "Сделка", not "Възможност". Glossary: `crm-domain-model` skill.

## Notifications

### AD-025 / AD-042: Email reminders via a Vercel Cron route and Resend
**Accepted** (founder, 2026-10-28; AD-042 replaces AD-025's pg_cron + Edge Function mechanism).
Email only. A Vercel Cron Route Handler reuses the TypeScript services (pg_cron + `pg_net`
calling the route is the fallback). The service-role client is allowed in that route, and every
query still filters by `agency_id`. Local development uses Mailpit and manual triggers. Scope:
`spec/reminders.md`.
**Revisit if:** push notifications arrive with the PWA.

### AD-051: How reminder emails are claimed, keyed and sent
**Accepted** (founder, 2026-10-30, with the reminders plan). Refines AD-042; scope stays in
`spec/reminders.md`.
- **Claim, then send.** A send first inserts a `pending` row in `notification_deliveries`
  (`ON CONFLICT DO NOTHING`); only the run that inserted it sends, then sets `sent` or `failed`.
  `sent` and `pending` block a repeat, `failed` and `skipped` can be claimed again. A crash
  mid-send leaves `pending`: that user misses one email rather than getting two.
- **Key per email.** `(user_id, kind, period_key)` is unique. `daily_digest` → `YYYY-MM-DD`
  (agency-local date); `inquiry_assigned` → `<inquiry_id>:YYYY-MM-DD`; an import summary →
  `import:<job_id>`. A single date key would stop a broker's second inquiry email of the day.
- **`skipped` means an empty digest**, so "why didn't X get an email?" has an answer. A user who
  turned the digest off, or a deactivated member, gets no row at all.
- **Only the service role writes** the table (the digest route, and `after()` work in the
  inquiry and import actions). Members read their own rows, owners and managers the agency's.
- **The route stays off until `go-live`.** With no `CRON_SECRET` it refuses every call;
  `?now=` is ignored when `NODE_ENV=production`.
- **Mail transport:** `MAIL_TRANSPORT=smtp` (Mailpit) or `resend` (plain `fetch`, paced).
**Why:** a double email costs trust and a missed one costs one digest; an inquiry email must
not be suppressed by the day's earlier one.
**Revisit if:** the pilot needs retries beyond the next day's run, or volume outgrows one request.

### AD-052: Agency counts are part of the digest
**Accepted** (founder, 2026-10-31, while building `reminders`). Refines
`spec/reminders.md` rules 2, 3 and 5.
- **Turning the digest off also stops the counts.** An owner or manager has one digest switch,
  and no separate email carries the counts.
- **Same rows as the sections.** The builder derives the counts from the agency's rows the digest
  has already loaded, so they add no query. Definitions match Exceptions (`docs/domain-model.md` §4).
- **The subject counts own work, or the agency's when there is none.** They aren't added together,
  because an own overdue task is also in the agency's overdue count.
**Why:** one switch is simpler to explain, and a count that can't disagree with the digest's own
sections is easier to trust.
**Revisit if:** owners want the counts without their own digest, or the other way round.

### AD-053: Who gets an assignment email, and what it counts
**Accepted** (founder, 2026-10-31, while building `reminders`). Refines
`spec/reminders.md` rule 4 and AD-051.
- **Active members of the agency only.** The service role bypasses RLS, so the send checks
  membership itself. Anyone else gets no email and no row, as with the digest.
- **An import summary counts `new` inquiries**, the same number the import preview shows. An
  import of closed history sends nothing.
- **A conversion uses the inquiry's date key.** If an inquiry goes A → B → A in one day, A hears
  once, and a conversion back to A that day sends nothing.
- **Nothing retries a failed assignment email.** It stays `failed`; a `new` inquiry still reaches
  the next digest.
**Why:** a summary of work to do shouldn't count work that's closed, and one key per inquiry per
day keeps a busy reassignment from spamming anyone.
**Revisit if:** pilot brokers miss a same-day hand-back, or ask to hear about imported history.

### AD-061: An inquiry can join an open deal; an invitation can be resent
**Accepted** (founder, 2026-11-06, plan approval of `tasks/plan.md`). Refines
`spec/conversion-join.md`.
- **`join_inquiry` is its own RPC**, beside `convert_inquiry` (not changed): `plpgsql`,
  `SECURITY INVOKER` (RLS applies, AD-050), `SET search_path = public`, `authenticated` only.
  Lock order is the inquiry, then the deal, so two joins can't deadlock. Refusals are i18n keys
  (`errors.not_found`, `errors.inquiries.invalid_transition`, `join_closed_opportunity`,
  `join_contact_not_on_opportunity`). A `nurture` deal is reactivated as
  `OpportunityRepository.reactivate` does; a deal with no owner takes the inquiry's assignee; an
  optional `call` task is created for the owner, else the caller. The RPC validates the call back
  itself (JSON null = none; blank title or bad date = `errors.inquiries.join_invalid_task`).
- **Origin vs joined is derived**: `inquiries.opportunity_id` is origin or joined,
  `opportunities.inquiry_id` is origin only. The "joined on" date is `inquiries.joined_at`, set by `join_inquiry`
  (review fix, migration `20261107000003`): `updated_at` moves on a contact merge (C4), so it
  can't date the join.
- **The call-back title comes from the form** (RPCs don't see the locale); `due_at` defaults to
  now + 1 h in agency time.
- **The notification reuses `notifyIfAssignedToColleague`** with the inquiry's previous assignee
  and the deal's owner (AD-053).
- **Resend claims first, then sends.** `claim_invitation_resend(p_membership_id)` is
  `SECURITY DEFINER` because memberships are owner-only for `UPDATE` while managers resend
  broker invitations. It checks agency and role (owner: any; manager: brokers only), then does one
  conditional `UPDATE` of `agency_memberships.invitation_sent_at` (at most once per 5 minutes).
  Only after a claim does the service send, so two clicks can't both send.
- **`invitation_sent_at` has no default**: backfilled from `invited_at` for `invited` rows,
  set by `createInvitation`, `NULL` on signup memberships.
- **Spike (2026-11-06, local stack):** calling `auth.admin.inviteUserByEmail` again for the same
  unconfirmed user returns the same user id, sends a second email (Mailpit) with a new `invite`
  token, and does not refuse. So resend uses `inviteUserByEmail` with the same `data` and
  `redirectTo` as `inviteMember`; no `generateLink` or own email path.
**Why:** a repeat caller should land on the deal that already exists, and a lost invitation
shouldn't need a second account or a database edit.
**Revisit if:** pilots need to join a deal the contact isn't on, or a failed resend email blocking
a retry for 5 minutes is felt.

### AD-062: Smart lists are filters evaluated on read in SQL; built-in lists are code
**Accepted** (founder, 2026-11-07; scope in `spec/smart-lists.md`).
- **`smart_lists` holds custom lists only** (`entity` `opportunity | inquiry`, `filter` jsonb,
  `shared`, `created_by`; unique name per member ignoring case; max 50 per member, enforced by a
  trigger raising `smartLists.errors.limit`). The nine built-in lists are presets in
  `src/domain/smart-lists/built-in.ts`, nothing per agency. Not audited: a list is a view
  preference.
- **RLS:** a personal list is seen and changed by its creator only, a manager included. Only
  owners and managers can insert or update to `shared = true`. A shared list is seen by the
  agency and renamed, edited or deleted by owners and managers. `agency_id`, `created_by` and
  `entity` never change (trigger). **Only the creator can unshare:** unsharing hands the list back
  to them alone, so the UPDATE policy's `WITH CHECK` requires `shared OR created_by = auth.uid()`;
  another manager deletes the list instead. (It once relied on Postgres applying the SELECT policy
  to the new row, which happens only when the UPDATE reads the table: an UPDATE with no WHERE got
  through. Fixed at the Checkpoint 1 review.) At most 5 of a member's lists may use
  `has_new_matches` (trigger, `smartLists.errors.matchListLimit`): each is a matching pass in the
  overview.
- **Three invoker SQL functions** (`LANGUAGE sql STABLE SECURITY INVOKER`, an explicit
  `current_agency_id()` filter, `authenticated` only): `smart_list_opportunities`,
  `smart_list_inquiries` (filter, limit, offset, `p_after` key; return the page, `sort_key` and
  `total_count`) and `smart_list_counts` (`[{key, entity, filter}]` in, counts out, each capped at
  1000). Nothing computes a list in TypeScript. Unknown filter keys are ignored by SQL; Zod
  refuses them before saving. A known key with a value of the wrong shape (a bad uuid, an unknown
  `next_action`, a `no_touch_days` that isn't a whole number ≥ 1) matches nothing, so a stale
  filter never widens.
- **The filter carries `sort`** (`created_desc` default, `last_touch_asc`, `next_action_asc`;
  inquiries `received_asc | received_desc`); every order ends with `id`.
- **`me` is `auth.uid()` in SQL**, so a shared "mine" list is per viewer. Mine / Agency on the
  built-in lists is `assigned_to: 'me'` set or dropped by the service (AD-044).
- **Day windows are computed in SQL** from the agency timezone setting (`agencies.settings`) and pinned to `getTodayWindows` by
  a test (`overdue` before now, `today` until the next agency midnight, `upcoming` the next four
  days). **`overdue` and `due-today` are deals by the deal's owner, placed by `next_action_at`**
  (the earliest pending task), not Today's tasks by the task's assignee; the Today-consistency
  test compares after mapping Today's tasks to the viewer's deals (spec rule 2, Checkpoint 1
  review).
- **Last touch is a function, not a column:** latest completed task `completed_at` or note
  `created_at` on the deal, else `created_at`; never `updated_at`.
- **`new-matches` reuses `match_evaluate`:** one view (`deal_match_rows`) holds the join for both
  `match_properties` and the list. **Decided at Checkpoint 1 (founder, 2026-11-07): the list is
  ordered by oldest last touch, and each row of the page shows its new-match count.** Ordering by
  the exact count means counting every deal: 57 s at 2,000 deals (1.7–4.6 s even capped). A cache or
  materialized view still needs the founder's OK (AD-060 revisit clause). **Accepted speed
  exception:** on Agency scope at 2,000 deals the `new-matches` page and queue step take ~1.2–1.3 s
  and the overview p95 ~1.1–1.4 s (spec rule 10); on Mine about 30× less. `deal_match_rows` lives
  in the `private` schema, which the API doesn't expose, so a client can't request every
  deal × listing pair directly; the invoker functions read it as the caller.
- **The queue lives in the URL** (`/opportunities/[id]?list=<id>&pos=<n>&of=<total>&key=<k1>`);
  Next and Skip ask for the first row after the current deal's `sort_key`, so a deal that left the
  list doesn't break the order. **The key is the one the deal had when the queue opened it**, not
  its key now (Task 9): working a deal moves its key (a completed task is a new touch, a new task
  a new next action), and asking "after the key now" would skip every deal in between. Each step
  is a GET to `/lists/[id]/step` that re-runs the list at the click and redirects to the deal or
  to the list's "List done" state, so the deal page only resolves the list's name. `pos` counts
  the deals stepped through and `of` is the list's size at the last step, shown as "No. 2 · 1
  deal in the list" (a deal that was worked has left the count). Previous takes the row at
  `pos - 1` of the list as it is now (cut 2). The opportunity list reads through
  `smart_list_opportunities` too, so a list and its saved copy always agree.
**Why:** the count is the work left, so a list must be evaluated when it is read; one SQL
definition per list keeps the overview, the list page and the queue consistent, and matching
keeps one rule set.
**Revisit if:** pilot agencies working on Agency scope find the `new-matches` list or the overview
slow (the accepted exception above), or agencies ask to configure thresholds or list definitions.

### AD-063: A saved list's filter comes from its entity list's URL
**Accepted** (smart-lists Tasks 11–13 and their review, 2026-11-08).
- **Save as list and Update list send the list page's URL params, not a filter.** The server maps
  them in `src/domain/smart-lists/url-filter.ts` through the same `toListFilter` the deal list
  reads with (`src/domain/opportunities/list-filter.ts`), so a saved list counts exactly what the
  page showed. Update list maps them by the **list's own** `entity`; the client never says which.
- **A saved list stores only what its page can show.** Deal lists: the page's filters, newest
  first. Inquiry lists: status and search, newest first; assigned-to and source are not on the
  inquiry page, so they are not saved (a list "from imot.bg" is a search).
- **Edit filters opens the entity list with the filter as URL params.** What the page can't show
  (`me`, `unassigned`, several values of a key, another sort, a stale shape) is left out, and the
  page **warns** before Update list replaces it (`shownExactly`). Lists saved from the UI always
  round-trip exactly; seeded or SQL-made lists may not.
- **Sharing:** owners and managers share their own personal list; only the creator unshares
  (AD-062's RLS). The actions require the role before any read.
**Why:** one mapping between the page and the saved filter means the list and its saved copy
can't drift, and nothing the user can't see is changed without a warning.
**Revisit if:** the inquiry page gains filters (add them to the mapping), or users ask to edit
`me` / several values from the list page (add them to the page's URL filters, which removes the
warning case).

### AD-064: Property import validates in TypeScript and writes per row in one RPC
**Accepted** (property-import plan, 2026-11-08).
- **Validation in TypeScript, writes in one RPC.** As for contacts (AD-034): the service
  validates each page of rows and stores a `normalized` payload with every id resolved
  (`settlement_id`, `area_id` or `new_area: { settlement_id, name }`, `assigned_to`, the
  listings, `owner_contact_id` or `new_owner`). `import_commit_properties(p_job_id, p_limit)`
  writes each row in its own `BEGIN … EXCEPTION` block, so a failed row is `error` and leaves
  nothing behind (AD-050).
- **One address rule, in SQL.** `property_address_key(text)` is `IMMUTABLE`; `properties.address_key`
  is a stored generated column from it, indexed `(agency_id, settlement_id, address_key)`.
  Validation asks `import_property_address_matches(p_items)` for each row's key and existing
  match, finds in-file duplicates from those keys, and the commit re-checks with the same column.
  No copy of the rule exists in TypeScript.
- **Owners and areas are shared at commit.** The RPC re-matches the owner by phone and email
  against `contact_methods` before creating a contact, and inserts a new area with `ON CONFLICT`
  on `(agency_id, settlement_id, lower(name))` before selecting it, so rows of one file share
  them without in-file bookkeeping. The preview groups them so its counts match.
- **An unmatched owner with no name is skipped, not refused** (spec Q3). The property still
  imports, with no owner party, and `normalized.warnings` carries
  `import.warnings.ownerSkippedNoName` for the preview. A row-level warning is a valid row's
  note, never an error: `errors` stays empty and the row commits.
- **Unticked new areas** live in `import_jobs.options.create_areas` as the kept
  `settlement_id:name` keys; the commit creates only those and imports the other rows without an
  area. No re-validation.
- **Settlement lookup** loads candidates by `lower(name_bg|name_en)` (after stripping
  `гр.`/`с.`/`град`/`село`) and by EKATTE code; a pure function resolves unique, ambiguous,
  narrowed by municipality or province, or not found. Never by order.
- **Header detection takes the entity**, with one synonym dictionary per entity, so property
  columns ("type", "description", "id") can't change contact or inquiry mapping.
- **Audit carries the job.** The property and listing `created` audit rows get `import_job_id` in
  `metadata` when the record has one. The property row also stores the job's `file_name` (from a
  job of the same agency only), because brokers can't read `import_jobs`; the timeline shows
  "Imported from <file>" from the audit row alone (Task 11, 20261109000006).
- **Revert "untouched"**: the property's `updated_at` ≤ the job's `completed_at`, and no note,
  task or opportunity link, no listing outside the job or changed after it, no party ended,
  added later or from outside the job, and none of the row's listings or its owner party deleted
  by hand. `properties.updated_at` moves only when an editable column changes (a trigger `WHEN`
  that ignores `search_vector` and `address_key`), so renaming an area isn't work on its
  properties (Checkpoint 1 review). Properties go first (listings and parties cascade), then
  the existing contact rule, then the job's areas no property or `requirement_locations` row uses.
- **Limits** unchanged: 5 MB, 5,000 rows, 500-row chunks.
- **Scale (final, local stack, 2,000 rows):** validate 3.3 s plus preview 0.2 s (rule 11: < 30 s),
  commit 8.0 s in 10 × 200-row batches (< 2 min), stage 0.4 s, revert 2.7 s. The E2E commits and
  reverts the 20-row file in about 8 s per project.
- **Numbers and dates.** A dot or comma before exactly three digits is a thousands separator
  (`185.000` and `185,000` are both 185 000). `options.date_format` is one of `dd.MM.yyyy`,
  `dd/MM/yyyy`, `MM/dd/yyyy`, `yyyy-MM-dd` and replaces the day-first guesses; ISO dates are
  always accepted. A job default assignee must be an active member, or validation refuses the
  job (`import.errors.unknownDefaultAssignee`).
**Why:** one validation path shared with the property form and contacts, one address rule the
preview and the commit can't disagree on, and a per-row all-or-nothing write that a revert can
undo precisely.
**Revisit if:** the scale run misses rule 11 (batch the RPC differently), or the address key
proves too loose or too strict on a real export (tune the one function).

---

## Retired

Kept so old references resolve: AD-003 (English first: replaced by AD-031), AD-005 and AD-011
(sprint sequencing), AD-010 (free-text phones: reversed by AD-012), AD-022 ("Team Member"
placeholder: replaced by AD-023).
