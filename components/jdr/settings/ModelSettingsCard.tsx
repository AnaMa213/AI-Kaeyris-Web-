"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/core/api/errors";
import {
  modelSettingsSchema,
  SUMMARY_CLOUD_MODEL_LABELS,
  SUMMARY_CLOUD_MODEL_OPTIONS,
  TRANSCRIPTION_CLOUD_MODEL_LABELS,
  TRANSCRIPTION_CLOUD_MODEL_OPTIONS,
  type AiModelProvider,
  type LocalModelCategory,
  type LocalModelValidationProofs,
  type LocalModelValidationResult,
  type ModelSettings,
} from "@/lib/jdr/schemas/modelSettings";

const PROVIDER_LABELS: Record<AiModelProvider, string> = {
  cloud: "Cloud",
  local: "Local",
  ollama: "Ollama",
};

// Full provider set — used for the LLM Résumé selector.
const PROVIDER_OPTIONS = [
  { value: "cloud", label: "Cloud" },
  { value: "local", label: "Local" },
  { value: "ollama", label: "Ollama" },
] satisfies Array<{ value: AiModelProvider; label: string }>;

// Story 6.5 (AC6): Ollama is not a valid transcription provider, so the
// transcription selector only offers Cloud and Local. PROVIDER_LABELS still
// holds all three for value→label display lookups.
const TRANSCRIPTION_PROVIDER_OPTIONS = [
  { value: "cloud", label: "Cloud" },
  { value: "local", label: "Local" },
] satisfies Array<{ value: AiModelProvider; label: string }>;

// Story 6.6 / BD-20: transient, per-category state for the "Tester le modele"
// probe. Never persisted as form data — it only mirrors the backend proof and
// the exact path it was issued for, so saves can be gated and invalidated when
// the path or provider changes.
type CategoryValidation =
  | { status: "idle" }
  | { status: "pending"; testedPath: string }
  | {
      status: "success";
      testedPath: string;
      validationId: string;
      message: string;
    }
  | { status: "error"; testedPath: string; message: string };

const IDLE_VALIDATION: {
  transcription: CategoryValidation;
  summary: CategoryValidation;
} = {
  transcription: { status: "idle" },
  summary: { status: "idle" },
};

interface ModelSettingsCardProps {
  values: ModelSettings;
  loading: boolean;
  submitting: boolean;
  errorMessage: string | null;
  onSubmit: (values: ModelSettings, proofs: LocalModelValidationProofs) => void;
  // Runs the bounded backend probe for a Local category. Resolves with the
  // proof on success; rejects with `ApiError` (Problem Details) on failure.
  onValidate: (
    category: LocalModelCategory,
    modelPath: string,
  ) => Promise<LocalModelValidationResult>;
}

