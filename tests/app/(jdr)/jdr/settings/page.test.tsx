// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/core/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccessMock(...a),
    error: (...a: unknown[]) => toastErrorMock(...a),
  },
}));

const userMock = vi.hoisted(() => ({
  current: {
    status: "authenticated" as const,
    auth: {
      authId: "user-uuid-1",
      username: "kenan",
      systemRole: "admin" as const,
    },
    activeCampaign: null,
  } as unknown,
}));

vi.mock("@/lib/core/session/useCurrentUser", () => ({
  useCurrentUser: () => userMock.current,
}));

const { default: SettingsPage } = await import("@/app/(jdr)/jdr/settings/page");

const userOut = {
  id: "user-uuid-1",
  username: "kenan",
  system_role: "admin" as const,
  status: "active" as const,
  created_at: "2026-06-15T10:00:00Z",
  updated_at: "2026-06-15T10:00:00Z",
  last_login_at: null,
};

type ApiModelSettings = {
  transcription_provider: string;
  summary_provider: string;
  transcription_local_path: string | null;
  summary_local_path: string | null;
  transcription_cloud_model: string | null;
  summary_cloud_model: string | null;
  ollama_model: string | null;
  deepinfra_api_key_set: boolean;
};

const defaultModelSettings: ApiModelSettings = {
  transcription_provider: "cloud",
  summary_provider: "cloud",
  transcription_local_path: null,
  summary_local_path: null,
  transcription_cloud_model: null,
  summary_cloud_model: null,
  ollama_model: null,
  deepinfra_api_key_set: false,
};

type CapturedRequest = {
  method: string;
  url: string;
  body: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type":
        status >= 400 ? "application/problem+json" : "application/json",
    },
  });
}

