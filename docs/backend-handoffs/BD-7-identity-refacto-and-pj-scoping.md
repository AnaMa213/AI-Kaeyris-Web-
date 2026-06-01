# Backend Handoff — BD-7 : Identity refacto + PJs scoping

**Repo source :** `AI-Kaeyris-Web` (frontend Next.js)
**Repo cible :** `AnaMa213/AI-Kaeyris` (backend FastAPI)
**Émetteur :** Kenan
**Date :** 2026-06-01
**Statut :** ready-for-backend
**Priorité :** **bloquant** pour la suite Epic 2 (Stories 2.5+). Frontend Story 2.4 (Campagnes list+create) reste fonctionnelle pendant BD-7.
**Migration de données :** **NONE — purge** (drop+recreate des tables impactées). Kenan a accepté de perdre les données locales/staging existantes.
**Référence interne :** `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-01.md`

---

## TL;DR

Le modèle d'identité actuel conflate deux concepts orthogonaux : (a) "qui peut administrer le portail" (= créer/gérer des comptes user) et (b) "qui maîtrise telle campagne". BD-7 sépare ces deux dimensions :

- **Système** : `users.system_role: "admin" | "user"` — global au compte.
- **Campagne** : `campaign_members.role: "gm" | "pj"` — par membership campagne (déjà livré BD-4 avec valeur `"gm" | "player"` — à renommer en `"gm" | "pj"`).

De plus, les PJs deviennent scopés campagne (`jdr_pjs.campaign_id` NOT NULL) et associables à un user joueur (`jdr_pjs.user_id` NULLABLE).

---

## 1. Schema changes

### 1.1 — `users.profile` → `users.system_role`

**Avant** :
```sql
ALTER TABLE jdr_users ADD COLUMN profile VARCHAR NOT NULL;
-- valeurs : 'gm' | 'user'
```

**Après** :
```sql
ALTER TABLE jdr_users RENAME COLUMN profile TO system_role;
-- nouveau enum :
CREATE TYPE jdr_system_role AS ENUM ('admin', 'user');
ALTER TABLE jdr_users ALTER COLUMN system_role TYPE jdr_system_role USING system_role::jdr_system_role;
-- ⚠ migration de données NON requise : Kenan purge la DB avant déploiement.
```

Sémantique :
- `admin` : peut créer/lister/éditer/supprimer des comptes via `/services/jdr/users/*`
- `user` : compte standard, peut créer ses propres campagnes et y être membre

### 1.2 — `campaign_members.role` valeurs alignées

**Avant (BD-4)** : `'gm' | 'player'`
**Après** : `'gm' | 'pj'` — alignement avec le terme JDR français "PJ"

```sql
-- Si enum déclaré côté Postgres
ALTER TYPE jdr_campaign_role RENAME VALUE 'player' TO 'pj';
-- Ou si stocké en VARCHAR : drop+recreate via purge
```

### 1.3 — `jdr_pjs.campaign_id` NOT NULL

**Avant** : pas de colonne campaign_id sur `jdr_pjs`.
**Après** :
```sql
ALTER TABLE jdr_pjs ADD COLUMN campaign_id UUID NOT NULL
  REFERENCES jdr_campaigns(id) ON DELETE CASCADE;
CREATE INDEX idx_jdr_pjs_campaign_id ON jdr_pjs(campaign_id);
```

### 1.4 — `jdr_pjs.user_id` NULLABLE

```sql
ALTER TABLE jdr_pjs ADD COLUMN user_id UUID NULL
  REFERENCES jdr_users(id) ON DELETE SET NULL;
CREATE INDEX idx_jdr_pjs_user_id ON jdr_pjs(user_id);
```

Sémantique : un PJ peut être créé sans joueur attribué (`user_id IS NULL`). Le gm assigne plus tard via `PATCH /pjs/{id}` (story future, hors BD-7 endpoint-wise).

---

## 2. Endpoints — autorisation reformulée

### 2.1 — `/services/jdr/users/*` — admin-only

| Endpoint | Avant | Après |
|---|---|---|
| `GET /users` | Auth requise (legacy : "gm" implicit check) | Auth requise **+ `system_role = "admin"`** sinon 403 |
| `POST /users` | idem | idem |
| `PATCH /users/{id}` | idem | idem |
| `DELETE /users/{id}` | idem | idem |

