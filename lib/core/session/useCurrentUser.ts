"use client";

import { useQuery } from "@tanstack/react-query";
import { sessionQueryOptions } from "@/lib/core/session/queries";
import type { CampaignRole, CurrentUser } from "@/lib/core/session/types";

export function useCurrentUser(): CurrentUser {
  const { data, isLoading, isError } = useQuery(sessionQueryOptions);

  if (isLoading) {
    return { status: "loading" };
  }

  if (isError || !data) {
    return { status: "unauthenticated" };
  }

  // Logout sentinel pinned by useLogout: an empty `user.id` means the cache
  // is in the post-logout placeholder state. Real /auth/me responses always
  // carry a non-empty UUID.
  if (!data.user.id) {
    return { status: "unauthenticated" };
  }

  return {
    status: "authenticated",
    auth: {
      authId: data.user.id,
      username: data.user.username,
      systemRole: data.user.system_role,
    },
    activeCampaign: data.active_campaign
      ? {
          id: data.active_campaign.id,
          name: data.active_campaign.name,
          // Backend BD-7 returns role as "gm" | "pj" but the openapi schema
          // types it loosely as string. Narrow at the adapter boundary.
          role: data.active_campaign.role as CampaignRole,
          characterId: data.active_campaign.character_id,
        }
      : null,
  };
}
