"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@/lib/core/api/client";
import { SESSION_QUERY_KEY } from "@/lib/core/session/queries";
import type { AuthMeResponse } from "@/lib/core/session/types";

// Sentinel pinned in the session cache while logout is in flight. The empty
// `id` is the signal that this is a logout placeholder; useCurrentUser maps
// it to 'unauthenticated' without triggering a refetch. A real /auth/me
// response always carries a non-empty UUID. Pre-BD-7 the placeholder relied
// on active_campaign=null but that is now a valid authenticated state, so
// we use the empty-id sentinel instead.
export const UNAUTH_PLACEHOLDER: AuthMeResponse = {
  user: { id: "", username: "", system_role: "user" },
  active_campaign: null,
};

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const apiClient = useMemo(() => createApiClient(), []);

  return useMutation({
    onMutate: async () => {
      await queryClient.cancelQueries();
      // Pin the session cache to the unauth sentinel so useCurrentUser flips
      // to 'unauthenticated' immediately, before the network roundtrip — and
      // without dropping the entry (which would race with SessionProvider's
      // refetch and re-probe /auth/me while the cookie is still alive).
      queryClient.setQueryData<AuthMeResponse>(
        SESSION_QUERY_KEY,
        UNAUTH_PLACEHOLDER,
      );
      // Drop every other cached query so a future re-login starts fresh.
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "session",
      });
      router.replace("/login");
    },
    mutationFn: async () => {
      await apiClient.POST("/services/jdr/auth/logout");
    },
  });
}
