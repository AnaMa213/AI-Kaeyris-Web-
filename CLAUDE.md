# Claude Code Instructions

Apply `AGENTS.md` first. This file only adds Claude Code usage rules.

## Claude-specific workflow

- Reply in French unless the user asks otherwise.
- Keep the active context small; do not preload large docs.
- Before broad exploration, name the files or folders you want to inspect and why.
- For long sessions, propose `/compact` with the continuation summary from `AGENTS.md`.
- Load BMAD skills from `.claude/skills/` only when the user asks for BMAD work or the task clearly needs it.
- Do not read `.claude/worktrees/` unless the user explicitly targets a worktree.

## Useful entry points

- Start with `project-context.md` for stable project context.
- Use `CONVENTIONS.md` as the detailed rulebook only when touching boundaries, identity, theming, API, tests, or Git workflow.
- Use `docs/context/api/backend-summary.md` and `docs/context/api/openapi.json` only for API-facing tasks.
- Use `_bmad-output/implementation-artifacts/` only when implementing or reviewing a specific story.

## Claude response discipline

- Prefer short plans, compact diffs, and targeted test reports.
- Do not restate long context from files already referenced.
- Do not paste full generated files or OpenAPI content.
- End important tasks with: decisions, files changed, tests, risks, next step.
