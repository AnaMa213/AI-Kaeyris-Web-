# Backend Handoff — BD-16 : identifiants publics opaques (slug) pour campagnes & séances

- **Repo source** : `AI-Kaeyris-Web` (frontend)
- **Repo cible** : `AnaMa213/AI-Kaeyris` (backend, FastAPI + SQLAlchemy)
- **Émetteur** : Kenan
- **Date** : 2026-06-13
- **Statut** : 🟡 **DEMANDÉ** — non implémenté. Bloque la Story 4.20 (URLs propres).
- **Priorité** : **BASSE** — confort/esthétique d'URL, aucune fonctionnalité produit bloquée. À planifier hors chemin critique (Epic 5/6).
- **Migration de données** : OUI (ajout de colonnes + backfill). Voir §3.

## TL;DR

Les routes frontend sont aujourd'hui **clés par UUID** :

```
/jdr/campaigns/{campId}/sessions/{sid}
```

où `campId` et `sid` sont les UUID bruts exposés dans `CampaignOut.id` / `SessionOut.id`.
La Story 4.20 (« Hide raw UUID in URLs ») veut des URLs propres **sans** UUID dans la
barre d'adresse. Côté frontend seul, on ne peut pas masquer l'UUID sans casser le routing
ou maintenir une table de correspondance fragile. Il faut un **identifiant public opaque
et stable** (slug ou short-id) fourni par le backend, **en plus** de l'UUID interne.

## 1. Demande — un identifiant public par ressource routable

Ajouter un champ `public_id` (ou `slug`) **stable**, **unique par périmètre**, et **sûr pour
une URL** sur les deux ressources qui apparaissent dans le chemin :

- `CampaignOut.public_id`
- `SessionOut.public_id`

**Caractéristiques attendues :**

- **Opaque** : ne révèle pas l'UUID interne ni un compteur séquentiel devinable
  (préférer un short-id type base32/nanoid de 8–12 caractères, ou un slug dérivé du titre
  + suffixe court anti-collision).
- **Stable** : ne change jamais après création (les URLs partagées doivent rester valides).
  ⇒ si dérivé du titre, le slug **ne suit pas** les renommages ultérieurs (le titre change,
  le slug reste).
- **Unique** : globalement pour les campagnes ; **par campagne** pour les séances suffit
  (le chemin porte déjà le `campId`).
- **Résolvable** : les endpoints `GET` doivent accepter le `public_id` **ou** l'UUID
  (voir §2), pour ne pas casser les liens existants pendant la transition.

## 2. Résolution côté API (au choix backend, à confirmer)

Deux options — **option A recommandée** (moindre surface de changement) :

- **Option A — résolution polymorphe sur les endpoints existants.**
  `GET /services/jdr/campaigns/{id}` et `GET /services/jdr/sessions/{id}` acceptent
  indifféremment l'UUID **ou** le `public_id`. Le frontend route avec le `public_id` et
  passe la valeur telle quelle au `GET`. Aucun nouvel endpoint.

- **Option B — endpoints de lookup dédiés.**
  `GET /services/jdr/campaigns/by-slug/{slug}` → `CampaignOut`, idem séances.
  Plus explicite mais ajoute des routes et un aller-retour de résolution.

> Décision à acter par le backend. Le frontend s'adapte aux deux ; A demande moins de code
> des deux côtés.

## 3. Migration de données

- Ajouter la colonne `public_id` (indexée, `UNIQUE` selon le périmètre §1) sur `campaigns`
  et `sessions`.
- **Backfill** : générer un `public_id` pour toutes les lignes existantes.
- Générer automatiquement le `public_id` à la création (POST campaign / POST session).

## 4. Contrat / OpenAPI (bloquant frontend)

- **AC-B1** — `docs/context/api/openapi.json` régénéré expose `CampaignOut.public_id` et
  `SessionOut.public_id` (string, non nullable une fois le backfill fait). Le frontend
  régénère ses types via `gen:api` + `check:api-types`.
- **AC-B2** — (si Option A) les `GET` by-id documentent qu'ils acceptent UUID **ou**
  `public_id`.

## 5. AC testables (backend)

- **AC-B3** — `POST /campaigns` et `POST /sessions` renvoient un `public_id` non vide, stable.
- **AC-B4** — Renommer une ressource ne change **pas** son `public_id`.
- **AC-B5** — (Option A) `GET …/{public_id}` et `GET …/{uuid}` renvoient la **même** ressource.
- **AC-B6** — Collision de slug gérée (suffixe anti-collision déterministe ou retry).

## 6. Récap

- **Cœur** : un champ public opaque/stable par ressource routable (campagne + séance),
  + résolution by-slug (Option A recommandée : polymorphe sur les `GET` existants).
- **Bloquant frontend** : AC-B1 (contrat) avant de pouvoir livrer la Story 4.20.
- **Non urgent** : aucune feature produit ne dépend de ce handoff ; pur confort d'URL.
- **Frontend en attente** : Story 4.20 reste `blocked-on-backend` jusqu'à la livraison +
  resync `openapi.json`.
