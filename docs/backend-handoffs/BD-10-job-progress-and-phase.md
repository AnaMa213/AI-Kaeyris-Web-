# Backend Handoff — BD-10 : avancement de transcription en direct (`phase` + `progress_percent`)

- **Repo source** : `AI-Kaeyris-Web` (frontend)
- **Repo cible** : `AnaMa213/AI-Kaeyris` (backend, FastAPI + SQLAlchemy + RQ + Redis + Whisper)
- **Émetteur** : Kenan
- **Date** : 2026-06-03
- **Statut** : ready-for-backend
- **Priorité** : **MOYENNE** — le polling actuel (`status`) marche déjà ; BD-10 transforme une estimation client en avancement réel (phases + %). UX, pas correctif.
- **Migration de données** : **NONE** — tout passe par `job.meta` (Redis/RQ). Pas de migration Alembic.
- **Supersède** : BD-8 §4 bis (champ `progress` sur `JobOut`, demandé vaguement). BD-10 le précise, le renomme `progress_percent`, et ajoute `phase` + l'instrumentation worker exacte.

## TL;DR

Après l'upload, le MJ veut voir l'avancement de la transcription en clair : **Reduce → Transcription → Transcrit**, avec un pourcentage **réel** (pas une estimation client). Le contrat actuel `GET /services/jdr/jobs/{job_id}` n'expose que `status` (`queued/running/succeeded/failed`) — aucune phase, aucun %.

**Demande** : le worker RQ publie son avancement dans **`job.meta`** (`phase` + `progress_percent`) à chaque étape du pipeline `_transcribe_session`, et le endpoint `GET /jobs/{id}` relit cette meta pour enrichir `JobOut` avec deux champs **optionnels/nullable**. Le pipeline découpe déjà l'audio en N chunks séquentiels (`TRANSCRIPTION_CHUNK_DURATION_SECONDS`) → on a un **vrai dénominateur** pour le % (`chunks_done / chunks_total`).

