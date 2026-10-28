# Sprint N Task List — BrokerCRM

> **Theme:** <one line>
> **Plan:** `docs/sprint-N-implementation-plan.md`
> **Legend:** `[ ]` todo · `[x]` done · **(Should)** = cuttable per plan §7 · AC = acceptance criterion

---

## Slice N.S — <Name> (≈X d)

### User stories
- **US-B0NN:** As a broker, I can … so that …
- **US-M0NN:** As a manager, …

### Tasks
#### Database
- [ ] Migration `YYYYMMDDHHMMSS_<desc>.sql` (L-006 naming, sorts after the latest file)
- [ ] RLS per P-001 + pgTAP isolation test `supabase/tests/database/0NN-<desc>.sql`
#### Domain
- [ ] `src/domain/<entity>/types.ts` · `validation.ts` · `repository.ts` · `service.ts`
- [ ] Vitest: `<file>.test.ts`
#### Server Actions
- [ ] `<action>` (Zod-validated, role-gated, `toActionError()`)
#### UI
- [ ] <route / component>
- [ ] i18n keys in `messages/bg.json` + `messages/en.json`
- [ ] Browser check: desktop + 390 px, BG locale

### Acceptance criteria
- [ ] **AC-N.S-1** <testable statement> (FR-XXX-NN)

---

## Sprint Close (Slice N.last)
- [ ] All Must slices merged and deployed (`supabase db push` done)
- [ ] `supabase test db`, `npm test`, `npm run typecheck`, `npm run lint` all green
- [ ] Supabase security advisor clean
- [ ] Task list fully ticked (or untouched items moved to STATUS.md carry-over)
- [ ] BRD: FR tables ✅, new stories added, Deferred Items updated
- [ ] decisions-log + learnings appended
- [ ] `docs/STATUS.md` refreshed
- [ ] Previous sprint's plan + task list moved to `docs/archive/`
