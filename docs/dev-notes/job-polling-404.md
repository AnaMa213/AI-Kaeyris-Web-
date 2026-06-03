# Dev note — Polling `/jobs/{id}` qui boucle en 404

## Symptôme

Après l'envoi d'un audio, l'appel `GET /services/jdr/jobs/{job_id}` se répète
toutes les ~1 s en remontant systématiquement :

```json
{
  "type": "https://kaeyris.local/errors/job-not-found",
  "title": "Job not found",
  "status": 404,
  "detail": "Job <uuid> not found.",
  "instance": "/services/jdr/jobs/<uuid>"
}
```

## Cause racine

`NEXT_PUBLIC_MOCK_AUDIO=true` dans `.env.local`.

En mode mock, l'upload **n'atteint pas le backend** : `useUploadSessionAudio`
([lib/jdr/sessions/queries.ts](../../lib/jdr/sessions/queries.ts)) synthétise
une réponse avec `job_id: crypto.randomUUID()`. Ce `job_id` est un UUID inventé
côté navigateur, inconnu de toute base backend.

Le polling (`useJob`, [lib/jdr/jobs/queries.ts](../../lib/jdr/jobs/queries.ts))
**ne passe pas par le mock** : il interroge le vrai backend sur cet UUID factice
→ 404. Comme 404 n'est pas un statut terminal (`succeeded`/`failed`), le
back-off ne s'arrête jamais.

## Pourquoi ça bouclait à l'infini (au-delà du mock)

Le middleware d'erreur ([lib/core/api/problemDetails.ts](../../lib/core/api/problemDetails.ts))
**throw** l'`ApiError` 404. Du coup `query.state.data` reste `undefined`, et
`jobRefetchInterval(undefined)` renvoie `1000` ms → re-poll chaque seconde, sans
fin, sur un job introuvable. Le défaut existait même hors mock (job purgé,
mauvais ID…).

## Correction

1. **Config** — `NEXT_PUBLIC_MOCK_AUDIO=false` dans `.env.local` pour un upload
   réel (penser à **redémarrer le serveur Next** : les `NEXT_PUBLIC_*` sont
   inlinés au démarrage, un refresh ne suffit pas).
2. **Robustesse** — `useJob` traite désormais le 404 comme un état d'arrêt :
   - `isJobNotFound(error)` détecte un `ApiError` de statut 404 ;
   - `refetchInterval` renvoie `false` quand `query.state.error` est un 404 ;
   - `retry` ne retente jamais un 404.
   L'erreur reste exposée via `useJob().error` pour que l'UI puisse l'afficher.

## Pour vérifier

- Mock OFF + backend up → l'upload renvoie un `job_id` réel, le polling suit le
  job jusqu'à `succeeded`/`failed`.
- Job inconnu (mock ON, ou ID purgé) → un seul 404, polling stoppé, plus de
  boucle.
