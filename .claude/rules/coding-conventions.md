# Coding Conventions

## TypeScript
- Use `type` over `interface` for object shapes (consistency)
- Use `as const` for literal types where appropriate
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
- Indexes: always on `agency_id`, and on commonly filtered/sorted columns

## React Components
- Use React Server Components by default; add `'use client'` only when needed
- Co-locate server actions with the pages/features that use them
- Use shadcn/ui primitives — don't reinvent buttons, inputs, dialogs, etc.

## Error Handling
- Show errors to the user with a `sonner` toast, using the translated message
- Log technical errors with `console.error` (Sentry later)

## Tests
- Vitest for domain services and validation: co-locate as `<file>.test.ts`
- pgTAP for RLS, triggers and RPCs: `supabase/tests/database/0NN-<desc>.sql`
- A bug fix starts with a test that fails without the fix
