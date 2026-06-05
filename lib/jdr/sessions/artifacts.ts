"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@/lib/core/api/client";
import { ApiError } from "@/lib/core/api/errors";
import { jobQueryKey, type JobOut } from "@/lib/jdr/jobs/queries";
import type { components } from "@/types/api";

type SummaryArtifactOut = components["schemas"]["SummaryArtifactOut"];
type JobQueuedOut = components["schemas"]["JobQueuedOut"];

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

export const summaryArtifactQueryKey = (sessionId: string) =>
  ["jdr", "artifact", "summary", sessionId] as const;

/**
 * Story 4.3 — récupère le Résumé d'une séance (`GET /artifacts/summary`).
 * Un résumé non encore généré remonte en `isError` (404/422) — le consommateur
 * traite ça comme « absent » et n'expose jamais une erreur de page. `retry:false`
 * pour ne pas marteler l'endpoint sur une absence.
 *
 * Note : seul `summary` est câblé ici (Story 4.3) ; Récit/Éléments/POVs arrivent
 * en Story 4.4 (le `GET povs` est par PJ, asymétrique).
 */
export function useSummaryArtifact(sessionId: string) {
  const apiClient = useMemo(() => createApiClient(), []);
  return useQuery({
    queryKey: summaryArtifactQueryKey(sessionId),
    queryFn: async () => {
      const result = await apiClient.GET(
        "/services/jdr/sessions/{session_id}/artifacts/summary",
        { params: { path: { session_id: sessionId } } },
      );
      return unwrap<SummaryArtifactOut>(result);
    },
    enabled: sessionId !== "",
    retry: false,
  });
}

/**
 * Story 4.3 — déclenche la génération du Résumé (`POST /artifacts/summary`,
 * 202 → `JobQueuedOut`). Le job retourné est semé dans le cache jobs
 * (`jobQueryKey`) pour que `useJob`/`<JobStateBadge>` le suivent sans refetch.
 */
export function useGenerateSummary(sessionId: string) {
  const apiClient = useMemo(() => createApiClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await apiClient.POST(
        "/services/jdr/sessions/{session_id}/artifacts/summary",
        { params: { path: { session_id: sessionId } } },
      );
      return unwrap<JobQueuedOut>(result);
    },
    onSuccess: (job) => {
      queryClient.setQueryData<JobOut>(jobQueryKey(job.id), job as JobOut);
    },
  });
}

export type { SummaryArtifactOut, JobQueuedOut };
