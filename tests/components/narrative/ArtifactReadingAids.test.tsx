// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ArtifactReadingAids } from "@/components/narrative/ArtifactReadingAids";

describe("<ArtifactReadingAids>", () => {
  test("renders word count and reading time", () => {
    render(<ArtifactReadingAids markdown="Un deux trois" />);

    expect(
      screen.getByText("~3 mots · ≈ 1 min de lecture"),
    ).toBeInTheDocument();
  });

  test("renders nothing for empty markdown", () => {
    const { container } = render(<ArtifactReadingAids markdown={"   \n"} />);

    expect(container.firstChild).toBeNull();
  });

  test("renders nothing when runtime data has no markdown text", () => {
    const { container } = render(
      <ArtifactReadingAids markdown={undefined as unknown as string} />,
    );

    expect(container.firstChild).toBeNull();
  });
});
