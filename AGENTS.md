<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# BrokerCRM

Multi-tenant SaaS CRM for Bulgarian residential real estate brokerages. The product
promise: every opportunity has an owner, a next action, and a complete history.

This file holds the project instructions; Claude Code loads it through `CLAUDE.md`.
Coding conventions: `.claude/rules/coding-conventions.md`. Skills: `.claude/skills/`.

## Commands

```bash
npm run dev                          # localhost:3000
npm run typecheck                    # tsc --noEmit
npm run lint                         # eslint; i18next/no-literal-string flags hardcoded JSX text
npm run test                         # vitest (node env, globals on)
npx vitest run path/to/file.test.ts  # one file
npm run test:db                      # pgTAP, supabase/tests/database (local Supabase must be running)
npx supabase start                   # local stack via Docker, applies migrations
npx supabase db reset                # clean DB + supabase/seed.sql (two agencies, sample data)
npm run build
```

Env vars: `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` is server-only.

## Definition of done

A change is not done until all of these pass, and you have seen them pass in this session:

1. `npm run typecheck` and `npm run lint` (no new warnings in touched files).
2. `npm run test`, plus new Vitest tests for any new or changed service/validation logic.
3. If you touched `supabase/`: `npx supabase db reset` then `npm run test:db`.
4. If you changed UI: check it in the browser in both `bg` and `en`.
5. Docs updated in the same change: `docs/domain-model.md` for schema or rule changes,
   `docs/decisions-log.md` for a design decision, `docs/BRD.md` for a new screen,
   requirement or business rule.

If a step can't run (e.g. Docker is down), say so explicitly. Never report it as passed.

CI (`.github/workflows/ci.yml`) runs steps 1–3 on every pull request and push to `main`.
Existing lint errors are baselined in `eslint-suppressions.json`: never add entries to it.
After fixing suppressed errors, shrink it with `npx eslint . --prune-suppressions`.

## Where things are

| Need | Read |
|---|---|
| Entities, states, invariants, glossary | `docs/domain-model.md` (keep it current) |
| Why something is the way it is | `docs/decisions-log.md` (AD-0xx) |
| Patterns and past mistakes | `docs/learnings.md` (L-, P-, G-) |
| Requirements and status per feature | `docs/BRD.md` |
| Product brief, personas, pilot scope | `docs/business-description.md` |
| Current state and carry-over | `docs/STATUS.md` (created by the `sprint-planning` skill) |
| Pilot evidence for prioritisation | `docs/pilot-feedback.md` |

Finished sprint plans are in `docs/archive/`. Don't read them unless a question needs them.

## Architecture

- **Per entity** (`src/domain/<entity>/`): `types.ts`, `validation.ts` (Zod),
  `repository.ts` (Supabase queries), `service.ts` (business rules; takes a
  `SupabaseClient` in the constructor). UI: `src/components/ui/` (shadcn primitives),
  `src/components/domain/<entity>/`.
- **Mutations**: component → Server Action in `src/app/(dashboard)/<feature>/actions.ts`
  → `getAuthContext()` (`src/lib/actions.ts`: user, `agencyId`, `role`) → Zod → Service
  → `revalidatePath()`. Actions return `ActionResult<T>` and never throw; wrap errors
  with `toActionError()` (same file). Throw `DomainError` (`src/lib/errors.ts`) with an
  i18n key for business-rule violations.
- **Supabase clients** (`src/lib/supabase/`): `server.ts` for Server Components and
  Actions, `client.ts` for client components, `admin.ts` (service role) only inside
  Server Actions that need it (invitations).
- **i18n** (next-intl, no locale routing): locale from the `NEXT_LOCALE` cookie, synced
  from `profiles.locale`. Bulgarian is the default. Add every key to **both**
  `messages/bg.json` and `messages/en.json`. Zod messages and `DomainError.code` are
  translation keys, translated in `toActionError`. Default stage names are translated
  via `useStageTranslation`; custom names pass through. Format dates and numbers with
  `useFormatter`.
- **Time**: "today" is agency-local (`src/lib/time/agency-day.ts`, default Europe/Sofia).
- **Authorization** is enforced in Server Component layouts and by RLS.

## Rules that are easy to get wrong

These fail silently or only in production. Each has a reference in `docs/learnings.md`
or `docs/decisions-log.md`.

- Every tenant table: `agency_id NOT NULL`, RLS `ENABLE` **and** `FORCE`, policies via
  `current_agency_id()` / `current_user_role()`. Add new tables to the `tables_are` list
  in `supabase/tests/database/010-rls-catalog.sql`. Template: `supabase-patterns` skill.
- A policy must never query `agency_memberships` or its own table: infinite recursion (G-001).
- Still filter by `agencyId` in code. RLS is the safety net, not the only layer.
- New `public` functions: revoke `EXECUTE` from `PUBLIC, anon`, grant explicitly (AD-028).
- RPCs don't see the request locale. Pass it in, or return i18n keys (G-008).
- Server Action bodies are limited to 1 MB. Chunk large payloads client-side (G-007, P-009).
- `audit_log` is append-only and written by DB triggers. Never insert from app code (AD-020).
- `opportunities.next_action_at` is maintained by the `sync_opportunity_next_action`
  trigger on `tasks`. Never set it from app code.
- Phones are stored E.164 via `normalizePhone()`; emails lowercase.
- An inquiry's `raw_payload` (original source data) is never modified. Caller fields,
  links, assignment and status are editable.
- No synchronous `setState` inside `useEffect` (G-003).
- **Known gap:** AD-030 and G-010 describe `src/proxy.ts` refreshing the Supabase
  session, but that file has never been committed, and there is no middleware either.
  Don't assume token refresh happens per request.

## Product scope

BrokerCRM is a full agency system for Bulgarian residential sales agencies (2–30 brokers),
with follow-up discipline as its edge (AD-039).

Core loop: inquiry arrives → contact matched or created → opportunity created → broker
assigned → next action scheduled → broker sees it on Today → outcome recorded → new next
action or stage change → manager sees exceptions. Details in `docs/domain-model.md`.

Property side of the loop (committed, built sprint by sprint): property and mandate
recorded → published to portals → buyer requirement recorded → matched to properties →
viewing with feedback → offer → won or lost. These attach to the core loop's contacts and
opportunities; they don't replace it.

Committed modules (AD-039): properties and mandates, requirements and matching, viewings,
offers, portal syndication, portal/email lead intake, routing and lead pool, reminders,
action plans, Smart Lists, reports, GDPR tools, PWA. Pilot evidence sets their order.

Non-goals (don't build unless asked): native mobile apps, WhatsApp/Viber inbox, commission
accounting, AI lead scoring, complex marketing automation, document generation and
e-signatures, transaction management, AML document handling, MLS-like marketplace,
multi-country expansion.

## Workflow

- Planning a sprint or feature slice: `sprint-planning` skill.
- Schema, RLS, functions: `supabase-patterns` skill.
- Domain questions or changes: `crm-domain-model` skill.
- Conventional commits (`feat(sprint-N): ...`), one logical change each. Commit or push
  only when asked.
- After a feature: offer to update `docs/BRD.md`, and record design decisions in
  `docs/decisions-log.md`.
