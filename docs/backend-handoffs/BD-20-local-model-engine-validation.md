# Backend Handoff - BD-20: Local model engine and validation

- **Source repo:** `AI-Kaeyris-Web` (frontend)
- **Target repo:** `AnaMa213/AI-Kaeyris` (backend, FastAPI + SQLAlchemy + RQ)
- **Emitter:** Codex, from Story 6.6
- **Date:** 2026-06-16
- **Status:** Requested / blocking frontend implementation
- **Priority:** High - `local` can currently be selected and persisted, but it cannot be safely saved or executed as an in-process model.

---

## TL;DR

Story 6.6 requires a real backend validation probe before the frontend can gate saves for Local model paths.

The current frontend contract exposes only:

- `GET /services/jdr/settings/models`
- `PATCH /services/jdr/settings/models`

There is no endpoint that proves a local model path is loadable, task-compatible, and safe enough to save. The frontend must not fake this with local state only; the backend must issue a validation proof and enforce it on PATCH.

---

## Required API contract

### 1. Local validation endpoint

Recommended route:

```http
POST /services/jdr/settings/models/local/validation
Content-Type: application/json
```

Request body:

```json
{
  "category": "transcription",
  "model_path": "/models/whisper-large-v3"
}
```

Schema requirements:

- `category`: enum `"transcription" | "summary"`
- `model_path`: string, max length aligned with existing `*_local_path` fields (`1024`)

Success response:

```json
{
  "validation_id": "opaque-server-proof",
  "category": "transcription",
  "model_path": "/models/whisper-large-v3",
  "status": "succeeded",
  "runtime": "faster-whisper",
  "model_format": "ctranslate2-whisper",
  "message": "Model loaded and accepted for transcription.",
  "expires_at": "2026-06-16T12:00:00Z"
}
```

Schema requirements:

- `validation_id`: opaque server-issued proof
- `category`: same category as request
- `model_path`: returned path or normalized path
- `status`: `"succeeded"` for 2xx responses
- `runtime`: selected runtime (`"faster-whisper"`, `"llama-cpp-python"`, or backend-chosen equivalent)
- `model_format`: detected or inferred model format
- `message`: short user-facing French-safe text or neutral English text the frontend can display
- `expires_at`: timestamp, because model files can move/change after validation

### 2. PATCH save enforcement

Extend `ModelSettingsPatch` with proof fields:

```json
{
  "transcription_provider": "local",
  "transcription_local_path": "/models/whisper-large-v3",
  "transcription_local_validation_id": "opaque-server-proof"
}
```

Recommended fields:

- `transcription_local_validation_id?: string | null`
- `summary_local_validation_id?: string | null`

The backend must reject any changed Local path unless the matching proof is supplied and valid.

The validation proof must be bound to:

- current authenticated user
- category (`transcription` or `summary`)
- exact normalized path or a path hash
- success status
- expiry window

Direct API callers must not be able to bypass validation by PATCHing a Local path without a proof.

### 3. Error contract

Use RFC 9457 Problem Details for validation failures.

Recommended problem `type` values:

- `local-model-path-not-found`
- `local-model-timeout`
- `local-model-out-of-memory`
- `local-model-incompatible-task`
- `local-model-unsupported-format`
- `local-model-validation-expired`
- `local-model-validation-required`

The frontend displays `title` / `detail` inline. Do not include secrets, absolute internal stack traces, or raw runtime logs in the response body.

---

## Required runtime behavior

### Transcription Local

The local transcription provider must load and run an embedded ASR/Whisper runtime in-process when the saved `transcription_provider` is `"local"`.

Runtime candidate:

- `faster-whisper` over CTranslate2 models.

Expected validation probe:

- Check path exists and is readable.
- Attempt bounded runtime/model initialization.
- Verify the model is compatible with ASR/Whisper transcription, not a causal LLM.
- Do not transcribe a real session during validation.

### LLM Resume Local

The local summary provider must load and run an embedded text-generation runtime in-process when `summary_provider` is `"local"`.

Runtime candidate:

- `llama.cpp` / `llama-cpp-python` for GGUF local models.

Expected validation probe:

- Check path exists and is readable.
- Attempt bounded runtime/model initialization.
- Verify causal/text-generation compatibility, not ASR/Whisper.
- Run at most a tiny prompt or metadata-level probe.

### Job wiring

Once a Local model is saved and validated, generation jobs must use it per invocation:

- transcription jobs use the validated local transcription runtime/path
- summary, narrative, elements, and POV jobs use the validated local LLM runtime/path when the owning GM's summary provider is Local
- unresolved owner or missing settings retain the Story 6.5 env fallback behavior

The backend must not silently fall back to env when a saved validated Local path fails at runtime. It should fail the job with a user-visible Problem Details-style error so the GM knows the Local configuration is broken.

---

## Probe budget and packaging requirements

Document these backend settings in the target repo:

- probe timeout
- max memory or practical RAM/GPU guidance
- supported model formats for each category
- CPU/GPU behavior and whether GPU acceleration is optional
- dependency/image-size impact
- where models are expected to live on disk in deployment
- whether paths are container-internal paths or host-mounted paths

Suggested starting point:

- timeout: configurable, default 30-60 seconds
- no full audio transcription during validation
- no long LLM generation during validation
- clear failure for unsupported formats or category mismatch

