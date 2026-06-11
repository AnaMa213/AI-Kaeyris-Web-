"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@/lib/core/api/client";
import { ApiError } from "@/lib/core/api/errors";
import type {
  UserCreateInput,
  UserUpdateInput,
} from "@/lib/jdr/schemas/users";
import type { components } from "@/types/api";

type UserOut = components["schemas"]["UserOut"];

// Defensive unwrap. createErrorMiddleware (Story 1.5) throws ApiError before
// this branch is hit on every non-2xx; this fallback only ever fires if the
// middleware was bypassed (test mock, etc.).
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

interface UseUsersOptions {
  enabled?: boolean;
}

export function useUsers({ enabled = true }: UseUsersOptions = {}) {
  const apiClient = useMemo(() => createApiClient(), []);
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const result = await apiClient.GET("/services/jdr/users");
      return unwrap(result);
    },
    enabled,
  });
}

// Story 1.9 lesson: queryClient.clear() is for session boundaries
// (login / logout / expired). Mutations on a single resource use
// invalidateQueries scoped to the query key so unrelated cached
// entries (['auth', 'setup-status'], etc.) survive untouched.
function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["users"] });
}

export function useCreateUser() {
  const apiClient = useMemo(() => createApiClient(), []);
  const invalidateUsers = useInvalidateUsers();
  return useMutation({
    mutationFn: async (body: UserCreateInput) => {
      const result = await apiClient.POST("/services/jdr/users", { body });
      return unwrap(result);
    },
    onSuccess: () => {
      invalidateUsers();
    },
  });
}

export function useUpdateUser() {
  const apiClient = useMemo(() => createApiClient(), []);
  const invalidateUsers = useInvalidateUsers();
  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: UserUpdateInput;
    }) => {
      const result = await apiClient.PATCH("/services/jdr/users/{user_id}", {
        params: { path: { user_id: id } },
        body,
      });
      return unwrap(result);
    },
    onSuccess: () => {
      invalidateUsers();
    },
  });
}

export function useDeleteUser() {
  const apiClient = useMemo(() => createApiClient(), []);
  const invalidateUsers = useInvalidateUsers();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await apiClient.DELETE("/services/jdr/users/{user_id}", {
        params: { path: { user_id: id } },
      });
      if (result.error !== undefined) {
        throw new ApiError({
          type: "about:blank",
          title: "Suppression impossible",
          status: 0,
        });
      }
    },
    onSuccess: () => {
      invalidateUsers();
    },
  });
}

export type { UserOut };
