# Backend Handoff — BD-6 : Campaigns CRUD + Sessions filter by campaign_id

**Repo source :** `AI-Kaeyris-Web` (frontend Next.js)
**Repo cible :** `AnaMa213/AI-Kaeyris` (backend FastAPI)
**Émetteur :** Kenan
**Date :** 2026-05-31
**Statut :** ready-for-backend
**Priorité :** **bloquant** pour le pivot UX "Sessions → Campagnes" (SCP 2026-05-31). Frontend peut mocker pendant le dev local, mais le runtime end-to-end exige le contrat live.
**Référence interne :** `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-31.md`

---

## TL;DR

BD-4 a livré la table `campaigns` + `campaign_members` + `users.default_campaign_id` + l'endpoint `/auth/me` qui retourne `active_campaign`. Mais **aucun endpoint CRUD `/campaigns`** n'a été exposé — c'était volontaire dans BD-4 ("V1 = 1 seule campagne par défaut, pas d'UI").

Le SCP 2026-05-31 change la décision V1 : l'utilisateur doit pouvoir voir la liste de ses campagnes et créer/sélectionner une campagne. Donc :

1. **Nouveaux endpoints `/services/jdr/campaigns`** (list + create + get + patch + delete).
2. **Filtrage des sessions par `campaign_id`** : `GET /services/jdr/sessions?campaign_id={uuid}` + `POST /services/jdr/sessions` doit accepter `campaign_id` dans le body.
3. **PJs restent globaux à l'utilisateur** V1 (pas de scope campagne) — confirmation produit ci-dessous.

---

## Périmètre détaillé

### 1. `GET /services/jdr/campaigns` — list current user's campaigns

**Auth :** cookie session requis (cohérent avec les autres endpoints JDR).

**Réponse 200 :**
```json
{
  "items": [
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "name": "Les Royaumes Brisés",
      "description": "Un royaume autrefois uni se déchire...",
      "role": "gm",
      "session_count": 12,
      "last_session_at": "2026-05-29T18:30:00Z",
      "created_at": "2026-01-12T18:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "size": 50
}
```

**Comportement :**
- Liste toutes les campagnes où l'utilisateur courant est membre (via `campaign_members`).
- `role` = rôle du current user dans cette campagne (`"gm"` ou `"player"`, cohérent avec BD-4 `campaign_members.role`).
- `session_count` = count des sessions liées à cette campagne (jointure ou aggregate côté backend).
- `last_session_at` = `max(sessions.recorded_at)` pour cette campagne, ou `null` si aucune.
- Réponse `Page_CampaignOut_` cohérente avec `Page_SessionOut_` / `Page_PjOut_` existants.

### 2. `POST /services/jdr/campaigns` — create campaign

**Auth :** cookie session requis.

**Body :**
```json
{
  "name": "Les Royaumes Brisés",
  "description": "Un royaume autrefois uni se déchire..."
}
```

**Comportement :**
- Validation : `name` requis (min 1, max 200), `description` optionnel (max 4000).
- Crée la ligne `campaigns` + crée la ligne `campaign_members` avec `role = "gm"` pour le current user (le créateur est automatiquement MJ de sa campagne).
- Réponse 201 retourne `CampaignOut` (même shape que dans le list, avec `session_count = 0` et `last_session_at = null`).
- 409 si le user a déjà une campagne avec le même nom (contrainte UX-friendly, optionnelle si trop chère côté backend).

### 3. `GET /services/jdr/campaigns/{campaign_id}` — fetch one

**Auth :** cookie session + l'user doit être membre.

**Réponse 200 :** `CampaignOut` (même shape que la list).

**Erreurs :**
- 403 : user non-membre de la campagne.
- 404 : campagne inexistante.

### 4. `PATCH /services/jdr/campaigns/{campaign_id}` — update name/description

**Auth :** cookie session + l'user doit être **MJ** de cette campagne (`campaign_members.role = "gm"`).

**Body :**
```json
{
  "name": "Les Royaumes Brisés (Tome II)",
  "description": "Suite de la première campagne."
}
```

**Comportement :**
- Champs partiels acceptés (comme `PATCH /sessions/{id}`).
- 403 si le user est seulement joueur sur la campagne.

### 5. `DELETE /services/jdr/campaigns/{campaign_id}` — delete campaign (cascade)

**Auth :** cookie session + l'user doit être MJ.

**Comportement :**
- **Confirmation produit nécessaire** : on cascade les sessions/artefacts liés ? Ou on refuse si des sessions existent ?
- Hypothèse V1 : **refuse si `session_count > 0`** (return 409 "Cannot delete: campaign has sessions"). L'UI demandera de supprimer les sessions d'abord. C'est plus sûr et préserve l'historique.
- Plus tard, si Kenan demande, on ajoutera un cascade explicite.

### 6. `GET /services/jdr/sessions` — filter by campaign

**Auth :** cookie session requis (déjà en place).

**Query params :**
- `campaign_id={uuid}` — optionnel; si présent, filtre sur cette campagne uniquement.
- (Si absent, comportement actuel — return all sessions where current user is GM. Mais le frontend pivot ne devrait jamais appeler sans `campaign_id`.)

**Comportement :**
- Filtre `WHERE sessions.campaign_id = ?` et `WHERE current_user is_member of this campaign`.
- 403 si l'user n'est pas membre de la campagne demandée.

