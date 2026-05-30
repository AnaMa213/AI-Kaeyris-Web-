"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@/lib/core/api/client";
import { ApiError } from "@/lib/core/api/errors";

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const apiClient = useMemo(() => createApiClient(), []);

  return useMutation({
    mutationFn: async () => {
      const { error } = await apiClient.POST("/services/jdr/auth/logout");
      if (error) {
        throw new ApiError({
          type: "about:blank",
          title: "Déconnexion impossible",
          status: 0,
        });
      }
    },
    onSuccess: () => {
      queryClient.clear();
      router.push("/login");
    },
  });
}
