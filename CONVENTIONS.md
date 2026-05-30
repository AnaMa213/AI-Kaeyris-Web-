# Conventions de codage — AI-Kaeyris-Web (JDR Assistant)

Ces conventions sont **non-négociables** et garanties par ESLint quand possible. Elles préparent la future migration vers un monorepo Turborepo + Hub multi-tenant sans coder la monorepo aujourd'hui.

Origine : Sprint Change Proposal du 2026-05-29 (`_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-29.md`).

---

## Frontières d'import (PC-H3, PC-H6)

**JAMAIS importer `lib/jdr/*` depuis `lib/core/*` ou `components/common/*`.**
Sens unique : le générique ignore le spécifique. Garanti par ESLint `import/no-restricted-paths` activé via `eslint.config.mjs`.

**JAMAIS importer `components/jdr/*` depuis `components/common/*` ou `components/ui/*`.**
Même règle au niveau components. Si tu as besoin d'un composant générique côté JDR : importe-le, ne le modifie pas.

**JAMAIS faire de fetch direct depuis un composant.**
Toujours via `lib/core/api/*` ou `lib/jdr/*/queries.ts`. Garantit l'extraction future de SDK packages sans toucher aux composants UI.

**JAMAIS importer un module `app/(jdr)/*` ou `app/(launcher)/*` depuis un autre route group.**
Les route groups sont des frontières d'application en devenir. Un composant partagé entre deux route groups vit dans `components/common/` ou `lib/core/`.

---

## Identité (PC-H1, PC-H3, PC-H7)

**JAMAIS lire `document.cookie` ou `localStorage` pour de l'auth.**
Toujours via `useCurrentUser()` de `lib/core/session/`. Garantit le swap V1 mock → V2 Hub SSO sans toucher aux composants.

**JAMAIS hardcoder `"MJ"`, `"player"`, `"gm"`, `"mj"` comme string literal dans la logique UI.**
Toujours via un type discriminé (`role: 'mj' | 'player'`) typé depuis `lib/core/session/types.ts`. Préserve la cohérence quand un user pourra être MJ sur une campagne et Joueur sur une autre (V2).

**JAMAIS supposer qu'il existe 1 utilisateur.**
Tout endpoint backend reçoit un `user_id` (même si V1 = toujours Kenan). Pas de `WHERE user_id = 1` côté backend, pas de `currentUser === 'kenan'` côté frontend.

**JAMAIS lire le `campaign_id` depuis l'URL ou un sous-domaine en V1.**
La campagne active vient du backend (`/auth/me`) et est lue via `useCurrentUser().auth.campaignId`. Les URLs (`/c/:campaignId/...`) et sous-domaines (`jdr.kaeyris.com`) sont des décisions V2 différées.

---

## Naming