**Architecture retenue** : enrichir le polling existant via `job.meta`. **PAS de SSE en v1** (cf. §4 — l'argumentaire et la porte de sortie). Zéro infra nouvelle, zéro migration, zéro pont worker→web à construire (RQ fournit déjà ce canal).

## 1. Modèle — `job.meta` (pas de migration)

Le worker écrit dans `job.meta` (dict RQ persisté dans Redis via `save_meta()`), relu côté web par `Job.fetch(id, connection=redis)`.

| Clé meta            | Type        | Domaine                                          |
|---------------------|-------------|--------------------------------------------------|
| `phase`             | str (enum)  | `reducing` \| `transcribing` \| `done` \| `failed` |
| `progress_percent`  | int         | `0`..`100`                                       |

**Décision — `phase` ne contient PAS `queued`.** L'état `queued` est déjà porté par `Job.status` ; le dupliquer dans `phase` crée deux sources de vérité. `phase` ne décrit que le travail *in-flight* du worker. Tant que le job est `queued`, `phase`/`progress_percent` sont simplement absents (→ `null`).

**Pourquoi `job.meta` et pas des colonnes `jdr_jobs` :**

| Option                  | Migration | Coût écriture                       | Persistance        |
|-------------------------|-----------|-------------------------------------|--------------------|
| `job.meta` (**retenu**) | aucune    | `save_meta()` O(1), pas de DB       | volatil (TTL RQ)   |
| colonnes `jdr_jobs`     | Alembic   | 1 commit Postgres **par chunk** = écriture chaude | persistant         |

Un % éphémère ne justifie pas une écriture Postgres chaude à chaque tick. Si un besoin d'historique post-mortem émerge un jour, des colonnes pourront être ajoutées — pas le besoin ici.

## 2. Instrumentation worker — `app/jobs/jdr.py`

Helper local (récupère le job RQ courant ; dégrade en no-op hors contexte worker, donc les tests directs du core async ne cassent pas) :

```python
from rq import get_current_job

def _emit(job, phase: str, pct: int) -> None:
    if job is None:
        return
    job.meta["phase"] = phase
    job.meta["progress_percent"] = int(pct)
    job.save_meta()
```

Le `transcribe_session_job` (entrée sync RQ) capture `get_current_job()` et le passe au core async `_transcribe_session(session_id, job=...)`, OU passe un callback (cf. AC-B12). Points d'émission, dans l'ordre des étapes existantes de `_transcribe_session` :

| AC      | Point dans le pipeline                                            | `phase`         | `progress_percent`                          |
|---------|------------------------------------------------------------------|-----------------|---------------------------------------------|
| AC-B1   | avant `prepare_audio_for_transcription` (si reduce nécessaire)   | `reducing`      | `0`                                         |
| AC-B2   | entrée `_transcribe_with_optional_chunking`                      | `transcribing`  | `0`                                         |
| AC-B3   | dans la boucle de chunks, après chaque chunk transcrit          | `transcribing`  | `min(99, round(chunks_done / chunks_total * 100))` |
| AC-B4   | après persist + `session.state = TRANSCRIBED`                    | `done`          | `100`                                       |
| AC-B5   | bloc `except` (`AudioReduceError` + tout échec permanent/transient) | `failed`     | dernière valeur émise (**ne pas remettre à 0**) |

**Borne AC-B3** : ne jamais émettre `100` pendant la boucle — `100` est réservé à `done` (AC-B4). Garantit que le frontend ne plafonne pas à 100 % avant l'arrivée réelle du résultat.

**Refactor requis — `_transcribe_with_optional_chunking`** : aujourd'hui aucune progression ne sort de cette fonction. Ajouter un paramètre **callback** :

```python
on_progress: Callable[[int, int], None] | None = None   # (chunks_done, chunks_total)
```

La boucle appelle `on_progress(done, total)` après chaque chunk. Côté worker :

```python
on_progress=lambda done, total: _emit(job, "transcribing", min(99, round(done / total * 100)))
```

> Rejeté : passer l'objet `job` RQ directement dans `_transcribe_with_optional_chunking`. Ça couplerait la transcription à RQ et casserait ses tests unitaires (qui tournent sans Redis). Le callback découple proprement.

## 3. Contrat API

### 3a. Enrichir `JobOut` — PRIORITÉ (le frontend poll déjà ce schéma)

Fichier : `app/services/jdr/schemas.py`. Ajouter à `JobOut` :

```python
phase: Literal["reducing", "transcribing", "done", "failed"] | None = None
progress_percent: int | None = None   # 0..100
```

Router `GET /services/jdr/jobs/{job_id}` (`app/services/jdr/router.py`) : après avoir construit la projection depuis `jdr_jobs`, faire `Job.fetch(job_id, connection=redis)`, lire `rq_job.meta.get("phase")` / `.get("progress_percent")`, peupler les deux champs. Fetch en échec ou meta vide → `None` (cf. §5).

C'est l'unique chose que le frontend consomme en v1 : `JobOut` est déjà typé et polled (`useJob`, `JobStateBadge`). **Aucun nouveau câblage front** — deux champs optionnels, consommés en priorité sur l'estimation existante (BD-8 §4 bis : le frontend bascule automatiquement sur le vrai % dès qu'il apparaît).

### 3b. SSE — OPTIONNEL, phase 2, NE PAS bloquer 3a

`GET /services/jdr/jobs/{job_id}/events`, `Content-Type: text/event-stream`. Le serveur poll `rq_job.meta` à intervalle (~1 s) et pousse :

```
event: progress
data: {"status":"running","phase":"transcribing","progress_percent":42}
```

Event terminal puis fermeture du flux :

```
event: progress
data: {"status":"succeeded","phase":"done","progress_percent":100}
```

Payload event = exactement `{status, phase, progress_percent}` (mêmes types que `JobOut`). **À ne livrer que si la latence du polling gêne réellement l'UX** (cf. §4). Le frontend ne câblera SSE qu'après validation de 3a.

## 4. SSE vs polling enrichi — arbitrage

