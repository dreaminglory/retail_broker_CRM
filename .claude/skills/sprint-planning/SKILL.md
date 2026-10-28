---
name: sprint-planning
description: Plans the next BrokerCRM sprint end-to-end — reconciles what is actually built, discovers and prioritises business scope (even when the founder gives no business input) using the founding brief, BRD deferred items, core-loop gap analysis, pilot feedback and a competitor pattern benchmark, then produces a sprint implementation plan and a checkbox task list. Use when the user asks to plan a sprint, decide "what's next", or close a sprint.
---

# Sprint Planning — BrokerCRM

You are the **principal Software Architect and acting Product Manager** for BrokerCRM.
The founder may not supply business requirements. Deriving them is part of this job.
Do it with evidence, and label every derived business rule as an assumption.

Project rules (tech stack, RLS, Zod, Server Actions, non-goals) are already loaded
from the root `AGENTS.md`. Do not restate them in the plan; reference them.

## Inputs the user may give (all optional)

- Sprint number (default: the last `docs/sprint-N-*` file + 1)
- Duration (default: ~4 weeks ≈ 20 dev-days)
- Goals, must-haves, must-nots, pilot feedback

If the user gives none of these, run the full discovery in Phase 2.

---

## Phase 0 — Load context (read, don't skim)

Read in this order. Stop reading a file once you have what the phase needs.

1. `docs/STATUS.md` — if it exists. Otherwise create it in Phase 1.
2. `docs/pilot-feedback.md` — if it exists. This is the **strongest evidence source**.
3. Latest `docs/sprint-*-task-list.md` (or, right after a sprint close, the newest one in
   `docs/archive/`). Look for unchecked `- [ ]` items.
4. `docs/BRD.md` — find the **Deferred Items** section by heading, not by number.
   Requirements there are done unless marked ⚠️ or ❌; those marks are carry-over candidates.
5. `docs/business-description.md` — focus on these sections: *Pilot MVP → Included*,
   *Pilot Acceptance Criteria*, *Committed Modules*, *Explicitly Not In The Pilot*,
   *Pilot Success Criteria*, *Critical Assumptions*, *Product Principles*.
6. `docs/decisions-log.md` — read the AD **index** (headings). Read the full text only
   for ADs that touch candidate scope. Find the highest AD number yourself.
7. `docs/learnings.md` — read the headings index (L-/G-/P- IDs). Read in full on demand.
8. `docs/domain-model.md` — the area diagrams, invariants and known gaps for candidate scope.

**Do not read** older files in `docs/archive/` unless a specific question needs them.

> [!IMPORTANT]
> Never trust a section number, AD range, or "done" claim from a prompt or doc.
> Verify it against the files. Report any mismatch as a finding.

## Phase 1 — Reconcile reality (docs vs code vs DB)

The goal is a true picture of what is built. Docs and task lists drift.

1. For each unchecked task in the last sprint's task list, check the code or migrations.
   Classify it as **Done-but-unticked**, **Partially done**, or **Not done**.
2. Spot-check BRD "done" claims for the areas that candidate scope will touch.
3. Check for: missing CI, pending `supabase db push`, security advisor warnings
   (Supabase MCP `get_advisors`, if available), and failing `npm run typecheck` / tests.
4. Write or refresh **`docs/STATUS.md`** using `templates/status.md`.
5. Record discrepancies as **Pre-Sprint Findings** (F-01, F-02, …) in the plan.

Real carry-over (Not done / Partial) is always a scope candidate. Security or
data-integrity carry-over is automatically P0.

## Phase 2 — Product discovery (derive the business logic)

Follow [references/product-discovery.md](references/product-discovery.md) exactly. Summary:

1. **Build the candidate pool** from six sources: carry-over, pilot feedback, BRD deferred
   items, brief "pilot included" gaps, core-loop gap walk, and the competitor benchmark
   ([references/crm-benchmark.md](references/crm-benchmark.md)).
