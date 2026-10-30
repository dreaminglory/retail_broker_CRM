# BrokerCRM

Multi-tenant CRM for Bulgarian residential brokerages (2–30 brokers). Promise: every
opportunity has an owner, a next action and a complete history. **What we're building and
what's next: `SPEC.md`.**

## Where things are

| File | What it is | Read it when |
|---|---|---|
| `SPEC.md` | Product spec: objective, non-goals, pilot gate, module map with status, ideas backlog, pilot evidence | Starting any work; picking what's next |
| `spec/<module-id>.md` | One module's approved scope: rules, edge cases, acceptance criteria | Planning or building that module |
| `tasks/plan.md`, `tasks/todo.md` | Plan and checklist of the **one** active module | Building; tick tasks only after the Definition of Done |
| `docs/domain-model.md` | Entities, states and invariants as built | Touching a table, status or rule (with `crm-domain-model`) |
| `docs/decisions-log.md` | Decisions in force (AD-NNN), cited from code | Before changing something an AD covers |
| `docs/BRD.md` | Functional requirements (FR-xxx) with built status | Closing a module; checking a requirement |
| `docs/research/` | Business brief, competitor gap analysis, pattern benchmark | Only for `/feature-ideas` and new specs |
| `docs/archive/` | Finished plans and old sprint docs | Rarely; history only |

## Commands

```bash
npm run dev            # localhost:3000
npm run typecheck      # tsc --noEmit
npm run lint           # eslint (i18next/no-literal-string flags hardcoded JSX text)
npm run test           # vitest; one file: npx vitest run <path>
npm run stack:up       # local Supabase (Docker Desktop running) + .env.local
npx supabase db reset  # clean DB + seed (two agencies)
npm run test:db        # pgTAP (needs the local stack)
npm run test:services  # vitest with the service suites and coverage (needs the local stack)
npm run test:e2e       # Playwright core loop, bg + en, 1280 and 390 px (needs the local stack;
                       # first time: npx playwright install chromium)
```

Seeded logins, password `password123`: `owner|manager|broker@alpha.bg` (or `@beta.bg`).
Switch language with the `NEXT_LOCALE` cookie (`bg`/`en`). `SUPABASE_SERVICE_ROLE_KEY` is server-only.

## Architecture

- Next.js 16 differs from older versions: check `node_modules/next/dist/docs/` before using an
  API you are not sure of.
- Per entity `src/domain/<entity>/`: `types.ts`, `validation.ts` (Zod), `repository.ts`
  (queries), `service.ts` (rules; takes a `SupabaseClient`). UI in `src/components/domain/<entity>/`,
  shadcn primitives in `src/components/ui/`.
- Mutation: component → Server Action `src/app/(dashboard)/<feature>/actions.ts` →
  `getAuthContext()` → Zod → service → `revalidatePath()`. Actions return `ActionResult<T>`,
  never throw, and wrap errors with `toActionError()` (`src/lib/actions.ts`). Business-rule
  violations throw `DomainError` with an i18n key.
- Supabase clients `src/lib/supabase/`: `server.ts`, `client.ts`, `admin.ts` (service role,
  only in Server Actions that need it and the reminders cron route, AD-042).
- i18n: next-intl, no locale routing, Bulgarian default. Every key goes in **both**
  `messages/bg.json` and `messages/en.json`. Dates and numbers via `useFormatter`.
  "Today" is agency-local (`src/lib/time/agency-day.ts`).
- Authorization lives in Server Component layouts and RLS; `src/proxy.ts` only refreshes the session.
- Style: `type` over `interface`, named exports, kebab-case files, Server Components unless a
  client one is needed, errors shown with a `sonner` toast.

## Rules that fail silently

- Migrations, policies, functions, RPCs: load the `supabase-patterns` skill first.
  Tables, statuses, business rules: load `crm-domain-model` first.
- Filter by `agencyId` in code too; RLS is the safety net.
- Never write `audit_log` from app code (triggers do it) or set `opportunities.next_action_at`
  (the `tasks` trigger does it).
- Phones stored E.164 via `normalizePhone()`, emails lowercase. An inquiry's `raw_payload` is never modified.
- RPCs don't see the request locale: return i18n keys. Server Action bodies max 1 MB: chunk large payloads.
- No synchronous `setState` inside `useEffect`.
- Stages, lead sources and merge are owner/manager only: `requireRole(ctx, CONFIG_ROLES)`.
- Never add entries to `eslint-suppressions.json`.

## Definition of done

Seen passing in this session, never assumed (if something can't run, say so):

1. `npm run typecheck`, `npm run lint`, `npm run test`. New or changed service/validation
   logic has Vitest tests; a bug fix starts with a failing test.
2. Touched `supabase/`: `npx supabase db reset` then `npm run test:db`.
3. Changed UI: checked in the browser in `bg` and `en`.
4. Changed schema or a rule: `docs/domain-model.md` in the same commit. Made a design
   decision: a new AD in `docs/decisions-log.md`.

## Workflow

One module at a time, from the capability map in `SPEC.md`:

1. **Ideas** — `/feature-ideas` finds gaps and scores them into the SPEC.md backlog.
2. **Spec** — `/spec <module-id>` writes `spec/<module-id>.md`. The founder approves it.
3. **Plan** — `/plan` writes `tasks/plan.md` and `tasks/todo.md`.
4. **Build** — `/build auto` runs a whole phase after one approval (`/build` = one task).
   It commits per task on a feature branch (`feat(<module-id>): ...`), never on `main`.
5. **Review** — `/review` at each phase checkpoint; `/ship` before a prod `db push` or a pilot release.
6. **Close** — mark the module Done in `SPEC.md`, set its `docs/BRD.md` rows, move `tasks/*`
   to `docs/archive/<module-id>-*.md`.

Never push, open a PR or merge without being asked. Start a fresh session per phase.
