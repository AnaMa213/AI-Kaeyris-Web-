# AI-Kaeyris-Web - Claude Instructions

- Répondre en français.
- Ce repo est le frontend séparé de AI-Kaeyris.
- Ne jamais modifier le backend depuis ce repo.
- Le backend est consommé via HTTP/OpenAPI uniquement.
- Lire `docs/context/api/backend-summary.md` avant toute décision API uniquement.
- Utiliser `docs/context/api/openapi.json` comme contrat API source.
- Priorité produit : workflow JDR utilisable de bout en bout.
- Travailler story par story.
- Avant une grosse écriture, proposer le plan et les fichiers touchés.
- Quand la session devient longue, proposer `/compact` avec un résumé des décisions.
  021

## Token discipline

- Ne jamais lire tout le repo sans raison.
- Toujours commencer par identifier les fichiers pertinents.
- Lire seulement les fichiers nécessaires à la tâche.
- Ne jamais coller le contenu complet de `openapi.json` dans la réponse.
- Préférer les références de fichiers aux longs résumés.
- À la fin d'une tâche, produire un résumé court : décisions, fichiers modifiés, tests, next step.
