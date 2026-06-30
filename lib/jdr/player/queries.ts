"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@/lib/core/api/client";
import { ApiError } from "@/lib/core/api/errors";
import type { components } from "@/types/api";

/**
 * Story 8.4 (BD-27) — player-scoped read hooks. A player (campaign member with
 * `active_campaign.role === "pj"`) reads ONLY the sessions where their PJ took
 * part, via the `/me/*` namespace (backend scopes by the authenticated PJ).
 * Read-only: there is no write counterpart here by design.
 */

type PlayerSessionItem = components["schemas"]["PlayerSessionItem"];
type PlayerSessionListOut = components["schemas"]["PlayerSessionListOut"];
type SummaryArtifactOut = components["schemas"]["SummaryArtifactOut"];
type NarrativeArtifactOut = components["schemas"]["NarrativeArtifactOut"];
type ElementsArtifactOut = components["schemas"]["ElementsArtifactOut"];
type PovArtifactOut = components["schemas"]["PovArtifactOut"];

function unwrap<T>(result: { data?: unknown; error?: unknown }): T {
  if (result.error !== undefined) {
    if (result.error instanceof ApiError) throw result.error;
    const problem = result.error as { status?: unknown; title?: unknown; type?: unknown };
    throw new ApiError({
      type: typeof problem.type === "string" ? problem.type : "about:blank",
      title: typeof problem.title === "string" ? problem.title : "Request failed",
      status: typeof problem.status === "number" ? problem.status : 0,
    });
  }
  return result.data as T;
}

/** Absent artifact (not yet generated) — surfaced as 404/422, treated as "absent". */
export function isPlayerArtifactAbsentError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.problem.status === 404 || error.problem.status === 422)
  );
}

export const mySessionsQueryKey = () => ["jdr", "me", "sessions"] as const;
export const myArtifactQueryKey = (kind: string, sessionId: string) =>
  ["jdr", "me", "artifact", kind, sessionId] as const;

/** GET /me/sessions — the player's sessions, newest recorded first. */
export function useMySessions() {
  const apiClient = useMemo(() => createApiClient(), []);
  return useQuery({
    queryKey: mySessionsQueryKey(),
    queryFn: async () => {
      const result = await apiClient.GET("/services/jdr/me/sessions");
      const page = unwrap<PlayerSessionListOut>(result);
      return [...page.items].sort((a, b) =>
        b.recorded_at.localeCompare(a.recorded_at),
      ) as PlayerSessionItem[];
    },
  });
}

function usePlayerArtifact<T>(
  kind: "summary" | "narrative" | "elements" | "pov",
  sessionId: string,
  path:
    | "/services/jdr/me/sessions/{session_id}/summary"
    | "/services/jdr/me/sessions/{session_id}/narrative"
    | "/services/jdr/me/sessions/{session_id}/elements"
    | "/services/jdr/me/sessions/{session_id}/pov",
) {
  const apiClient = useMemo(() => createApiClient(), []);
  return useQuery({
    queryKey: myArtifactQueryKey(kind, sessionId),
    queryFn: async () => {
      const result = await apiClient.GET(path, {
        params: { path: { session_id: sessionId } },
      });
      return unwrap<T>(result);
    },
    enabled: sessionId !== "",
    retry: false,
  });
}

export const useMySummary = (sessionId: string) =>
  usePlayerArtifact<SummaryArtifactOut>(
    "summary",
    sessionId,
    "/services/jdr/me/sessions/{session_id}/summary",
  );

export const useMyNarrative = (sessionId: string) =>
  usePlayerArtifact<NarrativeArtifactOut>(
    "narrative",
    sessionId,
    "/services/jdr/me/sessions/{session_id}/narrative",
  );

export const useMyElements = (sessionId: string) =>
  usePlayerArtifact<ElementsArtifactOut>(
    "elements",
    sessionId,
    "/services/jdr/me/sessions/{session_id}/elements",
  );

export const useMyPov = (sessionId: string) =>
  usePlayerArtifact<PovArtifactOut>(
    "pov",
    sessionId,
    "/services/jdr/me/sessions/{session_id}/pov",
  );

export type {
  PlayerSessionItem,
  SummaryArtifactOut,
  NarrativeArtifactOut,
  ElementsArtifactOut,
  PovArtifactOut,
};
