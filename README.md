# BrokerCRM

A multi-tenant CRM for Bulgarian residential real estate brokerages. Next.js 16 + Supabase.

## Run it locally

Needs Node.js and Docker Desktop (running).

```bash
npm install
npm run stack:up       # local Supabase + .env.local
npx supabase db reset  # clean DB + seed (two agencies)
npm run dev            # http://localhost:3000
```

Seeded logins (password `password123`): `owner@alpha.bg`, `manager@alpha.bg`, `broker@alpha.bg`
(and `@beta.bg`).

## Tests

```bash
npm run typecheck && npm run lint && npm run test   # TypeScript, ESLint, Vitest
npm run test:db                                      # pgTAP: RLS, tenant isolation, SQL functions
npm run test:e2e                                     # Playwright core loop (first time: npx playwright install chromium)
```

## Documentation

- `AGENTS.md`: commands, architecture, rules, Definition of Done, workflow, and a map of every doc
- `SPEC.md`: what we're building, in which order, and where it stands
