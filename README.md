# BrokerCRM

A multi-tenant SaaS CRM for Bulgarian residential real estate brokerages.

## Local Development Runbook

To set up and run the project locally, you need Docker (for Supabase) and Node.js.

### 1. Start the Database
Start the local Supabase stack (PostgreSQL, GoTrue auth, PostgREST):
```bash
npx supabase start
```
*Note: This will also apply any pending migrations.*

### 2. Reset and Seed the Database
If you need a clean slate with the exact production schema and local seed data (two agencies, owners, contacts, etc.):
```bash
npx supabase db reset
```

### 3. Run the Test Suites
We maintain a strict test harness. Before pushing, ensure all tests pass:

**Database Tests (pgTAP):** Tests RLS, tenant isolation, and SQL functions.
```bash
npx supabase test db
```

**Domain Logic Tests (Vitest):** Tests phone normalization, date handling, and business rules.
```bash
npm run test
```

### 4. Start the Application
Start the Next.js development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Documentation
- `AGENTS.md`: Commands, architecture and rules for contributors and AI agents
- `docs/business-description.md`: Product and business brief
- `docs/BRD.md`: Requirements and their status
- `docs/domain-model.md`: Entities, lifecycles, invariants and glossary
- `docs/decisions-log.md`: ADRs (Architecture Decision Records)
- `docs/learnings.md`: Patterns and gotchas
- `docs/sprint-*-implementation-plan.md`: Current sprint plan (finished sprints in `docs/archive/`)