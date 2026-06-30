"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BackLink } from "@/components/common/BackLink";
import { FantasyLoader } from "@/components/common/FantasyLoader";
import { AccountSettingsCard } from "@/components/jdr/settings/AccountSettingsCard";
import {
  ModelPricingCard,
  type ModelPricing,
} from "@/components/jdr/settings/ModelPricingCard";
import { ModelSettingsCard } from "@/components/jdr/settings/ModelSettingsCard";
import { ApiError } from "@/lib/core/api/errors";
import { useCurrentUser } from "@/lib/core/session/useCurrentUser";
import {
  DEFAULT_MODEL_SETTINGS,
  MODEL_TIER_LABELS,
  type LocalModelCategory,
  type LocalModelValidationProofs,
  type ModelSettings,
  type ModelSettingsPatchInput,
} from "@/lib/jdr/schemas/modelSettings";
import {
  useModelCatalog,
  useModelSettings,
  useUpdateModelSettings,
  useValidateLocalModel,
  type CloudModel,
} from "@/lib/jdr/settings/queries";
import { useUpdateUser } from "@/lib/jdr/users/queries";

// The backend serialises pricing as { unit, … }; the pricing card uses the
// front's { type, … } shape. Convert at the boundary so the catalog stays the
// single source of truth without leaking its wire shape into the card.
function toModelPricing(pricing: CloudModel["pricing"]): ModelPricing {
  if (pricing.unit === "per_minute") {
    return { type: "per-minute", pricePerMinute: pricing.price_per_minute };
  }
  return {
    type: "per-million-tokens",
    inputPer1M: pricing.input_per_1m,
    outputPer1M: pricing.output_per_1m,
  };
}

function tieredOptionLabel(model: CloudModel): string {
  const tier = MODEL_TIER_LABELS[model.tier] ?? model.tier;
  return `${model.label} · ${tier}`;
}

