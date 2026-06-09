# Backend Handoff — BD-11 : connectivité worker → LLM (génération artefacts)

- **Repo source** : `AI-Kaeyris-Web` (frontend)
- **Repo cible** : `AnaMa213/AI-Kaeyris` (backend, FastAPI + SQLAlchemy + RQ + Redis + Whisper)
- **Émetteur** : Kenan
- **Date** : 2026-06-09
- **Statut** : ✅ **IMPLÉMENTÉ** (backend `main`, PR #11 `codex/011-llm-connectivity` — `826526c` fix connectivité worker, `53d89cf` ci security checks). Vérifié 2026-06-09.
- **Priorité** : **HAUTE — bloquant produit.** Tant que le worker n'atteint pas le LLM, **aucun** artefact ne se génère (résumé → récit/éléments/POVs → régénération). Tout le pipeline Epic 4 (et la vérif de la Story 4.5) est non testable de bout en bout.

## ✅ Implémentation livrée (vérifiée dans le repo backend)

- **Cause confirmée + garde-fou** : `app/adapters/llm.py::_resolve_base_url` détecte désormais une `LLM_BASE_URL` loopback (`localhost`/`127.x`) **depuis l'intérieur d'un conteneur** (`_running_in_container()` via `/.dockerenv`) et lève un `RuntimeError` explicite : *« Use a Docker-reachable host such as `http://host.docker.internal:<port>/v1` or a Compose service name »*. Plus de `httpx.ConnectError` silencieux : la mauvaise config échoue tôt avec un message actionnable.
- **Connectivité** : rétablie via la config réseau/env du service `worker` (cf. commit `826526c`).
- **AC-B2 (failure_reason)** : un échec LLM lève `TransientLLMError` → `TransientJobError` (RQ retry) ; à épuisement, le job finit `status="failed"` avec `failure_reason` renseigné (jamais bloqué en `running`). Le contrat `JobOut.failure_reason` est inchangé — **aucune action frontend requise**.
- **Côté Web** : RAS sur le contrat. La surface d'échec (item A5 / Story 4.10 « surface generation failures ») reste à câbler côté front, mais le backend fournit déjà `failure_reason`.
- **Migration de données** : NONE — infra/config worker.
- **Côté frontend** : aucun changement de contrat requis ; voir §3 (surface d'erreur, déjà couverte par `JobOut.failure_reason`).

## TL;DR

À chaque tentative de génération du résumé, le worker RQ échoue sur une **erreur de connexion réseau vers l'endpoint LLM** :

```
httpx.ConnectError: All connection attempts failed
  → app/adapters/llm.py:131  self._client.chat.completions.create(...)
  → app/adapters/llm.py:146  raise TransientLLMError(...)
  → app/jobs/jdr.py:742       partial = await adapter.complete(...)
  → app/jobs/jdr.py:748       raise TransientJobError(str(exc))
```

Ce n'est **pas** un bug applicatif : l'appel OpenAI/LLM part bien, mais **aucune connexion TCP n'aboutit** (`All connection attempts failed`). C'est un problème de **configuration/réseau** entre le conteneur worker et l'endpoint LLM.

## 1. Hypothèses de cause (à vérifier côté backend/infra)

- **Base URL injoignable depuis le conteneur worker** : `OPENAI_BASE_URL` (ou équivalent) pointe vers `localhost`/`127.0.0.1` alors que le LLM tourne sur l'hôte ou un autre service Docker → utiliser le nom de service Compose (`host.docker.internal` / nom du service) plutôt que `localhost`.
- **Service LLM non démarré / non exposé** dans l'environnement où tourne le worker (réseau Docker, port non publié sur le réseau du worker).
- **Clé API absente/invalide** orientant le client vers un endpoint par défaut inatteignable, ou **proxy/firewall** sortant bloquant.
- **Le `web` atteint peut-être le LLM mais pas le `worker`** (réseaux Compose ou variables d'env différentes entre les deux process).

## 2. Demande

1. Rétablir la connectivité **worker → LLM** dans l'environnement de dev/déploiement (config réseau + variables d'env du service `worker`).
2. Confirmer qu'un **job résumé** d'une session `non_diarised` (`POST /services/jdr/sessions/{id}/artifacts/summary`) atteint **`status=succeeded`** de bout en bout.

## 3. Surface d'erreur côté frontend (déjà supporté par le contrat)

Indépendamment du fix infra, le frontend doit présenter l'échec proprement (cf. item **A5** du backlog Epic 4 bis). Le contrat le permet déjà : `JobOut.status="failed"` + `failure_reason`.

- **Demande mineure** : s'assurer qu'un échec **transient épuisé** (après retries RQ) se traduit bien par un `JobOut.status="failed"` **avec un `failure_reason` lisible** (ex. `"llm-unreachable"`), et non par un job bloqué en `running`/`queued`. Le frontend mappera `failure_reason` vers un message utilisateur + bouton « Réessayer ».

## 4. AC testables (backend)

- **AC-B1** — Dans l'environnement worker, un job résumé sur une session `non_diarised` transcrite atteint `status=succeeded` (plus de `httpx.ConnectError`).
- **AC-B2** — En cas d'indisponibilité réelle du LLM, le job finit en `status="failed"` avec un `failure_reason` non vide (jamais bloqué en `running`).
- **AC-B3** — Aucune régression sur la transcription (qui n'utilise pas le LLM).

## 5. Récap

- **Cœur** : config réseau/env worker → LLM (§1, §2). Pas de code applicatif a priori, pas de migration.
- **Bloquant frontend** : oui, indirectement — la chaîne artefacts (et la vérification Story 4.5) reste non testable tant que AC-B1 n'est pas vert.
- **Bonus** : AC-B2 (failure_reason propre) pour que le front affiche un échec actionnable.
