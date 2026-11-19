# phone-loop — task list

> Plan: `tasks/plan.md`. Spec: `spec/phone-loop.md`. Tick a task only after the Definition of
> Done in `AGENTS.md` (typecheck, lint, test; `db reset` + `test:db` if `supabase/` changed;
> browser check in bg and en if UI changed).

## Phase 1 — Foundation

- [ ] **T1: Link builders and mobile detection** (S) — Opus no
  - Acceptance:
    - `src/lib/contact-links.ts` exports `telHref`, `viberHref`, `whatsAppHref`, `mailtoHref`,
      `isMobile`, and `contactLinksFor(value, type)` returning the buttons rule 1 allows.
    - BG mobile → Call, Viber, WhatsApp; BG landline → Call; saved `viber` method → Viber even
      if landline; foreign mobile → all three; unparseable legacy → Call with digits only.
    - `isMobile` uses `libphonenumber-js/mobile` (founder approved 2026-11-19), imported only
      here; the bundle delta is measured and written in the commit message and AD-065.
  - Verify: `npx vitest run src/lib/contact-links.test.ts`; typecheck, lint.
  - Files: `src/lib/contact-links.ts`, `src/lib/contact-links.test.ts`.

- [ ] **T2: Migration part 1: columns, tenant check, contacted_at** (M) — **Opus**
  - Acceptance:
    - AD-065 in `docs/decisions-log.md` before the SQL.
    - `tasks.inquiry_id` (FK, `ON DELETE SET NULL`, partial index), `tasks.channel` (check
      `phone|viber|whatsapp|email`), `inquiries.contacted_at`.
    - BEFORE trigger refuses an `inquiry_id` from another agency (pattern
      `refuse_archived_property`); `trg_task_marks_inquiry_contacted`;
      `trg_inquiry_contacted_at`. Grants per `supabase-patterns`.
    - pgTAP `106-phone-loop.sql`: first attempt sets `contacted_at` + `contacted`; second doesn't
      move it; converted/dismissed status untouched; "Mark contacted" sets it; existing rows
      `NULL`; cross-agency refused; run as a seeded broker.
    - `src/types/database` regenerated; `docs/domain-model.md` §2.2, §2.3, §3.1, invariants.
  - Verify: `npx supabase db reset`; `npm run test:db`; typecheck.
  - Files: `supabase/migrations/20261119000001_phone_loop.sql`,
    `supabase/tests/database/106-phone-loop.sql`, `docs/decisions-log.md`,
    `docs/domain-model.md`, generated types.

