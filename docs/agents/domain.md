# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This repo is **single-context**. Its domain docs use custom paths, not the `GLOSSARY.md` and
`docs/adr/` defaults:

| Role | Path |
|---|---|
| Glossary | `docs/domain-model.md`, section **7. Glossary EN / BG** |
| Domain model (entities, lifecycles, invariants, known gaps) | `docs/domain-model.md`, sections 1–6 |
| ADRs | `docs/decisions-log.md`: one file, one `### AD-0NN: Title` entry per decision |
| Lessons and gotchas | `docs/learnings.md` (L-, P-, G- entries) |

**Never create `GLOSSARY.md`, `CONTEXT.md` or a `docs/adr/` directory in this repo.** New terms
go into the glossary table in `docs/domain-model.md` §7 (with one canonical Bulgarian term).
New decisions are appended to `docs/decisions-log.md` as the next `AD-0NN` entry, using the
existing entry format (Date, Status, Context, Decision, Rationale, Consequences).

## Before exploring, read these

- **`docs/domain-model.md` §7** for vocabulary, and the sections of §1–6 that cover the area
  you are about to touch (the `crm-domain-model` project skill maps tasks to sections).
- **`docs/decisions-log.md`**: read the `AD-0NN` headings, then the full entries that touch the
  area you're about to work in.

## File structure

```
/
├── docs/
│   ├── domain-model.md      ← glossary (§7) + entities, lifecycles, invariants
│   ├── decisions-log.md     ← ADRs as AD-001, AD-002, … entries
│   └── learnings.md
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis,
a test name), use the term as defined in `docs/domain-model.md` §7. Don't drift to synonyms the
glossary explicitly avoids. In Bulgarian UI text, use the canonical BG term, not a listed variant.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing
language the project doesn't use (reconsider) or there's a real gap (note it for
`/domain-modeling`, which adds it to §7).

## Flag ADR conflicts

If your output contradicts an existing decision, surface it explicitly rather than silently
overriding:

> _Contradicts AD-014 (soft task completion enforcement), but worth reopening because…_
