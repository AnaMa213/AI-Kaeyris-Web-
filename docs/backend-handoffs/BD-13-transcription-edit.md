# Backend Handoff — BD-13 : persistance d'une transcription éditée

- **Repo source** : `AI-Kaeyris-Web` (frontend)
- **Repo cible** : `AnaMa213/AI-Kaeyris` (backend, FastAPI + SQLAlchemy)
- **Émetteur** : Kenan
- **Date** : 2026-06-09
- **Statut** : ✅ **IMPLÉMENTÉ** (backend `main`, PR #13 `codex/013-transcription-edit` — `44b6676`). Approche **A** (override Markdown) retenue. Vérifié 2026-06-09.
- **Priorité** : **MOYENNE** — débloque l'édition de la transcription sur la page (item R3 / story T-d). Le reste du chantier transcription (affichage recollé, labels locuteurs, export `.md`, choix du mode) est déjà couvert par le contrat existant et ne dépend pas de ce handoff.
- **Migration de données** : ✅ faite — colonne `jdr_sessions.edited_transcript_md` (`TEXT` nullable, `models.py:328`).

## ✅ Implémentation livrée (vérifiée dans le repo backend)

Le backend a retenu **l'approche A recommandée** (override Markdown au niveau session, données brutes intactes).

- **Endpoint** : `PUT /services/jdr/sessions/{session_id}/transcription` (`router.py:1263`), réponse `200` + `TranscriptionEditOut`. GM-only.
- **Payload `TranscriptionEditIn`** : `{ "content_md": string }` — `min_length=1` + rejet du blanc (`reject_blank_content`).
- **Réponse `TranscriptionEditOut`** : `{ session_id, content_md, is_edited: true, updated_at }`.
- **Stockage** : `edited_transcript_md` (`TEXT` nullable) sur `jdr_sessions`. `GET /transcription.md` renvoie l'override s'il existe (`router.py:1310`), sinon le rendu auto. Un flag `is_edited` est exposé.
- **⭐ Point produit critique — AC-B3 SATISFAIT** : la génération consomme bien le **texte édité** en priorité. `app/jobs/jdr.py::_load_session_source_document` (l.416-418) renvoie `_edited_transcript_source()` avant de retomber sur chunks (non_diarised) / segments (diarised). Corriger la transcription **impacte** résumé/récit/éléments/POVs. ✅
- **Codes d'erreur** :
  - `404 session-not-found` — session inexistante / autre MJ.
  - `409 session-not-transcribed` — session pas encore `state=transcribed` (rien à éditer).
- **Réinitialisation** : le repository expose un reset (`edited_transcript_md=None`, `repositories.py:523`) qui fait re-rendre l'auto ; pas de verbe `DELETE` HTTP dédié exposé pour l'instant.
- **Côté Web** : nouveau verbe d'écriture dans le contrat (`openapi.json` 2026-06-09). À consommer pour la story édition inline (4.17) → resync contrat + `gen:api`.

## TL;DR

Le MJ veut **corriger la transcription à la main** sur la page (la transcription auto contient des erreurs), puis la **télécharger** et surtout l'utiliser comme **source des générations** (résumé/récit/…). Aujourd'hui la récupération est en **lecture seule** :

- `GET /services/jdr/sessions/{id}/chunks` (non_diarised, chunks ordonnés)
- `GET /services/jdr/sessions/{id}/transcription` (diarised, segments)
- `GET /services/jdr/sessions/{id}/transcription.md` (export Markdown)

**Aucun verbe d'écriture** n'existe (`PUT`/`PATCH` = `never`). Demande : exposer une **persistance d'une transcription éditée**.

## 1. Décision de design à trancher (backend)

Deux approches — le frontend recommande la **A** (la moins invasive) :

- **A — Override Markdown (recommandé).** On stocke un **texte Markdown édité** au niveau session, distinct des données brutes (chunks/segments restent intacts). `GET /transcription.md` renvoie l'override s'il existe, sinon le rendu auto. Édition = un seul champ texte, indépendant du mode (diarised/non_diarised). Simple, réversible (supprimer l'override = revenir à l'auto).
- **B — Édition structurée.** Éditer les chunks/segments en place. Plus fidèle au modèle, mais double le travail (deux formats), complexifie l'UI et la validation. **Écarté** sauf besoin fort.

> ⚠️ **Point clé produit :** l'édition doit **impacter les générations**. Le pipeline de résumé/artefacts doit consommer le **texte édité s'il existe** (sinon corriger la transcription ne sert à rien). À confirmer dans l'implémentation `_generate_summary` & co.

## 2. Demande — endpoint d'écriture (approche A)

`PUT /services/jdr/sessions/{session_id}/transcription` *(ou `…/transcription.md`)* :

```json
{ "content_md": "## Scène 1\n\n**Aldric** : ..." }
```

- **Réponse** : `200` avec la projection transcription à jour (ou `204`).
- **Stockage** : champ texte nullable au niveau session (`edited_transcript_md`) — **migration Alembic probable** (une colonne `TEXT` nullable sur `jdr_sessions`, ou petite table dédiée).
- **Lecture** : `GET /transcription.md` renvoie l'override si présent, sinon le rendu auto. (Optionnel : exposer un flag `is_edited` sur `SessionOut` ou la projection transcription.)
- **Réinitialisation** (optionnel) : `DELETE` ou `content_md: null` pour revenir à l'auto.

### Règles / erreurs

- `404` si la session n'appartient pas au MJ courant.
- `409` si la session n'est pas encore `state=transcribed` (rien à éditer).
- Autoriser l'édition quel que soit le `transcription_mode` (l'override est du Markdown, agnostique du mode).

## 3. Contrat / OpenAPI (bloquant frontend)

- **AC-B1** — `openapi.json` régénéré expose le verbe d'écriture + le schéma de payload (`content_md`). Le frontend régénère via `gen:api`.

## 4. AC testables (backend)

- **AC-B2** — `PUT` d'un `content_md` sur une session transcrite → `200` ; `GET /transcription.md` renvoie ensuite le texte édité.
- **AC-B3** — Une génération de résumé lancée **après** édition consomme le **texte édité** (pas l'auto).
- **AC-B4** — `PUT` sur une session non transcrite → `409` ; sur une session d'un autre MJ → `404`.
- **AC-B5** — (si réinitialisation implémentée) suppression de l'override → `GET /transcription.md` re-renvoie le rendu auto.

## 5. Récap

- **Cœur** : un verbe d'écriture + un stockage de texte édité (approche A recommandée). Migration probable (1 colonne `TEXT` nullable).
- **Point produit critique** : le texte édité doit **alimenter les générations** (AC-B3), sinon l'édition est cosmétique.
- **Bloquant frontend** : AC-B1 (contrat) pour la story T-d (édition inline).
