# Implementation Plan: phone-loop

> Spec: `spec/phone-loop.md` (approved 2026-11-19). Checklist: `tasks/todo.md`.
> Branch: `feat/phone-loop` from `fix/app-font` (`main` doesn't hold requirements through
> property-import yet; founder chose not to merge on 2026-11-19). Commits `feat(phone-loop): ...`.
> Model: **Opus** for T2, T3, T5, T7 (schema, triggers, the write path, the intent timing);
> Sonnet for the rest.

## Overview

Every phone and email becomes a Call · Viber · WhatsApp · Email link; tapping one and coming
back to the app opens "Did you reach <name>?", which logs a completed `call` task and the next
action or retry in one save. The first logged attempt on an inquiry stamps
`inquiries.contacted_at` (by trigger). Built on `tasks` with three new columns and four
triggers; no new table, no new RPC, `convert_inquiry` and `join_inquiry` untouched.

## What the code says (planning findings)

- **Phones:** `normalizePhone()` lives in `src/domain/contacts/phone.ts` (not `src/lib/phone`
  as the spec says) and imports `libphonenumber-js/min`. Min metadata carries no number-type
  patterns, so `getType()` returns `undefined`: **spec open question 1 is answered "no"**
  (checked 2026-11-19 with node: `+359888123456` → `undefined` with `/min`, `MOBILE` with
  `/mobile`; a BG landline → `undefined` with both, so the rule is "`MOBILE` → messengers").
  `metadata.mobile.json` is 99 KB raw vs 84 KB for `min` (same dependency, a different import).
  T1 uses it **only** in `contact-links.ts` and measures the real client-bundle delta. This is
  the spec's ask-first: see Open questions.
- **One write or two (spec OQ 4):** `TaskService.completeWithNext` is already three
  non-atomic writes (complete, create next, move stage). The call log follows it:
  - *insert path* (no pending task to complete): the completed call and the pending
    next/retry go in **one** multi-row `insert`, which PostgREST runs in one statement, so
    they are atomic;
  - *complete path*: reuses `completeWithNext` unchanged. A failure after the complete leaves
    the call logged without its retry and shows an error toast; the same as today's flow.
  - No RPC. Stage change stays the existing separate update.
- **Tenant check pattern:** `refuse_archived_property()` in
  `20261103000003_property_triggers.sql` is the model for a BEFORE trigger checking that
  `tasks.inquiry_id` is in the task's agency (FKs don't see RLS). `mark_property_viewed()` is
  the model for an AFTER trigger on `tasks` that writes another table as the caller (RLS and
  audit apply).
- **Next action:** the `tasks` trigger in `20260901000009_create_tasks.sql` recomputes
  `next_action_at` on insert and on `status`/`due_at` change. Re-pointing an inquiry's tasks
  to a deal changes `opportunity_id`, which that trigger does **not** watch today: T3 must
  either add `opportunity_id` to its `UPDATE OF` list or recompute in the new trigger. T3
  checks and picks one (pgTAP proves it).
- **Today task cards** (`task-card.tsx`) have no contact phone: `listToday` must join the
  task's contact's primary phone and the inquiry's caller phone (T8).
- **Sizes:** `inquiry-card.tsx` 255 lines, `participant-list.tsx` 277, `task-card.tsx` 181:
  links go in a separate `ContactLinks` component so none of them grows much.
- **Reschedule presets** exist (`plus_1h`, `tomorrow_9`, `plus_2d`, `next_monday_9` in
  `src/domain/tasks/reschedule.ts`). "today 18:00" is new: T5 adds `today_18` there with its
  17:00 cutoff, so Today's reschedule menu doesn't gain it by accident (it's offered only by
  the prompt).

## Architecture decisions (AD-065, written in T2)

1. A logged call is a completed `call`/`email` task with `channel`; inquiries get calls via
   `tasks.inquiry_id`.
2. `inquiries.contacted_at` is trigger-owned, set once, never backfilled.
3. Conversion and join re-point an inquiry's tasks by trigger on `inquiries`; dismiss cancels
   pending ones. The two RPCs are not edited.
4. No RPC for logging (see findings). Mobile detection by `libphonenumber-js/mobile`, scoped
   to link building (pending founder OK).
5. The pending call intent lives in `sessionStorage` with ids and a display name only.

## Dependency graph

```
T1 contact-links (pure)            T2 migration: columns + contacted_at triggers
      │                                  │
      │                            T3 migration: conversion/dismiss follow-through
      │                                  │
      ├──────────── T4 ContactLinks on contact page + inquiry card (links only)
      │                                  │
      │                            T5 CallService + logCall action (+ today_18 preset)
      │                                  │
      └──────────── T6 PostCallSheet + "Log call" on the inquiry card
                                         │
                                   T7 call intent: tap → return prompt, desktop toast
                                         │
                ┌────────────────────────┼──────────────────────┐
          T8 Today call tasks     T9 opportunity + contact pages   T10 card contacted time + timeline channel
                └────────────────────────┼──────────────────────┘
                                   T11 seed + E2E
                                         │
                                   T12 close-out
```

T8, T9, T10 are independent of each other once T7 lands (different files; T9 and T10 both
read `messages/*.json` only to add keys, so merge order matters only there).

## Phases

- **Phase 1 — Foundation (T1–T3):** pure link builders and the schema. Ends with
  `db reset` + `test:db` green and the domain model updated.
- **Phase 2 — The loop on inquiries (T4–T7):** links, the write path, the prompt and the
  return detection, all on the inquiry card first: the spec's AC-1, AC-2, AC-3, AC-8 work
  end to end on one screen.
- **Phase 3 — Everywhere else (T8–T10):** Today, opportunity and contact pages, inquiry card
  details, timeline.
- **Phase 4 — Proof and close (T11–T12):** seed, E2E, BRD, docs, browser check.

Cut order (spec): T7's toast fallback → T10's card details → stage change in T9 → T8.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `visibilitychange` doesn't fire on iOS Safari until the call ends, or at all after a `tel:` confirmation sheet | High: the core of the module | T7 tests on a real iPhone before building on it; the toast fallback already covers "never hid"; worst case the toast also shows on iOS |
| `viber://chat?number=` form differs by OS/version | Med | T4 manual check on Android and iOS; the href builder is one function, easy to swap |
| Re-pointing tasks on conversion doesn't recompute `next_action_at` | High: wrong Today/At risk | T3 pgTAP asserts the deal's `next_action_at` after convert and join |
| `/mobile` metadata grows the client bundle | Low–Med | Load it only in `contact-links.ts`, measure in T1; fallback BG prefix rule |
| Trigger writing `inquiries` hits RLS for a broker who can't update that inquiry | Med | T2 pgTAP runs the log as a seeded broker; same RLS as "Mark contacted" |
| Prompt feels naggy | Med | 5 s / 2 h thresholds in one constants file; "Not now" writes nothing (A1 measures it) |

## Open questions

1. **Resolved (founder, 2026-11-19):** import `libphonenumber-js/mobile` in
   `contact-links.ts` only; T1 records the measured bundle delta in AD-065. The BG prefix rule
   is not used.
2. **Real-phone checks (founder or whoever has the devices):** Viber link form (T4) and the iOS
   return behaviour (T7) need an Android and an iPhone with Viber and WhatsApp.
