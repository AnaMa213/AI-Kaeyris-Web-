// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StuckTranscriptionCard } from "@/components/jdr/sessions/StuckTranscriptionCard";

describe("<StuckTranscriptionCard> (Story 4.23 AC10)", () => {
  test("renders the interrupted message and both affordances", () => {
    render(
      <StuckTranscriptionCard onRetry={vi.fn()} onRecover={vi.fn()} />,
    );
    expect(
      screen.getByRole("heading", { name: "Transcription interrompue" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Réessayer" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Débloquer la séance" }),
    ).toBeInTheDocument();
  });

  test("wires the retry and recover handlers", async () => {
    const onRetry = vi.fn();
    const onRecover = vi.fn();
    const user = userEvent.setup();
    render(<StuckTranscriptionCard onRetry={onRetry} onRecover={onRecover} />);

    await user.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Débloquer la séance" }));
    expect(onRecover).toHaveBeenCalledTimes(1);
  });

  test("disables the recover button and shows a pending label while recovering", () => {
    render(
      <StuckTranscriptionCard onRetry={vi.fn()} onRecover={vi.fn()} recovering />,
    );
    const button = screen.getByRole("button", { name: "Déblocage…" });
    expect(button).toBeDisabled();
  });
});
