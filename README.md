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
- `docs/BRD.md`: Business Requirements Document
- `docs/sprint-*-implementation-plan.md`: Technical implementation details for each sprint
- `docs/technical-architecture.md`: Engineering runbook and architectural decisions
- `docs/decisions-log.md`: ADRs (Architecture Decision Records)