---

## OpenAPI sync required for frontend unblock

After backend implementation:

1. Regenerate the backend OpenAPI from the live FastAPI app.
2. Copy it to frontend `docs/context/api/openapi.json`.
3. Run frontend `npm run gen:api`.
4. Run frontend `npm run check:api-types`.

Frontend implementation of Story 6.6 remains blocked until generated `types/api.ts` exposes:

- local validation request schema
- local validation response schema
- validation endpoint operation
- `transcription_local_validation_id` and `summary_local_validation_id` or equivalent PATCH proof fields

---

## Backend tests required

Suggested tests:

- validation rejects missing path
- validation rejects transcription category with LLM/GGUF path
- validation rejects summary category with Whisper/ASR path
- validation times out cleanly and returns Problem Details
- validation success returns an opaque proof bound to user/category/path
- PATCH Local path without proof is rejected
- PATCH Local path with stale/wrong-path/wrong-category proof is rejected
- PATCH Local path with valid proof succeeds
- jobs use Local runtime for validated Local settings
- jobs keep Story 6.5 env fallback when owner/settings are unresolved
- raw paths and runtime errors are not logged with secrets

---

## Frontend impact once delivered

Expected frontend files after contract sync:

- `lib/jdr/schemas/modelSettings.ts`
- `lib/jdr/settings/queries.ts`
- `components/jdr/settings/ModelSettingsCard.tsx`
- `app/(jdr)/jdr/settings/page.tsx`
- `tests/components/jdr/settings/ModelSettingsCard.test.tsx`
- `tests/app/(jdr)/jdr/settings/page.test.tsx`
- `docs/context/api/openapi.json`
- `types/api.ts`

The frontend will add per-category "Tester le modele" actions, inline validation state, save gating, and PATCH proof forwarding only after the OpenAPI contract exists.

---

## Delivered — actual runtime & packaging impact (AC8)

BD-20 is implemented on `AnaMa213/AI-Kaeyris` `main` and synced into this repo's
`docs/context/api/openapi.json` + `types/api.ts` on 2026-06-16. Facts captured
from the delivered backend so the frontend story documents the real impact:

- **Endpoint:** `POST /services/jdr/settings/models/local/validation` returns
  `LocalModelValidationOut` (`validation_id`, `category`, `model_path`,
  `status: "succeeded"`, `runtime`, `model_format`, `message`, `expires_at`).
- **PATCH proof fields:** `transcription_local_validation_id`,
  `summary_local_validation_id` on `ModelSettingsPatch` (write-only; never
  returned on `ModelSettingsOut`).
- **Runtime libraries** (added to backend `pyproject.toml`, lazily imported so
  cloud/HTTP-only deployments never load them):
  - Transcription: `faster-whisper` (CTranslate2 Whisper).
  - Summary/LLM: `llama-cpp-python` (GGUF).
- **Supported model formats:**
  - Transcription → CTranslate2 Whisper **directory** containing `model.bin`
    (`runtime: "faster-whisper"`, `model_format: "ctranslate2-whisper"`).
  - Summary → single **`.gguf`** file (`runtime: "llama-cpp-python"`,
    `model_format: "gguf"`).
- **Probe budget:** bounded by `LOCAL_MODEL_VALIDATION_TIMEOUT_SECONDS`
  (default **45s**, `asyncio.wait_for`). Transcription probe loads the model
  only; summary probe runs a 1-token generation. No real session is processed.
- **Proof expiry:** `LOCAL_MODEL_VALIDATION_TTL_SECONDS` default **900s**
  (15 min). The proof is `sha256(validation_id)` bound to user + category +
  `sha256(normalized_path)` + `succeeded` + expiry; PATCH rejects a changed
  Local path without a matching, unexpired proof.
- **CPU/GPU:** `LOCAL_MODEL_DEVICE` defaults to **`cpu`**; GPU is optional via
  `LOCAL_WHISPER_COMPUTE_TYPE` / `LOCAL_LLM_GPU_LAYERS` / `LOCAL_LLM_CONTEXT_TOKENS`.
- **Error taxonomy (Problem Details `type`):** `local-model-path-not-found`,
  `local-model-timeout`, `local-model-out-of-memory`,
  `local-model-incompatible-task`, `local-model-unsupported-format`,
  `local-model-validation-required`, `local-model-validation-expired`. The
  frontend surfaces `detail`/`title` inline; no secrets or stack traces leak.
- **Image-size / RAM impact:** `faster-whisper` (CTranslate2) and
  `llama-cpp-python` add compiled native deps to the **backend** image only.
  They are import-lazy, so RAM is consumed only when a GM actually runs Local;
  practical RAM depends on the operator's model file (e.g. Whisper large-v3
  ≈ 1.5–3 GB, GGUF varies with quantization). The **frontend** bundle is
  unaffected — it only gained the validation request/response types.

## References

- `_bmad-output/implementation-artifacts/6-6-local-model-engine-and-validation.md`
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-16.md`
- `_bmad-output/planning-artifacts/epics.md#Story 6.6`
- `docs/context/api/openapi.json`
- `docs/context/api/backend-summary.md`
- https://github.com/ggml-org/llama.cpp
- https://github.com/abetlen/llama-cpp-python
- https://github.com/SYSTRAN/faster-whisper