export function ModelSettingsCard({
  values,
  loading,
  submitting,
  errorMessage,
  onSubmit,
  onValidate,
}: ModelSettingsCardProps) {
  const disabled = loading || submitting;
  const form = useForm<ModelSettings>({
    resolver: zodResolver(modelSettingsSchema),
    defaultValues: values,
  });

  // Story 6.6: per-category probe results. Staleness is handled by derivation
  // (`liveValidation` compares against the live path) and by provider-change
  // resets, so no validation reset is needed in the form-sync effect — and a
  // successful save remounts the card via its key, clearing this anyway.
  const [validation, setValidation] = useState(IDLE_VALIDATION);

  useEffect(() => {
    form.reset(values);
  }, [form, values]);

  const transcriptionProvider = useWatch({
    control: form.control,
    name: "transcriptionProvider",
  });
  const summaryProvider = useWatch({
    control: form.control,
    name: "summaryProvider",
  });
  const transcriptionLocalPath = useWatch({
    control: form.control,
    name: "transcriptionLocalPath",
  });
  const summaryLocalPath = useWatch({
    control: form.control,
    name: "summaryLocalPath",
  });

  // AC5: a probe result only counts for the exact path it was issued for. The
  // derived view returns "idle" once the live path no longer matches, so a
  // stale success/error/pending indicator is never shown after an edit. (No
  // effect needed — this is pure derivation during render.)
  const liveValidation = (
    category: LocalModelCategory,
    formPath: string,
  ): CategoryValidation => {
    const current = validation[category];
    if (current.status !== "idle" && current.testedPath !== formPath) {
      return { status: "idle" };
    }
    return current;
  };

  // Returns the still-valid proof id for a category/path pair, or undefined.
  const proofFor = (
    category: LocalModelCategory,
    formPath: string,
  ): string | undefined => {
    const current = liveValidation(category, formPath);
    return current.status === "success" ? current.validationId : undefined;
  };

  // AC5: switching a provider (in particular away from Local) drops any probe
  // result for that category. Done in the change handler — the React-idiomatic
  // place to adjust state in response to a user event, not an effect.
  const resetValidation = (category: LocalModelCategory) => {
    setValidation((state) =>
      state[category].status === "idle"
        ? state
        : { ...state, [category]: { status: "idle" } },
    );
  };

  // Mirrors the backend rule: a Local category needs a fresh successful probe
  // unless it is an already-saved Local path left unchanged (which keeps its
  // stored proof server-side and must not block unrelated saves).
  const categoryNeedsTest = (
    category: LocalModelCategory,
    provider: AiModelProvider,
    formPath: string,
    savedProvider: AiModelProvider,
    savedPath: string,
  ): boolean => {
    if (provider !== "local" || formPath === "") return false;
    if (savedProvider === "local" && formPath === savedPath) return false;
    return proofFor(category, formPath) === undefined;
  };

  const runTest = (category: LocalModelCategory, modelPath: string) => {
    setValidation((state) => ({
      ...state,
      [category]: { status: "pending", testedPath: modelPath },
    }));
    onValidate(category, modelPath)
      .then((result) => {
        setValidation((state) => {
          const current = state[category];
          // Ignore a resolve that lost the race with a later path edit.
          if (current.status !== "pending" || current.testedPath !== modelPath) {
            return state;
          }
          return {
            ...state,
            [category]: {
              status: "success",
              testedPath: modelPath,
              validationId: result.validationId,
              message: result.message,
            },
          };
        });
      })
      .catch((error: unknown) => {
        const message =
          error instanceof ApiError
            ? (error.problem.detail ?? error.problem.title)
            : "La validation du modele local a echoue.";
        setValidation((state) => {
          const current = state[category];
          if (current.status !== "pending" || current.testedPath !== modelPath) {
            return state;
          }
          return {
            ...state,
            [category]: { status: "error", testedPath: modelPath, message },
          };
        });
      });
  };

  const transcriptionNeedsTest = categoryNeedsTest(
    "transcription",
    transcriptionProvider,
    transcriptionLocalPath,
    values.transcriptionProvider,
    values.transcriptionLocalPath,
  );
  const summaryNeedsTest = categoryNeedsTest(
    "summary",
    summaryProvider,
    summaryLocalPath,
    values.summaryProvider,
    values.summaryLocalPath,
  );
  const saveBlockedByValidation = transcriptionNeedsTest || summaryNeedsTest;

  const buildProofs = (nextValues: ModelSettings): LocalModelValidationProofs => {
    const proofs: LocalModelValidationProofs = {};
    if (nextValues.transcriptionProvider === "local") {
      const proof = proofFor("transcription", nextValues.transcriptionLocalPath);
      if (proof) proofs.transcription = proof;
    }
    if (nextValues.summaryProvider === "local") {
      const proof = proofFor("summary", nextValues.summaryLocalPath);
      if (proof) proofs.summary = proof;
    }
    return proofs;
  };

  // Story 6.4 (AC2): a single shared DeepInfra API key input is visible as soon
  // as either category uses the cloud provider.
  const anyCloud =
    transcriptionProvider === "cloud" || summaryProvider === "cloud";

  // Story 6.3 (AC5/UX-DR23) + Story 6.4 (AC5): replacing an already-saved local
  // model path OR an already-saved DeepInfra key is a destructive-leaning change
  // confirmed via dialog. `pendingValues` holds the form values awaiting that
  // confirmation.
  const [pendingValues, setPendingValues] = useState<ModelSettings | null>(
    null,
  );

  const replacedLocalPathLabels = (nextValues: ModelSettings): string[] => {
    const labels: string[] = [];
    if (
      nextValues.transcriptionProvider === "local" &&
      values.transcriptionLocalPath !== "" &&
      nextValues.transcriptionLocalPath !== values.transcriptionLocalPath
    ) {
      labels.push("Transcription");
    }
    if (
      nextValues.summaryProvider === "local" &&
      values.summaryLocalPath !== "" &&
      nextValues.summaryLocalPath !== values.summaryLocalPath
    ) {
      labels.push("LLM Resume");
    }
    return labels;
  };

  const isReplacingApiKey = (nextValues: ModelSettings): boolean =>
    values.deepinfraApiKeySet && nextValues.deepinfraApiKey !== "";

  const handleFormSubmit = (nextValues: ModelSettings) => {
    if (
      replacedLocalPathLabels(nextValues).length > 0 ||
      isReplacingApiKey(nextValues)
    ) {
      setPendingValues(nextValues);
      return;
    }
    onSubmit(nextValues, buildProofs(nextValues));
  };

  const confirmReplace = () => {
    if (pendingValues) {
      onSubmit(pendingValues, buildProofs(pendingValues));
    }
    setPendingValues(null);
  };

  // The single ConfirmDialog covers local-path replacement, key replacement, or
  // both. Keep the "Remplacer le chemin" label whenever a local path is
  // involved so the established 6.3 flow stays stable.
  const pendingLocalLabels = pendingValues
    ? replacedLocalPathLabels(pendingValues)
    : [];
  const pendingHasLocal = pendingLocalLabels.length > 0;
  const pendingKeyReplace = pendingValues
    ? isReplacingApiKey(pendingValues)
    : false;

  const confirmTitle = pendingHasLocal
    ? "Remplacer le chemin du modele local ?"
    : "Remplacer la cle API DeepInfra ?";
  const confirmLabel = pendingHasLocal
    ? "Remplacer le chemin"
    : "Remplacer la cle";
  const confirmDescription = (() => {
    if (!pendingValues) return undefined;
    const parts: string[] = [];
    if (pendingHasLocal) {
      parts.push(
        `Le chemin local enregistre pour ${pendingLocalLabels.join(" et ")} sera remplace. Si le nouveau chemin est invalide, cette categorie pourra cesser de fonctionner en mode Local.`,
      );
    }
    if (pendingKeyReplace) {
      parts.push(
        "La cle API DeepInfra enregistree sera remplacee par la nouvelle valeur saisie.",
      );
    }
    return parts.join(" ");
  })();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Modeles</CardTitle>
        <CardDescription>
          Choisis le provider utilise pour la transcription et les resumes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onSubmit={
            disabled
              ? (event) => event.preventDefault()
              : form.handleSubmit(handleFormSubmit)
          }
          className="flex flex-col gap-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="model-provider-transcription">
                Transcription
              </Label>
              <Controller
                control={form.control}
                name="transcriptionProvider"
                render={({ field }) => (
                  <Select
                    items={PROVIDER_LABELS}
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      resetValidation("transcription");
                    }}
                    disabled={disabled}
                  >
                    <SelectTrigger
                      id="model-provider-transcription"
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSCRIPTION_PROVIDER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {transcriptionProvider === "local" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="model-local-path-transcription">
                    Chemin du modele local (Transcription)
                  </Label>
                  <Controller
                    control={form.control}
                    name="transcriptionLocalPath"
                    render={({ field }) => (
                      <Input
                        id="model-local-path-transcription"
                        placeholder="/chemin/vers/le/modele"
                        disabled={disabled}
                        {...field}
                      />
                    )}
                  />
                  {transcriptionLocalPath !== "" && (
                    <LocalModelTestControls
                      category="transcription"
                      state={liveValidation(
                        "transcription",
                        transcriptionLocalPath,
                      )}
                      disabled={disabled}
                      onTest={() =>
                        runTest("transcription", transcriptionLocalPath)
                      }
                    />
                  )}
                </div>
              )}
              {transcriptionProvider === "cloud" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="model-cloud-model-transcription">
                    Modele cloud (Transcription)
                  </Label>
                  <Controller
                    control={form.control}
                    name="transcriptionCloudModel"
                    render={({ field }) => (
                      <Select
                        items={TRANSCRIPTION_CLOUD_MODEL_LABELS}
                        value={field.value}
                        onValueChange={(value) => field.onChange(value)}
                        disabled={disabled}
                      >
                        <SelectTrigger
                          id="model-cloud-model-transcription"
                          className="w-full"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TRANSCRIPTION_CLOUD_MODEL_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="model-provider-summary">LLM Resume</Label>
              <Controller
                control={form.control}
                name="summaryProvider"
                render={({ field }) => (
                  <Select
                    items={PROVIDER_LABELS}
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      resetValidation("summary");
                    }}
                    disabled={disabled}
                  >
                    <SelectTrigger
                      id="model-provider-summary"
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {summaryProvider === "local" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="model-local-path-summary">
                    Chemin du modele local (LLM Resume)
                  </Label>
                  <Controller
                    control={form.control}
                    name="summaryLocalPath"
                    render={({ field }) => (
                      <Input
                        id="model-local-path-summary"
                        placeholder="/chemin/vers/le/modele"
                        disabled={disabled}
                        {...field}
                      />
                    )}
                  />
                  {summaryLocalPath !== "" && (
                    <LocalModelTestControls
                      category="summary"
                      state={liveValidation("summary", summaryLocalPath)}
                      disabled={disabled}
                      onTest={() => runTest("summary", summaryLocalPath)}
                    />
                  )}
                </div>
              )}
              {summaryProvider === "cloud" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="model-cloud-model-summary">
                    Modele cloud (LLM Resume)
                  </Label>
                  <Controller
                    control={form.control}
                    name="summaryCloudModel"
                    render={({ field }) => (
                      <Select
                        items={SUMMARY_CLOUD_MODEL_LABELS}
                        value={field.value}
                        onValueChange={(value) => field.onChange(value)}
                        disabled={disabled}
                      >
                        <SelectTrigger
                          id="model-cloud-model-summary"
                          className="w-full"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SUMMARY_CLOUD_MODEL_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              )}
              {summaryProvider === "ollama" && (
                <div className="flex flex-col gap-2">
                  <p className="text-text-chrome-muted text-sm">
                    Ollama doit etre actif pour que cette configuration
                    fonctionne.
                  </p>
                  <Label htmlFor="model-ollama-model-summary">
                    Modele Ollama (LLM Resume)
                  </Label>
                  <Controller
                    control={form.control}
                    name="ollamaModel"
                    render={({ field }) => (
                      <Input
                        id="model-ollama-model-summary"
                        placeholder="ex: llama3:8b"
                        disabled={disabled}
                        {...field}
                      />
                    )}
                  />
                </div>
              )}
            </div>
          </div>

          {anyCloud && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="model-cloud-api-key-deepinfra">
                Cle API DeepInfra
              </Label>
              <Controller
                control={form.control}
                name="deepinfraApiKey"
                render={({ field }) => (
                  <Input
                    id="model-cloud-api-key-deepinfra"
                    type="password"
                    autoComplete="off"
                    placeholder={
                      values.deepinfraApiKeySet
                        ? "••••••••••••"
                        : "Saisis ta cle DeepInfra"
                    }
                    disabled={disabled}
                    {...field}
                  />
                )}
              />
              {values.deepinfraApiKeySet && (
                <p className="text-text-chrome-muted text-sm">
                  Une cle est deja enregistree. Laisse ce champ vide pour la
                  conserver.
                </p>
              )}
            </div>
          )}

          {loading && (
            <p role="status" className="text-text-chrome-muted text-sm">
              Chargement des modeles...
            </p>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="text-state-error flex flex-col gap-1 text-sm"
            >
              <p>{errorMessage}</p>
            </div>
          )}

          {saveBlockedByValidation && (
            <p className="text-text-chrome-muted text-sm">
              Teste le modele local avant d&apos;enregistrer.
            </p>
          )}

          <Button
            type="submit"
            disabled={disabled || saveBlockedByValidation}
            className={submitting ? "animate-pulse self-start" : "self-start"}
          >
            {submitting ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </form>
      </CardContent>

      <ConfirmDialog
        open={pendingValues !== null}
        onOpenChange={(open) => {
          if (!open) setPendingValues(null);
        }}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={confirmLabel}
        onConfirm={confirmReplace}
        destructive
      />
    </Card>
  );
}

// Story 6.6 / BD-20: the per-category "Tester le modele" action plus its inline
// status. `role="status"` for pending/success, `role="alert"` for failures.
function LocalModelTestControls({
  category,
  state,
  disabled,
  onTest,
}: {
  category: LocalModelCategory;
  state: CategoryValidation;
  disabled: boolean;
  onTest: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        id={`model-local-test-${category}`}
        className="self-start"
        disabled={disabled || state.status === "pending"}
        onClick={onTest}
      >
        {state.status === "pending" ? "Test en cours..." : "Tester le modele"}
      </Button>
      {state.status === "pending" && (
        <p role="status" className="text-text-chrome-muted text-sm">
          Validation du modele local en cours...
        </p>
      )}
      {state.status === "success" && (
        <p role="status" className="text-state-success text-sm">
          {state.message || "Modele local valide."}
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-state-error text-sm">
          {state.message}
        </p>
      )}
    </div>
  );
}

export type { ModelSettingsCardProps };
