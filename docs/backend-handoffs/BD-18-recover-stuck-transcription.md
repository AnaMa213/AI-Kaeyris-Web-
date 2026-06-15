# Backend Handoff — BD-18 : déblocage d'une transcription coincée (`POST /services/jdr/sessions/{session_id}/transcription/recover`)

- **Repo source** : `AI-Kaeyris-Web` (frontend)
- **Repo cible** : `AnaMa213/AI-Kaeyris` (backend, FastAPI + SQLAlchemy + RQ + Redis)
- **Émetteur** : Kenan
- **Date** : 2026-06-14
- **Statut** : ✅ **implémenté directement** (Story 4.23, AC10) — backend modifié dans le même chantier que le frontend, à la demande explicite de Kenan. Voir §3.
- **Priorité** : MOYENNE — débloque l'AC10 de la Story 4.23 (séance figée sur `transcribing`).

## TL;DR

Un worker de transcription passe la séance à `transcribing` **avant** le gros du travail et ne la fait basculer vers `transcribed` / `transcription_failed` qu'à la toute fin. Si le process worker meurt en cours de route (OOM, redémarrage conteneur, crash dur), le job RQ disparaît de Redis tandis que la séance reste `transcribing` **pour toujours** : l'UI affiche un « toujours en cours » infini, et la séance ne peut être ni supprimée (409 `session-delete-blocked`) ni voir son audio remplacé (409, refusé tant que `state == transcribing`).

Le frontend seul ne pouvait pas lever ce blocage (le backend renvoie 409 quel que soit l'affichage). Cet endpoint réalise la transition d'échec que le worker mort n'a jamais atteinte.

## 1. Endpoint — `POST /services/jdr/sessions/{session_id}/transcription/recover`

- **Auth** : GM-only (`require_gm`, `kaeyris-bearer`), même politique que `DELETE /sessions/{id}`.
- **`200 OK`** → `SessionOut` (la séance mise à jour, désormais `transcription_failed`).
- **`404 session-not-found`** — séance inexistante ou non visible par le MJ courant.
- **`409 transcription-not-stuck`** — la séance n'est pas en `transcribing` : rien à débloquer.
- **`409 transcription-still-active`** — le job de transcription est encore actif dans RQ : le worker est vivant, on ne court pas le risque de le doubler.
- **`422`** — `HTTPValidationError` (UUID malformé).

## 2. Logique (`recover_stuck_transcription`)

- refuse (`TranscriptionNotStuckError` → 409) si `session.state != TRANSCRIBING` ;
- refuse (`TranscriptionStillActiveError` → 409) si `current_job_id` est encore actif dans RQ (`_is_rq_job_active`, réutilisé depuis la logique de delete BD-15) ;
- sinon : `state → transcription_failed`, et marque le job orphelin `failed` (`failure_reason = "Transcription interrupted unexpectedly (worker lost before completion)."`).

Aucune migration de données. Aucun nouveau champ. Réutilise `SessionState.TRANSCRIPTION_FAILED` existant — la séance retombe dans l'état « échec » déjà géré (remplacement audio possible via `canReplaceAudio`, suppression possible car `state != transcribing` et job mort).

## 3. ✅ Implémentation livrée (backend `AI-Kaeyris`)

- `app/services/jdr/logic.py` : exceptions `TranscriptionNotStuckError` / `TranscriptionStillActiveError` + `recover_stuck_transcription(db, *, session, redis_client)`.
- `app/services/jdr/router.py` : classes d'erreur HTTP `TranscriptionNotStuckError` / `TranscriptionStillActiveError` (409) + endpoint `recover_stuck_transcription`.
- `tests/services/jdr/test_transcription_recover.py` : 9 tests (200 + état `transcription_failed`, job sans current_job_id, recover→delete OK, 409 still-active, 409 not-stuck, 404 inconnue/cross-GM, 401, 403).
- `docs/context/api/openapi.json` (backend) régénéré.

### Conséquences frontend (livrées dans la même Story 4.23)

- Contrat re-synchronisé (`docs/context/api/openapi.json` + `npm run gen:api`) ; seul ce path s'ajoute.
- `useRecoverTranscription` (`lib/jdr/sessions/queries.ts`) + `StuckTranscriptionCard` ; la page séance détecte `session.state === "transcribing" && jobNotFound` et propose « Réessayer » (refetch job) + « Débloquer la séance » (recover).
