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
import {
  modelSettingsSchema,
  SUMMARY_CLOUD_MODEL_LABELS,
  SUMMARY_CLOUD_MODEL_OPTIONS,
  TRANSCRIPTION_CLOUD_MODEL_LABELS,
  TRANSCRIPTION_CLOUD_MODEL_OPTIONS,
  type AiModelProvider,
  type ModelSettings,
} from "@/lib/jdr/schemas/modelSettings";

const PROVIDER_LABELS: Record<AiModelProvider, string> = {
  cloud: "Cloud",
  local: "Local",
  ollama: "Ollama",
};

const PROVIDER_OPTIONS = [
  { value: "cloud", label: "Cloud" },
  { value: "local", label: "Local" },
  { value: "ollama", label: "Ollama" },
] satisfies Array<{ value: AiModelProvider; label: string }>;

interface ModelSettingsCardProps {
  values: ModelSettings;
  loading: boolean;
  submitting: boolean;
  errorMessage: string | null;
  onSubmit: (values: ModelSettings) => void;
}

export function ModelSettingsCard({
  values,
  loading,
  submitting,
  errorMessage,
  onSubmit,
}: ModelSettingsCardProps) {
  const disabled = loading || submitting;
  const form = useForm<ModelSettings>({
    resolver: zodResolver(modelSettingsSchema),
    defaultValues: values,
  });

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
    onSubmit(nextValues);
  };

  const confirmReplace = () => {
    if (pendingValues) {
      onSubmit(pendingValues);
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
                    onValueChange={(value) => field.onChange(value)}
                    disabled={disabled}
                  >
                    <SelectTrigger
                      id="model-provider-transcription"
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
                    onValueChange={(value) => field.onChange(value)}
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

          <p className="text-text-chrome-muted text-sm">
            L&apos;estimation des couts par modele arrive dans une prochaine
            etape.
          </p>

          {errorMessage && (
            <div
              role="alert"
              className="text-state-error flex flex-col gap-1 text-sm"
            >
              <p>{errorMessage}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={disabled}
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

export type { ModelSettingsCardProps };
