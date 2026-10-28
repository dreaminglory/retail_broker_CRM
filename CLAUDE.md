@AGENTS.md
@.claude/rules/coding-conventions.md

## Claude Code specifics

- Project skills are in `.claude/skills/`: `crm-domain-model`, `sprint-planning`,
  `supabase-patterns`.
- For general Supabase and Postgres questions, use the `supabase` and
  `supabase-postgres-best-practices` plugin skills. Use `supabase-patterns` for this repo's rules.

## Development workflow (SuperMatt)

- **Deciding what to build** is the `sprint-planning` skill's job. SuperMatt's flow starts
  from a sprint slice or issue: `implement` → `tdd` → `qa` → `supermatt:code-review` → PR.
- **Shipping:** use `babysit-pr`, which stops before merging so a human merges. Don't use
  `ship-pr`, which squash-merges on green CI; test coverage is still too thin for that.
- **Code review** means `supermatt:code-review` (it reviews against `AGENTS.md` and
  `.claude/rules/`). The built-in `/code-review` is only used when explicitly asked for.
- Not used in this repo: `orchestrate`, `jury`, `wayfinder`, `teach`, `to-questionnaire`, `ideate`.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues for `dreaminglory/retail_broker_CRM`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The seven default labels: `bug`, `enhancement`, `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context, using custom paths: the glossary is §7 of `docs/domain-model.md`, and ADRs are `AD-0NN` entries in `docs/decisions-log.md`. See `docs/agents/domain.md`.

### External peers

`host-only`: reviews and juries run in this session only, with no external Codex or Claude CLI. See `docs/agents/cross-model.json`.
