# Backend Handoff — BD-12 : édition d'un PJ (`PATCH /services/jdr/pjs/{pj_id}`)

- **Repo source** : `AI-Kaeyris-Web` (frontend)
- **Repo cible** : `AnaMa213/AI-Kaeyris` (backend, FastAPI + SQLAlchemy)
- **Émetteur** : Kenan
- **Date** : 2026-06-09
- **Statut** : ✅ **IMPLÉMENTÉ** (backend `main`, PR #12 `codex/012-pj-update` — `268c440`). Vérifié 2026-06-09.
- **Priorité** : **MOYENNE** — débloque l'édition des PJ et leur rattachement à un compte joueur (cluster ID de l'Epic 4 bis).
- **Migration de données** : NONE — le champ `user_id` existe **déjà** sur le modèle PJ. Seul un verbe d'écriture a été ajouté.

## ✅ Implémentation livrée (vérifiée dans le repo backend)

- **Endpoint** : `PATCH /services/jdr/pjs/{pj_id}` (`router.py:999`), réponse `200` + `PjOut`. GM-only (`require_gm`).
- **Schéma `PjUpdate`** (`schemas.py:253`) — partial update, basé sur `model_fields_set` (un champ absent n'est pas touché) :
  - `name?: string` (min 1, max 255)
  - `user_id?: UUID | null` — `null` explicite ⇒ **délie** le PJ de son compte joueur.
- **Codes d'erreur** (conformes à la demande) :
  - `404 pj-not-found` — PJ inexistant ou n'appartenant pas au MJ courant (couvre aussi `PjForbiddenError`/`CampaignAccessError`).
  - `409 duplicate-pj` — collision de `name` avec un autre PJ du même MJ.
  - `422 invalid-user` — `user_id` ne référence aucun utilisateur connu.
- **Hors périmètre** : `DELETE /pjs/{pj_id}` toujours **non livré** (non demandé) — voir §2.
- **Côté Web** : nouveau verbe dans le contrat backend (`openapi.json` 2026-06-09). À consommer pour la story « PJ éditable + lien joueur » (4.16) → resync `openapi.json` + `gen:api` requis (voir note de fin).

## TL;DR

Un PJ est aujourd'hui **création seule** : `POST /services/jdr/pjs` (avec `name`, `campaign_id?`, `user_id?`) et `GET /services/jdr/pjs`. **Aucun endpoint d'édition** n'existe (`PUT`/`PATCH /pjs/{pj_id}` = `never` dans le contrat). Or le produit a besoin qu'un PJ soit **modifiable** : le **renommer** et surtout **(dé)associer un compte utilisateur** (`user_id`) après coup.

Le champ `user_id` étant **déjà** dans `PjCreate`/`PjOut`, la demande se limite à exposer une **mise à jour partielle**.

## 1. Demande — `PATCH /services/jdr/pjs/{pj_id}`

Mise à jour partielle d'un PJ appartenant au MJ courant.

**Request body** (tous champs optionnels — partial update) :

```json
{
  "name": "Aragorn",
  "user_id": "1f2e..."   // ou null pour délier
}
```

**Réponse** : `200` avec le `PjOut` à jour.

**Règles / codes d'erreur** (aligner sur l'existant `POST /pjs`) :

- `404` si le PJ n'appartient pas au MJ courant.
- `409 duplicate-pj` si le `name` entre en collision avec un autre PJ du même MJ.
- `422 invalid-user` si `user_id` ne correspond à aucun utilisateur connu (réutiliser la validation du `user_id` de `POST /pjs`).
- `user_id: null` explicite ⇒ **délier** le PJ de son utilisateur.

## 2. Optionnel (à confirmer) — `DELETE /services/jdr/pjs/{pj_id}`

Il n'existe pas non plus de suppression de PJ. **Non requis** par l'Epic 4 bis immédiate (le frontend ne le demande pas encore), mais à signaler : si une suppression devient nécessaire, prévoir l'invariant (que faire des PJ référencés dans un `mapping` diarisé ou une liste `players` non_diarisée ?). **Ne pas livrer tant que le front ne le demande pas.**

## 3. Contrat / OpenAPI (bloquant frontend)

- **AC-B1** — `docs/context/api/openapi.json` régénéré expose `PATCH /services/jdr/pjs/{pj_id}` avec un schéma `PjUpdate` (`name?`, `user_id?` nullable) et la réponse `PjOut`. Le frontend régénère ses types via `gen:api`.

## 4. AC testables (backend)

- **AC-B2** — `PATCH` du `name` d'un PJ du MJ → `200`, `PjOut.name` à jour.
- **AC-B3** — `PATCH` `user_id` vers un user valide → `200`, `PjOut.user_id` renseigné ; `user_id: null` → délié.
- **AC-B4** — `PATCH` d'un PJ d'un autre MJ → `404`.
- **AC-B5** — `PATCH` `name` en doublon (même MJ) → `409 duplicate-pj`.
- **AC-B6** — `PATCH` `user_id` inconnu → `422`.

## 5. Récap

- **Cœur** : un seul verbe à ajouter (`PATCH /pjs/{pj_id}`), partial update `name` + `user_id`. Le champ `user_id` existe déjà → pas de migration.
- **Bloquant frontend** : AC-B1 (contrat) pour la story Epic 4 bis « PJ éditable + lien joueur ».
- **Hors périmètre** : suppression de PJ (§2) — à demander séparément si besoin.
