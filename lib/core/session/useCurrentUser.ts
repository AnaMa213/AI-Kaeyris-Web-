"use client";

import { useQuery } from "@tanstack/react-query";
import { sessionQueryOptions } from "@/lib/core/session/queries";
import type { CurrentUser } from "@/lib/core/session/types";

export function useCurrentUser(): CurrentUser {
  const { data, isLoading, isError } = useQuery(sessionQueryOptions);

  if (isLoading) {
    return { status: "loading" };
  }

  if (isError || !data || !data.active_campaign) {
    return { status: "unauthenticated" };
  }

  return {
    status: "authenticated",
    auth: {
      authId: data.user.id,
      campaignId: data.active_campaign.id,
    },
    jdr: {
      role: data.active_campaign.role,
      characterId: data.active_campaign.character_id ?? "",
      displayName: data.user.username,
    },
  };
}