### 2.2 — `/services/jdr/campaigns/*` — auth user

| Endpoint | Auth requise |
|---|---|
| `GET /campaigns` | Auth (retourne campagnes où user est membre) — inchangé BD-6 |
| `POST /campaigns` | Auth, **tout user peut créer** une campagne et devient automatiquement `gm` (cf. BD-6) |
| `GET /campaigns/{id}` | Auth + user est membre (gm OU pj) |
| `PATCH /campaigns/{id}` | Auth + user est `gm` de cette campagne |
| `DELETE /campaigns/{id}` | Auth + user est `gm` de cette campagne. Refus si sessions existent (cf. SCP 2026-05-31 H5). |

### 2.3 — `/services/jdr/sessions/*` — campaign-scoped

Inchangé BD-6 mais autorisation **par campagne** :
- `POST /sessions` : `gm` de la campagne référencée par `campaign_id` body
- `PATCH /sessions/{id}`, `DELETE /sessions/{id}/audio`, etc. : `gm` de la campagne de la session
- `GET /sessions?campaign_id=` : membership (gm OU pj) de la campagne demandée

### 2.4 — `/services/jdr/pjs/*` — campaign-scoped (V1 + rétro-compat)

| Endpoint | Comportement V1 | Note |
|---|---|---|
| `GET /pjs` (sans filtre) | Retourne tous les PJs des campagnes où l'user est membre (gm OU pj). | **Rétro-compat Stories 2.1+2.2** — Kenan a décidé que les PJs globaux V1 restent fonctionnels. Le frontend Stories 2.1+2.2 n'ajoute pas le filtre. |
| `GET /pjs?campaign_id={uuid}` | Filtre sur cette campagne. Auth : membership (gm OU pj) de la campagne. | **Anticipation Story 2.X** — quand le frontend livre la version scopée. |
| `POST /pjs` | Body `{ name, campaign_id, user_id? }`. `campaign_id` requis. Auth : `gm` de la campagne. | **Backward-incompatible** : Stories 2.1+2.2 frontend devra envoyer `campaign_id` au POST. ⚠ Voir Section 3 ci-dessous. |
| `PATCH /pjs/{id}` | Accepte `{ name?, user_id? }`. Auth : `gm` de la campagne du PJ. | Hors-scope V1 endpoint (Story 2.X future). |
| `DELETE /pjs/{id}` | Auth : `gm` de la campagne du PJ. | V1 mocked côté frontend (BD-3), backend pas appelé. |

### 2.5 — `/services/jdr/auth/me` — étendu

**Avant (BD-6)** :
```json
{
  "user": { "id": "...", "username": "..." },
  "active_campaign": {
    "id": "...",
    "name": "...",
    "role": "gm" | "player",
    "character_id": "..." | null
  } | null
}
```

**Après (BD-7)** :
```json
{
  "user": {
    "id": "...",
    "username": "...",
    "system_role": "admin" | "user"
  },
  "active_campaign": {
    "id": "...",
    "name": "...",
    "role": "gm" | "pj",
    "character_id": "..." | null
  } | null
}
```

Changements :
1. `user.system_role` ajouté.
2. `active_campaign.role` renommé de `"player"` à `"pj"`.

---

## 3. ⚠ Impact rétro-compat Stories 2.1+2.2 (PJs frontend déjà livrés)

Stories 2.1+2.2 (frontend) ont livré `/jdr/pjs` qui :
- `GET /pjs` → 200 avec liste de PJs
- `POST /pjs` body `{ name: string }`
- `DELETE /pjs/{id}` mocked V1

Si BD-7 rend `campaign_id` **requis** au `POST /pjs`, le POST frontend Stories 2.1+2.2 va échouer en 422.

**Option A (recommandée)** : `POST /pjs` backend accepte `campaign_id` optionnel V1 ; si absent, le backend l'assigne à `default_campaign_id` du current user (le seed Kenan). Compatible avec Stories 2.1+2.2 sans modification frontend immédiate.

