"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@/lib/core/api/client";
import { ApiError } from "@/lib/core/api/errors";
import type { CampaignCreateInput } from "@/lib/jdr/schemas/campaigns";
import type { components } from "@/types/api";

type CampaignOut = components["schemas"]["CampaignOut"];
type PageOfCampaignOut = components["schemas"]["Page_CampaignOut_"];

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

export const CAMPAIGNS_QUERY_KEY = ["campaigns"] as const;
export const campaignQueryKey = (id: string) =>
  ["campaigns", id] as const;

export function useListCampaigns() {
  const apiClient = useMemo(() => createApiClient(), []);
  return useQuery({
    queryKey: CAMPAIGNS_QUERY_KEY,
    queryFn: async () => {
      const result = await apiClient.GET("/services/jdr/campaigns");
      return unwrap<PageOfCampaignOut>(result);
    },
  });
}

export function useGetCampaign(id: string) {
  const apiClient = useMemo(() => createApiClient(), []);
  return useQuery({
    queryKey: campaignQueryKey(id),
    queryFn: async () => {
      const result = await apiClient.GET(
        "/services/jdr/campaigns/{campaign_id}",
        { params: { path: { campaign_id: id } } },
      );
      return unwrap<CampaignOut>(result);
    },
    enabled: id !== "",
  });
}

export function useCreateCampaign() {
  const apiClient = useMemo(() => createApiClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CampaignCreateInput) => {
      const description = input.description?.trim();
      const result = await apiClient.POST("/services/jdr/campaigns", {
        body: {
          name: input.name,
          ...(description && description.length > 0 ? { description } : {}),
        },
      });
      return unwrap<CampaignOut>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CAMPAIGNS_QUERY_KEY });
    },
  });
}

export interface UpdateCampaignInput {
  name?: string;
  /** undefined = no change, null = clear, string = set */
  description?: string | null;
}

export function useUpdateCampaign(campaignId: string) {
  const apiClient = useMemo(() => createApiClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateCampaignInput) => {
      const body: components["schemas"]["CampaignPatch"] = {};
      if (input.name !== undefined) body.name = input.name;
      if (input.description !== undefined) {
        if (input.description === null) {
          body.description = null;
        } else {
          const trimmed = input.description.trim();
          body.description = trimmed === "" ? null : trimmed;
        }
      }
      const result = await apiClient.PATCH(
        "/services/jdr/campaigns/{campaign_id}",
        { params: { path: { campaign_id: campaignId } }, body },
      );
      return unwrap<CampaignOut>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignQueryKey(campaignId) });
      queryClient.invalidateQueries({ queryKey: CAMPAIGNS_QUERY_KEY });
    },
  });
}

export function useDeleteCampaign(campaignId: string) {
  const apiClient = useMemo(() => createApiClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await apiClient.DELETE(
        "/services/jdr/campaigns/{campaign_id}",
        { params: { path: { campaign_id: campaignId } } },
      );
      if (result.error !== undefined) {
        throw new ApiError({
          type: "about:blank",
          title: "Request failed",
          status: 0,
        });
      }
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: campaignQueryKey(campaignId) });
      queryClient.invalidateQueries({ queryKey: CAMPAIGNS_QUERY_KEY });
    },
  });
}

export type { CampaignOut, PageOfCampaignOut };
