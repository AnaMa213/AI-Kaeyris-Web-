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

export type { PjOut, PageOfPjOut };
