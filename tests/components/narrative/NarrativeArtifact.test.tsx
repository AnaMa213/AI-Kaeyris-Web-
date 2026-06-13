// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { render } from "@testing-library/react";
import { NarrativeArtifact } from "@/components/narrative/NarrativeArtifact";

// Markdown représentatif d'un artefact long-form : titre, prose, sous-titres,
// citation (pull-quote), thematic break (ornament), liste.
const MARKDOWN = [
  "# Titre principal",
  "",
  "Il etait une fois un heros courageux qui partit a l'aventure au petit matin.",
  "",
  "## Chapitre Un",
  "",
  "Le voyage commenca au lever du soleil, sur les routes poussiereuses du royaume.",
  "",
  "> Une citation marquante au fil du recit.",
  "",
  "---",
  "",
  "### Sous section",
  "",
  "- Premier point",
  "- Second point",
  "",
  "Texte final du passage.",
].join("\n");

describe("<NarrativeArtifact> (Story 5.1)", () => {
  test("rend le contenu dans un <article> sur le budget typographique parchemin", () => {
    const { container } = render(
      <NarrativeArtifact markdown={MARKDOWN} kind="narrative" />,
    );
    const article = container.querySelector("article");
    expect(article).not.toBeNull();
    expect(article).toHaveClass("narrative-body");
    // Le corps long-form passe sur parchemin (séparation chrome/parchemin).
    expect(article).toHaveClass("bg-surface-narrative");
    expect(article).toHaveClass("font-serif");
    // Mesure de lecture UX-DR3 (max-w 68ch).
    expect(article?.className).toContain("max-w-[68ch]");
    expect(container.textContent).toContain("Texte final du passage.");
  });

  test("applique la lettrine (drop-cap) pour les kinds prose : narrative", () => {
    const { container } = render(
      <NarrativeArtifact markdown={MARKDOWN} kind="narrative" />,
    );
    expect(container.querySelector("article")).toHaveClass(
      "narrative-body--dropcap",
    );
  });

  test.each(["summary", "pov"] as const)(
    "applique la lettrine pour le kind prose %s",
    (kind) => {
      const { container } = render(
        <NarrativeArtifact markdown={MARKDOWN} kind={kind} />,
      );
      expect(container.querySelector("article")).toHaveClass(
        "narrative-body--dropcap",
      );
    },
  );

  test("n'applique PAS la lettrine pour le kind elements (liste structurée)", () => {
    const { container } = render(
      <NarrativeArtifact markdown={MARKDOWN} kind="elements" />,
    );
    const article = container.querySelector("article");
    expect(article).toHaveClass("narrative-body");
    expect(article).not.toHaveClass("narrative-body--dropcap");
  });

  test("rend les blockquote en pull-quote (barre d'accent)", () => {
    const { container } = render(
      <NarrativeArtifact markdown={MARKDOWN} kind="narrative" />,
    );
    const pull = container.querySelector("blockquote.narrative-pullquote");
    expect(pull).not.toBeNull();
    expect(pull?.textContent).toContain("Une citation marquante");
  });

  test("rend un `---` en <hr class=narrative-ornament> (ornement centralisé)", () => {
    const { container } = render(
      <NarrativeArtifact markdown={MARKDOWN} kind="narrative" />,
    );
    expect(container.querySelector("hr.narrative-ornament")).not.toBeNull();
  });

  test("attribue des ids déterministes aux titres h2/h3 (rehype-slug) + lien d'ancrage (autolink)", () => {
    const { container } = render(
      <NarrativeArtifact markdown={MARKDOWN} kind="narrative" />,
    );
    // ids déterministes (prérequis Story 5.2 TocSidebar).
    expect(container.querySelector("h2#chapitre-un")).not.toBeNull();
    expect(container.querySelector("h3#sous-section")).not.toBeNull();
    // rehype-autolink-headings (behavior:"wrap") → lien focusable vers l'ancre.
    expect(
      container.querySelector('h2 a[href="#chapitre-un"]'),
    ).not.toBeNull();
  });
});
