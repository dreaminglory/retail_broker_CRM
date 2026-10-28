# Product Discovery — Deriving Business Logic Without a Product Owner

BrokerCRM has no full-time product owner. The founding brief, the pilot, and the
competitive landscape stand in for one. This method turns them into ranked,
specified scope that can be defended.

## 1. Evidence levels

Every candidate and every business rule gets an evidence level.

| Level | Meaning | Example |
|---|---|---|
| **E3** | Observed in the pilot: feedback, usage data, support requests | "Two brokers asked for overdue reminders by email" in `pilot-feedback.md` |
| **E2** | Explicit in the founding brief or the BRD (pilot-included, PAC, deferred item) | Smart Lists are listed as a "core pilot feature" |
| **E1** | Inferred from the core-loop gap walk or a product principle | "Today screen has no way to see work missed yesterday" |
| **E0** | Benchmark only: a competitor has it | "Pipedrive highlights rotting deals" |

The founding brief says V1 features "should be prioritized from observed pilot
behavior, not merely because established CRMs contain them". So:
**E0 items can never outrank E2/E3 items of similar value.** E0 items are mainly
used to shape *how* we build an E1–E3 need.

## 2. Candidate sources (build the pool from all six)

1. **Carry-over:** unfinished tasks from the last sprint, verified against code (Phase 1).
2. **Pilot feedback:** `docs/pilot-feedback.md`, if present.
3. **BRD Deferred Items:** the section in `docs/BRD.md`, found by heading.
4. **Brief gaps:** items in *Pilot MVP → Included* and *Pilot Acceptance Criteria*
   that the BRD does not yet mark ✅. These are pilot gates.
5. **Core-loop gap walk:** see §3.
6. **Benchmark:** patterns from `crm-benchmark.md` that strengthen a weak loop step.

## 3. Core-loop gap walk

Walk the 9-step loop from AGENTS.md as each persona: broker on a phone,
manager on a desktop, owner looking at the week. Score each step:

| Step | Works? (0–3) | Friction / failure mode | Fix candidate |
|---|---|---|---|
| 1 Inquiry arrives | | e.g. only manual entry; portal emails retyped | email-to-inquiry, web form |
| 2 Contact matched/created | | | |
| 3 Opportunity created | | | |
| 4 Broker assigned | | e.g. manager assigns by hand, no routing | round-robin rule |
| 5 Next action scheduled | | | |
| 6 Broker sees it on Today | | e.g. broker must open the app to know | email digest / reminder |
| 7 Outcome recorded | | e.g. too many clicks on mobile | quick-outcome sheet |
| 8 New next action / stage change | | | |
| 9 Manager sees exceptions | | | |

Also ask these failure questions:
- **Forgetting:** what happens if a broker doesn't open the app for 2 days?
- **Leaving:** what happens to a broker's work when they are deactivated?
- **Volume:** does each screen still work with 2,000 contacts and 300 open opportunities?
- **Mobile:** can steps 6–8 be done one-handed in under 30 seconds?
- **North star:** which step most limits *"% of active opportunities with a scheduled
  next action inside the follow-up window"*?

Use the dev server (localhost:3000) or the browser subagent to click through the
real flow when you're unsure.

## 4. Scoring rubric

Score each candidate 0–3 on each value dimension:

| Dimension | 3 = | 0 = |
|---|---|---|
| **Loop / north-star impact** | Fixes the weakest loop step | Doesn't touch the loop |
| **Pilot gate** | Blocks a PAC / pilot-included item, or is security/data-integrity carry-over | Nice to have post-pilot |
| **Broker adoption** | Gives the broker immediate personal value (principle #1) | Benefits only reporting |
| **Evidence** | E3 | E0 |

`Value = sum (0–12)`. `Effort` is in dev-days. `Priority = Value ÷ max(Effort, 1)`, then
apply these overrides:
- Security / data-loss carry-over → P0 regardless of score
- Hard dependency of a higher-ranked item → move it up
- E0-only → cap Value at 6

**Hard filters (drop before scoring):** AGENTS.md non-goals, the brief's
*Explicitly Not In The Pilot* list, and anything that needs multi-country expansion.

## 5. Mini-spec template (for each top candidate)

```markdown
### Candidate: <name>  (Source: <src> · Evidence: E? · Effort: ? d · Score: ?)
**Problem:** <who is hurt, in which loop step, how often>
**Outcome:** <observable change; which pilot metric moves>
**Business rules:**
1. <rule> [ASSUMPTION — validate in pilot: <how>]
2. <rule> (Evidence: <doc §> )
**Edge cases:** <deactivated owner, merged contact, timezone, empty agency, import rows…>
**Bulgarian context:** <terminology, portals (e.g. imot.bg), habits, legal (GDPR)>
**Borrowed pattern:** <competitor + pattern, adapted how>
**Out of scope:** <explicit exclusions>
```

## 6. Making assumptions testable

For each ASSUMPTION, propose a cheap validation to run during the pilot:
a usage counter, a one-question prompt in the weekly owner meeting, or an
audit-log query. Put these in the plan's "Pilot validation hooks" section so that the
next sprint's discovery has E3 evidence to use.