**Option B** : `campaign_id` strictement requis. Frontend Stories 2.1+2.2 amend en parallèle de BD-7 livré pour passer `useCurrentUser().auth.defaultCampaignId`.

**Recommandation Winston** : **Option A**. Évite breaking change frontend + cohérent avec le pattern BD-4 default_campaign_id. La rigidité viendra en Story 2.X future quand on refactore PJs sous `/jdr/campaigns/[id]/pjs`.

---

## 4. Schemas Pydantic (à exposer dans openapi.json)

```python
class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    system_role: Literal["admin", "user"]
    password: str = Field(min_length=8)

class UserPatch(BaseModel):
    username: str | None = None
    system_role: Literal["admin", "user"] | None = None
    password: str | None = None

class UserOut(BaseModel):
    id: UUID
    username: str
    system_role: Literal["admin", "user"]
    created_at: datetime
    updated_at: datetime

class AuthMeUserOut(BaseModel):
    id: UUID
    username: str
    system_role: Literal["admin", "user"]

class AuthMeCampaignOut(BaseModel):
    id: UUID
    name: str
    role: Literal["gm", "pj"]
    character_id: UUID | None

class AuthMeOut(BaseModel):
    user: AuthMeUserOut
    active_campaign: AuthMeCampaignOut | None

class PjCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    campaign_id: UUID | None = None   # Option A — optionnel V1, default fallback
    user_id: UUID | None = None

class PjPatch(BaseModel):
    name: str | None = None
    user_id: UUID | None = None       # rebind / orphan

class PjOut(BaseModel):
    id: UUID
    name: str
    campaign_id: UUID
    user_id: UUID | None
    created_at: datetime
```

---

## 5. Acceptance Criteria

1. **AC1** — `users.system_role` enum `(admin, user)` en place, ancien `profile` retiré.
2. **AC2** — `campaign_members.role` enum `(gm, pj)` en place, valeur `player` retirée.
3. **AC3** — `jdr_pjs.campaign_id` NOT NULL + index.
4. **AC4** — `jdr_pjs.user_id` NULLABLE + index + ON DELETE SET NULL.
5. **AC5** — `/users` endpoints check `system_role = admin` ; 403 sinon avec Problem Details cohérent (`title: "Forbidden — admin required"`).
6. **AC6** — `/auth/me` retourne `user.system_role` et `active_campaign.role: "gm" | "pj"`.
7. **AC7** — `POST /campaigns` ne demande PAS `system_role = admin`. Tout user authentifié peut créer.
8. **AC8** — `POST /pjs` accepte `campaign_id` optionnel (fallback `users.default_campaign_id`) — Option A.
9. **AC9** — `GET /pjs` (sans filtre) reste fonctionnel : retourne PJs des campagnes où l'user est membre.
10. **AC10** — `openapi.json` régénéré et committé sur `docs/context/api/openapi.json` côté backend repo OU envoyé à Kenan pour sync frontend.
11. **AC11** — Kenan re-seede 1 user admin (`admin/admin`) + 1 campagne par défaut + Kenan inscrit en `gm` après purge.

---

## 6. Estimation

~2 à 3 jours backend :
- 0.5 jour : schema rename + nouveaux enums + DROP+CREATE des tables impactées (pas de migration data)
- 0.5 jour : Pydantic schemas + endpoints update
- 0.5 jour : autorisation reformulée (admin check + campaign_members check)
- 0.5 jour : tests + rétro-compat `GET /pjs` sans filtre + `POST /pjs` Option A
- 0.5 jour : openapi régénération + seed user admin

---

## 7. Hors-scope BD-7

- **PATCH /pjs/{id}** : déclaré mais l'endpoint n'a pas besoin d'être livré tant que la Story 2.X frontend n'arrive pas. Si le backend peut le livrer "gratis" en même temps, bonus.
- **Audit log admin** (qui a créé/modifié quels users quand) : V2.
- **Soft-delete users** : V2.
- **Invitation flow** (admin envoie email à futur user pour qu'il s'inscrive) : V2.
- **Système RBAC fin** (custom roles, permissions à la carte) : V2.
- **PJ inheritance cross-campagne** (un même perso joué dans 2 campagnes parallèles) : pas prévu, chaque campagne a ses PJs.
