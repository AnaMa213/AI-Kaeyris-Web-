# Backend Handoff — BD-19 : wiring des paramètres modèle dans le pipeline de génération

- **Repo source** : `AI-Kaeyris-Web` (frontend)
- **Repo cible** : `AnaMa213/AI-Kaeyris` (backend, FastAPI + SQLAlchemy + RQ)
- **Émetteur** : Kenan
- **Date** : 2026-06-16
- **Statut** : ⏳ à implémenter (Story 6.5, BD-19)
- **Priorité** : HAUTE — les Stories 6.2–6.4 ont livré la persistance, mais sélectionner un modèle n'a aucun effet sur la génération.

---

## TL;DR

`jdr_model_settings` contient la configuration par GM (provider, modèle cloud, clé DeepInfra, chemin local). Pourtant, le pipeline de génération — `app/jobs/jdr.py` + `app/adapters/llm.py` + `app/adapters/transcription.py` — lit **uniquement** les variables d'environnement (`settings.LLM_PROVIDER`, `settings.LLM_API_KEY`, etc.) via des singletons `@lru_cache`. Ce BD-19 corrige cet écart pour les modes HTTP : **Cloud payant** (clé DeepInfra personnelle), **Cloud gratuit** (env de l'opérateur), **Ollama** (LLM seulement, HTTP).

Quatre blocs de travail :

1. Refactoriser les factories d'adaptateurs (fin du singleton `@lru_cache`) pour accepter des paramètres explicites.
2. Résoudre le propriétaire de la session dans les jobs et lui charger ses `ModelSettings`.
3. Retourner la **configuration effective** (env résolus) sur le `GET /settings/models` pour les utilisateurs non customisés.
4. Ajouter le champ `ollama_model` à `jdr_model_settings`.

---

## 1. État actuel du code

### `app/adapters/llm.py`

```
build_llm_adapter()          # factory lisant settings.LLM_PROVIDER / LLM_API_KEY / LLM_MODEL
get_llm_adapter()            # @lru_cache(maxsize=1) autour de build_llm_adapter() — singleton process
```

`get_llm_adapter()` est appelé dans **tous** les jobs LLM :
- `_generate_narrative` (ligne ~471)
- `_generate_elements` (ligne ~515)
- `_generate_povs` (ligne ~605)
- `_generate_summary` (lignes ~766, ~793)

L'adaptateur prend : `provider`, `model`, `api_key`, `base_url`. Le transport est déjà OpenAI-compatible (DeepInfra, Ollama, vLLM, OpenAI — `_DEFAULT_BASE_URLS` couvre tous ces cas). **Aucun nouveau transport à créer.**

### `app/adapters/transcription.py`

```
build_transcription_adapter()   # factory lisant settings.TRANSCRIPTION_PROVIDER / TRANSCRIPTION_*
get_transcription_adapter()     # @lru_cache(maxsize=1) — singleton process
```

Providers supportés aujourd'hui : `cloud` (Whisper API OpenAI) et `local` (base_url custom) + `mock`. **Pas de support `ollama`** pour la transcription — c'est intentionnel : l'Ollama du Story 6.5 ne concerne que le LLM.

`get_transcription_adapter()` est appelé dans `_transcribe_session` (ligne ~289).

### `app/services/jdr/db/models.py` — Session

```python
gm_key_id: Mapped[uuid.UUID]         # FK → jdr_api_keys.id, NOT NULL
campaign_id: Mapped[uuid.UUID | None] # FK → jdr_campaigns.id, nullable
```

### `app/services/jdr/db/models.py` — Campaign

```python
owner_user_id: Mapped[uuid.UUID]  # FK → jdr_users.id (le GM propriétaire)
```

### `app/services/jdr/auth_router.py` — serialisation GET

```python
def _model_settings_out(row) -> ModelSettingsOut:
    if row is None:
        return ModelSettingsOut()   # defaults Pydantic = cloud/cloud, tout null
    return ModelSettingsOut(...)
```

