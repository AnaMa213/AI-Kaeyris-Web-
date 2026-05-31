# Backend Handoff — BD-5 : Datetime serialisation must carry an explicit timezone

**Repo source :** `AI-Kaeyris-Web` (frontend Next.js)
**Repo cible :** `AnaMa213/AI-Kaeyris` (backend FastAPI)
**Émetteur :** Kenan
**Date :** 2026-05-31
**Statut :** ready-for-backend
**Priorité :** **non-bloquant frontend** (workaround `parseBackendDate` déjà en place côté frontend), mais à corriger côté backend pour propreté du contrat.

---

## TL;DR

Tous les champs `datetime` du backend (`recorded_at`, `created_at`, `updated_at`, etc.) sont actuellement sérialisés **sans suffixe timezone** (ex: `"2026-05-31T18:00:00"`). JavaScript `new Date()` interprète une telle string comme **heure locale machine**, ce qui décale silencieusement la valeur affichée de l'offset UTC de l'utilisateur. Pour Kenan en France été (UTC+2), une session créée à 20h00 locale était stockée correctement (= 18h00 UTC) mais réaffichée à 18h00 locale, soit **-2h apparent**.

**Fix demandé** : configurer Pydantic/FastAPI pour sérialiser les `datetime` avec leur timezone explicite (`Z` suffix ou `+HH:MM`).

---

## Preuve du bug

### POST envoyé par le frontend

```bash
curl -X POST http://localhost:8000/services/jdr/sessions \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"title":"DIAGNOSTIC-TZ","recorded_at":"2026-05-31T18:00:00.000Z","transcription_mode":"non_diarised"}'
```

Le frontend envoie bien un ISO-8601 UTC avec `Z` final.

### Réponse 201 actuellement

```json
{
  "id": "a2c882b0-cea3-4909-b510-d4b0e571c2ec",
  "title": "DIAGNOSTIC-TZ",
  "recorded_at": "2026-05-31T18:00:00",           ← pas de Z
  "mode": "batch",
  "state": "created",
  "transcription_mode": "non_diarised",
  "campaign_context": null,
  "created_at": "2026-05-31T21:24:17.740107",     ← pas de Z (heure locale serveur ?)
  "updated_at": "2026-05-31T21:24:17.740109"
}
```

### Réponse 201 attendue

```json
{
  "recorded_at": "2026-05-31T18:00:00Z",
  "created_at":  "2026-05-31T21:24:17.740107Z",
  "updated_at":  "2026-05-31T21:24:17.740109Z"
}
```

Ou de façon équivalente :

```json
{
  "recorded_at": "2026-05-31T18:00:00+00:00",
  "created_at":  "2026-05-31T21:24:17.740107+00:00",
  "updated_at":  "2026-05-31T21:24:17.740109+00:00"
}
```

---

## Périmètre — tous les champs `datetime` du backend

Confirmé sur deux endpoints, présumé identique partout :

| Endpoint | Champ | Bug observé |
|---|---|---|
| `POST /services/jdr/sessions` | `recorded_at`, `created_at`, `updated_at` | ✅ pas de TZ |
| `GET /services/jdr/sessions/{id}` | idem | présumé idem |
| `GET /services/jdr/sessions` (list) | idem | présumé idem |
| `GET /services/jdr/pjs` | `created_at` | ✅ pas de TZ (`"2026-05-31T14:46:36.834273"`) |
| `POST /services/jdr/pjs` | idem | présumé idem |
| `GET /services/jdr/users` | `created_at`, `updated_at` | présumé idem |
| `GET /services/jdr/auth/me` | tous les `datetime` | présumé idem |

Le fix doit être appliqué **globalement** (config Pydantic/FastAPI), pas endpoint par endpoint.

---

## Fix recommandé côté Pydantic / FastAPI

### Cause probable

Les colonnes SQLAlchemy sont déclarées en `DateTime` sans `timezone=True`, donc stockées en naïf côté DB. Pydantic les sérialise ensuite via `datetime.isoformat()` qui ne produit pas de suffixe quand l'objet `datetime` n'a pas de `tzinfo`.

### Fix canonical (1 — au modèle DB)

Migrer les colonnes vers `DateTime(timezone=True)` (PostgreSQL `TIMESTAMP WITH TIME ZONE`). Tous les nouveaux écrits seront stockés avec leur TZ; les lectures retourneront un `datetime` aware → Pydantic sérialise avec offset.

**Côté Alembic** : `alembic.op.alter_column("jdr_sessions", "recorded_at", type_=sa.DateTime(timezone=True), postgresql_using="recorded_at AT TIME ZONE 'UTC'")` (à adapter par colonne).

### Fix tactique (2 — à la sérialisation Pydantic)

Si la migration DB est trop chère, forcer la sérialisation côté Pydantic. Pour Pydantic v2 :

```python
from pydantic import BaseModel, ConfigDict, field_serializer
from datetime import datetime, timezone

class SessionOut(BaseModel):
    model_config = ConfigDict(json_encoders={
        datetime: lambda v: (
            v.replace(tzinfo=timezone.utc) if v.tzinfo is None else v
        ).isoformat()
    })
    recorded_at: datetime
    created_at: datetime
    updated_at: datetime
```

Ou plus propre, un `field_serializer` par champ.

### Cohérence inputs

S'assurer aussi que le **parsing** des inputs accepte les 3 formats canoniques :
- ISO avec `Z` → `"2026-05-31T18:00:00Z"`
- ISO avec offset → `"2026-05-31T18:00:00+02:00"`
- ISO naïve (pas idéal, mais tolérer pour compat) → `"2026-05-31T18:00:00"` interprété UTC

Pydantic v2 fait ça par défaut quand le champ est typé `datetime` (pas `Optional[datetime]`).

---

## Workaround frontend (déjà en place)

En attendant le fix backend, le frontend a un helper `lib/core/api/parseBackendDate.ts` qui force `Z` suffix si absent. **À retirer côté frontend une fois le BD-5 livré**, mais aucune urgence — il est inoffensif et passera les tests même contre un backend corrigé.

Lien : [`lib/core/api/parseBackendDate.ts`](../../lib/core/api/parseBackendDate.ts) + tests `tests/lib/core/api/parseBackendDate.test.ts`.

---

## Acceptance Criteria

1. **AC1** : `POST /services/jdr/sessions` retourne `recorded_at` avec suffixe `Z` ou `+00:00`.
2. **AC2** : Idem pour `created_at`, `updated_at` sur sessions, pjs, users, auth/me.
3. **AC3** : Le format reste ISO-8601 valide parsable par `new Date()` JavaScript (= test trivial : `new Date(value).toISOString()` retourne une string strictement égale à `value` après normalisation, ou différant uniquement de la précision sub-milliseconde).
4. **AC4** : Aucun changement de contrat pour les inputs (POST/PATCH continuent à accepter ISO avec ou sans TZ).

---

## Hors-scope

- Pas de migration vers `pendulum` ou `arrow` — la stdlib `datetime` suffit.
- Pas de changement du format DB (sauf si fix canonical via `timezone=True`) — seulement la sérialisation.
- Pas de standardisation des timezones côté frontend (date-fns continue à formatter en TZ machine, ce qui est le comportement souhaité pour l'UX).
