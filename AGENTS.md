<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This project uses Next.js 16.2.6. APIs, conventions, and file structure may differ from older knowledge. Before changing Next.js code, read the relevant guide in `node_modules/next/dist/docs/` and heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AI Agent Rules

Use these rules for Claude Code, Codex, and any coding assistant.

## Default workflow

1. Restate the goal in one short sentence.
2. Classify the task: `XS`, `S`, `M`, `L`, or `XL`.
3. Identify the relevant files before reading deeply.
4. Explain briefly why each file is needed.
5. Propose a minimal plan for `M` or larger tasks.
6. Apply targeted changes only.
7. Run or propose targeted tests.
8. End important tasks with the continuation summary below.

## Task sizes

- `XS`: 1-2 local files, no architecture concern, no global scan.
- `S`: 2-5 files, simple bug or small evolution, targeted tests if available.
- `M`: multi-file feature or fix, short plan required, split if useful.
- `L`: broad change, split into stories or micro-tasks before coding.
- `XL`: redesign, architecture shift, or epic; use BMAD framing before implementation.

## Context discipline

- Work on one task at a time.
- Do not scan the whole repo by default.
- Start with `rg --files`, `rg`, or exact paths from the user.
- Read only the files required for the task.
- If more than 5 files are needed, ask for or propose a reading budget.
- Treat `_bmad-output/`, `.claude/skills/`, and large docs as optional references, not default context.
- Do not paste large files, generated files, or `docs/context/api/openapi.json` into replies.
- Prefer file references and compact summaries over long explanations.

## Project boundaries

- This repo is the frontend only. Never modify the backend from here.
- The backend is consumed only through HTTP/OpenAPI.
- `docs/context/api/openapi.json` is the API contract source; regenerate `types/api.ts` with `npm run gen:api` when the contract changes.
- Read `docs/context/api/backend-summary.md` only for API decisions.
- Read `CONVENTIONS.md` only when touching architecture, imports, identity, theming, API boundaries, tests, or Git workflow rules.
- Preserve existing architecture unless the task explicitly justifies a change.
- Do not refactor outside the task scope.
- Do not add dependencies without a clear justification.
- Do not change public contracts without naming the impact.

## Quality rules

- Favor short, focused, testable patches.
- Use the existing patterns, folders, helpers, and naming before adding abstractions.
- Do not edit `components/ui/*` primitives directly unless the task requires it.
- Do not use direct `fetch()` from components; use the API/client/query layers.
- Keep tests close to the changed behavior:
  - Unit/integration: `npm test -- <pattern>` or `vitest run <pattern>`.
  - E2E: `npm run e2e` only for relevant multi-page flows or before release.
- If tests cannot be run, say why and give the exact targeted command.

## Response rules

- Reply in French unless the user asks otherwise.
- Be concise by default.
- State assumptions clearly.
- Avoid repeating project context already present in files.
- Avoid general teaching unless requested.

## Continuation summary

Use this format for significant work:

- Goal completed:
- Files changed:
- Key decisions:
- Tests run:
- Remaining work:
- Risks / warnings:
- Next recommended task:
