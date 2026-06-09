# Project Context

Stable context for coding tasks. Keep this file short; load detailed docs only when the task needs them.

## Product

AI-Kaeyris-Web is the separate frontend for the AI-Kaeyris ecosystem. Current priority: a usable end-to-end JDR/RPG session assistant for GM and players.

## Stack

- Next.js 16.2.6 App Router, React 19, TypeScript strict.
- Tailwind CSS 4, shadcn-style UI primitives, lucide-react icons.
- TanStack Query, Zustand for limited UI state, Zod validation.
- OpenAPI contract in `docs/context/api/openapi.json`; generated types in `types/api.ts`.
- Vitest + Testing Library for unit/integration tests.
- Playwright for E2E tests.

Before changing Next.js-specific code, read the relevant local guide in `node_modules/next/dist/docs/`.

## Main commands

- `npm run dev`: local dev server.
- `npm run lint`: ESLint.
- `npx tsc --noEmit`: TypeScript check.
- `npm test`: Vitest suite.
- `npm run build`: production build.
- `npm run e2e`: build + Playwright.
- `npm run gen:api`: regenerate `types/api.ts` from OpenAPI.
- `npm run check:api-types`: verify generated API types are in sync.

## Repo map

- `app/`: routes and layouts. Route groups include `(jdr)` and `(launcher)`.
- `components/ui/`: UI primitives; avoid direct edits unless required.
- `components/common/`: generic cross-service components.
- `components/jdr/`: JDR-specific UI.
- `lib/core/`: generic platform utilities, env, API client, auth/session.
- `lib/jdr/`: JDR domain schemas, permissions, query helpers, workflow logic.
- `providers/`: app providers.
- `types/api.ts`: generated API types.
- `tests/`: Vitest tests mirroring source paths.
- `e2e/`: Playwright scenarios and helpers.
- `docs/context/api/`: optional API/backend context capsules.
- `_bmad-output/`: BMAD planning and story artifacts; load only for specific stories.

## Architecture rules

- Frontend only. Do not modify backend code from this repo.
- Backend access is HTTP/OpenAPI only.
- `createApiClient()` in `lib/core/api/client.ts` is the HTTP entry point.
- Components must not call `fetch()` directly.
- Generic layers must not import JDR-specific modules.
- Route groups must stay isolated; shared code belongs in `components/common/` or `lib/core/`.
- Identity is read through `useCurrentUser()` and helpers in `lib/core/session/`.
- Use role helpers for `systemRole` and campaign roles; do not hardcode role logic in UI.
- Use `campaignId` for JDR scope; do not introduce `tenant_id` for V1 JDR code.
- Do not add Redux/global state managers without strong justification.
- No backend-for-frontend, no OAuth, and no V1 Hub UI unless a story explicitly changes scope.

Read `CONVENTIONS.md` before changing import boundaries, identity, theming, API boundaries, tests, or Git workflow.

## UI conventions

- JDR theme lives under `app/(jdr)/layout.tsx`; avoid global CSS that assumes every route is JDR.
- Keep chrome/dark tool surfaces separate from parchment/long-reading surfaces.
- Use existing tokens and component patterns before inventing new styling.
- Use `motion-safe:` for hover transforms and preserve reduced-motion safeguards.

## API rules

- `docs/context/api/openapi.json` is the source contract.
- Regenerate API types with `npm run gen:api` after contract changes.
- Do not paste full OpenAPI content into agent replies.
- For API decisions, load `docs/context/api/backend-summary.md` first, then the specific capsule:
  - `auth.md` for authentication and role flows.
  - `jdr-workflows.md` for session workflows.
  - `deployment.md` for runtime/deployment implications.

## Test strategy

- Unit/integration tests live in `tests/<source-mirror>/<file>.test.ts(x)`.
- Add `// @vitest-environment jsdom` only when a test needs DOM APIs.
- Shared jsdom setup is `tests/setup-jsdom.ts`.
- E2E tests live in `e2e/<feature>/<scenario>.spec.ts`.
- Playwright backend mocks use `page.route()`; do not add MSW.
- Run the smallest relevant tests after edits; use full build/E2E only when the change warrants it.

## Security and validation

- Do not read `document.cookie` or `localStorage` for auth.
- Keep secrets out of source and docs; use env files/templates only.
- Validate external/backend data at boundaries with existing schemas/helpers.
- Preserve redirect and auth guard behavior unless the task targets it.

## Do not do by default

- Do not scan the whole repo.
- Do not refactor outside scope.
- Do not rewrite generated files manually.
- Do not edit BMAD installer-managed files in `_bmad/`.
- Do not change public API contracts without documenting the impact.
- Do not create new long-form docs when a short context capsule is enough.