function mockSettingsPageFetch({
  settings = {},
  settingsPatchStatus = 200,
  settingsPatchTitle = "Provider update failed",
  settingsPatchType = "about:blank",
  settingsPatchDetail,
  userPatchStatus = 200,
  userPatchTitle = "Forbidden",
  validationStatus = 200,
  validationType = "local-model-incompatible-task",
  validationTitle = "Modele incompatible",
  validationDetail = "Ce modele n'est pas un modele Whisper/ASR.",
}: {
  settings?: Partial<ApiModelSettings>;
  settingsPatchStatus?: number;
  settingsPatchTitle?: string;
  settingsPatchType?: string;
  settingsPatchDetail?: string;
  userPatchStatus?: number;
  userPatchTitle?: string;
  validationStatus?: number;
  validationType?: string;
  validationTitle?: string;
  validationDetail?: string;
} = {}) {
  const calls: CapturedRequest[] = [];
  // Stateful model settings so a saved DeepInfra key flips the
  // `deepinfra_api_key_set` indicator on refetch — the raw key is NEVER
  // serialized back (mirrors the backend's write-only contract).
  const current: ApiModelSettings = { ...defaultModelSettings, ...settings };
  let keySet = current.deepinfra_api_key_set;

  const modelSettingsOut = (): ApiModelSettings => ({
    transcription_provider: current.transcription_provider,
    summary_provider: current.summary_provider,
    transcription_local_path: current.transcription_local_path,
    summary_local_path: current.summary_local_path,
    transcription_cloud_model: current.transcription_cloud_model,
    summary_cloud_model: current.summary_cloud_model,
    ollama_model: current.ollama_model,
    deepinfra_api_key_set: keySet,
  });

  const fetchMock = vi.fn(async (request: Request) => {
    const body = request.method === "GET" ? "" : await request.clone().text();
    calls.push({ method: request.method, url: request.url, body });

    if (
      request.method === "GET" &&
      request.url.includes("/services/jdr/settings/models")
    ) {
      return jsonResponse(modelSettingsOut());
    }

    if (
      request.method === "POST" &&
      request.url.includes("/services/jdr/settings/models/local/validation")
    ) {
      if (validationStatus >= 400) {
        return jsonResponse(
          {
            type: validationType,
            title: validationTitle,
            status: validationStatus,
            detail: validationDetail,
          },
          validationStatus,
        );
      }
      const reqBody = body ? JSON.parse(body) : {};
      return jsonResponse({
        validation_id: "proof-xyz",
        category: reqBody.category,
        model_path: reqBody.model_path,
        status: "succeeded",
        runtime: "faster-whisper",
        model_format: "ctranslate2-whisper",
        message: "Modele charge et accepte.",
        expires_at: "2026-06-16T12:00:00Z",
      });
    }

    if (
      request.method === "PATCH" &&
      request.url.includes("/services/jdr/settings/models")
    ) {
      if (settingsPatchStatus >= 400) {
        return jsonResponse(
          {
            type: settingsPatchType,
            title: settingsPatchTitle,
            status: settingsPatchStatus,
            ...(settingsPatchDetail ? { detail: settingsPatchDetail } : {}),
          },
          settingsPatchStatus,
        );
      }
      const patch = body ? JSON.parse(body) : {};
      for (const key of [
        "transcription_provider",
        "summary_provider",
        "transcription_local_path",
        "summary_local_path",
        "transcription_cloud_model",
        "summary_cloud_model",
        "ollama_model",
      ] as const) {
        if (patch[key] !== undefined) {
          (current as Record<string, unknown>)[key] = patch[key];
        }
      }
      if (patch.deepinfra_api_key) {
        keySet = true;
      }
      return jsonResponse(modelSettingsOut());
    }

    if (
      request.method === "PATCH" &&
      request.url.includes("/services/jdr/users/user-uuid-1")
    ) {
      if (userPatchStatus >= 400) {
        return jsonResponse(
          {
            type: "about:blank",
            title: userPatchTitle,
            status: userPatchStatus,
          },
          userPatchStatus,
        );
      }
      return jsonResponse(userOut);
    }

    return jsonResponse(
      { type: "about:blank", title: "Unexpected request", status: 500 },
      500,
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

function findModelSettingsPatch(calls: CapturedRequest[]) {
  return calls.find(
    (call) =>
      call.method === "PATCH" &&
      call.url.includes("/services/jdr/settings/models"),
  );
}

function findValidationCall(calls: CapturedRequest[]) {
  return calls.find(
    (call) =>
      call.method === "POST" &&
      call.url.includes("/services/jdr/settings/models/local/validation"),
  );
}

function asAuthenticated() {
  userMock.current = {
    status: "authenticated",
    auth: { authId: "user-uuid-1", username: "kenan", systemRole: "admin" },
    activeCampaign: null,
  };
}

function asLoading() {
  userMock.current = { status: "loading" };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  toastSuccessMock.mockClear();
  toastErrorMock.mockClear();
  asAuthenticated();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("<SettingsPage>", () => {
  test("affiche un loader pendant le chargement de la session", () => {
    asLoading();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderPage();
    expect(
      screen.getByLabelText("Ouverture des paramètres..."),
    ).toBeInTheDocument();
  });

  test("affiche le nom d'utilisateur et le titre Parametres une fois authentifie", () => {
    mockSettingsPageFetch();
    renderPage();
    expect(
      screen.getByRole("heading", { name: "Paramètres" }),
    ).toBeInTheDocument();
    expect(screen.getByText("kenan")).toBeInTheDocument();
  });

  test("PATCH reussi -> toast de succes, PATCH password seul, formulaire vide", async () => {
    const { calls } = mockSettingsPageFetch();
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByLabelText("Nouveau mot de passe"),
      "nouveau-secret",
    );
    await user.type(
      screen.getByLabelText("Confirme le mot de passe"),
      "nouveau-secret",
    );
    await user.click(screen.getAllByRole("button", { name: "Enregistrer" })[0]);

    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith("Mot de passe mis à jour."),
    );

    const userPatch = calls.find(
      (call) =>
        call.method === "PATCH" &&
        call.url.includes("/services/jdr/users/user-uuid-1"),
    );
    expect(userPatch?.url).toContain("/services/jdr/users/user-uuid-1");
    expect(JSON.parse(userPatch?.body ?? "{}")).toEqual({
      password: "nouveau-secret",
    });

    await waitFor(() =>
      expect(screen.getByLabelText("Nouveau mot de passe")).toHaveValue(""),
    );
    expect(screen.getByLabelText("Confirme le mot de passe")).toHaveValue("");
  });

  test("PATCH 403 -> message de permission, pas de toast de succes", async () => {
    mockSettingsPageFetch({ userPatchStatus: 403 });
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByLabelText("Nouveau mot de passe"),
      "nouveau-secret",
    );
    await user.type(
      screen.getByLabelText("Confirme le mot de passe"),
      "nouveau-secret",
    );
    await user.click(screen.getAllByRole("button", { name: "Enregistrer" })[0]);

    expect(
      await screen.findByText(
        "Tu n'as pas les permissions pour modifier ce compte.",
      ),
    ).toBeInTheDocument();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  test("settings modeles GET initialise les deux selecteurs", async () => {
    mockSettingsPageFetch({
      settings: {
        transcription_provider: "local",
        summary_provider: "ollama",
      },
    });
    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText("Transcription")).toHaveTextContent("Local"),
    );
    expect(screen.getByLabelText("LLM Resume")).toHaveTextContent("Ollama");
  });

  test("settings modeles PATCH reussi envoie seulement le provider modifie et affiche un toast", async () => {
    const { calls } = mockSettingsPageFetch();
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText("Transcription")).toHaveTextContent("Cloud"),
    );
    await user.click(screen.getByLabelText("Transcription"));
    await user.click(await screen.findByRole("option", { name: "Local" }));
    await user.click(screen.getAllByRole("button", { name: "Enregistrer" })[1]);

    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Configuration des modeles mise a jour.",
      ),
    );
    const settingsPatch = findModelSettingsPatch(calls);
    expect(settingsPatch?.url).toContain("/services/jdr/settings/models");
    expect(JSON.parse(settingsPatch?.body ?? "{}")).toEqual({
      transcription_provider: "local",
    });
  });

  test("settings modeles PATCH envoie le chemin local et la preuve apres validation", async () => {
    const { calls } = mockSettingsPageFetch();
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText("Transcription")).toHaveTextContent("Cloud"),
    );
    await user.click(screen.getByLabelText("Transcription"));
    await user.click(await screen.findByRole("option", { name: "Local" }));
    await user.type(
      screen.getByLabelText(/chemin du modele local \(transcription\)/i),
      "/models/whisper-large-v3",
    );

    // Story 6.6 (AC1/AC2): probe the path before saving.
    await user.click(screen.getByRole("button", { name: "Tester le modele" }));
    await waitFor(() =>
      expect(
        screen.getByText("Modele charge et accepte."),
      ).toBeInTheDocument(),
    );
    const validationCall = findValidationCall(calls);
    expect(JSON.parse(validationCall?.body ?? "{}")).toEqual({
      category: "transcription",
      model_path: "/models/whisper-large-v3",
    });

    await user.click(screen.getAllByRole("button", { name: "Enregistrer" })[1]);

    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Configuration des modeles mise a jour.",
      ),
    );
    // Story 6.6 (AC4): PATCH carries the backend-issued proof for that path.
    const settingsPatch = findModelSettingsPatch(calls);
    expect(JSON.parse(settingsPatch?.body ?? "{}")).toEqual({
      transcription_provider: "local",
      transcription_local_path: "/models/whisper-large-v3",
      transcription_local_validation_id: "proof-xyz",
    });
  });

  test("settings modeles: Enregistrer reste bloque sans test (aucun PATCH)", async () => {
    const { calls } = mockSettingsPageFetch();
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText("Transcription")).toHaveTextContent("Cloud"),
    );
    await user.click(screen.getByLabelText("Transcription"));
    await user.click(await screen.findByRole("option", { name: "Local" }));
    await user.type(
      screen.getByLabelText(/chemin du modele local \(transcription\)/i),
      "/models/whisper-large-v3",
    );

    // AC3: a changed Local path without a successful probe blocks the save.
    const saveButton = screen.getAllByRole("button", {
      name: "Enregistrer",
    })[1];
    expect(saveButton).toBeDisabled();
    await user.click(saveButton);

    expect(findModelSettingsPatch(calls)).toBeUndefined();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  test("settings modeles: echec de validation affiche l'erreur backend inline", async () => {
    const { calls } = mockSettingsPageFetch({ validationStatus: 422 });
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText("Transcription")).toHaveTextContent("Cloud"),
    );
    await user.click(screen.getByLabelText("Transcription"));
    await user.click(await screen.findByRole("option", { name: "Local" }));
    await user.type(
      screen.getByLabelText(/chemin du modele local \(transcription\)/i),
      "/models/not-a-whisper",
    );
    await user.click(screen.getByRole("button", { name: "Tester le modele" }));

    expect(
      await screen.findByText("Ce modele n'est pas un modele Whisper/ASR."),
    ).toBeInTheDocument();
    // Failure blocks the save and no PATCH is attempted.
    expect(
      screen.getAllByRole("button", { name: "Enregistrer" })[1],
    ).toBeDisabled();
    expect(findModelSettingsPatch(calls)).toBeUndefined();
  });

  test("remplacer un chemin local existant demande confirmation avant le PATCH", async () => {
    const { calls } = mockSettingsPageFetch({
      settings: {
        transcription_provider: "local",
        transcription_local_path: "/models/whisper-large-v3",
      },
    });
    const user = userEvent.setup();
    renderPage();

    const pathInput = await screen.findByLabelText(
      /chemin du modele local \(transcription\)/i,
    );
    expect(pathInput).toHaveValue("/models/whisper-large-v3");

    await user.clear(pathInput);
    await user.type(pathInput, "/models/whisper-small");

    // Story 6.6: the changed Local path must be probed before the destructive
    // replace confirmation can even be reached.
    await user.click(screen.getByRole("button", { name: "Tester le modele" }));
    await waitFor(() =>
      expect(
        screen.getByText("Modele charge et accepte."),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getAllByRole("button", { name: "Enregistrer" })[1]);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(findModelSettingsPatch(calls)).toBeUndefined();

    await user.click(
      screen.getByRole("button", { name: "Remplacer le chemin" }),
    );

    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Configuration des modeles mise a jour.",
      ),
    );
    const settingsPatch = findModelSettingsPatch(calls);
    expect(JSON.parse(settingsPatch?.body ?? "{}")).toEqual({
      transcription_local_path: "/models/whisper-small",
      transcription_local_validation_id: "proof-xyz",
    });
  });

  test("settings modeles PATCH rejete affiche une erreur inline et conserve les valeurs", async () => {
    mockSettingsPageFetch({
      settingsPatchStatus: 503,
      settingsPatchTitle: "Provider indisponible",
    });
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText("LLM Resume")).toHaveTextContent("Cloud"),
    );
    await user.click(screen.getByLabelText("LLM Resume"));
    await user.click(await screen.findByRole("option", { name: "Ollama" }));
    await user.click(screen.getAllByRole("button", { name: "Enregistrer" })[1]);

    expect(
      await screen.findByText("Provider indisponible"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("LLM Resume")).toHaveTextContent("Ollama");
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  test("Story 7.4 — une cle cloud rejetee (400 cloud-api-key-invalid) affiche le detail FR", async () => {
    mockSettingsPageFetch({
      settingsPatchStatus: 400,
      settingsPatchType: "https://kaeyris/errors/cloud-api-key-invalid",
      settingsPatchTitle: "Cloud API key invalid",
      settingsPatchDetail:
        "La clé DeepInfra a été refusée (non autorisée pour ce modèle).",
    });
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText("LLM Resume")).toHaveTextContent("Cloud"),
    );
    await user.click(screen.getByLabelText("LLM Resume"));
    await user.click(await screen.findByRole("option", { name: "Ollama" }));
    await user.click(screen.getAllByRole("button", { name: "Enregistrer" })[1]);

    // The actionable French detail is shown, not the generic English title.
    expect(
      await screen.findByText(
        "La clé DeepInfra a été refusée (non autorisée pour ce modèle).",
      ),
    ).toBeInTheDocument();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  test("settings modeles: modele cloud initialise au defaut et PATCH du seul modele modifie", async () => {
    const { calls } = mockSettingsPageFetch();
    const user = userEvent.setup();
    renderPage();

    // Server returned null cloud models -> the picker falls back to the catalog
    // default (AC3).
    await waitFor(() =>
      expect(
        screen.getByLabelText(/modele cloud \(transcription\)/i),
      ).toHaveTextContent("Whisper Large v3"),
    );

    await user.click(screen.getByLabelText(/modele cloud \(transcription\)/i));
    await user.click(
      await screen.findByRole("option", { name: "Whisper Large v3 Turbo" }),
    );
    await user.click(screen.getAllByRole("button", { name: "Enregistrer" })[1]);

    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Configuration des modeles mise a jour.",
      ),
    );
    const settingsPatch = findModelSettingsPatch(calls);
    expect(JSON.parse(settingsPatch?.body ?? "{}")).toEqual({
      transcription_cloud_model: "openai/whisper-large-v3-turbo",
    });
  });

  test("settings modeles: premiere cle DeepInfra envoyee, sans confirmation, champ vide ensuite", async () => {
    const { calls } = mockSettingsPageFetch();
    const user = userEvent.setup();
    renderPage();

    // Inputs stay disabled until the GET resolves; wait until enabled so the
    // typed key is not clobbered by the load-time form reset.
    await waitFor(() =>
      expect(screen.getByLabelText("Cle API DeepInfra")).toBeEnabled(),
    );
    await user.type(screen.getByLabelText("Cle API DeepInfra"), "di-secret");
    await user.click(screen.getAllByRole("button", { name: "Enregistrer" })[1]);

    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Configuration des modeles mise a jour.",
      ),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const settingsPatch = findModelSettingsPatch(calls);
    expect(JSON.parse(settingsPatch?.body ?? "{}")).toEqual({
      deepinfra_api_key: "di-secret",
    });

    // After refetch the key indicator flips on and the input is cleared.
    await waitFor(() =>
      expect(
        screen.getByText(/une cle est deja enregistree/i),
      ).toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Cle API DeepInfra")).toHaveValue("");
  });

  test("settings modeles: remplacer une cle existante demande confirmation puis vide le champ", async () => {
    const { calls } = mockSettingsPageFetch({
      settings: { deepinfra_api_key_set: true },
    });
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(
        screen.getByText(/une cle est deja enregistree/i),
      ).toBeInTheDocument(),
    );

    await user.type(screen.getByLabelText("Cle API DeepInfra"), "di-rotated");
    await user.click(screen.getAllByRole("button", { name: "Enregistrer" })[1]);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(findModelSettingsPatch(calls)).toBeUndefined();

    await user.click(screen.getByRole("button", { name: "Remplacer la cle" }));

    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Configuration des modeles mise a jour.",
      ),
    );
    const settingsPatch = findModelSettingsPatch(calls);
    expect(JSON.parse(settingsPatch?.body ?? "{}")).toEqual({
      deepinfra_api_key: "di-rotated",
    });

    await waitFor(() =>
      expect(screen.getByLabelText("Cle API DeepInfra")).toHaveValue(""),
    );
  });

  test("settings modeles: PATCH inclut ollama_model quand LLM Resume passe en Ollama", async () => {
    const { calls } = mockSettingsPageFetch();
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText("LLM Resume")).toHaveTextContent("Cloud"),
    );
    await user.click(screen.getByLabelText("LLM Resume"));
    await user.click(await screen.findByRole("option", { name: "Ollama" }));
    await user.type(
      screen.getByLabelText(/modele ollama \(llm resume\)/i),
      "mistral:7b",
    );
    await user.click(screen.getAllByRole("button", { name: "Enregistrer" })[1]);

    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Configuration des modeles mise a jour.",
      ),
    );
    const settingsPatch = findModelSettingsPatch(calls);
    expect(JSON.parse(settingsPatch?.body ?? "{}")).toEqual({
      summary_provider: "ollama",
      ollama_model: "mistral:7b",
    });
  });

  test("settings modeles: ollama_model absent du PATCH quand le provider n'est pas Ollama", async () => {
    const { calls } = mockSettingsPageFetch();
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText("LLM Resume")).toHaveTextContent("Cloud"),
    );
    await user.click(screen.getByLabelText("LLM Resume"));
    await user.click(await screen.findByRole("option", { name: "Local" }));
    await user.click(screen.getAllByRole("button", { name: "Enregistrer" })[1]);

    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Configuration des modeles mise a jour.",
      ),
    );
    const body = JSON.parse(findModelSettingsPatch(calls)?.body ?? "{}");
    expect(body).not.toHaveProperty("ollama_model");
    expect(body).toEqual({ summary_provider: "local" });
  });

  test("settings modeles: config effective initialise le formulaire avec les valeurs serveur (AC7)", async () => {
    mockSettingsPageFetch({
      settings: {
        transcription_provider: "cloud",
        summary_provider: "ollama",
        // The operator's real transcription model differs from the frontend
        // catalog default (DEFAULT_TRANSCRIPTION_CLOUD_MODEL =
        // "openai/whisper-large-v3"): the form must trust the server's
        // effective config, not the hardcoded default.
        transcription_cloud_model: "openai/whisper-large-v3-turbo",
        ollama_model: "mixtral:8x7b",
      },
    });
    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText("LLM Resume")).toHaveTextContent("Ollama"),
    );
    expect(
      screen.getByLabelText(/modele cloud \(transcription\)/i),
    ).toHaveTextContent("Whisper Large v3 Turbo");
    expect(
      screen.getByLabelText(/modele ollama \(llm resume\)/i),
    ).toHaveValue("mixtral:8x7b");
  });

  test("carte tarification montee quand un provider cloud est configure (6.7)", async () => {
    mockSettingsPageFetch();
    renderPage();

    // Default settings keep both providers on Cloud -> the pricing card mounts.
    expect(await screen.findByText("Tarification")).toBeInTheDocument();
  });

  test("carte tarification absente quand aucun provider n'est cloud (6.7)", async () => {
    mockSettingsPageFetch({
      settings: {
        transcription_provider: "local",
        summary_provider: "ollama",
      },
    });
    renderPage();

    // Wait for the GET to settle so currentModelSettings reflects local/ollama.
    await waitFor(() =>
      expect(screen.getByLabelText("Transcription")).toHaveTextContent("Local"),
    );
    expect(screen.queryByText("Tarification")).not.toBeInTheDocument();
  });
});
