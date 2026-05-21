# JDR Workflow Context - AI-Kaeyris API

Snapshot date: 2026-05-21.

The JDR service supports two transcription modes:

- `diarised`: default mode. Transcription contains speaker labels, and the GM maps speakers to PJs.
- `non_diarised`: opt-in mode for providers that do not identify speakers. Transcription is stored as ordered text chunks and summarized through map-reduce.

## Shared Concepts

Session states are managed by the backend. The frontend should render the state from the API rather than infer it from local steps.

Core entities:

- Session: title, recorded date, optional campaign context, transcription mode.
- PJ: stable player-character owned by the GM.
- Audio source: uploaded M4A associated with a session.
- Job: async work unit for transcription or artifact generation.
- Artifact: generated output, usually available as JSON and Markdown.

## Workflow A - Diarised Session

Use this when transcription can produce reliable `speaker_label` values.

1. Create or list PJs.

```http
POST /services/jdr/pjs
GET /services/jdr/pjs
```

2. Create a session. Omit `transcription_mode` or set it to `diarised`.

```http
POST /services/jdr/sessions
```

Minimal body:

```json
{
  "title": "Session 12 - La cite engloutie",
  "recorded_at": "2026-05-21T20:00:00Z",
  "transcription_mode": "diarised",
  "campaign_context": "Optional context for the LLM."
}
```

3. Upload M4A audio.

```http
POST /services/jdr/sessions/{session_id}/audio
```

The response contains `job_id`. Poll:

```http
GET /services/jdr/jobs/{job_id}
```

4. Read transcription after the job succeeds.

```http
GET /services/jdr/sessions/{session_id}/transcription
GET /services/jdr/sessions/{session_id}/transcription.md
```

5. Map speakers to PJs.

```http
PUT /services/jdr/sessions/{session_id}/mapping
GET /services/jdr/sessions/{session_id}/mapping
```

Request shape:

```json
{
  "mapping": {
    "speaker_1": "pj_uuid",
    "speaker_2": "pj_uuid"
  }
}
```

Changing the mapping invalidates existing `pov:*` artifacts.

6. Generate artifacts.

```http
POST /services/jdr/sessions/{session_id}/artifacts/narrative
POST /services/jdr/sessions/{session_id}/artifacts/elements
POST /services/jdr/sessions/{session_id}/artifacts/povs
```

Poll each returned `job_id`.

7. Read artifacts.

```http
GET /services/jdr/sessions/{session_id}/artifacts/narrative
GET /services/jdr/sessions/{session_id}/artifacts/narrative.md
GET /services/jdr/sessions/{session_id}/artifacts/elements
GET /services/jdr/sessions/{session_id}/artifacts/elements.md
GET /services/jdr/sessions/{session_id}/artifacts/povs/{pj_id}
GET /services/jdr/sessions/{session_id}/artifacts/povs/{pj_id}.md
```

## Workflow B - Non-Diarised Session

Use this when the provider returns plain transcription without speaker labels. This is the recommended early workflow for the frontend because it makes the JDR flow usable before a local diarisation host exists.

1. Create or list PJs.

```http
POST /services/jdr/pjs
GET /services/jdr/pjs
```

2. Create a session with `transcription_mode: "non_diarised"`.

```http
POST /services/jdr/sessions
```

Body:

```json
{
  "title": "Session test non diarised",
  "recorded_at": "2026-05-21T20:00:00Z",
  "transcription_mode": "non_diarised",
  "campaign_context": "Optional context for the LLM."
}
```

The mode is immutable. A `PATCH` containing `transcription_mode` returns `422 immutable-field`.

3. Upload M4A audio and poll transcription job.

```http
POST /services/jdr/sessions/{session_id}/audio
GET /services/jdr/jobs/{job_id}
```

4. Inspect chunks.

```http
GET /services/jdr/sessions/{session_id}/chunks
```

This returns ordered chunks with text. Internal `summary_text` is not exposed.

5. Declare PJs present in the session.

```http
POST /services/jdr/sessions/{session_id}/players
GET /services/jdr/sessions/{session_id}/players
```

Request shape:

```json
{
  "pj_ids": ["pj_uuid_1", "pj_uuid_2"]
}
```

6. Generate the global summary.

```http
POST /services/jdr/sessions/{session_id}/artifacts/summary
GET /services/jdr/jobs/{job_id}
```

Then read:

```http
GET /services/jdr/sessions/{session_id}/artifacts/summary
GET /services/jdr/sessions/{session_id}/artifacts/summary.md
```

7. Generate derived artifacts.

```http
POST /services/jdr/sessions/{session_id}/artifacts/narrative
POST /services/jdr/sessions/{session_id}/artifacts/elements
POST /services/jdr/sessions/{session_id}/artifacts/povs
```

In `non_diarised` mode, these require the global `summary` first. If missing, the backend returns `409 no-summary`.

8. Read artifacts using the same endpoints as diarised mode.

## Cross-Mode Rules

- `/transcription` and `/mapping` are for `diarised`.
- `/chunks`, session `/players`, and `/artifacts/summary` are for `non_diarised`.
- Calling the wrong endpoint for a mode returns `409 wrong-mode`.
- `narrative`, `elements`, and `povs` generation endpoints exist for both modes.
- `non_diarised` POV quality is limited because the LLM must infer character perspective without speaker labels.
- Player `/me/*` access is currently reliable for diarised sessions. Prioritize GM workflow before player UX.

## Frontend Milestone Suggestion

Recommended implementation order:

1. API settings: base URL + Bearer token + health check.
2. Sessions list/create/edit.
3. M4A upload + job polling.
4. Non-diarised happy path: chunks -> players -> summary -> artifacts.
5. Diarised path: transcription -> mapping -> artifacts.
6. Markdown artifact viewer/export.
7. Player token enrollment and read-only player views.

