# Auth Context - AI-Kaeyris API

Snapshot date: 2026-05-21.

## Contract

All non-public API routes require:

```http
Authorization: Bearer <api_key>
```

Public routes:

- `GET /health`
- `GET /healthz`
- `GET /readyz`
- `GET /docs`
- `GET /redoc`
- `GET /openapi.json`

The frontend should store only the plaintext token entered by the user. The backend stores API keys hashed with Argon2id.

## Roles

The JDR service has two roles:

- `gm`: game master/operator. Can create sessions, upload audio, manage PJs, generate artifacts, enroll players.
- `player`: read-only access bound to one PJ. Can read only the sessions and artifacts allowed for that PJ.

There is no OAuth, no email/password account system, and no refresh-token flow in the current backend.

## GM Bootstrap

A GM token is generated in the backend repository with:

```powershell
python scripts/generate_api_key.py owner
```

The generated hash is placed in backend `.env` as `API_KEYS=...` for bootstrap. The plaintext token is shown once and must be kept by the operator.

Frontend implication:

- Provide a token input in local app settings.
- Send the token on every authenticated request.
- Do not try to create the initial GM token from the frontend.

## Player Enrollment

GM creates a player token through:

```http
POST /services/jdr/players
```

Request:

```json
{
  "name": "joueur-aragorn",
  "pj_id": "uuid"
}
```

Response includes a plaintext `token` once. The UI should make that moment explicit because it cannot be fetched again.

Player tokens can be revoked with:

```http
DELETE /services/jdr/players/{player_id}
```

## Error Handling

Expected auth-related responses:

- `401`: missing or invalid Bearer token.
- `403`: valid token but insufficient role or forbidden player scope.
- `429`: rate limit exceeded.

Errors follow Problem Details. A UI should prefer `title` and `detail` when available.

Example shape:

```json
{
  "type": "https://kaeyris.local/errors/forbidden",
  "title": "Forbidden",
  "status": 403,
  "detail": "Role is not allowed for this route."
}
```

