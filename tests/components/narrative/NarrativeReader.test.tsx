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
});