Quand `row is None` (utilisateur sans row `jdr_model_settings`), le GET retourne les valeurs par défaut **Pydantic** (`cloud/cloud`, `transcription_cloud_model=None`, etc.) — pas les valeurs env réelles. L'AC7 de Story 6.5 demande qu'on retourne les **vraies** valeurs de l'env opérateur.

### `app/core/config.py` — env pertinentes

```
LLM_PROVIDER           = "deepinfra"
LLM_MODEL              = "meta-llama/Meta-Llama-3.1-8B-Instruct"
LLM_API_KEY            = ""
LLM_BASE_URL           = ""
TRANSCRIPTION_PROVIDER = "cloud"
TRANSCRIPTION_MODEL    = "whisper-large-v3"
TRANSCRIPTION_BASE_URL = ""
TRANSCRIPTION_API_KEY  = ""
```

---

## 2. Champ `ollama_model` — migration Alembic

### 2.1 `app/services/jdr/db/models.py`

Dans la classe `ModelSettings` (tableau `jdr_model_settings`), ajouter :

```python
ollama_model: Mapped[str | None] = mapped_column(
    String(200), nullable=True
)
```

Placement suggéré : après `summary_cloud_model`.

### 2.2 Migration Alembic

Créer `migrations/versions/0016_jdr_model_settings_ollama_model.py` :

```python
revision = "e4b1c9f2a037"
down_revision = "d6f0a8c4e135"  # la migration 0015 (BD-18 cloud model)

def upgrade() -> None:
    op.add_column(
        "jdr_model_settings",
        sa.Column("ollama_model", sa.String(200), nullable=True),
    )

def downgrade() -> None:
    op.drop_column("jdr_model_settings", "ollama_model")
```

Vérifier après : `alembic heads` → tête unique.

---

## 3. Schémas Pydantic — `app/services/jdr/schemas.py`

### `ModelSettingsOut`

Ajouter :
```python
ollama_model: str | None = Field(
    None,
    max_length=200,
    description="Ollama model name used when summary_provider is ollama (LLM only).",
)
```

### `ModelSettingsPatch`

Ajouter :
```python
ollama_model: str | None = Field(None, max_length=200)
```

---

## 4. Repository — `app/services/jdr/db/repositories.py`

Dans `ModelSettingsRepository.upsert_for_user`, ajouter le paramètre `ollama_model` et le bloc de mise à jour (même motif que les champs existants) :

```python
async def upsert_for_user(
    self,
    *,
    user_id: UUID,
    ...,
    ollama_model: str | None = None,
) -> ModelSettings:
    ...
    if ollama_model is not None:
        row.ollama_model = ollama_model
    ...
```

---

## 5. Route PATCH — `app/services/jdr/auth_router.py`

Dans `patch_model_settings`, passer `ollama_model=payload.ollama_model` à `upsert_for_user` et l'inclure dans le log (pas secret).

---

## 6. Config effective — `_model_settings_out` (AC7)

Remplacer la branche `row is None` de `_model_settings_out` pour retourner les valeurs env réelles :

```python
def _model_settings_out(row) -> ModelSettingsOut:
    if row is None:
        # Effective defaults from operator env — shows what generation
        # actually uses when the user has no custom settings.
        transcription_provider = ModelProvider(settings.TRANSCRIPTION_PROVIDER)
        summary_provider = ModelProvider(settings.LLM_PROVIDER)
        return ModelSettingsOut(
            transcription_provider=transcription_provider,
            summary_provider=summary_provider,
            transcription_cloud_model=(
                settings.TRANSCRIPTION_MODEL
                if transcription_provider == ModelProvider.CLOUD
                else None
            ),
            summary_cloud_model=(
                settings.LLM_MODEL
                if summary_provider == ModelProvider.CLOUD
                else None
            ),
            ollama_model=(
                settings.LLM_MODEL
                if summary_provider == ModelProvider.OLLAMA
                else None
            ),
            deepinfra_api_key_set=False,  # never expose the operator key
        )
    return ModelSettingsOut(
        transcription_provider=row.transcription_provider,
        summary_provider=row.summary_provider,
        transcription_local_path=row.transcription_local_path,
        summary_local_path=row.summary_local_path,
        transcription_cloud_model=row.transcription_cloud_model,
        summary_cloud_model=row.summary_cloud_model,
        ollama_model=row.ollama_model,
        deepinfra_api_key_set=bool(row.deepinfra_api_key),
    )
```