### 7. `POST /services/jdr/sessions` — accept `campaign_id` in body

**Body étendu :**
```json
{
  "title": "Session 13 — La crypte oubliée",
  "recorded_at": "2026-05-31T18:00:00Z",
  "transcription_mode": "non_diarised",
  "campaign_id": "11111111-1111-1111-1111-111111111111"
}
```

**Comportement :**
- `campaign_id` devient **requis** (validation pydantic).
- Vérifie que l'user est **MJ** de cette campagne (`campaign_members.role = "gm"`).
- Si non-MJ : 403.
- Migration : les sessions existantes (créées sans `campaign_id` avant BD-6) doivent être associées à la `users.default_campaign_id` du créateur (cohérent BD-4).

---

## Schemas Pydantic à exposer (`openapi.json`)

```python
class CampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)

class CampaignPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)

class CampaignOut(BaseModel):
    id: UUID
    name: str
    description: str | None
    role: Literal["gm", "player"]   # role of current user
    session_count: int
    last_session_at: datetime | None
    created_at: datetime

class Page_CampaignOut_(BaseModel):
    items: list[CampaignOut]
    total: int
    page: int = 1
    size: int = 50
```

---

## Migration des données existantes

V1 a déjà tourné avec une "campagne par défaut" pour Kenan (livrée par BD-4 seed). Les actions :

1. **Renommer** la campagne par défaut V1 en quelque chose comme `"Campagne par défaut"` ou `"Les Royaumes Brisés"` selon préférence Kenan. Choisir un nom narratif (pas `"campaign-default"`).
2. **Migrer toutes les sessions existantes** : si `sessions.campaign_id IS NULL`, le set à `users.default_campaign_id` du créateur. Ne devrait concerner que les sessions créées avant BD-6.
3. **Garder l'invariant** : chaque user a 1 campagne par défaut. Si un user crée une 2e campagne, son `default_campaign_id` peut pointer vers la 1ère ou la nouvelle (décision Kenan via UI).

---

## PJs scope — confirmation produit (V1)

**Hypothèse retenue dans le SCP** : les PJs restent **globaux à l'utilisateur**, pas scopés à une campagne. Donc :
- Pas de colonne `campaign_id` sur `jdr_pjs`.
- L'endpoint `GET /services/jdr/pjs` continue à retourner tous les PJs créés par/pour l'user, indépendamment de la campagne.
- La déclaration de présence (`POST /sessions/{id}/players`) déjà existante (Epic 4) reste inchangée : c'est elle qui relie un PJ à une session (et donc indirectement à une campagne via la session).

**Si cette hypothèse change** (PJs scopés campagne en V1) : il faudra ajouter `campaign_id` à `jdr_pjs` + migration + ajustement des endpoints. C'est un BD-7 séparé.

---

## Endpoints existants impactés

| Endpoint | Impact | Action |
|---|---|---|
| `GET /services/jdr/sessions` | Doit accepter `?campaign_id={uuid}` query param. | ✅ Modifier handler + signature. |
| `POST /services/jdr/sessions` | Doit accepter `campaign_id` dans le body (devient requis). | ✅ Modifier `SessionCreate` Pydantic + handler. |
| `PATCH /services/jdr/sessions/{id}` | Aucun changement (campagne fixée à la création). | Inchangé. |
| `GET /services/jdr/sessions/{id}` | Aucun changement de signature. Backend doit vérifier que l'user est membre de la campagne de cette session. | ✅ Ajouter le check 403. |
| `GET /services/jdr/auth/me` | Continue à retourner `active_campaign`. Optionnel : ajouter `available_campaigns_count` pour UI. | Inchangé (BD-6 ne touche pas `/auth/me`). |
| Tous les `POST /sessions/{id}/...` (audio, players, artifacts) | Backend doit déjà vérifier l'appartenance à la campagne via la session. | Inchangé fonctionnellement. |

---

## Acceptance Criteria

1. **AC1** : Les 5 endpoints `/services/jdr/campaigns` (list, create, get, patch, delete) sont déclarés dans `openapi.json` et opérationnels.
2. **AC2** : `GET /services/jdr/sessions?campaign_id={uuid}` filtre correctement; sans le param, comportement actuel préservé pour la rétro-compat (frontend appellera toujours avec le param, mais la rétro-compat évite de casser les tests backend existants).
3. **AC3** : `POST /services/jdr/sessions` exige `campaign_id` dans le body; 422 si absent.
4. **AC4** : Les sessions existantes en DB sont migrées vers la `default_campaign_id` du créateur.
5. **AC5** : 403 sur tous les accès cross-campagne (user non-membre).
6. **AC6** : `openapi.json` régénéré et committé pour que `npm run gen:api` côté frontend produise les types.

---

## Estimation

~1.5 à 2 jours backend (1 jour pour les endpoints + Pydantic, 0.5 jour pour la migration des données, 0.5 jour pour les tests + rétro-compat). Pas de migration SQL nouvelle (les tables existent depuis BD-4).

---

## Hors-scope BD-6

- Pagination, search, sort sur `/campaigns` — défaut natif (50 items, le frontend V1 n'en a pas besoin).
- Notifications de membres (qui rejoint/quitte une campagne) — V2.
- Permissions fines (rôles autres que MJ/Joueur) — V2.
- Cascade delete sur campagne avec sessions — V2 (V1 refuse).
- PJs scopés campagne — BD-7 séparé si décidé.
