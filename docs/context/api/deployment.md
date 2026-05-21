# Deployment Context - AI-Kaeyris API

Snapshot date: 2026-05-21.

## Backend Runtime

Local development:

- API: `http://localhost:8000`
- FastAPI docs: `http://localhost:8000/docs`
- OpenAPI: `http://localhost:8000/openapi.json`
- Redis required for jobs
- SQLite default DB: `./data/kaeyris.db`

Production target:

- PC fixe on private LAN
- Docker Compose stack
- Caddy reverse proxy on port `80`
- PostgreSQL 16
- Redis 7
- Prometheus + Grafana
- Watchtower pulls GHCR images

## Delivery Pattern

Backend deployment is pull-based:

```text
git push main
  -> GitHub Actions builds image
  -> GHCR publishes ghcr.io/anama213/ai-kaeyris:latest
  -> Watchtower on LAN host pulls and redeploys
```

This means the frontend should not assume a cloud-public API URL. The first production frontend target is likely a LAN URL configured by the user/operator.

## Environment Values Relevant To Frontend

Do not copy backend `.env` into this repo.

Useful frontend configuration:

- `API_BASE_URL`, for example `http://localhost:8000` or `http://<lan-host>`
- Bearer API key entered by the operator
- Optional request timeout values for long-running polling UX

Backend variables that matter conceptually but should stay backend-only:

- `API_KEYS`
- `DATABASE_URL`
- `REDIS_URL`
- `LLM_API_KEY`
- `TRANSCRIPTION_API_KEY`
- `POSTGRES_PASSWORD`
- `GRAFANA_ADMIN_PASSWORD`
- `CADDY_METRICS_HASH`

## Operations UX Implications

Audio upload and artifact generation are asynchronous.

Frontend should:

- Show accepted uploads as "job queued" rather than "done".
- Poll `GET /services/jdr/jobs/{job_id}` until `succeeded` or `failed`.
- Keep job errors visible with retry guidance.
- Avoid assuming WebSockets or server-sent events exist.
- Treat `/readyz` as an operator diagnostic, not as normal user flow.

## Observability

The backend exposes Prometheus metrics at `/metrics`, but production Caddy protects it with basic auth. The frontend should not call `/metrics`.

