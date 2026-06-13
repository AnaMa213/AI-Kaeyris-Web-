"use client";

import Markdown, { type Components } from "react-markdown";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings, {
  type Options as AutolinkOptions,
} from "rehype-autolink-headings";
import { cn } from "@/lib/utils";

/**
 * Story 5.1 — composant de rendu Markdown long-form réutilisé par tous les
 * panneaux d'artefacts (Récit, Résumé, POV). Présentationnel et piloté par
 * props : il ne fetch rien, il reçoit le `markdown` brut produit par le LLM.
 *
 * Divergence cadrée (cf. story §Divergence architecturale) : le titre PRD parle
 * de « Server Component » mais, depuis la Story 4.21, le texte d'artefact arrive
 * côté client via TanStack Query. Le composant est donc monté DANS des panneaux
 * `"use client"` → il s'exécute en Client Component. react-markdown v10 le
 * supporte sans réserve. Ne PAS réintroduire de route `artefacts/[kind]`.
 *
 * Le budget typographique (UX-DR3 : Crimson Pro, 18px/1.65, drop-cap,
 * pull-quote, ornement) est porté par les classes `.narrative-body*` de
 * `app/globals.css` — scopées pour ne jamais fuir sur les surfaces chrome.
 */

export type NarrativeArtifactKind = "summary" | "narrative" | "elements" | "pov";

// La lettrine n'a de sens que sur de la prose continue. `elements` est une
// fiche structurée (listes) → pas de drop-cap (AC3).
const DROPCAP_KINDS: ReadonlySet<NarrativeArtifactKind> = new Set([
  "summary",
  "narrative",
  "pov",
]);

// Décision V1 (story §Plugins) : on stylise via l'override `components` de
// react-markdown plutôt que d'écrire des plugins rehype custom — zéro plugin à
// maintenir, plus testable. À extraire vers `lib/markdown/plugins/` seulement si
// une logique de transformation le justifie un jour.
const MARKDOWN_COMPONENTS: Components = {
  // AC5 — `---` (thematic break) → ornement orné, centralisé en CSS.
  hr: () => <hr className="narrative-ornament" />,
  // AC4 — blockquote → pull-quote avec barre d'accent rouge.
  blockquote: ({ children }) => (
    <blockquote className="narrative-pullquote">{children}</blockquote>
  ),
};

// AC6 — ids de titres stables (rehype-slug) + lien d'ancrage focusable
// (rehype-autolink-headings, behavior "wrap"). Les ids déterministes débloquent
// la TocSidebar (Story 5.2).
const AUTOLINK_OPTIONS: AutolinkOptions = { behavior: "wrap" };

interface NarrativeArtifactProps {
  markdown: string;
  kind: NarrativeArtifactKind;
}

export function NarrativeArtifact({ markdown, kind }: NarrativeArtifactProps) {
  return (
    <article
      data-kind={kind}
      className={cn(
        // AC2 — budget typo parchemin (tokens existants de globals.css).
        "narrative-body bg-surface-narrative text-text-narrative font-serif",
        "w-full rounded-[8px] px-6 py-6 text-[18px] leading-[1.65] sm:px-8 sm:py-7",
        // AC3 — lettrine conditionnée au kind.
        DROPCAP_KINDS.has(kind) && "narrative-body--dropcap",
      )}
    >
      <Markdown
        rehypePlugins={[rehypeSlug, [rehypeAutolinkHeadings, AUTOLINK_OPTIONS]]}
        components={MARKDOWN_COMPONENTS}
      >
        {markdown}
      </Markdown>
    </article>
  );
}
