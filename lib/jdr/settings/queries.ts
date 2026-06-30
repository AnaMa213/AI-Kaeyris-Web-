"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@/lib/core/api/client";
import { ApiError } from "@/lib/core/api/errors";
import {
  DEFAULT_SUMMARY_CLOUD_MODEL,
  DEFAULT_TRANSCRIPTION_CLOUD_MODEL,
  localModelValidationResultSchema,
  modelSettingsSchema,
  type LocalModelCategory,
  type LocalModelValidationResult,
  type ModelSettings,
  type ModelSettingsPatchInput,
} from "@/lib/jdr/schemas/modelSettings";
import type { components } from "@/types/api";

type ModelSettingsOut = components["schemas"]["ModelSettingsOut"];
type ModelSettingsPatch = components["schemas"]["ModelSettingsPatch"];
type LocalModelValidationOut =
  components["schemas"]["LocalModelValidationOut"];
export type CloudModel = components["schemas"]["CloudModel"];
export type ModelCatalog = components["schemas"]["ModelCatalogOut"];

export const modelSettingsQueryKey = ["jdr", "settings", "models"] as const;
export const modelCatalogQueryKey = [
  "jdr",
  "settings",
  "model-catalog",
] as const;

function unwrap<T>(result: { data?: T; error?: unknown }): T {
  if (result.error !== undefined) {
    throw new ApiError({
      type: "about:blank",
      title: "Request failed",
      status: 0,
    });
  }
  return result.data as T;
}

function fromApi(data: ModelSettingsOut): ModelSettings {
  return modelSettingsSchema.parse({
    // "ollama" is never a valid transcription provider in the UI (Story 6.5
    // AC6). If a row somehow carries it (e.g. set via API before this change),
    // fall back to "cloud" so the restricted selector has a valid value.
    transcriptionProvider:
      data.transcription_provider === "ollama"
        ? "cloud"
        : data.transcription_provider,
    summaryProvider: data.summary_provider,
    transcriptionLocalPath: data.transcription_local_path ?? "",
    summaryLocalPath: data.summary_local_path ?? "",
    transcriptionCloudModel:
      data.transcription_cloud_model ?? DEFAULT_TRANSCRIPTION_CLOUD_MODEL,
    summaryCloudModel: data.summary_cloud_model ?? DEFAULT_SUMMARY_CLOUD_MODEL,
    ollamaModel: data.ollama_model ?? "",
    // The server never returns the key; the input always starts empty.
    deepinfraApiKey: "",
    deepinfraApiKeySet: data.deepinfra_api_key_set ?? false,
  });
}

function toApiPatch(values: ModelSettingsPatchInput): ModelSettingsPatch {
  return {
    ...(values.transcriptionProvider !== undefined
      ? { transcription_provider: values.transcriptionProvider }
      : {}),
    ...(values.summaryProvider !== undefined
      ? { summary_provider: values.summaryProvider }
      : {}),
    ...(values.transcriptionLocalPath !== undefined
      ? { transcription_local_path: values.transcriptionLocalPath }
      : {}),
    ...(values.summaryLocalPath !== undefined
      ? { summary_local_path: values.summaryLocalPath }
      : {}),
    ...(values.transcriptionCloudModel !== undefined
      ? { transcription_cloud_model: values.transcriptionCloudModel }
      : {}),
    ...(values.summaryCloudModel !== undefined
      ? { summary_cloud_model: values.summaryCloudModel }
      : {}),
    // Relevance to the "ollama" LLM provider is decided by the caller
    // (handleModelSettingsSubmit only sets ollamaModel when summaryProvider is
    // "ollama"); here we just forward it when present, like the other fields.
    ...(values.ollamaModel !== undefined
      ? { ollama_model: values.ollamaModel }
      : {}),
    // Empty string means "no change": only send a non-empty new key.
    ...(values.deepinfraApiKey !== undefined && values.deepinfraApiKey !== ""
      ? { deepinfra_api_key: values.deepinfraApiKey }
      : {}),
    // Story 6.6 / BD-20: forward the backend validation proof only when the
    // caller set it (i.e. a changed Local path is being saved). The backend
    // rejects the changed path without a matching, still-valid proof.
    ...(values.transcriptionLocalValidationId !== undefined
      ? {
          transcription_local_validation_id:
            values.transcriptionLocalValidationId,
        }
      : {}),
    ...(values.summaryLocalValidationId !== undefined
      ? { summary_local_validation_id: values.summaryLocalValidationId }
      : {}),
  };
}

function fromValidationApi(
  data: LocalModelValidationOut,
): LocalModelValidationResult {
  return localModelValidationResultSchema.parse({
    validationId: data.validation_id,
    category: data.category,
    modelPath: data.model_path,
    status: data.status,
    runtime: data.runtime,
    modelFormat: data.model_format,
    message: data.message,
    expiresAt: data.expires_at,
  });
}

function useInvalidateModelSettings() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: modelSettingsQueryKey });
}

interface UseModelSettingsOptions {
  enabled?: boolean;
}

export function useModelSettings({
  enabled = true,
}: UseModelSettingsOptions = {}) {
  const apiClient = useMemo(() => createApiClient(), []);
  return useQuery({
    queryKey: modelSettingsQueryKey,
    queryFn: async () => {
      const result = await apiClient.GET("/services/jdr/settings/models");
      return fromApi(unwrap(result));
    },
    enabled,
  });
}

// The cloud-model catalog is the backend's single source of truth (ids, tiers,
// prices). The front renders its selectors and pricing from this instead of
// hardcoding the list, so the two never drift. It is effectively static, so we
// never refetch it within a session.
export function useModelCatalog({ enabled = true }: UseModelSettingsOptions = {}) {
  const apiClient = useMemo(() => createApiClient(), []);
  return useQuery({
    queryKey: modelCatalogQueryKey,
    queryFn: async () => {
      const result = await apiClient.GET(
        "/services/jdr/settings/model-catalog",
      );
      return unwrap(result) as ModelCatalog;
    },
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useUpdateModelSettings() {
  const apiClient = useMemo(() => createApiClient(), []);
  const invalidateModelSettings = useInvalidateModelSettings();
  return useMutation({
    mutationFn: async (values: ModelSettingsPatchInput) => {
      const result = await apiClient.PATCH("/services/jdr/settings/models", {
        body: toApiPatch(values),
      });
      return fromApi(unwrap(result));
    },
    onSuccess: () => {
      invalidateModelSettings();
    },
  });
}

export interface LocalModelValidationInput {
  category: LocalModelCategory;
  modelPath: string;
}

// Story 6.6 / BD-20: bounded backend probe that loads a Local model path and
// returns a short-lived proof. Failures surface as `ApiError` carrying the
// backend Problem Details (`title`/`detail`), which callers display inline.
export function useValidateLocalModel() {
  const apiClient = useMemo(() => createApiClient(), []);
  return useMutation({
    mutationFn: async ({ category, modelPath }: LocalModelValidationInput) => {
      const result = await apiClient.POST(
        "/services/jdr/settings/models/local/validation",
        { body: { category, model_path: modelPath } },
      );
      return fromValidationApi(unwrap(result));
    },
  });
}
