"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@/lib/core/api/client";
import { ApiError } from "@/lib/core/api/errors";
import {
  DEFAULT_SUMMARY_CLOUD_MODEL,
  DEFAULT_TRANSCRIPTION_CLOUD_MODEL,
  modelSettingsSchema,
  type ModelSettings,
  type ModelSettingsPatchInput,
} from "@/lib/jdr/schemas/modelSettings";
import type { components } from "@/types/api";

type ModelSettingsOut = components["schemas"]["ModelSettingsOut"];
type ModelSettingsPatch = components["schemas"]["ModelSettingsPatch"];

export const modelSettingsQueryKey = ["jdr", "settings", "models"] as const;

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
    transcriptionProvider: data.transcription_provider,
    summaryProvider: data.summary_provider,
    transcriptionLocalPath: data.transcription_local_path ?? "",
    summaryLocalPath: data.summary_local_path ?? "",
    transcriptionCloudModel:
      data.transcription_cloud_model ?? DEFAULT_TRANSCRIPTION_CLOUD_MODEL,
    summaryCloudModel: data.summary_cloud_model ?? DEFAULT_SUMMARY_CLOUD_MODEL,
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
    // Empty string means "no change": only send a non-empty new key.
    ...(values.deepinfraApiKey !== undefined && values.deepinfraApiKey !== ""
      ? { deepinfra_api_key: values.deepinfraApiKey }
      : {}),
  };
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
