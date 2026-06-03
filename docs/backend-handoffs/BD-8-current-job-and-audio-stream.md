# Backend Handoff — BD-8 : current_job_id sur SessionOut + lecture audio (GET) + confirmation DELETE irrémédiable

- **Repo source** : `AI-Kaeyris-Web` (frontend)
- **Repo cible** : `AnaMa213/AI-Kaeyris` (backend, FastAPI + SQLAlchemy + Pydantic + Whisper + RQ)
- **Émetteur** : Kenan
- **Date** : 2026-06-03
- **Statut** : ready-for-backend
- **Priorité** :
  - Section 1 (`current_job_id`) — **BLOQUANT** pour Story 3.4 (reprise du polling de transcription après refresh navigateur).
  - Section 2 (`GET /audio`) — **BLOQUANT** pour le lecteur audio (Story 3.5 player) si l'endpoint n'existe pas encore.
  - Section 3 (DELETE irrémédiable) — **à valider** pour Story 3.6 (réinvocation destructive).
  - Section 4 (dict multi-jobs Epic 4) — **NICE-TO-HAVE / anticipation**, ne rien coder maintenant.
- **Migration de données** : NONE (champ nullable additif, aucune backfill requise — voir §1).
- **Référence interne** : table-ronde architecture du 2026-06-03 (party-mode Sally/John/Winston), décisions produit Kenan.

## TL;DR

Le frontend stocke aujourd'hui le `job_id` de transcription dans un `useState` côté page detail. Au refresh navigateur, cet état est perdu → le polling du job ne reprend pas → l'UI reste bloquée en `transcribing` sans jamais converger. On a besoin que `SessionOut` expose **`current_job_id`** (le job actif/le plus récent du pipeline) pour que le frontend reconstruise sa state machine à partir de l'API seule, sans état local.

Deux points secondaires : confirmer/exposer un **`GET` binaire de l'audio** pour le `<audio>` player (le POST et le DELETE existent, pas sûr que le GET soit exposé), et **valider que `DELETE /audio` est bien irrémédiable** (purge totale transcription + chunks + audio, reset `state → created`) — décision produit assumée (réinvocation = perte définitive).

## 1. Schema change — `current_job_id` sur SessionOut  [BLOQUANT]

### 1.1 SQL

```sql
ALTER TABLE sessions
  ADD COLUMN current_job_id uuid NULL REFERENCES jobs(id) ON DELETE SET NULL;
```

- Nullable, pas de default, pas de backfill (sessions existantes → `NULL` = aucun job connu, correct).
- `ON DELETE SET NULL` : si un job est purgé/expiré, la session ne casse pas (RQ garde l'état 24h succès / 7j échec ; le pointeur DB peut survivre plus longtemps — le SET NULL évite une FK pendante).

### 1.2 Sémantique (à implémenter scrupuleusement)

`current_job_id` = **le job du pipeline de transcription le plus récent pour cette session** ; `NULL` si aucun audio n'a jamais été uploadé (ou après purge).

| Évènement                         | Action sur `current_job_id`                          |
|-----------------------------------|------------------------------------------------------|
| `POST /sessions/{id}/audio` (202) | **SET** `current_job_id = <job transcription créé>`  |
| Job transcription `succeeded`     | **NE PAS clear** — laisser pointer (state terminal lu via `JobOut.status`) |
| Job transcription `failed`        | **NE PAS clear** — frontend a besoin de `failure_reason` |
| `DELETE /sessions/{id}/audio`     | **CLEAR** `current_job_id = NULL` (purge, voir §3)   |

**Pourquoi ne pas clear en fin de job ?** Le frontend lit `session.state` pour décider l'état terminal UI (`transcribed`/`failed`), mais a besoin de re-fetch le `JobOut` (notamment `failure_reason` en cas d'échec) tant que l'utilisateur reste sur la page. Garder le pointeur non-null en état terminal est sans ambiguïté : la FSM UI ne dérive jamais `transcribed` depuis la présence du job_id, seulement depuis `session.state`.

### 1.3 Changement OpenAPI — SessionOut

```python
class SessionOut(BaseModel):
    # ... champs existants ...
    current_job_id: UUID | None = None
```

Exemple `GET /services/jdr/sessions/{id}` pendant transcription :

```json
{
  "id": "…",
  "title": "Session 12 — La Chute d'Emon",
  "state": "transcribing",
  "transcription_mode": "whisper",
  "current_job_id": "9f1c…job…",
  "created_at": "…",
  "updated_at": "…"
}
```

Avec ce champ, le frontend fait : si `current_job_id != null` ET `state ∈ {audio_uploaded, transcribing}` → (re)lance le polling `GET /jobs/{current_job_id}`. Plus aucun `useState` de job_id. **C'est le déblocage de Story 3.4.**

## 2. Lecture audio — `GET /services/jdr/sessions/{id}/audio`  [BLOQUANT si absent]

Le `POST` (202 AudioUploadOut) et le `DELETE` existent. **Question/demande** : un `GET` est-il exposé pour servir le binaire au lecteur `<audio>` ? Si non, le créer.

Contrat attendu :

