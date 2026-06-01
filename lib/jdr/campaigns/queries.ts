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

export type { CampaignOut, PageOfCampaignOut };
