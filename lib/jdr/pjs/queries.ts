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

export const campaignPjsListQueryKey = (campaignId: string) =>
  ["pjs", "list", { campaignId }] as const;

export function useListCampaignPjs(campaignId: string) {
  const apiClient = useMemo(() => createApiClient(), []);
  return useQuery({
    queryKey: campaignPjsListQueryKey(campaignId),
    queryFn: async () => {
      const result = await apiClient.GET("/services/jdr/pjs", {
        params: { query: { campaign_id: campaignId } },
      });
      return unwrap<PageOfPjOut>(result);
    },
    enabled: campaignId !== "",
  });
}

export function useCreateCampaignPj(campaignId: string) {
  const apiClient = useMemo(() => createApiClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PjCreateInput) => {
      const result = await apiClient.POST("/services/jdr/pjs", {
        body: {
          name: input.name,
          campaign_id: campaignId,
          // "" / undefined → null explicite (PjCreate accepte user_id nullable).
          user_id: input.userId ? input.userId : null,
        },
      });
      return unwrap<PjOut>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: campaignPjsListQueryKey(campaignId),
      });
    },
  });
}

export interface UpdateCampaignPjInput {
  pjId: string;
  name: string;
  /** UUID to link a user, or `null` to unlink (BD-12 expects explicit null). */
  userId: string | null;
}

export function useUpdateCampaignPj(campaignId: string) {
  const apiClient = useMemo(() => createApiClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pjId, name, userId }: UpdateCampaignPjInput) => {
      const result = await apiClient.PATCH("/services/jdr/pjs/{pj_id}", {
        params: { path: { pj_id: pjId } },
        body: { name, user_id: userId },
      });
      return unwrap<PjOut>(result);
    },
    // Real persisted endpoint (BD-12) — refetch so the canonical PjOut
    // (server-confirmed user_id) comes back. Unlike useDeleteCampaignPj, which
    // mutates the cache locally only because the BD-3 DELETE is still unshipped.
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: campaignPjsListQueryKey(campaignId),
      });
    },
  });
}

export function useDeleteCampaignPj(campaignId: string) {
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
    // V1 mocked: BD-3 endpoint still pending, so a refetch would resurrect
    // the PJ. We mutate the cache directly — the row hides locally, a refresh
    // restores it. <PjDeleteConfirm> carries the honest "not persisted until
    // BD-3" caveat at the point of action.
    onSuccess: (deletedId) => {
      queryClient.setQueryData<PageOfPjOut>(
        campaignPjsListQueryKey(campaignId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.filter((pj) => pj.id !== deletedId),
            total: Math.max(0, old.total - 1),
          };
        },
      );
    },
  });
}

export type { PjOut, PageOfPjOut };