**JAMAIS mélanger "user JDR" (compte d'auth + character) et "user Hub" (compte global futur).**
- En V1, le terme `User` côté JDR backend = compte JDR. Le `profile: 'gm' | 'user'` reste comme contrat backend stable.
- En V2, on aura `HubUser` (compte global multi-tenant) et `JdrCharacter` (= User actuel renommé). Mais aujourd'hui : pas de renommage prématuré, juste pas de référence "Hub user" dans le code tant que le Hub n'existe pas.

**Anti-pattern : `tenant_id` dans le code JDR.**
Utiliser `campaign_id` (= `campaignId` côté TypeScript). La sémantique JDR est "campagne", pas "tenant" SaaS générique.

**Composants par origine** :
- `components/ui/` = shadcn primitives, **jamais touchées** (tweaks via wrapping)
- `components/common/` = génériques cross-service (FantasyLoader, futur ModuleCard…)
- `components/jdr/` = JDR-flavored (ProfilePicker, SetupWizard, UsersTable, …)

---

## Scope (PC-H6 + règle d'or)

**JAMAIS coder une UI Hub en V1.**
Pas de page `/hub`, pas de switcher de service, pas d'UI de gestion de campagnes en V1. Les hooks architecturaux (route groups `(jdr)/` + `(launcher)/`, identity layer, registry interface) sont **structurels**, pas fonctionnels.

**Règle d'or anti-scope-creep** :
> *Un hook architectural N'EST PAS une feature. Si un champ existe en DB sans UI, c'est intentionnel.*

Exemples d'application :
- `campaign_members.role` existe en DB → pas d'UI de gestion des rôles en V1
- `users.default_campaign_id` existe → pas d'UI de switch de campagne en V1
- `lib/core/session/useCurrentUser()` existe et retourne un triplet → pas de page `/profile` qui l'affiche en V1

---

## Theming

Le thème **dark-fantasy + parchemin** est scopé à `app/(jdr)/layout.tsx`. Aucun CSS global qui assume "tout est JDR".

Quand un futur composant Hub apparaîtra (V2 dans un autre repo), il aura son propre thème dans son route group / son layout / son repo.

**Palette intouchée** : OKLCH chrome 0.18 0.02 270 (`--surface-base`), accent gold 0.78 0.12 85, parchemin warm pour les surfaces de lecture. Ces tokens sont l'identité émotionnelle du JDR ("calm focus" pour le MJ fatigué).

---

## Backend & API

**`docs/context/api/openapi.json`** reste le contrat source. `types/api.ts` régénéré via `npm run gen:api` (pre-commit hook).

**JAMAIS modifier le backend FastAPI depuis ce repo.** Le backend AI-Kaeyris est un projet séparé (AnaMa213/AI-Kaeyris). Les besoins backend sont documentés dans `_bmad-output/planning-artifacts/prds/.../backend-modifications.md` (BD-1, BD-2, BD-3, BD-4) et transmis à l'équipe backend.

**`apiClient` est le seul point d'entrée HTTP frontend.** Créé via `createApiClient()` dans `lib/core/api/client.ts`. Aucun `fetch()` direct hors de cette couche.

---

## Tests unitaires / intégration (Vitest + RTL)

**Convention de placement** : `tests/<source-mirror>/<file>.test.tsx`
- Code à `lib/core/auth/redirect.ts` → test à `tests/lib/core/auth/redirect.test.ts`
- Code à `components/jdr/users/UsersTable.tsx` → test à `tests/components/jdr/users/UsersTable.test.tsx`

**Environnement** : Vitest, environnement Node par défaut, jsdom déclaré par fichier via `// @vitest-environment jsdom` quand on a besoin du DOM.

**Setup partagé** : `tests/setup-jsdom.ts` charge `@testing-library/jest-dom/vitest` + `cleanup()` afterEach.

---

## Tests E2E (Playwright)

**Convention de placement** : `e2e/<feature>/<scenario>.spec.ts`
- Le titre du `test()` décrit ce qui est garanti, pas l'action (ex. "logout redirects to /login without flashback" pas "click logout button")
- Helpers partagés : `e2e/helpers/mocks.ts`

**Quand écrire un E2E** :
- Chorégraphie multi-composants (auth flow, state machine cross-pages, async polling)
- **PAS** pour un composant isolé — reste sur Vitest + RTL

**Mocks backend** : `page.route()` natif Playwright, **JAMAIS** MSW. Décision architecturale Story 1.15 : `page.route()` est intégré, déterministe par test, et évite la couche service-worker qui peut diverger du vrai apiClient.

**Browsers V1** : chromium uniquement. Cross-browser (Firefox, WebKit) ajouté quand un besoin réel apparaît (rapport user "ça marche pas sur X").

**Lancement** :
- `npm run e2e` — build + headless run
- `npm run e2e:ui` — UI mode pour debug local
- CI : `.github/workflows/e2e.yml` (PR + push main)

**Pas en pré-commit/pré-push** : build + browser boot trop lents pour itération. Le CI fait le job.

---

## Git

**Commits** : conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`).

**Pré-commit hook** : `npm run gen:api` (régénère `types/api.ts` depuis `docs/context/api/openapi.json` et bloque si l'openapi.json a des changements unstagés).

**Quality gate avant push (local)** : `npm run lint && npx tsc --noEmit && npm test && npm run build && npm run check:api-types`. Tous green.

**Quality gate avant merge (CI)** : ci-dessus + `npm run e2e`. Le workflow GitHub Actions `e2e.yml` exécute Playwright à chaque PR/push main.

---

## Quand ces conventions deviendront-elles caduques ?

Le jour où un **deuxième service réel** apparaît dans le scope (pas hypothétique — un backend qui tourne, un besoin produit), on bascule le repo vers une monorepo Turborepo réelle :

```
apps/
  jdr/        ← ce repo actuel devient cette app
  service-X/  ← le nouveau service réel

packages/
  core/       ← extrait depuis lib/core/
  ui/         ← extrait depuis components/common/ + components/ui/
  jdr-sdk/    ← extrait depuis lib/jdr/
  jdr-ui/    ← extrait depuis components/jdr/
```

Si on a respecté les frontières ci-dessus depuis le début, l'extraction est **mécanique** (déplacement de dossiers + ajustement des `tsconfig.paths`), pas une réécriture. C'est l'objectif unique du SCP 2026-05-29.

---

*Document maintenu par Kenan. Modifications hors-scope d'une story doivent être documentées dans un nouveau SCP.*
