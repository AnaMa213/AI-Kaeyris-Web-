// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModelSettingsCard } from "@/components/jdr/settings/ModelSettingsCard";
import type { ModelSettings } from "@/lib/jdr/schemas/modelSettings";

type RenderOverrides = Partial<React.ComponentProps<typeof ModelSettingsCard>>;

const baseSettings: ModelSettings = {
  transcriptionProvider: "cloud",
  summaryProvider: "cloud",
  transcriptionLocalPath: "",
  summaryLocalPath: "",
  transcriptionCloudModel: "openai/whisper-large-v3",
  summaryCloudModel: "meta-llama/Meta-Llama-3.1-8B-Instruct",
  deepinfraApiKey: "",
  deepinfraApiKeySet: false,
};

const makeSettings = (
  overrides: Partial<ModelSettings> = {},
): ModelSettings => ({
  ...baseSettings,
  ...overrides,
});

function renderCard(overrides: RenderOverrides = {}) {
  const onSubmit = vi.fn();
  render(
    <ModelSettingsCard
      values={baseSettings}
      loading={false}
      submitting={false}
      errorMessage={null}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return { onSubmit };
}

describe("<ModelSettingsCard>", () => {
  test("rend deux selecteurs de provider avec les libelles fonctionnels", async () => {
    const user = userEvent.setup();
    renderCard();

    expect(screen.getByText("Modeles")).toBeInTheDocument();
    expect(screen.getByLabelText("Transcription")).toBeInTheDocument();
    expect(screen.getByLabelText("LLM Resume")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Transcription"));
    expect(
      await screen.findByRole("option", { name: "Cloud" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Local" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Ollama" })).toBeInTheDocument();
    // "DeepInfra" is never a provider option (it's a cloud account credential).
    expect(
      screen.queryByRole("option", { name: /deepinfra/i }),
    ).not.toBeInTheDocument();
  });

  test("initialise les selecteurs depuis les valeurs courantes", () => {
    renderCard({
      values: makeSettings({
        transcriptionProvider: "local",
        summaryProvider: "ollama",
        transcriptionLocalPath: "/models/whisper-large-v3",
      }),
    });

    expect(screen.getByLabelText("Transcription")).toHaveTextContent("Local");
    expect(screen.getByLabelText("LLM Resume")).toHaveTextContent("Ollama");
  });

  test("soumet les valeurs independantes choisies", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderCard();

    await user.click(screen.getByLabelText("Transcription"));
    await user.click(await screen.findByRole("option", { name: "Local" }));
    await user.click(screen.getByLabelText("LLM Resume"));
    await user.click(await screen.findByRole("option", { name: "Ollama" }));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith(
      makeSettings({
        transcriptionProvider: "local",
        summaryProvider: "ollama",
      }),
    );
  });

  test("desactive la soumission et les selecteurs pendant un envoi", () => {
    renderCard({ submitting: true });

    expect(screen.getByLabelText("Transcription")).toBeDisabled();
    expect(screen.getByLabelText("LLM Resume")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Enregistrement..." }),
    ).toBeDisabled();
  });

  test("affiche les etats de chargement et d'erreur inline", () => {
    renderCard({ loading: true, errorMessage: "Backend indisponible" });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Chargement des modeles...",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Backend indisponible");
  });

  test("ne rend pas d'UI de prix/cout (reservee a la Story 6.5)", () => {
    renderCard();

    expect(screen.queryByLabelText(/prix|cout/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  // --- Local model path (Story 6.3) ---------------------------------------

  test("affiche le champ chemin local uniquement quand Local est selectionne", async () => {
    const user = userEvent.setup();
    renderCard();

    expect(
      screen.queryByLabelText(/chemin du modele local \(transcription\)/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/chemin du modele local \(llm resume\)/i),
    ).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Transcription"));
    await user.click(await screen.findByRole("option", { name: "Local" }));

    expect(
      screen.getByLabelText(/chemin du modele local \(transcription\)/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/chemin du modele local \(llm resume\)/i),
    ).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("LLM Resume"));
    await user.click(await screen.findByRole("option", { name: "Local" }));

    expect(
      screen.getByLabelText(/chemin du modele local \(llm resume\)/i),
    ).toBeInTheDocument();
  });

  test("initialise le chemin local depuis les valeurs courantes quand le provider est local", () => {
    renderCard({
      values: makeSettings({
        transcriptionProvider: "local",
        transcriptionLocalPath: "/models/whisper-large-v3",
      }),
    });

    expect(
      screen.getByLabelText(/chemin du modele local \(transcription\)/i),
    ).toHaveValue("/models/whisper-large-v3");
    expect(
      screen.queryByLabelText(/chemin du modele local \(llm resume\)/i),
    ).not.toBeInTheDocument();
  });

  test("soumet le chemin local saisi pour la categorie en Local", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderCard();

    await user.click(screen.getByLabelText("Transcription"));
    await user.click(await screen.findByRole("option", { name: "Local" }));
    await user.type(
      screen.getByLabelText(/chemin du modele local \(transcription\)/i),
      "/models/whisper-large-v3",
    );
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith(
      makeSettings({
        transcriptionProvider: "local",
        transcriptionLocalPath: "/models/whisper-large-v3",
      }),
    );
  });

  test("demande confirmation avant de remplacer un chemin local existant", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderCard({
      values: makeSettings({
        transcriptionProvider: "local",
        transcriptionLocalPath: "/models/whisper-large-v3",
      }),
    });

    const pathInput = screen.getByLabelText(
      /chemin du modele local \(transcription\)/i,
    );
    await user.clear(pathInput);
    await user.type(pathInput, "/models/whisper-small");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Remplacer le chemin" }),
    );

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith(
      makeSettings({
        transcriptionProvider: "local",
        transcriptionLocalPath: "/models/whisper-small",
      }),
    );
  });

  test("ne demande pas confirmation si le chemin local n'a pas change", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderCard({
      values: makeSettings({
        transcriptionProvider: "local",
        transcriptionLocalPath: "/models/whisper-large-v3",
      }),
    });

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("conserve le chemin local saisi quand une erreur est affichee", () => {
    renderCard({
      values: makeSettings({
        transcriptionProvider: "local",
        transcriptionLocalPath: "/models/whisper-large-v3",
      }),
      errorMessage: "Backend indisponible",
    });

    expect(
      screen.getByLabelText(/chemin du modele local \(transcription\)/i),
    ).toHaveValue("/models/whisper-large-v3");
    expect(screen.getByRole("alert")).toHaveTextContent("Backend indisponible");
  });

  // --- Cloud model + DeepInfra key (Story 6.4) ----------------------------

  test("rend le selecteur de modele cloud uniquement quand Cloud est selectionne", async () => {
    const user = userEvent.setup();
    renderCard();

    expect(
      screen.getByLabelText(/modele cloud \(transcription\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/modele cloud \(llm resume\)/i),
    ).toBeInTheDocument();

    await user.click(screen.getByLabelText("Transcription"));
    await user.click(await screen.findByRole("option", { name: "Local" }));

    expect(
      screen.queryByLabelText(/modele cloud \(transcription\)/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText(/chemin du modele local \(transcription\)/i),
    ).toBeInTheDocument();
  });

  test("initialise le selecteur de modele cloud depuis la valeur serveur", () => {
    renderCard({
      values: makeSettings({
        transcriptionCloudModel: "openai/whisper-large-v3-turbo",
      }),
    });

    expect(
      screen.getByLabelText(/modele cloud \(transcription\)/i),
    ).toHaveTextContent("Whisper Large v3 Turbo");
  });

  test("rend un seul champ cle DeepInfra des qu'une categorie est en Cloud", () => {
    renderCard();
    expect(screen.getAllByLabelText("Cle API DeepInfra")).toHaveLength(1);
  });

  test("masque le champ cle DeepInfra quand aucune categorie n'est en Cloud", () => {
    renderCard({
      values: makeSettings({
        transcriptionProvider: "local",
        summaryProvider: "ollama",
      }),
    });

    expect(
      screen.queryByLabelText("Cle API DeepInfra"),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/modele cloud/i)).not.toBeInTheDocument();
  });

  test("affiche le champ cle DeepInfra quand une seule categorie est en Cloud", () => {
    renderCard({
      values: makeSettings({
        transcriptionProvider: "local",
        summaryProvider: "cloud",
      }),
    });

    expect(screen.getByLabelText("Cle API DeepInfra")).toBeInTheDocument();
  });

  test("affiche l'indice 'cle deja enregistree' uniquement si une cle existe", () => {
    const { rerender } = render(
      <ModelSettingsCard
        values={makeSettings({ deepinfraApiKeySet: true })}
        loading={false}
        submitting={false}
        errorMessage={null}
        onSubmit={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/une cle est deja enregistree/i),
    ).toBeInTheDocument();

    rerender(
      <ModelSettingsCard
        values={makeSettings({ deepinfraApiKeySet: false })}
        loading={false}
        submitting={false}
        errorMessage={null}
        onSubmit={vi.fn()}
      />,
    );
    expect(
      screen.queryByText(/une cle est deja enregistree/i),
    ).not.toBeInTheDocument();
  });

  test("saisir une premiere cle (aucune enregistree) soumet sans confirmation", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderCard();

    await user.type(screen.getByLabelText("Cle API DeepInfra"), "di-first-key");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledWith(
      makeSettings({ deepinfraApiKey: "di-first-key" }),
    );
  });

  test("remplacer une cle existante demande confirmation avant la soumission", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderCard({
      values: makeSettings({ deepinfraApiKeySet: true }),
    });

    await user.type(screen.getByLabelText("Cle API DeepInfra"), "di-new-key");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Remplacer la cle" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith(
      makeSettings({ deepinfraApiKeySet: true, deepinfraApiKey: "di-new-key" }),
    );
  });

  test("changer seulement le modele cloud (sans nouvelle cle) soumet sans confirmation", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderCard({
      values: makeSettings({ deepinfraApiKeySet: true }),
    });

    await user.click(screen.getByLabelText(/modele cloud \(transcription\)/i));
    await user.click(
      await screen.findByRole("option", { name: "Whisper Large v3 Turbo" }),
    );
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledWith(
      makeSettings({
        deepinfraApiKeySet: true,
        transcriptionCloudModel: "openai/whisper-large-v3-turbo",
      }),
    );
  });

  test("conserve le modele cloud et la cle saisie quand une erreur est affichee", async () => {
    const user = userEvent.setup();
    renderCard({
      values: makeSettings({ deepinfraApiKeySet: true }),
      errorMessage: "Backend indisponible",
    });

    await user.type(screen.getByLabelText("Cle API DeepInfra"), "typed-key");
    await user.click(screen.getByLabelText(/modele cloud \(transcription\)/i));
    await user.click(
      await screen.findByRole("option", { name: "Whisper Large v3 Turbo" }),
    );

    expect(screen.getByLabelText("Cle API DeepInfra")).toHaveValue("typed-key");
    expect(
      screen.getByLabelText(/modele cloud \(transcription\)/i),
    ).toHaveTextContent("Whisper Large v3 Turbo");
    expect(screen.getByRole("alert")).toHaveTextContent("Backend indisponible");
  });
});
