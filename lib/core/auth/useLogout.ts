"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@/lib/core/api/client";

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const apiClient = useMemo(() => createApiClient(), []);

  return useMutation({
    onMutate: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      router.replace("/login");
    },
    mutationFn: async () => {
      await apiClient.POST("/services/jdr/auth/logout");
    },
  });
}