Worker RQ et web FastAPI sont des **process séparés**. Le worker sait où il en est, le web doit le lire. La question n'est pas « SSE ou polling » mais « par quel canal franchir la frontière des process ».

- **`job.meta` (polling enrichi) fournit ce canal GRATUITEMENT** : écriture worker via `save_meta()`, lecture web via `Job.fetch()`. Pas de pub/sub, pas de streaming ASGI, pas de migration.
- **Le SSE devrait CONSTRUIRE ce pont** : soit le endpoint poll lui-même `job.meta` côté serveur pour re-streamer (= on déplace juste le polling client→serveur, même fraîcheur, plus de complexité : timeouts proxy, reconnexion, backpressure), soit on câble un Redis pub/sub alimenté par le worker (bus de messages pour un job qui progresse par paliers de chunks de plusieurs secondes — disproportionné).
- Pour de la transcription **batch**, un poll toutes les 1–2 s est imperceptible. Le SSE n'apporte pas assez pour justifier le pont tant que la latence ne gêne pas.

**Porte de sortie** : si un jour on veut du temps réel fin (typiquement le **live Jalon 5**, où un WebSocket stub existe déjà dans `app/services/jdr/live/router.py`), on activera 3b. On ne construit pas le pont par anticipation. WebSocket full-duplex : écarté, le besoin est strictement unidirectionnel serveur→client.

## 5. Dégradation — obligatoire

`job.meta` vit dans Redis, soumis au **TTL du résultat RQ**. Après expiration (ou job antérieur au déploiement, ou fetch Redis KO) la meta disparaît.

- Meta absente → `phase = null`, `progress_percent = null`, **HTTP 200** (jamais de 500).
- `JobOut` reste valide (champs optionnels). Le frontend retombe sur son estimation actuelle (durée audio).
- **Invariant** : `Job.status` (`queued/running/succeeded/failed`, depuis `jdr_jobs`) reste **TOUJOURS** la source de vérité de complétion. `phase`/`progress_percent` sont best-effort et décoratifs. Le frontend ne pilote **jamais** une transition d'état sur `phase`.

## 6. AC testables (backend)

- **AC-B6** — `GET /jobs/{id}` d'un job `running` en transcription → `phase="transcribing"`, `0 <= progress_percent <= 99`.
- **AC-B7** — job terminé OK → `phase="done"`, `progress_percent=100`, `status="succeeded"`.
- **AC-B8** — échec sur `AudioReduceError` → `phase="failed"`, `status="failed"`, `progress_percent` = dernière valeur émise (**pas** remis à 0).
- **AC-B9** — meta purgée (TTL) → `phase=null`, `progress_percent=null`, HTTP 200 (pas de 500).
- **AC-B10** — `progress_percent` **monotone croissant** sur la durée d'un job (jamais de régression entre deux lectures).
- **AC-B11** — *(bloquant frontend)* `docs/context/api/openapi.json` régénéré expose `phase` (enum nullable) + `progress_percent` (integer nullable) sur le schéma `JobOut`. Le frontend régénère ses types depuis ce contrat.
- **AC-B12** — `_transcribe_with_optional_chunking` testable unitairement : `on_progress` appelé `chunks_total` fois avec valeurs croissantes, **sans dépendance Redis**.

## 7. Récap priorités

- **MOYENNE — UX d'avancement réel** : §2 (instrumentation worker) + §3a (`JobOut` enrichi). Suffit à couvrir la demande produit (phases + % réels).
- **Bloquant côté frontend** : **AC-B11** — tant que `openapi.json` n'expose pas les deux champs, le frontend code à l'aveugle.
- **Backlog, non demandé maintenant** : §3b (SSE) — à activer seulement sur preuve par la mesure que le polling gêne.
- **À trancher backend** : nommage final de l'enum `phase` (proposé : `reducing|transcribing|done|failed`) ; le frontend mappera ces valeurs vers des labels FR habillés (fiction du rituel), donc l'enum doit être **fermé et documenté** dans l'OpenAPI, pas une string libre.
- **Aucune migration de données** — pure exploitation de `job.meta` RQ + 2 champs Pydantic optionnels.
