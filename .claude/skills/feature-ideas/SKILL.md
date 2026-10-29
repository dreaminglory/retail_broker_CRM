---
name: feature-ideas
description: Find what BrokerCRM is missing, score it, and put the result in the SPEC.md backlog or capability map. Use when asked what to build next, for feature ideas, to re-order modules, or when a new idea comes up that isn't on the map.
---

# Feature ideas

Output goes into `SPEC.md`: scored candidates in **Ideas backlog**, accepted ones as a row in
the **Capability map**. Then the founder runs `/spec <module-id>`. Don't write specs or code here.

## 1. Collect candidates (verify each against the code, not the docs)

1. `SPEC.md` *Pilot evidence* and *Known gaps*.
2. `docs/BRD.md` rows marked ⚠️ or ❌.
3. `docs/research/business-description.md`: *Pilot MVP → Included* and *Pilot Acceptance Criteria* not yet built.
4. Walk the core loop (SPEC.md §1) as a broker on a phone, a manager, an owner. Ask: what if a
   broker doesn't open the app for 2 days? leaves the agency? has 2,000 contacts? is one-handed?
5. Competitors, only to strengthen a weak loop step: `docs/research/crm-benchmark.md`,
   `docs/research/crm-competitive-gap-analysis.md`.

Drop anything that's a non-goal (SPEC.md §1), multi-country, or conflicts with an AD (unless
you propose the AD that supersedes it).

## 2. Score

Evidence: **E3** seen in the pilot, **E2** in the brief or BRD, **E1** inferred from the loop
walk, **E0** a competitor has it. Score 0–3 each on loop impact, pilot gate, broker value and
evidence; `priority = sum ÷ effort in days`. Security and data loss go first; E0-only items cap at 6.

## 3. Shape the best ones

For the top 3, run `agent-skills:idea-refine` briefly: the job it does, the simplest version,
the pattern worth borrowing (pattern, never text or branding), what's out. Note any rule that
has no evidence as `[ASSUMPTION — validate in pilot: <how>]`. Present them to the founder and
write what they accept into `SPEC.md`.
