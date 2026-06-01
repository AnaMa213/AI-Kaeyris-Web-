"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@/lib/core/api/client";
import { ApiError } from "@/lib/core/api/errors";
import {
  toIsoUtc,
  type SessionCreateInput,
} from "@/lib/jdr/schemas/sessions";
import type { components } from "@/types/api";

type SessionOut = components["schemas"]["SessionOut"];

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

export const SESSIONS_QUERY_KEY = ["sessions"] as const;
export const sessionQueryKey = (id: string) =>
  ["sessions", id] as const;

export interface CreateSessionInput extends SessionCreateInput {
  campaign_id: string;
}

export function useCreateSession() {
  const apiClient = useMemo(() => createApiClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSessionInput) => {
      // V1 lock: transcription_mode is hardcoded "non_diarised" per PRD FR-6.
      // The UI does not expose it; the user does not choose it.
      const result = await apiClient.POST("/services/jdr/sessions", {
        body: {
          title: input.title,
          campaign_id: input.campaign_id,
          recorded_at: toIsoUtc(input.recorded_at),
          transcription_mode: "non_diarised",
        },
      });
      return unwrap<SessionOut>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
    },
  });
}

export function useGetSession(id: string) {
  const apiClient = useMemo(() => createApiClient(), []);
  return useQuery({
    queryKey: sessionQueryKey(id),
    queryFn: async () => {
      const result = await apiClient.GET(
        "/services/jdr/sessions/{session_id}",
        { params: { path: { session_id: id } } },
      );
      return unwrap<SessionOut>(result);
    },
    enabled: id !== "",
  });
}

export type { SessionOut };
