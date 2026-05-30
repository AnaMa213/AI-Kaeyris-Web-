"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@/lib/core/api/client";
import { SESSION_QUERY_KEY } from "@/lib/core/session/queries";
import type { AuthMeResponse } from "@/lib/core/session/types";

const UNAUTH_PLACEHOLDER: AuthMeResponse = {
  user: { id: "", username: "" },
  active_campaign: null,
};

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const apiClient = useMemo(() => createApiClient(), []);

  return useMutation({
    onMutate: async () => {
      await queryClient.cancelQueries();
      // Pin the session query to an explicit "no active campaign" state.
      // useCurrentUser reads this as 'unauthenticated' without triggering
      // a refetch, avoiding the race where SessionProvider would re-probe
      // /services/jdr/users before the backend logout has invalidated the
      // cookie. LoginForm.onSuccess invalidates this entry post-login so
      // the placeholder doesn't survive a fresh sign-in.
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