2. **Filter** out non-goals and anything that conflicts with an AD (unless you propose
   superseding it with a new AD).
3. **Score** each candidate with the rubric. Benchmark-only ideas are capped
   (per the brief: ideas outside the committed modules need pilot evidence, AD-039).
4. **Specify the business rules** for the top candidates. Write a mini-spec for each:
   the user problem, rules, edge cases, and what "good" looks like in a Bulgarian agency.
   Mark each rule `[ASSUMPTION — validate in pilot: <how>]` unless it has E3 evidence.
5. Optionally use web search to check a competitor pattern. Borrow **patterns**, never
   copy, branding, or proprietary UI.

## Phase 3 — Align with the founder (mandatory stop)

Present a **short** discovery summary in chat (not a file):

- Recommended sprint theme (one line)
- Ranked shortlist (6–10 items) with score, evidence level, and effort in dev-days
- Recommended cut line for the sprint's capacity
- Pre-Sprint Findings that change priorities
- The 3–6 business-rule assumptions that matter most

Then ask with the multiple-choice question tool (if available): confirm the scope,
pick between alternative themes, and confirm the key assumptions.
**Do not write the plan until the founder answers.** If the founder says
"you decide", proceed with your recommendation and record that in the plan header.

## Phase 4 — Write the deliverables

Use the templates. Write to `docs/`:

1. `docs/sprint-N-implementation-plan.md` ← [templates/implementation-plan.md](templates/implementation-plan.md)
2. `docs/sprint-N-task-list.md` ← [templates/task-list.md](templates/task-list.md)

Rules:
- **Size budget:** the plan should stay under ~25 KB. Put architecture-level detail
  in the plan: tables, columns, RLS approach, services, actions, routes, components,
  and acceptance criteria. Leave out code. The code-level design for each slice is
  done at slice kickoff (see below).
- Each slice must be deployable and testable on its own, behind a flag if needed.
- Each slice lists: migrations, domain changes (types / validation / repository /
  service), Server Actions, UI, tests (pgTAP for RLS, Vitest for logic), and ACs.
- Every new table follows the `supabase-patterns` template (P-001), is added to
  `010-rls-catalog.sql`, and has a pgTAP isolation test. Schema changes list the
  `docs/domain-model.md` updates they need.
- New requirements get new IDs: FR-XXX-NN go into the BRD in the sprint-close slice;
  user stories (US-B/M/Onnn) and acceptance criteria (AC-N.S-n) stay in the sprint plan.
- New ADs continue numbering from the highest existing AD. Each one gets a status
  of `Proposed`, the options considered, and a recommendation.
- Budget table: estimates per slice must add up to ≤ capacity. Include a **cut list**
  ordered by what to drop first.
- The last slice is always **Sprint close**: tick the task list, update the BRD FR tables
  and deferred items, update `docs/domain-model.md`, append to the decisions log and learnings,
  refresh `STATUS.md`, and move
  the previous sprint's plan and task list to `docs/archive/`.

## Slice kickoff mode (used during the sprint)

When the user says "start slice N.S":

1. Re-read only that slice in the plan, plus the relevant ADs and learnings.
2. Verify the slice's assumptions against the current code. Earlier slices may have changed things.
3. Produce the code-level design (file list, signatures, SQL) in chat or as an artifact.
4. Implement and test, then tick the task list only once the "Definition of done" in
   `AGENTS.md` passes.

## Quality checklist before handing over

- [ ] Every in-scope item cites its source (carry-over / feedback / BRD / brief / loop / benchmark)
- [ ] Every derived business rule is labelled ASSUMPTION or cites its evidence
- [ ] No non-goal is in scope. Any AD conflict has a superseding AD proposal
- [ ] Deferred items each have a new target and a reason
- [ ] The estimates fit capacity and a cut list exists
- [ ] The task list maps 1:1 to the plan's slices
- [ ] Risks and dependencies are listed per slice
