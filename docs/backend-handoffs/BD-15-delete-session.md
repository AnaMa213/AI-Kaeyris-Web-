# Backend Handoff — BD-15 : suppression d'une session (`DELETE /services/jdr/sessions/{session_id}`)

- **Repo source** : `AI-Kaeyris-Web` (frontend)
- **Repo cible** : `AnaMa213/AI-Kaeyris` (backend, FastAPI + SQLAlchemy + RQ + Redis)
- **Émetteur** : Kenan
- **Date** : 2026-06-09
- **Statut** : ready-for-backend
- **Priorité** : **MOYENNE** — débloque l'item **C4** de l'Epic 4 bis (supprimer une session depuis le bloc « Sessions » de la page campagne). La story 4.8 a livré **C5** seul ; **C4 est reporté** côté frontend tant que cet endpoint n'existe pas (on a refusé un mock destructif trompeur sur un objet lourd).
- **Migration de données** : **PROBABLE** — voir §2 (cascade : audio stocké, chunks/segments, artefacts, jobs, players/mapping).

## TL;DR

Une session est aujourd'hui **création / lecture / édition partielle** uniquement :
- `POST /services/jdr/sessions`
- `GET /services/jdr/sessions` · `GET /services/jdr/sessions/{id}`
- `PATCH /services/jdr/sessions/{id}` (titre / `campaign_context`)

**Aucun verbe de suppression** n'existe (`DELETE /sessions/{id}` = `never` dans le contrat, vérifié aussi dans le router backend). Le produit veut pouvoir **supprimer une session** directement depuis la page campagne. Demande : exposer `DELETE /services/jdr/sessions/{session_id}`.

> Contexte : le frontend a délibérément **évité de mocker** cette suppression (contrairement à la suppression de PJ / BD-3). Une session porte l'audio, la transcription (chunks/segments), les artefacts générés et des jobs — une « suppression locale non persistée » serait dangereusement trompeuse. C4 attend donc un **vrai** endpoint.

## 1. Demande — `DELETE /services/jdr/sessions/{session_id}`

Suppression d'une session appartenant au MJ courant.

- **Réponse** : `204 No Content` (aligner sur `DELETE /campaigns/{campaign_id}` et `DELETE /players/{player_id}` déjà exposés).
- **Auth** : GM-only (`require_gm`), même politique que `PATCH /sessions/{id}`.

### Règles / codes d'erreur (aligner sur l'existant)

- `404 session-not-found` si la session n'existe pas ou n'appartient pas au MJ courant (réutiliser `SessionNotFoundError`).
- `409` **à trancher** si la session est dans un état non supprimable (ex. `transcribing` avec un job RQ en vol) — voir §2. À défaut de règle, autoriser la suppression à tout état et gérer la cascade/annulation côté backend.

## 2. Invariants & cascade (à trancher côté backend)

Une session n'est pas isolée. La suppression doit décider du sort de :

- **Audio stocké** (objet binaire / chemin) — purger le blob (cf. la logique d'`audio purge` déjà présente, `test_audio_purge.py`).
- **Transcription** : chunks (`non_diarised`) / segments (`diarised`) + l'override édité `edited_transcript_md` (BD-13).
- **Artefacts** générés (résumé / récit / éléments / POVs) attachés à la session.
- **`players` / `mapping`** (PJs présents / mapping locuteurs) liés à la session.
- **Jobs RQ en cours** (`current_job_id`) : si la session est `transcribing` ou a un job d'artefact actif, **annuler/avorter** proprement le job, ou refuser en `409`. À trancher.

Recommandation frontend : **cascade complète** (supprimer session + dépendances) pour `204`, et si un job est en vol, soit l'annuler, soit renvoyer `409` avec un `failure`/`title` lisible que le front mappera.

## 3. Contrat / OpenAPI (bloquant frontend)

- **AC-B1** — `docs/context/api/openapi.json` régénéré expose `DELETE /services/jdr/sessions/{session_id}` (réponse `204`, erreurs `404` / éventuel `409`). Le frontend régénère ses types via `gen:api` et câblera `useDeleteSession` + le `ConfirmDialog` (Story 4.6).

## 4. AC testables (backend)

- **AC-B2** — `DELETE` d'une session du MJ → `204` ; un `GET /sessions/{id}` ultérieur → `404` ; la session disparaît de `GET /sessions` ; `campaign.session_count` décrémenté.
- **AC-B3** — `DELETE` d'une session d'un autre MJ → `404`.
- **AC-B4** — Cascade : après suppression, les chunks/segments/artefacts/players/mapping liés ne sont plus accessibles (pas de lignes orphelines).
- **AC-B5** — (selon décision §2) suppression d'une session `transcribing` → soit `204` avec job annulé, soit `409` ; comportement déterministe et testé.
- **AC-B6** — Aucune régression sur `GET/POST/PATCH /sessions` ni sur la facturation `session_count` des campagnes.

## 5. Récap

- **Cœur** : un verbe à ajouter (`DELETE /sessions/{id}`, `204`) + la **cascade** des dépendances (audio, transcription, artefacts, players/mapping, jobs).
- **Bloquant frontend** : AC-B1 (contrat) pour la story C4 (suppression de session depuis la page campagne). Le frontend a sciemment reporté C4 plutôt que de le mocker.
- **À trancher backend** : politique sur une session avec job en vol (§2 / AC-B5).
