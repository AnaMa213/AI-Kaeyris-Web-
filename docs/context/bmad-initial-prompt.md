# Initial Prompt - Claude Code + BMAD

Nous créons un nouveau repo frontend séparé pour AI-Kaeyris.

Lis d'abord :

- `docs/context/api/backend-summary.md`
- `docs/context/api/openapi.json`
- `docs/context/api/jdr-workflows.md`
- `docs/context/api/auth.md`
- `docs/context/api/deployment.md`

Objectif : utiliser BMAD pour produire le cadrage du frontend uniquement.

Contraintes :

- Le backend existe déjà dans un repo séparé.
- Le frontend consomme l'API via HTTP/OpenAPI.
- Ne pas modifier le backend.
- Pas de backend-for-frontend.
- Pas d'OAuth.
- Pas de design system complexe.
- Pas de Redux/global state manager sauf justification forte.
- Priorité : workflow JDR utilisable de bout en bout.

Produis :

- `AGENTS.md`
- `docs/product.md`
- `docs/architecture.md`
- `docs/jalons.md`
- `stories/F0-foundations.md`
- `stories/F1-api-client.md`
- `stories/F2-jdr-sessions.md`
- `stories/F3-upload-jobs.md`
- `stories/F4-artifacts.md`
- `stories/F5-deployment.md`

Avant d'écrire beaucoup, propose d'abord la structure et les décisions principales.
