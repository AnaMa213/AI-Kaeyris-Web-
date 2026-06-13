"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@/lib/core/api/client";
import { ApiError } from "@/lib/core/api/errors";
import { jobQueryKey, type JobOut } from "@/lib/jdr/jobs/queries";
import type { components } from "@/types/api";

type SummaryArtifactOut = components["schemas"]["SummaryArtifactOut"];
type NarrativeArtifactOut = components["schemas"]["NarrativeArtifactOut"];
type ElementsArtifactOut = components["schemas"]["ElementsArtifactOut"];
type PovArtifactOut = components["schemas"]["PovArtifactOut"];
type JobQueuedOut = components["schemas"]["JobQueuedOut"];

function problemFromUnknown(error: unknown) {
  if (error instanceof ApiError) throw error;
  if (typeof error === "object" && error !== null && !Array.isArray(error)) {
    const maybeProblem = error as { status?: unknown; title?: unknown; type?: unknown };
    if (typeof maybeProblem.status === "number") {
      throw new ApiError({
        ...(error as Record<string, unknown>),
        type: typeof maybeProblem.type === "string" ? maybeProblem.type : "about:blank",
        title:
          typeof maybeProblem.title === "string"
            ? maybeProblem.title
            : "Request failed",
        status: maybeProblem.status,
      });
    }
  }
  throw new ApiError({
    type: "about:blank",
    title: "Request failed",
    status: 0,
  });
}

function unwrap<T>(result: { data?: unknown; error?: unknown }): T {
  if (result.error !== undefined) {
    problemFromUnknown(result.error);
  }
  return result.data as T;
}

export function isArtifactAbsentError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.problem.status === 404 || error.problem.status === 422)
  );
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

/* -------------------------------------------------------------------------- */
/* Story 4.4 — Récit / Éléments / POVs (générés indépendamment du Résumé).     */
/*                                                                            */
/* narrative/elements sont symétriques au summary (GET → *ArtifactOut, POST → */
/* JobQueuedOut). POVs est asymétrique : POST déclenche UN job qui génère un   */
/* `pov:<pj_id>` par PJ déclaré ; il n'existe PAS de GET liste (la lecture par */
/* PJ via `GET /artifacts/povs/{pj_id_str}` arrive en Story 5.7). En mode      */
/* non_diarised, ces trois générateurs exigent seulement le Résumé d'abord     */
/* (409 no-summary sinon) — déjà gaté par l'UI ; ne jamais appeler PUT /mapping*/
/* (diarised-only).                                                            */
/* -------------------------------------------------------------------------- */

export const narrativeArtifactQueryKey = (sessionId: string) =>
  ["jdr", "artifact", "narrative", sessionId] as const;

export const elementsArtifactQueryKey = (sessionId: string) =>
  ["jdr", "artifact", "elements", sessionId] as const;

export const povArtifactQueryKey = (sessionId: string, pjId: string) =>
  ["jdr", "artifact", "pov", sessionId, pjId] as const;

export const povArtifactSessionKey = (sessionId: string) =>
  ["jdr", "artifact", "pov", sessionId] as const;

/**
 * Story 4.4 — récupère le Récit (`GET /artifacts/narrative`). Mêmes règles que
 * le Résumé : un récit non encore généré remonte en `isError` (404/422), traité
 * comme « absent », jamais une erreur de page (`retry:false`).
 */
export function useNarrativeArtifact(sessionId: string) {
  const apiClient = useMemo(() => createApiClient(), []);
  return useQuery({
    queryKey: narrativeArtifactQueryKey(sessionId),
    queryFn: async () => {
      const result = await apiClient.GET(
        "/services/jdr/sessions/{session_id}/artifacts/narrative",
        { params: { path: { session_id: sessionId } } },
      );
      return unwrap<NarrativeArtifactOut>(result);
    },
    enabled: sessionId !== "",
    retry: false,
  });
}