- **Route** : `GET /services/jdr/sessions/{id}/audio`
- **Auth** : cookie de session (le `<audio src>` doit fonctionner avec cookie envoyé automatiquement).
- **Réponse 200** : binaire audio, `Content-Type: audio/mp4` (ou type réel sortant du reducer ffmpeg — préciser ; on s'attend à de l'AAC/m4a).
- **Range requests OBLIGATOIRES** : `Accept-Ranges: bytes` + support `Range:` → `206 Partial Content`. **Sans ça, le scrub/seek du player ne marche pas** (Chrome refuse de seek sans 206).
- **Headers** : `Content-Length`, `Content-Range` sur les 206, `Cache-Control: private, max-age=...` (audio immuable tant que pas remplacé).
- **404** : pas d'audio (session `created` ou après purge) ou cross-tenant.

**Alternative acceptable** : renvoyer une **URL signée courte durée** (`{ "url": "...", "expires_at": "..." }`). Si vous partez là-dessus, dites-le — ça change le code frontend. **Préférence frontend : servir le binaire directement avec Range** (un seul round-trip, cookie auth déjà là). À trancher selon votre stockage (FS local vs S3).

## 3. DELETE /audio — comportement irrémédiable  [à valider]

Décision **produit assumée** (Kenan) : remplacer l'audio = **perte définitive**. `DELETE /audio` = purge totale, pas soft-delete.

À confirmer / garantir :

1. `DELETE /services/jdr/sessions/{id}/audio` purge **tout** : fichier audio, chunks intermédiaires, transcription produite, artifacts dérivés. Aucune conservation.
2. Reset machine : `session.state → created` et `current_job_id → NULL`.
3. Idempotence : un second DELETE sur session déjà `created` renvoie quoi ? (204 idempotent préféré, ou 404 — **précisez**).

**Question ouverte — le 409 :**
- `transcribing` → garder le **409** (ne pas supprimer pendant qu'un job tourne — sinon kill RQ propre requis). **OK, garder.**
- `transcribed` → Story 3.6 « replace audio » **exige** de pouvoir remplacer un audio déjà transcrit. **Demande : autoriser `DELETE` sur `state = transcribed`** (204, purge + reset `created`). Le frontend gère la confirmation forte (modale destructive type-to-confirm). Confirmez que ce relâchement du 409 sur `transcribed` est OK, et que le 409 ne subsiste **que** sur `transcribing`.

| `state` au DELETE | Réponse attendue                          |
|-------------------|-------------------------------------------|
| `created`         | 204 (idempotent) ou 404 — à préciser      |
| `audio_uploaded`  | 204 + purge + reset `created`             |
| `transcribing`    | **409** (job en cours, refus)             |
| `transcribed`     | **204 + purge totale + reset `created`** (changement demandé) |
| `failed`          | 204 + purge + reset `created`             |

**Question additionnelle frontend (UX échec)** : en cas de transcription `failed`, **l'audio source est-il conservé** côté backend ? Le frontend veut afficher « Relancer la transcription » sur le **même** audio sans re-upload. Si l'audio est perdu à l'échec, on bascule sur « Réessayer » avec re-upload. **Merci de trancher.**

## 4. Anticipation Epic 4 (multi-artifacts) — NICE-TO-HAVE, ne rien coder maintenant

Epic 4 introduira jusqu'à 4 jobs/session (`summary`, `narrative`, `elements`, `povs`), potentiellement concurrents. **Ne pas** transformer `current_job_id` en dict — ça pollue la sémantique « pipeline transcription ».

Direction recommandée le moment venu (additif, non-breaking) :

```
GET /services/jdr/sessions/{id}/jobs?status=active
→ 200 [ JobOut, ... ]   # jobs non-terminaux de la session
```

`current_job_id` reste le pointeur du pipeline transcription ; les artifacts Epic 4 se pollent via cette liste. **Aucune action backend maintenant** — documenté ici uniquement pour éviter un dict prématuré en §1.

## 4 bis. Champ `progress` sur `JobOut` — NICE-TO-HAVE (Story 3.4 livrée sans)

Story 3.4 (frontend) affiche désormais un **pourcentage de transcription** pour que le MJ sache quand ça se termine. Le contrat actuel `JobOut` n'expose **aucune progression** (`status` seulement : `queued/running/succeeded/failed`). Le frontend **estime** donc le % côté client (durée audio × temps écoulé depuis `started_at`, plafonné à 95 % jusqu'à la fin).

**Demande (non-bloquante) :** exposer un champ optionnel sur `JobOut` :

```python
class JobOut(BaseModel):
    # ... champs existants ...
    progress: int | None = None   # 0..100, mis à jour par le worker ; None si inconnu
```

- Sémantique : pourcentage réel de traitement (ex. chunks transcrits / total), `None` tant qu'indéterminé.
- **Le frontend est déjà prêt** : un adaptateur consomme `job.progress` **en priorité** s'il est présent, et retombe sur l'estimation sinon. **Aucune coordination de livraison nécessaire** — dès que le champ apparaît, le vrai % remplace l'estimation automatiquement.
- Si le coût worker est élevé (pas de granularité interne Whisper), **laisser tomber** : l'estimation frontend suffit pour V1.

## 5. Récap priorités

- **BLOQUANT Story 3.4 (survie refresh)** : §1 `current_job_id` sur SessionOut. *(Le polling live on-page est livré sans ; seule la reprise après rechargement attend ce champ.)*
- **BLOQUANT player (Story 3.5)** : §2 `GET /audio` avec Range (si pas déjà exposé).
- **À valider Story 3.6** : §3 relâcher le 409 sur `transcribed`, garder sur `transcribing`, purge irrémédiable + reset `created` ; + statuer sur la conservation audio post-`failed`.
- **NICE-TO-HAVE** : §4 (dict Epic 4) + §4 bis (`progress` sur JobOut) — ne rien coder d'urgent.
