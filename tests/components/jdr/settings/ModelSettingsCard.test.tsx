// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModelSettingsCard } from "@/components/jdr/settings/ModelSettingsCard";
import { ApiError } from "@/lib/core/api/errors";
import type { ModelSettings } from "@/lib/jdr/schemas/modelSettings";

type RenderOverrides = Partial<React.ComponentProps<typeof ModelSettingsCard>>;

const makeValidationResult = (
  overrides: Partial<{
    validationId: string;
    category: "transcription" | "summary";
    modelPath: string;
    message: string;
  }> = {},
) => ({
  validationId: "proof-1",
  category: "transcription" as const,
  modelPath: "/models/whisper-large-v3",
  status: "succeeded" as const,
  runtime: "faster-whisper",
  modelFormat: "ctranslate2-whisper",
  message: "Modele charge et accepte.",
  expiresAt: "2026-06-16T12:00:00Z",
  ...overrides,
});

const baseSettings: ModelSettings = {
  transcriptionProvider: "cloud",
  summaryProvider: "cloud",
  transcriptionLocalPath: "",
  summaryLocalPath: "",
  transcriptionCloudModel: "openai/whisper-large-v3",
  summaryCloudModel: "meta-llama/Meta-Llama-3.1-8B-Instruct",
  ollamaModel: "",
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
  const onValidate = vi.fn(async () => makeValidationResult());
  render(
    <ModelSettingsCard
      values={baseSettings}
      loading={false}
      submitting={false}
      errorMessage={null}
      onSubmit={onSubmit}
      onValidate={onValidate}
      {...overrides}
    />,
  );
  return { onSubmit, onValidate };
}