export default function SettingsPage() {
  const user = useCurrentUser();
  const updateMutation = useUpdateUser();
  const modelSettingsQuery = useModelSettings({
    enabled: user.status === "authenticated",
  });
  const modelCatalogQuery = useModelCatalog({
    enabled: user.status === "authenticated",
  });
  const updateModelSettingsMutation = useUpdateModelSettings();
  const validateLocalModelMutation = useValidateLocalModel();

  // Derive the selector options + pricing/label maps from the backend catalog
  // (single source of truth). Undefined while loading → the cards fall back to
  // their static lists so the UI is never empty.
  const catalog = modelCatalogQuery.data;
  const transcriptionCloudModelOptions = useMemo(
    () =>
      catalog?.transcription.map((model) => ({
        value: model.id,
        label: tieredOptionLabel(model),
      })),
    [catalog],
  );
  const summaryCloudModelOptions = useMemo(
    () =>
      catalog?.summary.map((model) => ({
        value: model.id,
        label: tieredOptionLabel(model),
      })),
    [catalog],
  );
  const { pricingByModel, labelByModel } = useMemo(() => {
    if (!catalog) {
      return { pricingByModel: undefined, labelByModel: undefined };
    }
    const pricing: Record<string, ModelPricing> = {};
    const labels: Record<string, string> = {};
    for (const model of [...catalog.transcription, ...catalog.summary]) {
      pricing[model.id] = toModelPricing(model.pricing);
      labels[model.id] = model.label;
    }
    return { pricingByModel: pricing, labelByModel: labels };
  }, [catalog]);
  // Bumping this key remounts AccountSettingsCard on success, clearing the
  // password fields (AC 6) without reaching into the form's internals.
  const [formKey, setFormKey] = useState(0);
  // Same trick for the model card: a key-only save returns a server payload
  // identical to before (the DeepInfra key is never echoed), so React Query's
  // structural sharing keeps the same reference and the form never resets.
  // Remounting on success guarantees the masked key input clears (Story 6.4 AC4).
  const [modelFormKey, setModelFormKey] = useState(0);

  const errorMessage = (() => {
    const error = updateMutation.error;
    if (!error) return null;
    if (error instanceof ApiError) {
      if (error.problem.status === 403) {
        return "Tu n'as pas les permissions pour modifier ce compte.";
      }
      return error.problem.title;
    }
    return error.message;
  })();

  const modelSettingsErrorMessage = (() => {
    const error = updateModelSettingsMutation.error ?? modelSettingsQuery.error;
    if (!error) return null;
    if (error instanceof ApiError) {
      // Story 7.4 / B — the save-time DeepInfra key rejection carries an
      // actionable French detail; prefer it over the generic title.
      if (error.problem.type?.endsWith("/cloud-api-key-invalid")) {
        return error.problem.detail ?? error.problem.title;
      }
      return error.problem.title;
    }
    return error.message;
  })();

  if (user.status !== "authenticated") {
    // `unauthenticated` is handled by <AuthGuard> (layout) which redirects to
    // /login; here we only need a loader for the brief `loading` window.
    return (
      <section className="bg-background text-foreground min-h-full p-8">
        <FantasyLoader message="Ouverture des paramètres..." />
      </section>
    );
  }

  const handleSubmit = (values: { password: string }) => {
    updateMutation.mutate(
      { id: user.auth.authId, body: { password: values.password } },
      {
        onSuccess: () => {
          setFormKey((key) => key + 1);
          toast.success("Mot de passe mis à jour.");
        },
      },
    );
  };

  const currentModelSettings =
    modelSettingsQuery.data ?? DEFAULT_MODEL_SETTINGS;

  // Story 6.7 (FR-25): the pricing card reflects the SAVED cloud models, not the
  // in-flight form state. A category contributes a model only when it is on the
  // Cloud provider; otherwise it is null and that category is omitted/"—".
  const pricingTranscriptionModel =
    currentModelSettings.transcriptionProvider === "cloud"
      ? currentModelSettings.transcriptionCloudModel
      : null;
  const pricingSummaryModel =
    currentModelSettings.summaryProvider === "cloud"
      ? currentModelSettings.summaryCloudModel
      : null;
  const showPricingCard =
    pricingTranscriptionModel !== null || pricingSummaryModel !== null;

  const handleValidateLocalModel = (
    category: LocalModelCategory,
    modelPath: string,
  ) => validateLocalModelMutation.mutateAsync({ category, modelPath });

  const handleModelSettingsSubmit = (
    values: ModelSettings,
    proofs: LocalModelValidationProofs,
  ) => {
    const body: ModelSettingsPatchInput = {};
    if (
      values.transcriptionProvider !==
      currentModelSettings.transcriptionProvider
    ) {
      body.transcriptionProvider = values.transcriptionProvider;
    }
    if (values.summaryProvider !== currentModelSettings.summaryProvider) {
      body.summaryProvider = values.summaryProvider;
    }
    // Story 6.6 (AC4/AC5): send the Local path together with the backend proof
    // whenever Local is newly selected or its path changed. An already-saved
    // Local path left unchanged sends neither (the backend keeps its stored
    // proof and must not be re-validated just to save unrelated fields).
    const transcriptionLocalChanged =
      values.transcriptionProvider === "local" &&
      values.transcriptionLocalPath !== "" &&
      (currentModelSettings.transcriptionProvider !== "local" ||
        values.transcriptionLocalPath !==
          currentModelSettings.transcriptionLocalPath);
    if (transcriptionLocalChanged) {
      body.transcriptionLocalPath = values.transcriptionLocalPath;
      if (proofs.transcription) {
        body.transcriptionLocalValidationId = proofs.transcription;
      }
    }
    const summaryLocalChanged =
      values.summaryProvider === "local" &&
      values.summaryLocalPath !== "" &&
      (currentModelSettings.summaryProvider !== "local" ||
        values.summaryLocalPath !== currentModelSettings.summaryLocalPath);
    if (summaryLocalChanged) {
      body.summaryLocalPath = values.summaryLocalPath;
      if (proofs.summary) {
        body.summaryLocalValidationId = proofs.summary;
      }
    }
    if (
      values.transcriptionProvider === "cloud" &&
      values.transcriptionCloudModel !==
        currentModelSettings.transcriptionCloudModel
    ) {
      body.transcriptionCloudModel = values.transcriptionCloudModel;
    }
    if (
      values.summaryProvider === "cloud" &&
      values.summaryCloudModel !== currentModelSettings.summaryCloudModel
    ) {
      body.summaryCloudModel = values.summaryCloudModel;
    }
    // Ollama model name only matters when the LLM Résumé provider is "ollama"
    // (Story 6.5 AC5). Send it only when it actually changed.
    if (
      values.summaryProvider === "ollama" &&
      values.ollamaModel !== currentModelSettings.ollamaModel
    ) {
      body.ollamaModel = values.ollamaModel;
    }
    // Only send a new DeepInfra key when a cloud provider is in use and the
    // user actually typed one (empty means "keep the existing key").
    const anyCloud =
      values.transcriptionProvider === "cloud" ||
      values.summaryProvider === "cloud";
    if (anyCloud && values.deepinfraApiKey !== "") {
      body.deepinfraApiKey = values.deepinfraApiKey;
    }

    updateModelSettingsMutation.mutate(body, {
      onSuccess: () => {
        setModelFormKey((key) => key + 1);
        toast.success("Configuration des modeles mise a jour.");
      },
    });
  };

  return (
    <section className="bg-background text-foreground min-h-full p-8">
      <div className="mb-4">
        <BackLink href="/jdr/campaigns" label="Campagnes" />
      </div>
      <header className="mx-auto mb-8 max-w-2xl">
        <h1 className="font-display text-3xl font-semibold">Paramètres</h1>
        <p className="text-text-chrome-muted mt-1 text-sm">
          Gère ton compte et tes préférences.
        </p>
      </header>

      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <AccountSettingsCard
          key={`account-${formKey}`}
          username={user.auth.username}
          onSubmit={handleSubmit}
          submitting={updateMutation.isPending}
          errorMessage={errorMessage}
        />
        <ModelSettingsCard
          key={`model-${modelFormKey}`}
          values={currentModelSettings}
          loading={modelSettingsQuery.isLoading}
          submitting={updateModelSettingsMutation.isPending}
          errorMessage={modelSettingsErrorMessage}
          onSubmit={handleModelSettingsSubmit}
          onValidate={handleValidateLocalModel}
          transcriptionCloudModelOptions={transcriptionCloudModelOptions}
          summaryCloudModelOptions={summaryCloudModelOptions}
        />
        {showPricingCard && (
          <ModelPricingCard
            transcriptionCloudModel={pricingTranscriptionModel}
            summaryCloudModel={pricingSummaryModel}
            pricingByModel={pricingByModel}
            labelByModel={labelByModel}
          />
        )}
      </div>
    </section>
  );
}
