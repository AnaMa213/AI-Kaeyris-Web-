"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@/lib/core/api/client";
import { env } from "@/lib/core/env";
import { ApiError, AuthError } from "@/lib/core/api/errors";
import { parseProblemDetails } from "@/lib/core/api/problemDetails";
import { campaignQueryKey } from "@/lib/jdr/campaigns/queries";
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
      // transcription_mode is GM-chosen at creation (Story 4.12) and immutable
      // afterwards. It is always sent explicitly — the schema defaults it to
      // "non_diarised" because the backend default ("diarised") doesn't match
      // the V1 pipeline.
      const result = await apiClient.POST("/services/jdr/sessions", {
        body: {
          title: input.title,
          campaign_id: input.campaign_id,
          recorded_at: toIsoUtc(input.recorded_at),
          transcription_mode: input.transcription_mode,
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

export function useDeleteSession(sessionId: string, campaignId?: string) {
  const apiClient = useMemo(() => createApiClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await apiClient.DELETE(
        "/services/jdr/sessions/{session_id}",
        { params: { path: { session_id: sessionId } } },
      );
      if (result.error !== undefined) {
        throw new ApiError({
          type: "about:blank",
          title: "Request failed",
          status: 0,
        });
      }
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: sessionQueryKey(sessionId) });
      if (campaignId) {
        queryClient.invalidateQueries({
          queryKey: sessionsListQueryKey(campaignId),
        });
        queryClient.invalidateQueries({ queryKey: campaignQueryKey(campaignId) });
      }
    },
  });
}

/**
 * Story 4.23 (AC10) — recover a session wedged in `transcribing` after its
 * worker died (the job lookup 404s). `POST /transcription/recover` performs the
 * failed transition the dead worker never reached → `transcription_failed`, so
 * audio replace / session delete unblock. Seeds + invalidates the session cache
 * so the page re-renders into the recoverable failed state.
 */
export function useRecoverTranscription(
  sessionId: string,
  campaignId?: string,
) {
  const apiClient = useMemo(() => createApiClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await apiClient.POST(
        "/services/jdr/sessions/{session_id}/transcription/recover",
        { params: { path: { session_id: sessionId } } },
      );
      return unwrap<SessionOut>(result);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(sessionQueryKey(sessionId), updated);
      queryClient.invalidateQueries({ queryKey: sessionQueryKey(sessionId) });
      if (campaignId) {
        queryClient.invalidateQueries({
          queryKey: sessionsListQueryKey(campaignId),
        });
      }
    },
  });
}

// openapi-fetch types the multipart body as { audio: string }, which does not
// match a FormData payload — the audio POST/DELETE use plain fetch and re-parse
// problem+json themselves (same shape as the openapi-fetch error middleware).
// Local dev: when NEXT_PUBLIC_MOCK_AUDIO is on we short-circuit without hitting
// the backend (the GET audio mock middleware does not apply — these bypass the
// openapi-fetch client; see Dev Notes 4.2).

/** POST multipart `/audio` (or mock short-circuit). Shared by upload + replace. */
async function uploadAudioRaw(
  sessionId: string,
  file: File,
): Promise<AudioUploadOut> {
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
}

/**
 * DELETE `/audio` (or mock short-circuit, symmetric to the POST). Throws
 * `ApiError`/`AuthError` on ≥400 so the replace sequence aborts before POSTing.
 */
async function deleteAudioRaw(sessionId: string): Promise<void> {
  if (env.NEXT_PUBLIC_MOCK_AUDIO) return;
  const url = `${env.NEXT_PUBLIC_API_BASE_URL}/services/jdr/sessions/${sessionId}/audio`;
  const response = await fetch(url, {
    method: "DELETE",
    credentials: "include",
  });
  if (response.status >= 400) {
    const problem = await parseProblemDetails(response);
    if (response.status === 401) throw new AuthError(problem);
    throw new ApiError(problem);
  }
}

/**
 * Optimistic post-upload patch (Story 3.4) : seed the job cache + flip the
 * session to `audio_uploaded` carrying `current_job_id`, then invalidate so the
 * live polling re-arms from the refetched session. Shared by upload + replace.
 */
function seedJobAndPatchSession(
  queryClient: ReturnType<typeof useQueryClient>,
  sessionId: string,
  data: AudioUploadOut,
): void {
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
}

interface SessionAudioMutationOptions {
  /**
   * Story 3.5 — `true` = remplacement : DELETE l'audio courant avant le POST,
   * séquentiel (un DELETE en échec, ex. 409, abort avant le POST). `false`
   * (défaut, Story 3.1) = upload simple.
   */
  replace?: boolean;
}

/**
 * Mutation d'envoi d'audio de session. Le POST re-déclenche la transcription ;
 * le patch optimiste (seed job `queued` + `current_job_id` + invalidate) est
 * identique pour l'upload et le remplacement — seul le DELETE préalable diffère.
 */
export function useSessionAudioMutation(
  sessionId: string,
  { replace = false }: SessionAudioMutationOptions = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<AudioUploadOut> => {
      if (replace) await deleteAudioRaw(sessionId);
      return uploadAudioRaw(sessionId, file);
    },
    onSuccess: (data) => seedJobAndPatchSession(queryClient, sessionId, data),
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
