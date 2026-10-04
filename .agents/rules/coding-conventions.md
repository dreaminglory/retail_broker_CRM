# Coding Conventions

## TypeScript
- Use `type` over `interface` for object shapes (consistency)
- Use `as const` for literal types where appropriate
- Never use `any` — use `unknown` if the type is truly unknown
- Prefer named exports over default exports
- Use barrel exports (`index.ts`) sparingly — only for public domain APIs

## File Naming
- Use kebab-case for files and directories: `contact-methods.ts`, `inquiry-form.tsx`
- Use PascalCase for React components: `ContactCard.tsx` → `export function ContactCard()`
- Use camelCase for functions and variables
- Use SCREAMING_SNAKE_CASE for constants and enum-like objects

## Database
- Table names: snake_case, plural (`contacts`, `agency_memberships`, `opportunity_participants`)
- Column names: snake_case (`created_at`, `agency_id`, `contact_name`)
- Foreign keys: `<referenced_table_singular>_id` (e.g., `contact_id`, `agency_id`)
- Every table gets: `id` (uuid, PK), `created_at` (timestamptz), `updated_at` (timestamptz)
- Every tenant table gets: `agency_id` (uuid, FK to agencies, NOT NULL)
- Indexes: always on `agency_id`, and on commonly filtered/sorted columns
- RLS: enabled and enforced on every tenant table, using `current_agency_id()` helper

## React Components
- Use React Server Components by default; add `'use client'` only when needed
- Keep components focused — one primary responsibility per component
- Co-locate server actions with the pages/features that use them
- Use shadcn/ui primitives — don't reinvent buttons, inputs, dialogs, etc.

## Error Handling
- Server actions return `{ success: true, data }` or `{ success: false, error }` — never throw
- Display user-friendly error messages via toast notifications
- Log technical errors to console (later to Sentry)

## Git Commits
- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- One logical change per commit
- Reference the sprint/task when relevant: `feat(sprint-1): add inquiry creation form`
