# Backend Context - AI-Kaeyris API

Snapshot date: 2026-05-21.

This folder is a compact API context for frontend planning and implementation. It is intentionally not a copy of the backend repository.

## Source Backend

- Repository: `../AI-Kaeyris`
- Runtime: FastAPI modular monolith
- API contract: `docs/context/api/openapi.json`
- Primary frontend target: JDR/RPG session assistant
- Error format: RFC 9457 Problem Details (`application/problem+json`)
- Auth: Bearer API key in the `Authorization` header
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
- Add OAuth or user/password auth for the current scope.
- Read or copy backend `.env` secrets.
- Import Python backend modules into the frontend.

## Important Endpoints

Health and readiness:

- `GET /healthz`
- `GET /readyz`
- `GET /openapi.json`

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

1. Configure API base URL and Bearer token.
2. Create/list/update sessions.
3. Upload M4A audio.
4. Poll transcription and artifact jobs.
5. Support both `diarised` and `non_diarised` workflows.
6. Display/export generated Markdown artifacts.
7. Provide a read-only player view later, after the GM workflow is solid.

