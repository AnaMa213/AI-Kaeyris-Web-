# Backend Handoff — BD-14 : SSE pour les jobs d'artefacts (active BD-10 §3b)

- **Repo source** : `AI-Kaeyris-Web` (frontend)
- **Repo cible** : `AnaMa213/AI-Kaeyris` (backend, FastAPI + RQ + Redis)
- **Émetteur** : Kenan
- **Date** : 2026-06-09
- **Statut** : ✅ **IMPLÉMENTÉ** (backend `main`, PR #14 `codex/014-sse-artifact-jobs` — `5e52957`). Vérifié 2026-06-09.
- **Priorité** : **BASSE/MOYENNE** — confort UX. Le polling `GET /jobs/{id}` fonctionne déjà ; BD-14 supprime la latence de poll sur les jobs d'artefacts (résumé/récit/éléments/POVs).
- **Migration de données** : NONE.
- **Active** : la porte de sortie **BD-10 §3b** (endpoint SSE, laissé optionnel à l'époque). BD-14 demande de la livrer et de la **généraliser aux jobs d'artefacts**.

## ✅ Implémentation livrée (vérifiée dans le repo backend)

- **Endpoint** : `GET /services/jdr/jobs/{job_id}/events` (`router.py:2193`), `Content-Type: text/event-stream`, `Cache-Control: no-cache`, via `StreamingResponse`. GM-only.
- **Format de frame** (`_format_job_sse_frame`, l.509) :
  ```
  event: progress
  data: {"status":"running","phase":null,"progress_percent":null}
  ```
  Payload JSON = projection publique de `JobOut` (`status`, `phase`, `progress_percent`, + `failure_reason` quand disponible) — **identique à `GET /jobs/{job_id}`**.
- **Cycle** (`_job_event_stream`, l.518) : émet une frame, puis si le statut est terminal (`succeeded`/`failed`) **ferme le flux** ; sinon re-lit l'état toutes les `_JOB_EVENTS_POLL_INTERVAL_SECONDS` (~1 s) et ré-émet.
- **Généricité (AC-B3)** : un seul endpoint pour **tous** les kinds de jobs (transcription **et** artefacts). Les jobs d'artefacts laissent `phase`/`progress_percent` à `null` ; la transcription peut les renseigner (BD-10).
- **Visibilité** : la validation 404 (job inconnu / autre MJ) se fait **avant** d'ouvrir le flux (`_project_job_out`), donc reste un vrai `404` HTTP, pas une erreur in-stream.
- **AC-B4 (fallback)** : `GET /jobs/{id}` (polling) inchangé — pas de régression.
- **Côté Web** : nouvel endpoint documenté dans le contrat (`openapi.json` 2026-06-09, réponse `text/event-stream`). Câblage `useJob` → SSE avec **fallback polling** à faire pour la story 4.19 (« consume SSE artifact jobs »).

## TL;DR

Pendant la génération d'un artefact, le frontend **poll** `GET /services/jdr/jobs/{job_id}` toutes les X s pour suivre `status`. On veut le **même confort que la transcription** : un flux **SSE** poussé par le serveur. BD-10 §3b a déjà spécifié ce endpoint (`GET /jobs/{job_id}/events`, `text/event-stream`) mais l'a laissé en phase 2. BD-14 = **l'activer**, pour **tous** les jobs (transcription **et** artefacts).

## 1. Demande — `GET /services/jdr/jobs/{job_id}/events`

Reprend exactement BD-10 §3b. `Content-Type: text/event-stream`. Le serveur relit l'état du job à intervalle (~1 s) et pousse :

```
event: progress
data: {"status":"running","phase":null,"progress_percent":null}
```

Event terminal puis fermeture du flux :

```
event: progress
data: {"status":"succeeded","phase":null,"progress_percent":null}
```

- **Payload = exactement les champs de `JobOut`** (`status`, `phase`, `progress_percent`).
- **Jobs d'artefacts** : `phase`/`progress_percent` restent `null` (suivi sur `status` uniquement — c'est le contrat actuel des artefacts, cf. Story 4.4). Les jobs de **transcription** peuvent renseigner `phase`/`progress_percent` (BD-10) si l'instrumentation est en place.
- **Event terminal** = `status ∈ {succeeded, failed}` → émettre puis fermer le flux. En cas d'échec, inclure `failure_reason` si disponible (cohérent avec BD-11 §3).

## 2. Invariants (repris de BD-10)

- `Job.status` reste **la** source de vérité de complétion ; SSE est un canal de transport, pas une nouvelle vérité.
- **Dégradation** : si le SSE n'est pas disponible (proxy, timeout, endpoint absent), le frontend **retombe sur le polling** `GET /jobs/{id}` existant. BD-14 ne doit pas casser le polling.

## 3. Contrat / OpenAPI

- **AC-B1** — `openapi.json` régénéré documente `GET /services/jdr/jobs/{job_id}/events` (réponse `text/event-stream`). À défaut de typage SSE riche en OpenAPI, documenter le format d'event en description.

## 4. AC testables (backend)

- **AC-B2** — `GET /jobs/{id}/events` sur un job d'artefact `running` pousse des events `progress` avec `status` à jour, puis un event terminal `succeeded`/`failed`, puis ferme le flux.
- **AC-B3** — Le endpoint fonctionne aussi pour un job de **transcription** (généralisation, pas un endpoint par type).
- **AC-B4** — Le polling `GET /jobs/{id}` reste fonctionnel (pas de régression) — c'est le fallback frontend.

## 5. Récap

- **Cœur** : livrer l'endpoint SSE de BD-10 §3b, **générique tous jobs**. Zéro migration.
- **Frontend** : `useJob` basculera sur SSE quand dispo, avec fallback polling. Câblage front à faire **après** AC-B1.
- **Priorité** : confort, non bloquant — le polling actuel couvre déjà le besoin fonctionnel.