**Sécurité :** l'env `LLM_API_KEY` / `TRANSCRIPTION_API_KEY` n'est **jamais** exposée — seul `deepinfra_api_key_set: False` est retourné pour les utilisateurs sans clé personnelle.

> **Edge case :** si `settings.TRANSCRIPTION_PROVIDER` contient une valeur inconnue (ni `cloud`, ni `local`, ni `ollama`), `ModelProvider(...)` lèvera `ValueError`. Entourer d'un `try/except` si nécessaire et fallback sur `ModelProvider.CLOUD`.

---

## 7. Factories d'adaptateurs — passage de params explicites

### 7.1 `app/adapters/llm.py`

Ajouter une surcharge de `build_llm_adapter` acceptant des paramètres explicites (ne remplace pas l'existant — la version sans args est conservée pour la compatibilité FastAPI DI et les tests qui utilisent `app.dependency_overrides`):

```python
def build_llm_adapter(
    *,
    provider: str | None = None,
    model: str | None = None,
    api_key: str | None = None,
    base_url: str | None = None,
) -> LLMAdapter:
    """Build an LLM adapter. When params are None, falls back to env config."""
    resolved_provider = (provider or settings.LLM_PROVIDER).strip().lower()
    if resolved_provider == "mock":
        return MockLLMAdapter()
    if resolved_provider not in _DEFAULT_BASE_URLS:
        raise RuntimeError(
            f"Unknown LLM provider {resolved_provider!r}. "
            f"Supported: {sorted({*_DEFAULT_BASE_URLS, 'mock'})}"
        )
    resolved_model = model or settings.LLM_MODEL
    resolved_key = api_key or settings.LLM_API_KEY
    if not resolved_key and resolved_provider not in {"ollama", "vllm"}:
        raise RuntimeError(
            f"LLM API key is required for provider {resolved_provider!r}."
        )
    resolved_base_url = base_url or _resolve_base_url(resolved_provider)
    return OpenAICompatibleLLMAdapter(
        provider=resolved_provider,
        model=resolved_model,
        api_key=resolved_key or "noop",
        base_url=resolved_base_url,
        timeout_seconds=settings.LLM_TIMEOUT_SECONDS,
    )


@lru_cache(maxsize=1)
def get_llm_adapter() -> LLMAdapter:
    """FastAPI / job DI: process-wide adapter (env config, memoised).

    Tests use `app.dependency_overrides` or `get_llm_adapter.cache_clear()`.
    Jobs that need per-user settings call `build_llm_adapter(...)` directly.
    """
    return build_llm_adapter()
```

### 7.2 `app/adapters/transcription.py`

Même motif — ajouter les paramètres optionnels à `build_transcription_adapter` :

```python
def build_transcription_adapter(
    *,
    provider: str | None = None,
    model: str | None = None,
    api_key: str | None = None,
    base_url: str | None = None,
) -> TranscriptionAdapter:
    resolved_provider = (provider or settings.TRANSCRIPTION_PROVIDER).strip().lower()
    if resolved_provider == "mock":
        return MockTranscriptionAdapter()
    if resolved_provider not in _DEFAULT_BASE_URLS:
        raise RuntimeError(
            f"Unknown transcription provider {resolved_provider!r}. "
            f"Supported: {sorted({*_DEFAULT_BASE_URLS, 'mock'})}"
        )
    resolved_model = model or settings.TRANSCRIPTION_MODEL
    resolved_key = api_key or settings.TRANSCRIPTION_API_KEY
    resolved_base_url = base_url or settings.TRANSCRIPTION_BASE_URL or _DEFAULT_BASE_URLS[resolved_provider]
    if resolved_provider == "local" and not resolved_base_url:
        raise RuntimeError(
            "TRANSCRIPTION_PROVIDER='local' requires TRANSCRIPTION_BASE_URL or a user-configured base_url."
        )
    if resolved_provider == "cloud" and not resolved_key:
        raise RuntimeError(
            "TRANSCRIPTION_PROVIDER='cloud' requires TRANSCRIPTION_API_KEY or a user API key."
        )
    return OpenAICompatibleTranscriptionAdapter(
        provider=resolved_provider,
        model=resolved_model,
        api_key=resolved_key or "noop",
        base_url=resolved_base_url,
        timeout_seconds=settings.TRANSCRIPTION_TIMEOUT_SECONDS,
    )


@lru_cache(maxsize=1)
def get_transcription_adapter() -> TranscriptionAdapter:
    """FastAPI / job DI: process-wide adapter (env config, memoised)."""
    return build_transcription_adapter()
```

**`@lru_cache` conservé** : le singleton env est toujours utile (pas de ModelSettings chargé en dehors des jobs JDR). C'est uniquement dans les jobs que `build_*_adapter(...)` est appelé avec les params per-user.

---

## 8. Résolution du propriétaire — `app/jobs/jdr.py`

### 8.1 Helper de résolution

Ajouter une fonction `_resolve_session_owner_id` (async, appelée via le sessionmaker) :

```python
async def _resolve_session_owner_id(
    session_id: UUID,
) -> UUID | None:
    """Resolve the owning GM user_id for a session.

    Chain: Session.campaign_id → Campaign.owner_user_id (preferred).
    Fallback: Session.gm_key_id → ApiKey.owner_user_id.
    Returns None if both paths are null or the row doesn't exist.
    """
    from app.services.jdr.db.models import ApiKey, Campaign  # avoid circular

    sessionmaker = get_sessionmaker()
    async with sessionmaker() as db:
        session_row = await db.scalar(
            select(Session).where(Session.id == session_id)
        )
        if session_row is None:
            return None

        # Chain 1: campaign owner (preferred — direct FK, always a real GM)
        if session_row.campaign_id is not None:
            campaign = await db.scalar(
                select(Campaign).where(Campaign.id == session_row.campaign_id)
            )
            if campaign is not None and campaign.owner_user_id is not None:
                return campaign.owner_user_id

        # Chain 2: API key owner (fallback for sessions created via API key)
        key_row = await db.scalar(
            select(ApiKey).where(ApiKey.id == session_row.gm_key_id)
        )
        if key_row is not None:
            return key_row.owner_user_id  # may still be None for machine keys

        return None
```

### 8.2 Helper de chargement des ModelSettings

```python
async def _load_user_model_settings(
    user_id: UUID,
) -> ModelSettings | None:
    from app.services.jdr.db.repositories import ModelSettingsRepository

    sessionmaker = get_sessionmaker()
    async with sessionmaker() as db:
        return await ModelSettingsRepository(db).get_for_user(user_id)
```

### 8.3 Helper de construction des adaptateurs per-session

```python
_DEEPINFRA_BASE_URL = "https://api.deepinfra.com/v1/openai"
_OLLAMA_BASE_URL = "http://localhost:11434/v1"

def _build_llm_adapter_for_user(
    row: ModelSettings | None,
) -> LLMAdapter:
    """Build an LLM adapter from per-user ModelSettings, with env fallback."""
    if row is None:
        return build_llm_adapter()  # env fallback → current behavior

    provider_str = row.summary_provider.value  # "cloud" | "local" | "ollama"

    if provider_str == "ollama":
        return build_llm_adapter(
            provider="ollama",
            model=row.ollama_model or settings.LLM_MODEL,
            api_key="noop",  # Ollama n'exige pas de clé
            base_url=_OLLAMA_BASE_URL,
        )

    if provider_str == "cloud":
        # Cloud payant : clé DeepInfra personnelle non vide
        if row.deepinfra_api_key:
            return build_llm_adapter(
                provider="deepinfra",
                model=row.summary_cloud_model or settings.LLM_MODEL,
                api_key=row.deepinfra_api_key,
                base_url=_DEEPINFRA_BASE_URL,
            )
        # Cloud gratuit : env opérateur
        return build_llm_adapter()

    # "local" : pas encore couvert dans ce story (6.6)
    logger.warning(
        "llm_adapter.local_not_supported",
        note="Story 6.6 required for local in-process execution; falling back to env.",
    )
    return build_llm_adapter()


def _build_transcription_adapter_for_user(
    row: ModelSettings | None,
) -> TranscriptionAdapter:
    """Build a transcription adapter from per-user ModelSettings, with env fallback."""
    if row is None:
        return build_transcription_adapter()

    provider_str = row.transcription_provider.value  # "cloud" | "local"
    # NOTE: "ollama" is not a valid transcription provider (AC6 / Story 6.5).
    # If a row somehow has ollama set for transcription, fall back to env.

    if provider_str == "cloud":
        if row.deepinfra_api_key:
            return build_transcription_adapter(
                provider="cloud",
                model=row.transcription_cloud_model or settings.TRANSCRIPTION_MODEL,
                api_key=row.deepinfra_api_key,
                # DeepInfra Whisper endpoint is OpenAI-compatible at their base URL.
                base_url=_DEEPINFRA_BASE_URL,
            )
        return build_transcription_adapter()  # Cloud gratuit : env opérateur

    if provider_str == "local":
        # Local path : pas encore couvert dans ce story (6.6)
        logger.warning(
            "transcription_adapter.local_not_supported",
            note="Story 6.6 required; falling back to env.",
        )
        return build_transcription_adapter()

    # "ollama" ou valeur inconnue → fallback env
    return build_transcription_adapter()
```

> **Sécurité :** `row.deepinfra_api_key` est lu en mémoire dans le worker et passé à l'adaptateur. Il ne doit jamais apparaître dans les logs. Les logs existants dans `OpenAICompatibleLLMAdapter` ne loguent que `provider` et `model` — vérifier que `api_key` n'est pas loguée par le SDK OpenAI (il ne l'est pas par défaut).

### 8.4 Mise à jour des async cores dans `app/jobs/jdr.py`

Remplacer tous les appels à `get_llm_adapter()` et `get_transcription_adapter()` par les helpers per-user. Le pattern est identique dans les 5 fonctions :

**`_transcribe_session`** :
```python
# Après Step 1 (chargement session), ajouter :
owner_id = await _resolve_session_owner_id(session_id)
user_settings = await _load_user_model_settings(owner_id) if owner_id else None

# À la place de `adapter = get_transcription_adapter()` :
adapter = _build_transcription_adapter_for_user(user_settings)
```

**`_generate_narrative`, `_generate_elements`, `_generate_summary`, `_generate_povs`** :
```python
# Au début de chaque fonction, avant l'appel LLM :
owner_id = await _resolve_session_owner_id(session_id)
user_settings = await _load_user_model_settings(owner_id) if owner_id else None
adapter = _build_llm_adapter_for_user(user_settings)
```

Mettre à jour également `model_used` dans les UPSERT d'artefacts pour refléter le provider/model réel :
```python
# Avant : model_used = f"{settings.LLM_PROVIDER}:{settings.LLM_MODEL}"
# Après (exemple pour narrative) :
effective_provider = user_settings.summary_provider.value if user_settings else settings.LLM_PROVIDER
effective_model = (
    (user_settings.summary_cloud_model or user_settings.ollama_model or settings.LLM_MODEL)
    if user_settings else settings.LLM_MODEL
)
model_used = f"{effective_provider}:{effective_model}"
```

---

## 9. Tests backend (`tests/services/jdr/`)

Les tests existants appellent les async cores directement et surclassent `app.dependency_overrides` ou `get_llm_adapter.cache_clear()`. Après le refactoring, ils continueront de fonctionner car `get_llm_adapter()` reste le même singleton env (inchangé pour les tests DI).

**Nouveaux tests à ajouter :**

```
tests/services/jdr/test_pipeline_model_routing.py
```

Couvertures requises :

| Scénario | Description |
|----------|-------------|
| `test_llm_adapter_env_fallback` | `_build_llm_adapter_for_user(None)` → env adapter |
| `test_llm_adapter_cloud_paid` | `row.deepinfra_api_key` présente → DeepInfra avec user key + model |
| `test_llm_adapter_cloud_free` | `row.summary_provider=cloud`, pas de clé → env adapter |
| `test_llm_adapter_ollama` | `row.summary_provider=ollama`, `ollama_model="llama3:8b"` → Ollama adapter, bon model |
| `test_llm_adapter_local_fallback` | `row.summary_provider=local` → env fallback (6.6 not yet) |
| `test_transcription_adapter_cloud_paid` | clé présente → DeepInfra cloud, user key + model |
| `test_transcription_adapter_cloud_free` | cloud, pas de clé → env |
| `test_transcription_adapter_local_fallback` | local → env fallback (6.6 not yet) |
| `test_owner_resolution_via_campaign` | `session.campaign_id` → `campaign.owner_user_id` |
| `test_owner_resolution_via_gm_key` | `session.campaign_id=None` → `gm_key.owner_user_id` |
| `test_owner_resolution_none` | les deux FK nulles → `None` (env fallback) |
| `test_effective_config_no_row` | GET sans row `jdr_model_settings` → env provider/model retournés |
| `test_effective_config_no_key_exposed` | env opérateur : `deepinfra_api_key_set=False` |
| `test_ollama_model_persisted` | PATCH avec `ollama_model` → stocké, retourné par GET |

```
tests/services/jdr/test_model_settings.py  (existant, 10 tests passés)
```

Étendre avec :
- Assert que `ModelSettingsOut` ne contient jamais le champ `deepinfra_api_key` (clé brute absente du JSON de réponse)
- Test PATCH + GET `ollama_model`

---

## 10. Synchronisation OpenAPI et frontend

Après toutes les modifications backend :

1. Régénérer l'OpenAPI depuis le backend en live : `uvicorn app.main:app --reload` puis récupérer `/openapi.json`.
2. Copier dans le frontend : `docs/context/api/openapi.json`.
3. Régénérer les types : `npm run gen:api` (→ `types/api.ts`).
4. Vérifier : `npm run check:api-types` → ✅ zéro drift.

Champs attendus dans le diff OpenAPI :
- `ModelSettingsOut` : + `ollama_model` (nullable string)
- `ModelSettingsPatch` : + `ollama_model` (nullable string)

---

## 11. Critères de régression (non-régression obligatoire)

| Scénario | Comportement attendu |
|----------|---------------------|
| Utilisateur sans row `jdr_model_settings` | jobs utilisent env (byte-for-byte current) |
| `session.campaign_id=None`, `gm_key_id` owner introuvable | jobs utilisent env |
| `TRANSCRIPTION_PROVIDER=mock` (tests) | `MockTranscriptionAdapter` retourné, inchangé |
| `LLM_PROVIDER=mock` (tests) | `MockLLMAdapter` retourné, inchangé |
| Appels via FastAPI DI (`Depends(get_llm_adapter)`) | comportement singleton env inchangé |
| `get_llm_adapter.cache_clear()` dans les tests | fonctionne toujours (cache toujours présent) |
| Suite backend complète | `uv run pytest tests/services/jdr -q` → 0 échec |

---

## 12. Hors-scope (Story 6.5)

- **Mode Local in-process (Story 6.6)** : `summary_provider=local` et `transcription_provider=local` reviennent au fallback env dans ce story ; le chargement du modèle depuis le disque et la validation par sonde arrivent dans BD-20.
- **Estimation de coût / table de prix** (Story 6.7).
- **Clé en attente at-rest** : chiffrement de `deepinfra_api_key` en DB est un follow-up possible post-6.5.
- **Découverte des modèles Ollama** (`GET /api/tags`) : le sélecteur est un champ libre dans ce story ; l'autocomplétion est un nice-to-have futur.
