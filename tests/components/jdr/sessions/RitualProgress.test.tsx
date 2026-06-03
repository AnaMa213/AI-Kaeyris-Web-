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
});