/**
 * Story 4.4 — récupère les Éléments (`GET /artifacts/elements`). Les quatre
 * listes (npcs/locations/items/clues) sont toujours présentes (`[]` si vides)
 * quand l'artefact existe ; absent = `isError`.
 */
export function useElementsArtifact(sessionId: string) {
  const apiClient = useMemo(() => createApiClient(), []);
  return useQuery({
    queryKey: elementsArtifactQueryKey(sessionId),
    queryFn: async () => {
      const result = await apiClient.GET(
        "/services/jdr/sessions/{session_id}/artifacts/elements",
        { params: { path: { session_id: sessionId } } },
      );
      return unwrap<ElementsArtifactOut>(result);
    },
    enabled: sessionId !== "",
    retry: false,
  });
}

/**
 * Story 5.7 — récupère le POV d'un PJ donné. La route renvoie `unknown` dans le
 * contrat car elle sert aussi le `.md` ; le consommateur décide la présence via
 * `Boolean(data?.text)` pour couvrir le 200/null historique.
 */
export function usePovArtifact(sessionId: string, pjId: string) {
  const apiClient = useMemo(() => createApiClient(), []);
  return useQuery({
    queryKey: povArtifactQueryKey(sessionId, pjId),
    queryFn: async () => {
      const result = await apiClient.GET(
        "/services/jdr/sessions/{session_id}/artifacts/povs/{pj_id_str}",
        {
          params: {
            path: { session_id: sessionId, pj_id_str: pjId },
          },
        },
      );
      return unwrap<PovArtifactOut>(result);
    },
    enabled: sessionId !== "" && pjId !== "",
    retry: false,
  });
}

/**
 * Story 4.4 — déclenche la génération du Récit (`POST /artifacts/narrative`).
 * Le job retourné est semé dans le cache jobs pour que `useJob`/`<JobStateBadge>`
 * le suivent sans refetch (même pattern que `useGenerateSummary`).
 */
export function useGenerateNarrative(sessionId: string) {
  const apiClient = useMemo(() => createApiClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await apiClient.POST(
        "/services/jdr/sessions/{session_id}/artifacts/narrative",
        { params: { path: { session_id: sessionId } } },
      );
      return unwrap<JobQueuedOut>(result);
    },
    onSuccess: (job) => {
      queryClient.setQueryData<JobOut>(jobQueryKey(job.id), job as JobOut);
    },
  });
}

/**
 * Story 4.4 — déclenche la génération des Éléments (`POST /artifacts/elements`).
 */
export function useGenerateElements(sessionId: string) {
  const apiClient = useMemo(() => createApiClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await apiClient.POST(
        "/services/jdr/sessions/{session_id}/artifacts/elements",
        { params: { path: { session_id: sessionId } } },
      );
      return unwrap<JobQueuedOut>(result);
    },
    onSuccess: (job) => {
      queryClient.setQueryData<JobOut>(jobQueryKey(job.id), job as JobOut);
    },
  });
}

/**
 * Story 4.4 — déclenche la génération des POVs (`POST /artifacts/povs`). UN seul
 * job génère un `pov:<pj_id>` par PJ déclaré. POST uniquement : pas de GET liste
 * (lecture par PJ = Story 5.7). En non_diarised, la liste `/players` fait office
 * de mapping — ne pas appeler `PUT /mapping`.
 */
export function useGeneratePovs(sessionId: string) {
  const apiClient = useMemo(() => createApiClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await apiClient.POST(
        "/services/jdr/sessions/{session_id}/artifacts/povs",
        { params: { path: { session_id: sessionId } } },
      );
      return unwrap<JobQueuedOut>(result);
    },
    onSuccess: (job) => {
      queryClient.setQueryData<JobOut>(jobQueryKey(job.id), job as JobOut);
    },
  });
}

export type {
  SummaryArtifactOut,
  NarrativeArtifactOut,
  ElementsArtifactOut,
  PovArtifactOut,
  JobQueuedOut,
};