describe("<ModelSettingsCard>", () => {
  test("rend deux selecteurs de provider avec les libelles fonctionnels", async () => {
    const user = userEvent.setup();
    renderCard();

    expect(screen.getByText("Modeles")).toBeInTheDocument();
    expect(screen.getByLabelText("Transcription")).toBeInTheDocument();
    expect(screen.getByLabelText("LLM Resume")).toBeInTheDocument();

    // Transcription selector (Story 6.5 AC6): only Cloud and Local — Ollama is
    // not a valid transcription provider.
    await user.click(screen.getByLabelText("Transcription"));
    expect(
      await screen.findByRole("option", { name: "Cloud" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Local" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Ollama" }),
    ).not.toBeInTheDocument();
    // "DeepInfra" is never a provider option (it's a cloud account credential).
    expect(
      screen.queryByRole("option", { name: /deepinfra/i }),
    ).not.toBeInTheDocument();

    // LLM Résumé selector still offers all three providers, Ollama included.
    await user.keyboard("{Escape}");
    await user.click(screen.getByLabelText("LLM Resume"));
    expect(
      await screen.findByRole("option", { name: "Ollama" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Cloud" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Local" })).toBeInTheDocument();
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
      {},
    );
  });

  test("rend les modeles cloud servis par le catalogue backend", async () => {
    const user = userEvent.setup();
    renderCard({
      summaryCloudModelOptions: [
        { value: "meta-llama/Meta-Llama-3.1-8B-Instruct", label: "Llama 8B · Éco" },
        {
          value: "meta-llama/Meta-Llama-3.1-70B-Instruct",
          label: "Llama 70B · Premium",
        },
      ],
    });

    // The summary cloud selector is visible (summaryProvider === "cloud") and
    // renders the catalog-provided labels, not the hardcoded fallback list.
    await user.click(screen.getByLabelText("Modele cloud (LLM Resume)"));
    expect(
      await screen.findByRole("option", { name: "Llama 70B · Premium" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Llama 8B · Éco" }),
    ).toBeInTheDocument();
    // A model absent from the served catalog must not appear.
    expect(
      screen.queryByRole("option", { name: /Qwen/ }),
    ).not.toBeInTheDocument();
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

  test("soumet le chemin local saisi pour la categorie en Local apres un test reussi", async () => {
    const user = userEvent.setup();
    const { onSubmit, onValidate } = renderCard();

    await user.click(screen.getByLabelText("Transcription"));
    await user.click(await screen.findByRole("option", { name: "Local" }));
    await user.type(
      screen.getByLabelText(/chemin du modele local \(transcription\)/i),
      "/models/whisper-large-v3",
    );

    // Story 6.6 (AC4): a changed Local path must be tested before saving.
    await user.click(screen.getByRole("button", { name: "Tester le modele" }));
    await waitFor(() =>
      expect(onValidate).toHaveBeenCalledWith(
        "transcription",
        "/models/whisper-large-v3",
      ),
    );
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith(
      makeSettings({
        transcriptionProvider: "local",
        transcriptionLocalPath: "/models/whisper-large-v3",
      }),
      { transcription: "proof-1" },
    );
  });

  test("la confirmation de remplacement n'apparait qu'apres un test reussi", async () => {
    const user = userEvent.setup();
    const { onSubmit, onValidate } = renderCard({
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

    // Save is gated until the changed Local path is validated: clicking
    // Enregistrer does nothing (no dialog, no submit) while it is disabled.
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Tester le modele" }));
    await waitFor(() =>
      expect(onValidate).toHaveBeenCalledWith(
        "transcription",
        "/models/whisper-small",
      ),
    );

    // Only after a successful test does the destructive replace confirmation
    // gate the submit (Story 6.6 Task 4).
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
      { transcription: "proof-1" },
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
        onValidate={vi.fn(async () => makeValidationResult())}
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
        onValidate={vi.fn(async () => makeValidationResult())}
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
      {},
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
      {},
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
      {},
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

  // --- Ollama model (Story 6.5) -------------------------------------------

  test("affiche l'avertissement et le champ modele Ollama uniquement quand LLM Resume est Ollama", async () => {
    const user = userEvent.setup();
    // Transcription is "local" so the only thing that could surface the
    // DeepInfra key input is the LLM Résumé provider — letting us assert that
    // switching it to Ollama does NOT show a cloud key (Ollama is keyless).
    renderCard({ values: makeSettings({ transcriptionProvider: "local" }) });

    // Default summary provider is "cloud": no Ollama UI.
    expect(
      screen.queryByLabelText(/modele ollama \(llm resume\)/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/ollama doit etre actif/i),
    ).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("LLM Resume"));
    await user.click(await screen.findByRole("option", { name: "Ollama" }));

    expect(
      screen.getByText(
        /ollama doit etre actif pour que cette configuration fonctionne/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/modele ollama \(llm resume\)/i),
    ).toBeInTheDocument();
    // Ollama is not a cloud key: with transcription on Local too, the DeepInfra
    // input must stay hidden.
    expect(
      screen.queryByLabelText("Cle API DeepInfra"),
    ).not.toBeInTheDocument();
  });

  test("initialise le champ modele Ollama depuis les valeurs serveur", () => {
    renderCard({
      values: makeSettings({
        summaryProvider: "ollama",
        ollamaModel: "llama3:8b",
      }),
    });

    expect(
      screen.getByLabelText(/modele ollama \(llm resume\)/i),
    ).toHaveValue("llama3:8b");
  });

  test("soumet le nom de modele Ollama saisi pour LLM Resume", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderCard();

    await user.click(screen.getByLabelText("LLM Resume"));
    await user.click(await screen.findByRole("option", { name: "Ollama" }));
    await user.type(
      screen.getByLabelText(/modele ollama \(llm resume\)/i),
      "mistral:7b",
    );
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith(
      makeSettings({ summaryProvider: "ollama", ollamaModel: "mistral:7b" }),
      {},
    );
  });

  // --- Local model validation / "Tester le modele" (Story 6.6) ------------

  test("le bouton Tester le modele n'apparait qu'en Local avec un chemin non vide", async () => {
    const user = userEvent.setup();
    renderCard();

    // Cloud by default: no test button anywhere.
    expect(
      screen.queryByRole("button", { name: "Tester le modele" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Transcription"));
    await user.click(await screen.findByRole("option", { name: "Local" }));

    // Local but empty path: still no button.
    expect(
      screen.queryByRole("button", { name: "Tester le modele" }),
    ).not.toBeInTheDocument();

    await user.type(
      screen.getByLabelText(/chemin du modele local \(transcription\)/i),
      "/models/whisper-large-v3",
    );
    expect(
      screen.getByRole("button", { name: "Tester le modele" }),
    ).toBeInTheDocument();
  });

  test("desactive Enregistrer tant qu'un chemin local change n'est pas valide", async () => {
    const user = userEvent.setup();
    const { onValidate } = renderCard();

    await user.click(screen.getByLabelText("Transcription"));
    await user.click(await screen.findByRole("option", { name: "Local" }));
    await user.type(
      screen.getByLabelText(/chemin du modele local \(transcription\)/i),
      "/models/whisper-large-v3",
    );

    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
    expect(
      screen.getByText(/teste le modele local avant d'enregistrer/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tester le modele" }));
    await waitFor(() => expect(onValidate).toHaveBeenCalledOnce());

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Enregistrer" })).toBeEnabled(),
    );
  });

  test("affiche l'etat succes du test et reactive Enregistrer", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByLabelText("Transcription"));
    await user.click(await screen.findByRole("option", { name: "Local" }));
    await user.type(
      screen.getByLabelText(/chemin du modele local \(transcription\)/i),
      "/models/whisper-large-v3",
    );
    await user.click(screen.getByRole("button", { name: "Tester le modele" }));

    expect(
      await screen.findByText("Modele charge et accepte."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeEnabled();
  });

  test("affiche l'erreur backend inline et laisse Enregistrer desactive", async () => {
    const user = userEvent.setup();
    const onValidate = vi.fn(async () => {
      throw new ApiError({
        type: "local-model-incompatible-task",
        title: "Modele incompatible",
        status: 422,
        detail: "Ce modele n'est pas un modele Whisper/ASR.",
      });
    });
    renderCard({ onValidate });

    await user.click(screen.getByLabelText("Transcription"));
    await user.click(await screen.findByRole("option", { name: "Local" }));
    await user.type(
      screen.getByLabelText(/chemin du modele local \(transcription\)/i),
      "/models/not-a-whisper",
    );
    await user.click(screen.getByRole("button", { name: "Tester le modele" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Ce modele n'est pas un modele Whisper/ASR.");
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
  });

  test("editer le chemin apres un test reussi invalide la preuve et redesactive Enregistrer", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByLabelText("Transcription"));
    await user.click(await screen.findByRole("option", { name: "Local" }));
    const pathInput = screen.getByLabelText(
      /chemin du modele local \(transcription\)/i,
    );
    await user.type(pathInput, "/models/whisper-large-v3");
    await user.click(screen.getByRole("button", { name: "Tester le modele" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Enregistrer" })).toBeEnabled(),
    );

    // AC5: editing the validated path invalidates the probe.
    await user.type(pathInput, "-turbo");

    expect(
      screen.queryByText("Modele charge et accepte."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
  });

  test("un chemin local existant inchange n'exige pas de nouveau test", () => {
    renderCard({
      values: makeSettings({
        transcriptionProvider: "local",
        transcriptionLocalPath: "/models/whisper-large-v3",
      }),
    });

    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeEnabled();
  });
});
