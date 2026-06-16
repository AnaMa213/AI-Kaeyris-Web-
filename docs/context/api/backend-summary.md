# Backend Context - AI-Kaeyris API

Snapshot date: 2026-05-27.

This folder is a compact API context for frontend planning and implementation. It is intentionally not a copy of the backend repository.

## Source Backend

- Repository: `../AI-Kaeyris`
- Runtime: FastAPI modular monolith
- API contract: `docs/context/api/openapi.json`
- Primary frontend target: JDR/RPG session assistant
- Error format: RFC 9457 Problem Details (`application/problem+json`)
- Auth: web session cookie (`session`, HTTP-only) for the frontend; Bearer API key remains supported for machine/API-key clients
- Async jobs: Redis + RQ, polled through `GET /services/jdr/jobs/{job_id}`
- Persistence: SQLite in local dev, PostgreSQL in production

## Frontend Boundary

The frontend consumes the backend over HTTP only.

Do:

- Treat `openapi.json` as the source of truth for routes, schemas, and status codes.
- Keep backend and frontend as separate deployable projects.
- Use frontend state only where it supports the JDR workflow.
- Prefer simple API-client code generated or typed from OpenAPI.

Do not:

- Modify backend code from this repo.
- Add a backend-for-frontend unless a concrete limitation appears later.
- Add OAuth/OIDC or store session tokens in frontend state for the current scope.
- Read or copy backend `.env` secrets.
- Import Python backend modules into the frontend.

## Important Endpoints

Health and readiness:

- `GET /healthz`
- `GET /readyz`
- `GET /openapi.json`

Web auth and user management:

- `GET /services/jdr/auth/setup/status`
- `POST /services/jdr/auth/setup`
- `POST /services/jdr/auth/login`
- `POST /services/jdr/auth/logout`
- `POST /services/jdr/users`
- `GET /services/jdr/users`
- `PATCH /services/jdr/users/{user_id}`
- `DELETE /services/jdr/users/{user_id}`
- `GET /services/jdr/settings/models`
- `PATCH /services/jdr/settings/models`

JDR GM workflow:

- `POST /services/jdr/sessions`
- `GET /services/jdr/sessions`
- `GET /services/jdr/sessions/{session_id}`
- `PATCH /services/jdr/sessions/{session_id}`
- `POST /services/jdr/sessions/{session_id}/audio`
- `DELETE /services/jdr/sessions/{session_id}/audio`
- `GET /services/jdr/jobs/{job_id}`

JDR diarised mode:

- `POST /services/jdr/pjs`
- `GET /services/jdr/pjs`
- `PUT /services/jdr/sessions/{session_id}/mapping`
- `GET /services/jdr/sessions/{session_id}/mapping`
- `GET /services/jdr/sessions/{session_id}/transcription`
- `GET /services/jdr/sessions/{session_id}/transcription.md`

JDR non-diarised mode:

- `GET /services/jdr/sessions/{session_id}/chunks`
- `POST /services/jdr/sessions/{session_id}/players`
- `GET /services/jdr/sessions/{session_id}/players`
- `POST /services/jdr/sessions/{session_id}/artifacts/summary`
- `GET /services/jdr/sessions/{session_id}/artifacts/summary`
- `GET /services/jdr/sessions/{session_id}/artifacts/summary.md`

Shared artifacts:

- `POST /services/jdr/sessions/{session_id}/artifacts/narrative`
- `GET /services/jdr/sessions/{session_id}/artifacts/narrative`
- `GET /services/jdr/sessions/{session_id}/artifacts/narrative.md`
- `POST /services/jdr/sessions/{session_id}/artifacts/elements`
- `GET /services/jdr/sessions/{session_id}/artifacts/elements`
- `GET /services/jdr/sessions/{session_id}/artifacts/elements.md`
- `POST /services/jdr/sessions/{session_id}/artifacts/povs`
- `GET /services/jdr/sessions/{session_id}/artifacts/povs/{pj_id}`
- `GET /services/jdr/sessions/{session_id}/artifacts/povs/{pj_id}.md`

Player access:

- `POST /services/jdr/players`
- `DELETE /services/jdr/players/{player_id}`
- `GET /services/jdr/me`
- `GET /services/jdr/me/sessions`
- `GET /services/jdr/me/sessions/{session_id}/narrative`
- `GET /services/jdr/me/sessions/{session_id}/narrative.md`
- `GET /services/jdr/me/sessions/{session_id}/pov`
- `GET /services/jdr/me/sessions/{session_id}/pov.md`

Live mode:

- `POST /services/jdr/live/sessions` is published but returns `501`.
- `WS /services/jdr/live/stream` is a stub and should not be built as a frontend feature yet.

## Frontend Goal

Replace curl/Postman with a usable UI for the JDR workflow:

1. Configure API base URL.
2. On first run, call setup status and create the first GM when required.
3. Login with `username`, `profile`, and `password`; rely on the HTTP-only `session` cookie with `credentials: "include"`.
4. Provide GM user management: create, list, update, and logically delete users.
5. Create/list/update sessions.
6. Upload M4A audio.
7. Poll transcription and artifact jobs.
8. Support both `diarised` and `non_diarised` workflows.
9. Display/export generated Markdown artifacts.
10. Provide a read-only player view later, after the GM workflow is solid.

## Web Auth Contract

Fresh install:

1. `GET /services/jdr/auth/setup/status`
2. If response is `{ "required": true }`, show a first-GM setup screen.
3. `POST /services/jdr/auth/setup` with:

```json
{
  "username": "admin",
  "password": "chosen-password"
}
```

Successful setup returns `201`, creates the first `gm` user, and sets `Set-Cookie: session=...; HttpOnly; Path=/; SameSite=Lax`.

Login:

```json
{
  "username": "admin",
  "profile": "gm",
  "password": "chosen-password"
}
```

Successful login returns `200` and sets the same HTTP-only cookie. The frontend must not read or store the session token; it must send requests with `credentials: "include"`.

Invalid credentials:

```json
{
  "type": "about:blank",
  "title": "Invalid credentials",
  "status": 401
}
```

Unsupported profile:

```json
{
  "type": "about:blank",
  "title": "Forbidden",
  "status": 403
}
```

