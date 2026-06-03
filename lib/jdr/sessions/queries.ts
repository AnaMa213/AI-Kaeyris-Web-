"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@/lib/core/api/client";
import { env } from "@/lib/core/env";
import { ApiError, AuthError } from "@/lib/core/api/errors";
import { parseProblemDetails } from "@/lib/core/api/problemDetails";
import { jobQueryKey } from "@/lib/jdr/jobs/queries";
import {
  toIsoUtc,
  type SessionCreateInput,
} from "@/lib/jdr/schemas/sessions";
import type { components } from "@/types/api";

type SessionOut = components["schemas"]["SessionOut"];
type PageOfSessionOut = components["schemas"]["Page_SessionOut_"];
type AudioUploadOut = components["schemas"]["AudioUploadOut"];
type JobOut = components["schemas"]["JobOut"];

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

export function useUploadSessionAudio(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<AudioUploadOut> => {
      // openapi-fetch types the multipart body as { audio: string }, which
      // does not match a FormData payload — we use plain fetch here and
      // re-parse problem+json responses ourselves (same shape as the
      // openapi-fetch error middleware).
      // Local dev shortcut: when NEXT_PUBLIC_MOCK_AUDIO is on we synthesize
      // an AudioUploadOut without hitting the backend. The GET audio mock
      // middleware (lib/core/api/mocks/audio.ts) does not apply here because
      // this hook bypasses the openapi-fetch client (see Dev Notes 4.2).
      if (env.NEXT_PUBLIC_MOCK_AUDIO) {
        return {
          session_id: sessionId,
          path: `mock/${sessionId}.m4a`,
          sha256: "0".repeat(64),
          size_bytes: file.size,
          // Mock dev : durée factice (10 min) pour tester l'estimation du % (Story 3.4).
          duration_seconds: 600,
          uploaded_at: new Date().toISOString(),
          job_id: crypto.randomUUID(),
        };
      }
      const formData = new FormData();
      formData.append("audio", file);
      const url = `${env.NEXT_PUBLIC_API_BASE_URL}/services/jdr/sessions/${sessionId}/audio`;
      const response = await fetch(url, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (response.status >= 400) {
        const problem = await parseProblemDetails(response);
        if (response.status === 401) throw new AuthError(problem);
        throw new ApiError(problem);
      }
      return (await response.json()) as AudioUploadOut;
    },
    onSuccess: (data) => {
      const initialJob: JobOut = {
        id: data.job_id,
        kind: "transcription",
        session_id: sessionId,
        status: "queued",
        failure_reason: null,
        queued_at: data.uploaded_at,
        started_at: null,
        ended_at: null,
      };
      queryClient.setQueryData(jobQueryKey(data.job_id), initialJob);
      queryClient.setQueryData<SessionOut | undefined>(
        sessionQueryKey(sessionId),
        (current) =>
          current
            ? {
                ...current,
                state: "audio_uploaded",
                current_job_id: data.job_id,
                updated_at: data.uploaded_at,
              }
            : current,
      );
      queryClient.invalidateQueries({ queryKey: sessionQueryKey(sessionId) });
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

export type { SessionOut, PageOfSessionOut, AudioUploadOut };
