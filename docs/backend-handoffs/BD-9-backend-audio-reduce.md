# Backend Handoff — BD-9 : reduce audio côté serveur (sortir ffmpeg.wasm du navigateur)

- **Repo source** : `AI-Kaeyris-Web` (frontend)
- **Repo cible** : `AnaMa213/AI-Kaeyris` (backend, FastAPI + SQLAlchemy + Pydantic + Whisper + RQ)
- **Émetteur** : Kenan
- **Date** : 2026-06-03
- **Statut** : ready-for-backend
- **Priorité** : **MOYENNE** — ne bloque pas l'upload aujourd'hui (le frontend a désactivé le reducer client et envoie le M4A raw), mais lève la limitation de taille qui contraint les MJ à raccourcir leurs séances.
- **Migration de données** : NONE (changement d'API et de pipeline, pas de schéma).
- **Référence interne** : discussion produit du 2026-06-03 suite au hang silencieux de ffmpeg.wasm en l'absence de COOP/COEP.

## TL;DR

Le frontend a toujours fait un reduce ffmpeg avant l'upload pour rester sous la limite de 25 Mo de Whisper cloud. Ce reduce vit dans le navigateur (`@ffmpeg/ffmpeg ^0.12.15`, ~25 Mo de wasm) et exige `SharedArrayBuffer` → COOP/COEP → ce n'est pas servi par Next, donc `ff.load()` hang sans erreur visible. Au-delà du bug, l'architecture client a des défauts structurels qu'on ne veut pas garder (cf. §3).

**Demande** : déplacer le reduce dans un worker RQ backend. `POST /audio` accepte le binaire raw (taille brute d'une séance JDR : 200-500 Mo selon durée et qualité de prise), le serveur enchaîne reduce → transcription dans le pipeline RQ. Le frontend, désormais, ne fait que `POST` puis poll un job.

D'ici-là, le frontend a déjà désactivé le reducer client (`NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED=false`), donc le backend reçoit du raw. Si la limite actuelle 413 tape, l'user voit un message dédié et raccourcit. BD-9 lève cette contrainte.

## 1. Demande — reduce dans un worker RQ  [MOYENNE]

### 1.1 Pipeline cible

```
POST /sessions/{id}/audio (raw M4A)  ──► 202 + job created
                                              │
                                              ▼
                                   ┌─── RQ worker (reduce) ───┐
                                   │  ffmpeg : -c:a aac -b:a  │
                                   │  24k -ac 1 (mono, faible │
                                   │  bitrate, voix)           │
                                   └──────────────┬───────────┘
                                                  ▼
                                   ┌─── RQ worker (transcribe) ──┐
                                   │  Whisper                     │
                                   └──────────────┬──────────────┘
                                                  ▼
                                   session.state → transcribed
```

### 1.2 Job kind — décision attendue

Deux options. Le frontend gère les deux, mais préfère la première :

**Option A (recommandée) — un seul job `transcription`** qui internalise le reduce.
- `JobOut.kind = "transcription"` comme aujourd'hui.
- Pas d'impact sur le contrat client : un seul `current_job_id` (BD-8), un seul polling.
- Si `JobOut.progress` (BD-8 §4 bis) est livré un jour, il peut combiner reduce + whisper sur un seul curseur.

**Option B — deux jobs chaînés `audio_reduce` puis `transcription`**.
- Nouveau `JobKind: "audio_reduce"`.
- `SessionOut.current_job_id` pointe successivement sur l'un puis l'autre.
- Le frontend devra distinguer le label affiché par phase. Faisable mais plus de surface.
- Justifié seulement si reduce et whisper sont sur des workers/queues différents avec des coûts d'observation distincts.

**Trancher en faveur de A** sauf contrainte opérationnelle qui force B.

### 1.3 État machine

**Pas d'état intermédiaire `reducing` distinct** demandé.

- Si reduce et transcribe sont absorbés dans un seul job (option A), `session.state` passe `created → audio_uploaded → transcribing → transcribed` comme aujourd'hui. Le worker est libre de réduire puis transcrire sans changer d'état session.
- Si vous préférez l'option B, un état `reducing` entre `audio_uploaded` et `transcribing` est possible — mais introduire un nouvel état dans le schéma rétrocompatible côté frontend demande un mapping de plus dans `STATE_LABEL`. À éviter si possible.

### 1.4 Limite d'upload

Aujourd'hui le frontend voit du 413 sur les gros fichiers (la limite exacte du backend n'est pas documentée — à confirmer dans `docs/context/api/backend-summary.md` ou via un test direct).

**Cible BD-9** : accepter le binaire raw d'une séance JDR complète, ordre de grandeur **jusqu'à 500 Mo** (4h d'enregistrement mono PCM-like en M4A non compressé agressivement). Si la stack (Nginx ou équivalent, FastAPI body limit, RQ payload) demande de bumper plusieurs cuts, documenter ce qui change.

Si une limite plus basse est imposée par l'infra, communiquer la valeur — le frontend affichera le seuil dans le message d'erreur 413 plutôt qu'un texte générique.

### 1.5 Conservation du raw

**Question produit ouverte** : après reduce réussi, le backend supprime-t-il le M4A raw ?

- **Recommandation** : supprimer après reduce confirmé OK, garder uniquement le reduced. Économie de stockage importante (raw = 10× le reduced).
- **Contre-argument** : conserver le raw permet de ré-réduire avec d'autres paramètres si on change Whisper ou la stratégie. Mais ce besoin est hypothétique.
- À trancher avec Kenan. Par défaut **supprimer** sauf raison contraire explicite.

Cette question recoupe BD-8 §3 (DELETE irrémédiable) : si on garde le raw, le DELETE doit purger raw + reduced + transcription + chunks.

## 2. Contrat API — ce qui change (rien, ou très peu)

L'attrait de cette approche : le contrat `POST /audio` ne change quasiment pas.

- **Route** : `POST /services/jdr/sessions/{id}/audio` (inchangé).
- **Réponse 202** : `AudioUploadOut` (inchangé). `job_id` peuplé, `duration_seconds` peut rester `null` (le backend peut le calculer après reduce mais ne le promet pas).
- **413** : le seuil change avec la limite §1.4 ; pas de breaking change sur la forme.
- **Idempotence** : si l'user re-upload sur une session `audio_uploaded` ou `transcribing`, comportement actuel (probablement 409). Inchangé.

**Pas de nouvelle route**, pas de nouveau verbe, pas de nouveau schéma Pydantic à publier. C'est purement un changement d'implémentation worker côté backend + un relâchement de la limite d'upload.

## 3. Pourquoi pas le client — trade-off documenté

Pour la postérité (et pour qu'on ne revienne pas en arrière dans 6 mois) :

| Aspect                          | Reduce client (état actuel désactivé) | Reduce backend (cible BD-9)        |
|---------------------------------|---------------------------------------|------------------------------------|
| Taille bundle wasm              | ~25 Mo (lazy, mais quand même chargé) | 0 côté client                       |
| Mémoire navigateur              | Charge tout le fichier en mémoire JS  | 0                                   |
| Mobile                          | Souvent OOM ou très lent              | Aucun impact device                 |
| User doit rester sur la page    | Oui (sinon perdu)                     | Non — fire-and-forget, l'user revient quand il veut |
| Headers serveur                 | COOP/COEP requis (effet de bord sur les assets cross-origin) | Aucun |
| Cohérence pipeline              | Étape isolée hors RQ                  | Intégrée au pattern RQ existant     |
| Observabilité                   | Erreurs noyées dans le navigateur user | Logs + metrics centralisés          |
| Coût bande passante upload      | Bas (envoie du reduced)               | Élevé (envoie du raw)               |

Le seul gain du client est **bande passante upload**. Vu qu'on parle d'un MJ qui upload une fois par session (1-2× par semaine), ce gain est marginal et n'équilibre pas le reste.

## 4. État actuel côté frontend (post-bypass)

Pour info, sans demande backend associée :

- `NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED=false` par défaut dans `.env.example`.
- `lib/audio/reduce.ts`, `lib/audio/provider.ts`, et le chemin `phase="reducing"` dans `SessionAudioUploadCard.tsx` sont **présents mais dormants**. Ils seront supprimés après que BD-9 soit livré et stable (3-4 fichiers + suppression de la dep `@ffmpeg/ffmpeg`).
- Le message d'erreur 413 a été reformulé pour ne plus suggérer à l'user de réactiver un reducer cassé : il pointe désormais BD-9 et conseille de raccourcir la séance.

## 5. Récap priorités

- **MOYENNE — déblocage des MJ avec longues séances** : §1 reduce dans un worker RQ. Le frontend tourne aujourd'hui sans, mais les séances longues échouent en 413.
- **À trancher** : §1.2 option A vs B (préférence A), §1.5 conservation du raw (préférence suppression après reduce).
- **À documenter** : §1.4 limite d'upload cible et changements stack nécessaires.
- **Aucun impact contrat OpenAPI** attendu — pure modification interne du pipeline worker.
