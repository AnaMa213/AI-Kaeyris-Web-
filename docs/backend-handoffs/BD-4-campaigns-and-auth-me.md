# Backend Handoff — BD-4 : Campaigns + memberships + /auth/me

**Repo source :** `AI-Kaeyris-Web` (frontend Next.js)
**Repo cible :** `AnaMa213/AI-Kaeyris` (backend FastAPI)
**Émetteur :** Kenan
**Date :** 2026-05-29
**Statut :** ready-for-backend
**Priorité :** **bloquant pour Story 1.11 runtime** (frontend peut mocker pendant le dev, mais le runtime end-to-end exige le contrat live)
**Référence interne :** `_bmad-output/planning-artifacts/prds/prd-AI-Kaeyris-Web--2026-05-22/backend-modifications.md` §BD-4

---

## TL;DR

Ajouter au backend JDR la notion de **campagne** comme unité de multi-tenancy : 2 nouvelles tables (`campaigns`, `campaign_members`), 1 colonne sur `users` (`default_campaign_id`), 1 nouvel endpoint `GET /services/jdr/auth/me` qui retourne le triplet `{ user, campaign, role }`, et filtrage par `campaign_id` sur tous les endpoints JDR existants.

Côté V1, **une seule campagne en DB**. Tous les users existants (Kenan + ses joueurs) sont automatiquement membres de cette campagne. Aucune UI de gestion de campagne côté frontend en V1. Le modèle N↔N existe en DB pour préparer V2 (un user pourra être MJ sur une campagne et joueur sur une autre) sans casser V1.

---

## Pourquoi

Le frontend amorce sa V2 en standalone (un seul service JDR), mais doit **dès aujourd'hui** publier un hook `useCurrentUser()` qui retourne un triplet `{ authId, campaignId, role }`. Ce hook est consommé par tous les composants JDR (sidebar, header, queries TanStack…).

**Le contrat doit survivre à la migration future** vers un Hub multi-tenant. Si le frontend bootstrappe ce hook sur un fake (genre `useCurrentUser = () => ({ role: 'mj' })`), on devra refactoriser N composants au moment où le vrai contexte multi-campagne arrivera. Or on n'a pas envie de faire ça plus tard.

Le moyen le plus simple de ne pas avoir à refactoriser plus tard : **le backend expose la forme finale du contrat dès la V1**, même si la DB ne contient qu'une seule campagne et un seul user power.

Trajectoire produit :
- **V1 (maintenant)** : Kenan + ses joueurs sur HA campagne. 1 row dans `campaigns`. Single-tenant en pratique.
- **V2 (Hub futur)** : Plusieurs MJs gèrent leurs campagnes indépendamment. Un user peut être MJ sur la campagne A et joueur sur la campagne B. Multi-tenant via `campaign_id`. Le Hub vivra dans un repo séparé avec une UI propre ; le backend JDR actuel deviendra un service consommé.

Le N↔N (`campaign_members`) supporte V2 nativement. V1 a juste 1 row par user.

---

## Schéma SQL

### Nouvelle table `campaigns`

```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Nouvelle table `campaign_members` (N↔N)

```sql
CREATE TABLE campaign_members (
  user_id UUID NOT NULL REFERENCES users(id),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  role TEXT NOT NULL CHECK (role IN ('mj', 'player')),
  character_id UUID,  -- nullable pour MJ ; renseigné pour player (chaque joueur EST un personnage)
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, campaign_id)
);

CREATE INDEX idx_campaign_members_campaign ON campaign_members(campaign_id);
CREATE INDEX idx_campaign_members_user ON campaign_members(user_id);
```

**Notes :**
- `role` valide : `'mj'` ou `'player'` (vocabulaire FR-friendly, pas `'gm'`/`'player'` mélangés — cohérent avec le profile existant côté backend).
- `character_id` nullable car en V1 un MJ n'a pas de personnage. En V2 il pourra en avoir un dans une autre campagne où il est joueur.

### Colonne ajoutée à `users`

```sql
ALTER TABLE users ADD COLUMN default_campaign_id UUID REFERENCES campaigns(id);
```

`default_campaign_id` = la campagne sur laquelle l'utilisateur "arrive" après login. V1 : pointe toujours vers l'unique campagne seedée. V2 : modifiable par l'utilisateur via UI Hub.

### Seed V1

```sql
-- Créer LA campagne V1 (id fixe pour traçabilité)
INSERT INTO campaigns (id, name, owner_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'Campagne par défaut', <kenan_user_id>);

-- Migrer les users existants vers campaign_members selon leur profile actuel
--   profile='gm'   → role='mj'
--   profile='user' → role='player'
INSERT INTO campaign_members (user_id, campaign_id, role)
SELECT id, '00000000-0000-0000-0000-000000000001',
       CASE WHEN profile = 'gm' THEN 'mj' ELSE 'player' END
FROM users;

