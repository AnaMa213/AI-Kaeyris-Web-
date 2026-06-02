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
type PageOfSessionOut = components["schemas"]["Page_SessionOut_"];

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
export const sessionsListQueryKey = (campaignId: string) =>
  ["sessions", "list", { campaignId }] as const;

export function useListSessions(input: { campaignId: string }) {
  const apiClient = useMemo(() => createApiClient(), []);
  return useQuery({
    queryKey: sessionsListQueryKey(input.campaignId),
    queryFn: async () => {
      const result = await apiClient.GET("/services/jdr/sessions", {
        params: { query: { campaign_id: input.campaignId } },
      });
      return unwrap<PageOfSessionOut>(result);
    },
    enabled: input.campaignId !== "",
  });
}

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

export interface UpdateSessionInput {
  title?: string;
  /** undefined = no change, null = clear, string = set */
  campaign_context?: string | null;
}

export function useUpdateSession(sessionId: string, campaignId?: string) {
  const apiClient = useMemo(() => createApiClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateSessionInput) => {
      // Build a sparse PATCH body. transcription_mode is immutable backend-side
      // (PRD FR-6 V1 lock) and never goes on the wire.
      const body: components["schemas"]["SessionUpdate"] = {};
      if (input.title !== undefined) body.title = input.title;
      if (input.campaign_context !== undefined) {
        if (input.campaign_context === null) {
          body.campaign_context = null;
        } else {
          const trimmed = input.campaign_context.trim();
          body.campaign_context = trimmed === "" ? null : trimmed;
        }
      }
      const result = await apiClient.PATCH(
        "/services/jdr/sessions/{session_id}",
        { params: { path: { session_id: sessionId } }, body },
      );
      return unwrap<SessionOut>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionQueryKey(sessionId) });
      if (campaignId) {
        queryClient.invalidateQueries({
          queryKey: sessionsListQueryKey(campaignId),
        });
      }
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

export type { SessionOut, PageOfSessionOut };
