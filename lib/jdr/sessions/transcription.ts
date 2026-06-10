"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@/lib/core/api/client";
import { ApiError } from "@/lib/core/api/errors";
import type { components } from "@/types/api";

type ChunkListOut = components["schemas"]["ChunkListOut"];
type ChunkOut = components["schemas"]["ChunkOut"];
type TranscriptionOut = components["schemas"]["TranscriptionOut"];
type TranscriptionSegmentOut = components["schemas"]["TranscriptionSegmentOut"];

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

export type {
  ChunkListOut,
  ChunkOut,
  TranscriptionOut,
  TranscriptionSegmentOut,
};
