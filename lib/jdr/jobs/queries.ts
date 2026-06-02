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

// Story 3.3: read-only consumer of the cache populated by useUploadSessionAudio.
// Story 3.4 will flip `enabled` and add `refetchInterval` for live polling.
export function useJob(jobId: string | null) {
  const apiClient = useMemo(() => createApiClient(), []);
  return useQuery({
    queryKey: jobQueryKey(jobId ?? ""),
    queryFn: async () => {
      const result = await apiClient.GET("/services/jdr/jobs/{job_id}", {
        params: { path: { job_id: jobId! } },
      });
      return unwrap<JobOut>(result);
    },
    enabled: false,
  });
}

export type { JobOut };
