// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModelPricingCard } from "@/components/jdr/settings/ModelPricingCard";

describe("<ModelPricingCard>", () => {
  test("affiche une ligne de reference par modele cloud configure", () => {
    render(
      <ModelPricingCard
        transcriptionCloudModel="openai/whisper-large-v3"
        summaryCloudModel="meta-llama/Meta-Llama-3.1-8B-Instruct"
      />,
    );

    // Reference table: one row per configured cloud model (AC2).
    expect(screen.getByText(/Whisper Large v3/)).toBeInTheDocument();
    expect(screen.getByText(/Llama 3.1 8B Instruct/)).toBeInTheDocument();
    expect(screen.getByText("$0.00045 / min")).toBeInTheDocument();
    expect(
      screen.getByText("$0.02 (entree) · $0.05 (sortie) / 1M tokens"),
    ).toBeInTheDocument();
  });

  test("n'affiche que la categorie cloud: l'autre categorie est omise de la table", () => {
    render(
      <ModelPricingCard
        transcriptionCloudModel="openai/whisper-large-v3"
        summaryCloudModel={null}
      />,
    );

    // Only the transcription model is listed in the reference table.
    expect(screen.getByText(/Whisper Large v3/)).toBeInTheDocument();
    expect(screen.queryByText(/Llama 3.1 8B Instruct/)).not.toBeInTheDocument();
    // The non-cloud category still appears in the estimate, marked "—".
    expect(screen.getByText("LLM Resume")).toBeInTheDocument();
  });

  test("le cout estime se met a jour quand la duree change (AC4)", async () => {
    const user = userEvent.setup();
    render(
      <ModelPricingCard
        transcriptionCloudModel="openai/whisper-large-v3"
        summaryCloudModel={null}
      />,
    );

    // Default 4 h: 4 * 60 * 0.00045 = $0.108.
    expect(screen.getByText("$0.108")).toBeInTheDocument();

    const hoursInput = screen.getByLabelText("Duree de session (heures)");
    await user.clear(hoursInput);
    await user.type(hoursInput, "8");

    // 8 h: 8 * 60 * 0.00045 = $0.216.
    expect(screen.getByText("$0.216")).toBeInTheDocument();
    expect(screen.queryByText("$0.108")).not.toBeInTheDocument();
  });

  test("affiche un avertissement que les tarifs sont indicatifs (AC6)", () => {
    render(
      <ModelPricingCard
        transcriptionCloudModel="openai/whisper-large-v3"
        summaryCloudModel={null}
      />,
    );

    expect(screen.getByText(/tarifs peuvent varier/i)).toBeInTheDocument();
    expect(screen.getByText(/deepinfra\.com/i)).toBeInTheDocument();
  });
});