- [ ] **T3: Migration part 2: calls follow conversion and dismiss** (S) — **Opus**
  - Acceptance:
    - `trg_inquiry_tasks_follow`: convert and join give the inquiry's tasks the deal and
      contact; dismiss cancels pending ones with outcome `phoneLoop.cancelledByDismiss`.
    - The deal's `next_action_at` equals the pending retry after convert and after join
      (extend the next-action trigger's `UPDATE OF` list or recompute here; pgTAP proves it).
    - `convert_inquiry` / `join_inquiry` not edited; their existing pgTAP files still pass.
    - Domain model: invariant for inquiry tasks following conversion; known gap 2 unchanged.
  - Verify: `npx supabase db reset`; `npm run test:db`.
  - Files: `supabase/migrations/20261119000002_phone_loop_follow.sql`,
    `supabase/tests/database/106-phone-loop.sql`, `docs/domain-model.md`.

### Checkpoint: Foundation
- [ ] typecheck, lint, test, `db reset`, `test:db` green
- [ ] `/mobile` decision (approved 2026-11-19) and bundle delta recorded in AD-065
- [ ] `/review` of the migration before Phase 2

## Phase 2 — The loop on inquiries

- [ ] **T4: `ContactLinks` on the contact page and the inquiry card** (M)
  - Acceptance:
    - `src/components/domain/calls/contact-links.tsx`: real `<a href>` buttons, ≥ 44 px at
      390 px, `aria-label` with action and name; icon-only on cards, icon + label on the
      contact page.
    - Used in `contact-method-list.tsx` and the inquiry card's contact row; keys
      `phoneLoop.links.*` in both message files.
    - Manual: Viber and WhatsApp open the chat on an Android and an iPhone (plan OQ 2).
  - Verify: component test for the rendered hrefs; typecheck, lint, test; browser bg/en
    at 390 and 1280.
  - Files: `contact-links.tsx`, `contact-links.test.tsx`, `contact-method-list.tsx`,
    `inquiry-card.tsx`, `messages/bg.json`, `messages/en.json`.

- [ ] **T5: `CallService.log` and the `logCall` action** (M) — **Opus**
  - Acceptance:
    - `src/domain/calls/` (`types.ts`, `validation.ts` with `logCallSchema`, `service.ts`):
      picks the pending call task (tapped task, else my earliest on the deal/inquiry, never
      another member's) and completes it via `completeWithNext`; otherwise one multi-row insert
      of the completed call plus the optional next/retry.
    - Closed contexts per rule 8 (no stage change, no retry on a dismissed inquiry).
    - `today_18` preset in `reschedule.ts` with the 17:00 cutoff, not added to Today's menu.
    - `logCall` in `src/app/(dashboard)/calls/actions.ts`: `getAuthContext`, Zod,
      `ActionResult`, `toActionError`, `revalidatePath` of the context's pages and `/today`.
  - Verify: `npx vitest run src/domain/calls`; `npm run test:services` (new
    `calls/service.integration.test.ts`); action test; typecheck, lint.
  - Files: `src/domain/calls/*`, `src/domain/tasks/reschedule.ts` (+ test),
    `src/domain/tasks/repository.ts`, `src/app/(dashboard)/calls/actions.ts` (+ test).

- [ ] **T6: Post-call sheet and "Log call" on the inquiry card** (M)
  - Acceptance:
    - `post-call-sheet.tsx`: bottom sheet at 390 px, dialog at 1280; Answered / No answer /
      Not now; outcome focus; presets per rule 5; channel picker for manual logging;
      "Completes: <task>" with the switch; rule 7 warning (shown for deals, inert here).
    - "Log call" in the inquiry card menu opens it; saving a *No answer* on a `new` inquiry
      makes it `contacted` with a retry on Today.
  - Verify: component test (required outcome, presets, Not now writes nothing); typecheck,
    lint, test; browser bg/en 390 and 1280.
  - Files: `post-call-sheet.tsx` (+ test), `inquiry-card.tsx`, `inquiry-list.tsx`,
    message files.

- [ ] **T7: Call intent: prompt on return, toast on desktop** (M) — **Opus**
  - Acceptance:
    - `use-call-intent.ts` + a provider mounted once in `src/app/(dashboard)/layout.tsx`;
      `ContactLinks` registers the intent on tap (Call/Viber/WhatsApp, not mailto).
    - Opens the sheet on return after ≥ 5 s hidden within 2 h; toast with Log for 2 min if not
      hidden within 3 s; newest tap wins; cleared on save or Not now; `sessionStorage` holds
      no number; thresholds in one constants file.
    - Manual: iPhone Safari and Android Chrome show the prompt after a real call (plan OQ 2).
  - Verify: hook tests with fake timers and `visibilitychange`; typecheck, lint, test;
    browser bg/en (desktop toast path).
  - Files: `use-call-intent.ts` (+ test), `call-intent-provider.tsx`,
    `src/app/(dashboard)/layout.tsx`, `contact-links.tsx`.

### Checkpoint: Loop on inquiries
- [ ] Spec AC-1, AC-2, AC-3, AC-8 work on the inquiry card in bg and en, 390 and 1280
- [ ] typecheck, lint, test, `test:services` green
- [ ] `/review`; founder tries it on a phone

## Phase 3 — Everywhere else

- [ ] **T8: Today call tasks** (S)
  - Acceptance: `listToday` returns the task's contact primary phone, else the inquiry caller
    phone; `task-card.tsx` shows Call and Viber for `call` tasks; the prompt carries that
    task and completes it.
  - Verify: repository/service test for the phone join; typecheck, lint, test; browser bg/en.
  - Files: `src/domain/tasks/repository.ts`, `types.ts`, `task-card.tsx`, Today client.

- [ ] **T9: Opportunity and contact pages** (M)
  - Acceptance: links on the primary contact and contact participants; "Log call" in both
    page headers; contact page context per rule 2 (one active deal auto, several → picker,
    "no deal"); stage change in the prompt on active deals; closed deals per rule 8; rule 7
    warning live (AC-5).
  - Verify: service suite case for AC-5; component test for the deal picker; typecheck,
    lint, test; browser bg/en.
  - Files: `participant-list.tsx`, opportunity and contact `[id]` page headers,
    `post-call-sheet.tsx`, message files.

- [ ] **T10: Inquiry card contact time and channel on the timeline** (S)
  - Acceptance: "Contacted after 2 h 10 min" via `useFormatter`, last call and pending retry
    on the card (rule 9); timeline call entries show the channel icon and label (rule 10).
  - Verify: unit test of the duration and last-call mapping; timeline service test; browser
    bg/en.
  - Files: `inquiry-card.tsx`, `src/domain/inquiries/repository.ts`,
    `src/domain/timeline/service.ts`, timeline entry component, message files.

### Checkpoint: Everywhere
- [ ] Spec AC-4, AC-5, AC-6, AC-7 green (pgTAP + service suite), UI in bg/en 390/1280
- [ ] `/review`

## Phase 4 — Proof and close

- [ ] **T11: Seed and E2E** (M)
  - Acceptance: seed per agency (BG mobile inquiry, landline inquiry, contact with a Viber
    method and one active deal, pending call task due today for the broker); core-loop E2E
    extended per the spec's testing strategy (intercept `tel:`, hide/show, No answer → Today
    → Answered → convert → both calls on the deal timeline), bg and en, 390 and 1280 (toast).
  - Verify: `npx supabase db reset`; `npm run test:e2e`.
  - Files: `supabase/seed.sql`, `e2e/core-loop.spec.ts`, `e2e/fixtures.ts`.

- [ ] **T12: Close the module** (S)
  - Acceptance: AC-9 checked (no number in URLs, storage or logs; 44 px; no literal strings);
    BRD FR-COM-01…05 ✅; `SPEC.md` row Done and §5 updated; `smart-lists` A3 note; glossary
    lines; `tasks/*` moved to `docs/archive/phone-loop-*.md`.
  - Verify: full Definition of Done in this session.
  - Files: `docs/BRD.md`, `SPEC.md`, `docs/domain-model.md`, `docs/archive/`.

### Checkpoint: Complete
- [ ] All spec success criteria AC-1…AC-9 met
- [ ] `/ship` before any prod `db push`
