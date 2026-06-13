// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { NarrativeReader } from "@/components/narrative/NarrativeReader";

describe("<NarrativeReader>", () => {
  test("renders reading aids above the narrative artifact", () => {
    render(
      <NarrativeReader
        markdown={"Une phrase courte pour lire."}
        kind="narrative"
      />,
    );

    expect(
      screen.getByText("~5 mots · ≈ 1 min de lecture"),
    ).toBeInTheDocument();
    expect(screen.getByText("Une phrase courte pour lire.")).toBeInTheDocument();
  });

  test("keeps the TOC as a right-side rail on xl viewports", () => {
    const { container } = render(
      <NarrativeReader
        markdown={"## Un\n\nTexte.\n\n## Deux\n\nSuite."}
        kind="summary"
      />,
    );

    const root = container.firstElementChild;
    const article = container.querySelector("article");
    expect(root).toHaveClass("xl:grid");
    expect(root?.className).toContain("xl:grid-cols-[1fr_minmax(0,13rem)]");
    expect(article).toHaveClass("w-full");
  });
});
