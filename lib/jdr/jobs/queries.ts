"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@/lib/core/api/client";
import { ApiError } from "@/lib/core/api/errors";
import type { components } from "@/types/api";

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

export const JOBS_QUERY_KEY = ["jdr", "jobs"] as const;
export const jobQueryKey = (id: string) => ["jdr", "job", id] as const;

const TERMINAL_STATUSES: JobOut["status"][] = ["succeeded", "failed"];

/**
 * Back-off du polling (Story 3.4) : job terminal → stop (`false`) ; sinon
 * intervalle dégressif dérivé de l'âge du job (`queued_at`) — 1 s (jeune) →
 * 3 s (<30 s) → 5 s (au-delà). Pas d'intervalle constant : évite de spammer un
 * job long. Un job sans data encore (`undefined`) poll vite pour démarrer.
 */
export function jobRefetchInterval(job: JobOut | undefined): number | false {
  if (job && TERMINAL_STATUSES.includes(job.status)) return false;
  const ageMs = job ? Date.now() - new Date(job.queued_at).getTime() : 0;
  if (ageMs < 10_000) return 1000;
  if (ageMs < 30_000) return 3000;
  return 5000;
}

/**
 * Un 404 `job-not-found` est définitif : le job n'existe pas (ou plus) côté
 * backend. Sans cette garde, `data` reste `undefined` et le back-off poll en
 * boucle toutes les secondes sur un job introuvable. On stoppe le polling et on
 * laisse l'erreur remonter au consommateur (Story 3.4 / dev-notes job-polling-404).
 */
export function isJobNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.problem.status === 404;
}

interface UseJobOptions {
  /** Active le polling live + back-off. Par défaut read-only (cache seul). */
  live?: boolean;
}

/**
 * Story 3.3 : consommateur read-only du cache (`live:false`, le `<JobStateBadge>`
 * ne déclenche aucun réseau). Story 3.4 : `live:true` active le polling live
 * avec back-off, stoppé automatiquement à l'état terminal.
 */
export function useJob(jobId: string | null, { live = false }: UseJobOptions = {}) {
  const apiClient = useMemo(() => createApiClient(), []);
  return useQuery({
    queryKey: jobQueryKey(jobId ?? ""),
    queryFn: async () => {
      const result = await apiClient.GET("/services/jdr/jobs/{job_id}", {
        params: { path: { job_id: jobId! } },
      });
      return unwrap<JobOut>(result);
    },
    enabled: live && jobId !== null,
    // Polling : on neutralise le staleTime global (60 s) pour que le refetch
    // initial parte dès l'activation, et que chaque tick d'intervalle refetch.
    staleTime: live ? 0 : undefined,
    // Un 404 ne doit jamais être retenté : c'est un état d'arrêt, pas un retard.
    retry: (_failureCount, error) => !isJobNotFound(error),
    refetchInterval: live
      ? (query) => {
          if (isJobNotFound(query.state.error)) return false;
          return jobRefetchInterval(query.state.data as JobOut | undefined);
        }
      : false,
    // Le MJ peut "partir de l'onglet" : on continue de poller en arrière-plan
    // pour pouvoir le notifier à la fin (Story 3.4).
    refetchIntervalInBackground: live,
  });
}

export type { JobOut };
