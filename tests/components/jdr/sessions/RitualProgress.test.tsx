// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RitualProgress } from "@/components/jdr/sessions/RitualProgress";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("<RitualProgress>", () => {
  test("idle → renders nothing", () => {
    const { container } = render(
      <RitualProgress uiState="idle" sessionTitle="Séance 12" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test("uploading → acte I title, no technical vocabulary leaks into the DOM", () => {
    const { container } = render(
      <RitualProgress uiState="uploading" sessionTitle="Séance 12" />,
    );
    expect(screen.getByText("Le parchemin se prépare")).toBeInTheDocument();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/Réduction audio/i);
    expect(text).not.toMatch(/ffmpeg/i);
    expect(text).not.toMatch(/réduction/i);
    expect(text).not.toMatch(/%/);
  });

  test("transcribing → acte II title", () => {
    render(<RitualProgress uiState="transcribing" sessionTitle="Séance 12" />);
    expect(screen.getByText("Les scribes transcrivent")).toBeInTheDocument();
  });

  test("transcribing + phase 'reducing' → preparation habillage (BD-10)", () => {
    render(
      <RitualProgress
        uiState="transcribing"
        sessionTitle="Séance 12"
        phase="reducing"
        progress={12}
      />,
    );
    expect(screen.getByText("Le grimoire se prépare")).toBeInTheDocument();
    expect(
      screen.queryByText("Les scribes transcrivent"),
    ).not.toBeInTheDocument();
    // determinate bar still driven by the real percent during reduce
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "12",
    );
  });

  test("transcribing + phase 'transcribing' → scribes habillage", () => {
    render(
      <RitualProgress
        uiState="transcribing"
        sessionTitle="Séance 12"
        phase="transcribing"
      />,
    );
    expect(screen.getByText("Les scribes transcrivent")).toBeInTheDocument();
    expect(screen.queryByText("Le grimoire se prépare")).not.toBeInTheDocument();
  });

  test("transcribing without phase → scribes habillage (degradation)", () => {
    render(
      <RitualProgress
        uiState="transcribing"
        sessionTitle="Séance 12"
        phase={null}
      />,
    );
    expect(screen.getByText("Les scribes transcrivent")).toBeInTheDocument();
  });

  test("transcribing with a numeric progress → determinate progressbar + '58 %'", () => {
    render(
      <RitualProgress
        uiState="transcribing"
        sessionTitle="Séance 12"
        progress={58}
      />,
    );
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "58");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByText("58 %")).toBeInTheDocument();
  });

  test("transcribing with null progress → no progressbar (indeterminate credible bar)", () => {
    render(
      <RitualProgress
        uiState="transcribing"
        sessionTitle="Séance 12"
        progress={null}
      />,
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  test("transcribed → acte III title + 'Ouvrir le récit' CTA", () => {
    const onOpenStory = vi.fn();
    render(
      <RitualProgress
        uiState="transcribed"
        sessionTitle="Séance 12"
        onOpenStory={onOpenStory}
      />,
    );
    expect(screen.getByText("Le récit est consigné")).toBeInTheDocument();
    expect(
      screen.getByText("Ta session est gravée dans le grimoire."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ouvrir le récit" }),
    ).toBeInTheDocument();
  });

  test("failed → acte échec title + retry/replace actions present", () => {
    render(
      <RitualProgress
        uiState="failed"
        sessionTitle="Séance 12"
        onRetry={vi.fn()}
        onReplace={vi.fn()}
      />,
    );
    expect(screen.getByText("Le grimoire est resté muet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Relancer la transcription" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remplacer l'enregistrement" }),
    ).toBeInTheDocument();
  });

  test("exposes an accessible role=status node; decorative SVGs are aria-hidden", () => {
    const { container } = render(
      <RitualProgress uiState="transcribing" sessionTitle="Séance 12" />,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });
  });

  test("the 'Ouvrir le récit' CTA fires onOpenStory when provided", async () => {
    const onOpenStory = vi.fn();
    render(
      <RitualProgress
        uiState="transcribed"
        sessionTitle="Séance 12"
        onOpenStory={onOpenStory}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Ouvrir le récit" }));
    expect(onOpenStory).toHaveBeenCalledTimes(1);
  });

  // Story 4.15 (T2) — when a transcription job is active the page passes a
  // `replaceDisabledHint` instead of `onReplace`: the replace trigger stays
  // visible but disabled, so no second transcription can be launched.
  describe("Story 4.15 — replace trigger guard", () => {
    test("transcribing + replaceDisabledHint → disabled 'Remplacer' carrying the hint", () => {
      render(
        <RitualProgress
          uiState="transcribing"
          sessionTitle="Séance 12"
          replaceDisabledHint="Transcription en cours — patiente."
        />,
      );
      const replace = screen.getByRole("button", {
        name: "Remplacer l'enregistrement",
      });
      expect(replace).toBeDisabled();
      expect(replace).toHaveAttribute(
        "title",
        "Transcription en cours — patiente.",
      );
    });

    test("transcribing + onReplace (no hint) → enabled 'Remplacer' (legacy path)", () => {
      render(
        <RitualProgress
          uiState="transcribing"
          sessionTitle="Séance 12"
          onReplace={vi.fn()}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Remplacer l'enregistrement" }),
      ).toBeEnabled();
    });

    test("the disabled replace button does not fire onReplace when clicked", async () => {
      const onReplace = vi.fn();
      render(
        <RitualProgress
          uiState="transcribing"
          sessionTitle="Séance 12"
          onReplace={onReplace}
          replaceDisabledHint="Transcription en cours."
        />,
      );
      const user = userEvent.setup();
      await user.click(
        screen.getByRole("button", { name: "Remplacer l'enregistrement" }),
      );
      expect(onReplace).not.toHaveBeenCalled();
    });

    test("failed act also honours replaceDisabledHint (disabled + hint)", () => {
      render(
        <RitualProgress
          uiState="failed"
          sessionTitle="Séance 12"
          onRetry={vi.fn()}
          replaceDisabledHint="Transcription en cours."
        />,
      );
      const replace = screen.getByRole("button", {
        name: "Remplacer l'enregistrement",
      });
      expect(replace).toBeDisabled();
      expect(replace).toHaveAttribute("title", "Transcription en cours.");
    });
  });
});