-- Pointer default_campaign_id de tous les users vers la V1 campaign
UPDATE users SET default_campaign_id = '00000000-0000-0000-0000-000000000001';
```

---

## Nouvel endpoint : `GET /services/jdr/auth/me`

Endpoint authentifié (consomme le cookie de session existant, BD-1).
Pas de paramètres. Retourne le contexte courant.

### Réponse 200

```json
{
  "user": {
    "id": "11111111-2222-3333-4444-555555555555",
    "username": "kenan"
  },
  "active_campaign": {
    "id": "00000000-0000-0000-0000-000000000001",
    "name": "Campagne par défaut",
    "role": "mj",
    "character_id": null
  }
}
```

### Résolution de `active_campaign`

Algorithme côté backend :
1. Si `users.default_campaign_id` est renseigné → l'utiliser.
2. Sinon → prendre la première ligne `campaign_members` de cet user (ordering déterministe, ex. `ORDER BY joined_at ASC`).
3. Sinon → retourner 200 avec `active_campaign: null`. Le frontend traitera ça comme `useCurrentUser() = { status: 'unauthenticated' }` (pas de contexte = pas d'opération JDR possible).

`role` et `character_id` proviennent du row `campaign_members` matchant `(user_id, campaign_id)`.

### Réponse 401

Si pas authentifié → 401 Problem Details RFC 9457 (comme tous les autres endpoints protégés).
Côté frontend, l'`AuthInterceptor` (Story 1.9 déjà livrée) capte ça et redirige vers `/login?expired=true`.

---

## Filtering scope sur les endpoints existants

**Tous les endpoints JDR data doivent filter par `campaign_id = active_campaign.id`** — dérivé du cookie de session (pas du body, pas d'un query param).

Endpoints concernés (non-exhaustif, suivre l'OpenAPI actuel) :
- `GET /services/jdr/sessions` → ne retourner que les sessions de la campagne active
- `POST /services/jdr/sessions` → assigner automatiquement le `campaign_id` de la campagne active (le body ne contient PAS `campaign_id`)
- `GET /services/jdr/pjs` → idem
- `GET /services/jdr/users` → idem (mais voir note plus bas sur Story 1.10)
- `POST /services/jdr/sessions/{id}/players` → idem
- etc.

V1 : toutes les queries filtrent par l'unique campaign id seedée. V2 : chaque requête lit la campagne active dans la session et filtre dessus.

**Important :** ne pas exposer `campaign_id` dans les request bodies pour les opérations de création. Le backend le déduit du cookie. Ça évite de polluer les contrats API V1 avec un champ qui n'est pas configurable côté frontend.

---

## Impact sur Story 1.10 (Users CRUD déjà livrée)

Les endpoints `/services/jdr/users` (POST/GET/PATCH/DELETE) livrés dans BD-3 (2026-05-27) sont **inchangés au niveau du contrat API**. Mais leur implémentation doit être adaptée :

- **`POST /services/jdr/users`** : un nouvel user créé doit être automatiquement ajouté à la campagne par défaut (`campaign_members` insert avec `role` dérivé du `profile` envoyé).
- **`DELETE /services/jdr/users/{id}`** (qui est en réalité un soft-delete) : conserver le row `campaign_members` pour audit, mais flagger l'user inactif (champ existant `is_active`).
- **`GET /services/jdr/users`** : filtrer par campagne active (V1 = tous les users sont dans la même campagne donc impact nul ; V2 = filtrage critique).

---

## Hors-scope de BD-4 (à ne PAS implémenter)

Pour éviter le scope-creep et garder BD-4 atomique :

- **PAS d'UI de gestion de campagnes** côté frontend. Pas de `POST /campaigns` exposé en V1. Création de la campagne = seul moyen = la migration seed ci-dessus.
- **PAS de multi-campagne par user en V1.** La table `campaign_members` supporte plusieurs rows par user, mais la migration V1 n'en insère qu'une seule.
- **PAS de notion de tenant/organization au-dessus des campagnes.** Pas de table `tenants` ou `organizations`. La campagne EST l'unité de multi-tenancy.
- **PAS d'endpoint `PATCH /users/{id}/default_campaign_id`.** Ce sera utile en V2 quand l'UI permettra de switcher, pas avant.
- **PAS d'endpoint pour la liste des memberships d'un user.** Pareil — V2.

---

## Quality gate côté backend

Avant de marquer BD-4 livré, vérifier :

1. ✅ Migration applicable sur une DB existante avec les users actuels (test sur DB de dev).
2. ✅ `GET /auth/me` retourne le contrat attendu pour Kenan (role: 'mj') et pour un user joueur.
3. ✅ Tous les endpoints existants filtrent correctement par campagne (test : créer une 2e campagne factice en SQL, créer une session dedans, vérifier qu'elle n'apparaît PAS dans `GET /sessions` quand authentifié comme un membre de la campagne 1).
4. ✅ `POST /services/jdr/sessions` (ou équivalent) ne nécessite PAS de `campaign_id` dans le body.
5. ✅ Mettre à jour `docs/context/api/openapi.json` côté backend pour refléter le nouvel endpoint `/auth/me`. Le frontend régénère ses types depuis cet OpenAPI.
6. ✅ Update du seed pour dev local (`scripts/seed.py` ou équivalent backend).

---

## Frontend mock pendant l'attente

En attendant BD-4 livré, le frontend mockera `/services/jdr/auth/me` à l'API client layer dans `lib/core/api/mocks/auth-me.ts` (Story 1.11). Le mock retournera une réponse statique conforme au contrat ci-dessus. Quand BD-4 est shippé, on retire le mock — aucun changement requis dans les composants.

---

## Questions ouvertes côté backend

Si l'équipe backend a besoin de clarifications, ces questions sont attendues :

- **Faut-il préserver le champ `profile` (`'gm'` / `'user'`) sur la table `users` ou le retirer ?**
  → Recommandation : le préserver V1 (compatibilité ascendante), le retirer en V2 quand `campaign_members.role` est la source unique de vérité. Pas de breaking change V1.

- **Stratégie de cache pour `/auth/me`** ?
  → Recommandation : `Cache-Control: no-store`. Le frontend le cache via TanStack Query avec un `staleTime` court (~5 min). Tout changement de membership invalide la query.

- **Création de campagne via script de seed uniquement, ou endpoint admin ?**
  → V1 : script seed uniquement. V2 : sera traité côté Hub.

---

## Contact

Pour toute question, ouvrir une issue sur le repo backend ou contacter Kenan directement.

Source de vérité côté frontend : `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-29.md` (Sprint Change Proposal approuvé 2026-05-29).
