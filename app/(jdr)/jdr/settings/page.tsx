"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BackLink } from "@/components/common/BackLink";
import { FantasyLoader } from "@/components/common/FantasyLoader";
import { AccountSettingsCard } from "@/components/jdr/settings/AccountSettingsCard";
import { ModelSettingsCard } from "@/components/jdr/settings/ModelSettingsCard";
import { ApiError } from "@/lib/core/api/errors";
import { useCurrentUser } from "@/lib/core/session/useCurrentUser";
import {
  DEFAULT_MODEL_SETTINGS,
  type ModelSettings,
  type ModelSettingsPatchInput,
} from "@/lib/jdr/schemas/modelSettings";
import {
  useModelSettings,
  useUpdateModelSettings,
} from "@/lib/jdr/settings/queries";
import { useUpdateUser } from "@/lib/jdr/users/queries";

export default function SettingsPage() {
  const user = useCurrentUser();
  const updateMutation = useUpdateUser();
  const modelSettingsQuery = useModelSettings({
    enabled: user.status === "authenticated",
  });
  const updateModelSettingsMutation = useUpdateModelSettings();
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

  const handleModelSettingsSubmit = (values: ModelSettings) => {
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
    if (
      values.transcriptionProvider === "local" &&
      values.transcriptionLocalPath !==
        currentModelSettings.transcriptionLocalPath
    ) {
      body.transcriptionLocalPath = values.transcriptionLocalPath;
    }
    if (
      values.summaryProvider === "local" &&
      values.summaryLocalPath !== currentModelSettings.summaryLocalPath
    ) {
      body.summaryLocalPath = values.summaryLocalPath;
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
        />
      </div>
    </section>
  );
}
