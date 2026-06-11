"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@/lib/core/api/client";
import { ApiError } from "@/lib/core/api/errors";
import type { components } from "@/types/api";

type ChunkListOut = components["schemas"]["ChunkListOut"];
type ChunkOut = components["schemas"]["ChunkOut"];
type TranscriptionOut = components["schemas"]["TranscriptionOut"];
type TranscriptionSegmentOut = components["schemas"]["TranscriptionSegmentOut"];
type TranscriptionEditOut = components["schemas"]["TranscriptionEditOut"];

/**
 * Status-preserving unwrap (mirrors lib/jdr/sessions/artifacts.ts). The error
 * middleware throws an `ApiError` (status intact) on >=400 before we reach here;
 * this branch is the defensive fallback for a returned (non-thrown) error and
 * keeps the real HTTP status so a 404 `transcription-not-ready` stays
 * distinguishable from a genuine failure (via `isArtifactAbsentError`). Unlike the
 * generic queries.ts/players.ts unwrap, never *discard* a known status — the final
 * `status: 0` below is only a last resort for an error shape that carries no
 * status at all.
 */
function problemFromUnknown(error: unknown): never {
  if (error instanceof ApiError) throw error;
  if (typeof error === "object" && error !== null && !Array.isArray(error)) {
    const maybe = error as { status?: unknown; title?: unknown; type?: unknown };
    if (typeof maybe.status === "number") {
      throw new ApiError({
        ...(error as Record<string, unknown>),
        type: typeof maybe.type === "string" ? maybe.type : "about:blank",
        title: typeof maybe.title === "string" ? maybe.title : "Request failed",
        status: maybe.status,
      });
    }
  }
  // No status info at all — genuinely unknown error shape, not a discarded one.
  throw new ApiError({ type: "about:blank", title: "Request failed", status: 0 });
}

function unwrap<T>(result: { data?: T; error?: unknown }): T {
  if (result.error !== undefined) {
    problemFromUnknown(result.error);
  }
  return result.data as T;
}

export const chunksQueryKey = (sessionId: string) =>
  ["jdr", "transcription", "chunks", sessionId] as const;

export const transcriptionQueryKey = (sessionId: string) =>
  ["jdr", "transcription", "diarised", sessionId] as const;

export const transcriptionMarkdownQueryKey = (sessionId: string) =>
  ["jdr", "transcription", "markdown", sessionId] as const;

interface TranscriptionQueryOptions {
  /**
   * Mode + state gate, decided by the caller (the viewer branches on
   * `transcription_mode` and only mounts at `state === "transcribed"`). Keeping
   * the matching hook enabled and the other disabled guarantees exactly one
   * endpoint is hit — so `409 wrong-mode` can never occur.
   */
  enabled: boolean;
}

/**
 * Story 4.13 — chunks of a non_diarised session (`GET /chunks`, `ChunkListOut`).
 * `retry:false` so a not-ready 404 doesn't hammer the endpoint.
 */
export function useSessionChunks(
  sessionId: string,
  { enabled }: TranscriptionQueryOptions,
) {
  const apiClient = useMemo(() => createApiClient(), []);
  return useQuery({
    queryKey: chunksQueryKey(sessionId),
    queryFn: async () => {
      const result = await apiClient.GET(
        "/services/jdr/sessions/{session_id}/chunks",
        { params: { path: { session_id: sessionId } } },
      );
      return unwrap<ChunkListOut>(result);
    },
    enabled: enabled && sessionId !== "",
    retry: false,
  });
}

/**
 * Story 4.13 — diarised transcription of a session (`GET /transcription`,
 * `TranscriptionOut`). Same rules as `useSessionChunks`.
 */
export function useSessionTranscription(
  sessionId: string,
  { enabled }: TranscriptionQueryOptions,
) {
  const apiClient = useMemo(() => createApiClient(), []);
  return useQuery({
    queryKey: transcriptionQueryKey(sessionId),
    queryFn: async () => {
      const result = await apiClient.GET(
        "/services/jdr/sessions/{session_id}/transcription",
        { params: { path: { session_id: sessionId } } },
      );
      return unwrap<TranscriptionOut>(result);
    },
    enabled: enabled && sessionId !== "",
    retry: false,
  });
}

/**
 * Story 4.17 - canonical Markdown transcription of a session
 * (`GET /transcription.md`). BD-13 makes this endpoint the read source for the
 * edited override while still rendering the auto transcription before edits.
 */
export function useSessionTranscriptionMarkdown(
  sessionId: string,
  { enabled }: TranscriptionQueryOptions,
) {
  const apiClient = useMemo(() => createApiClient(), []);
  return useQuery({
    queryKey: transcriptionMarkdownQueryKey(sessionId),
    queryFn: async () => {
      const result = await apiClient.GET(
        "/services/jdr/sessions/{session_id}/transcription.md",
        { params: { path: { session_id: sessionId } }, parseAs: "text" },
      );
      return unwrap<string>(result);
    },
    enabled: enabled && sessionId !== "",
    retry: false,
  });
}

interface UpdateTranscriptionMarkdownInput {
  content_md: string;
}

/**
 * Story 4.17 - persist an edited Markdown transcription (`PUT /transcription`).
 * The backend stores an override and generation jobs consume it first.
 */
export function useUpdateTranscriptionMarkdown(sessionId: string) {
  const apiClient = useMemo(() => createApiClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateTranscriptionMarkdownInput) => {
      const result = await apiClient.PUT(
        "/services/jdr/sessions/{session_id}/transcription",
        {
          params: { path: { session_id: sessionId } },
          body: { content_md: input.content_md },
        },
      );
      return unwrap<TranscriptionEditOut>(result);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        transcriptionMarkdownQueryKey(sessionId),
        data.content_md,
      );
      queryClient.invalidateQueries({
        queryKey: transcriptionMarkdownQueryKey(sessionId),
      });
      queryClient.invalidateQueries({ queryKey: chunksQueryKey(sessionId) });
      queryClient.invalidateQueries({
        queryKey: transcriptionQueryKey(sessionId),
      });
    },
  });
}

/**
 * Story 4.14 — export the finished transcription as Markdown
 * (`GET /transcription.md`, text/markdown). One mode-agnostic endpoint covers
 * both `transcription_mode` values (the backend renders the Markdown), so there
 * is no wrong-mode hazard here. The `200` body is typed `content?: never` in the
 * generated contract (FastAPI omits the text/markdown schema), hence
 * `parseAs: "text"` to read the raw string and the `unwrap<string>` cast. The
 * download is imperative (triggered on click) → a mutation, not a query. The
 * caller owns the file-save side effect.
 */
export function useDownloadTranscriptionMarkdown(sessionId: string) {
  const apiClient = useMemo(() => createApiClient(), []);
  return useMutation({
    mutationFn: async () => {
      const result = await apiClient.GET(
        "/services/jdr/sessions/{session_id}/transcription.md",
        { params: { path: { session_id: sessionId } }, parseAs: "text" },
      );
      return unwrap<string>(result);
    },
  });
}

export type {
  ChunkListOut,
  ChunkOut,
  TranscriptionOut,
  TranscriptionSegmentOut,
  TranscriptionEditOut,
};
