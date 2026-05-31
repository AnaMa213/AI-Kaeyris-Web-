"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@/lib/core/api/client";
import { ApiError } from "@/lib/core/api/errors";
import type { PjCreateInput } from "@/lib/jdr/schemas/pjs";
import type { components } from "@/types/api";

type PjOut = components["schemas"]["PjOut"];
type PageOfPjOut = components["schemas"]["Page_PjOut_"];

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

export const PJS_QUERY_KEY = ["pjs"] as const;

export function useListPjs() {
  const apiClient = useMemo(() => createApiClient(), []);
  return useQuery({
    queryKey: PJS_QUERY_KEY,
    queryFn: async () => {
      const result = await apiClient.GET("/services/jdr/pjs");
      return unwrap<PageOfPjOut>(result);
    },
  });
}

function useInvalidatePjs() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: PJS_QUERY_KEY });
}

export function useCreatePj() {
  const apiClient = useMemo(() => createApiClient(), []);
  const invalidatePjs = useInvalidatePjs();
  return useMutation({
    mutationFn: async (body: PjCreateInput) => {
      const result = await apiClient.POST("/services/jdr/pjs", { body });
      return unwrap<PjOut>(result);
    },
    onSuccess: () => {
      invalidatePjs();
    },
  });
}

export function useDeletePj() {
  const apiClient = useMemo(() => createApiClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pjId: string) => {
      const result = await apiClient.DELETE("/services/jdr/pjs/{pj_id}", {
        params: { path: { pj_id: pjId } },
      });
      if (result.error !== undefined) {
        throw new ApiError({
          type: "about:blank",
          title: "Suppression impossible",
          status: 0,
        });
      }
      return pjId;
    },
    // V1 mocked: the backend never receives the delete (BD-3 endpoint missing),
    // so invalidateQueries would refetch and bring the PJ back. We mutate the
    // cache directly instead — the page hides the PJ locally, a refresh
    // restores it. Documented in <MockBadge> tooltip + Story 2.2 AC4.
    onSuccess: (deletedId) => {
      queryClient.setQueryData<PageOfPjOut>(PJS_QUERY_KEY, (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.filter((pj) => pj.id !== deletedId),
          total: Math.max(0, old.total - 1),
        };
      });
    },
  });
}

export type { PjOut, PageOfPjOut };
