# BrokerCRM — AI Agent Project Context

## Project Identity
This is a **multi-tenant SaaS CRM** for Bulgarian residential real estate brokerages.
The product ensures every opportunity has an owner, a next action, and a complete history.

## Foundational Documents
Always check these before making architectural decisions:
- `business-description.md` — Founding product brief, domain model, personas, pilot scope
- `docs/BRD.md` — Business Requirements Document (populated incrementally during development)
- `docs/decisions-log.md` — Architecture Decision Records (ADRs)
- `docs/learnings.md` — Best practices and patterns discovered during development

## Approved Tech Stack
- **Framework:** Next.js 16 (App Router, React Server Components, Server Actions)
- **Language:** TypeScript 5.x (strict mode)
- **Database:** Supabase (managed PostgreSQL with Row-Level Security)
- **Auth:** Supabase Auth (email/password, magic link)
- **Styling:** Tailwind CSS 4 + shadcn/ui components
- **Icons:** Lucide React
- **Validation:** Zod (runtime validation + TypeScript inference)
- **Forms:** React Hook Form
- **Hosting:** Vercel
- **Error Monitoring:** Sentry (later)
- **Analytics:** PostHog (later)

## Approved Architecture Decisions
- **Record visibility:** Agency-visible (all members of an agency see all records)
- **Tenant isolation:** `agency_id` on every tenant-owned table, enforced by PostgreSQL RLS
- **Auth model:** User → AgencyMembership → Agency (users belong to agencies via memberships)
- **Roles:** owner, manager, broker (defined on AgencyMembership, not on User)
- **Localization:** Build in English first, localize to Bulgarian before pilot
- **Domain structure:** `src/domain/<entity>/` with types.ts, service.ts, repository.ts, validation.ts
- **UI structure:** `src/components/ui/` for shadcn primitives, `src/components/domain/` for CRM components

## Core Operating Loop (Foundation Slice)
The primary workflow this system must support:
1. Inquiry arrives → 2. Contact matched/created → 3. Opportunity created →
4. Broker assigned → 5. Next action scheduled → 6. Broker sees it on Today Screen →
7. Outcome recorded → 8. New next action or stage change → 9. Manager sees exceptions

## Critical Rules
- **NEVER** create a database table without `agency_id` and an RLS policy
- **NEVER** write a query without tenant scoping (RLS is the safety net, not the only layer)
- **ALWAYS** use Zod schemas for validating input data
- **ALWAYS** use TypeScript strict mode — no `any` types
- **ALWAYS** use Server Actions for mutations, not client-side API calls
- **ALWAYS** handle errors gracefully with user-friendly messages

## Non-Goals for Pilot
Do NOT build any of these unless explicitly asked:
- Native mobile apps (iOS/Android)
- WhatsApp/Viber two-way inbox
- Listing syndication or property portal
- Commission accounting
- AI lead scoring
- Document generation
- Advanced transaction management
