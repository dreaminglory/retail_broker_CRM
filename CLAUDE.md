@AGENTS.md

## Claude Code

- Workflow commands come from the `agent-skills` plugin (enabled in `.claude/settings.json`).
  If a short name clashes with a built-in command, use the prefix: `/agent-skills:plan`,
  `/agent-skills:review`.
- Project skills: `feature-ideas`, `crm-domain-model`, `supabase-patterns`. General Supabase
  and Postgres questions: the `supabase` plugin skills.
