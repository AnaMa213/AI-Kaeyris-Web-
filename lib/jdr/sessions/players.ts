"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@/lib/core/api/client";
import { ApiError } from "@/lib/core/api/errors";
import type { components } from "@/types/api";

type SessionPlayersOut = components["schemas"]["SessionPlayersOut"];

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

export const sessionPlayersQueryKey = (sessionId: string) =>
  ["jdr", "session-players", sessionId] as const;

/**
 * Story 4.1 — PJs déclarés présents à une session (`GET /players`). Source de
 * la pré-sélection de `<PjPresenceForm>`. Désactivé tant que `sessionId` est vide.
 */
export function useSessionPlayers(sessionId: string) {
  const apiClient = useMemo(() => createApiClient(), []);
  return useQuery({
    queryKey: sessionPlayersQueryKey(sessionId),
    queryFn: async () => {
      const result = await apiClient.GET(
        "/services/jdr/sessions/{session_id}/players",
        { params: { path: { session_id: sessionId } } },
      );
      return unwrap<SessionPlayersOut>(result);
    },
    enabled: sessionId !== "",
  });
}

/**
 * Story 4.1 — déclare la présence des PJs (`POST /players`). Sémantique
 * **remplacement total** : le `pj_ids` envoyé est l'ensemble complet voulu (pas
 * un delta). Le cache est réécrit depuis la réponse pour un reflet immédiat.
 */
export function useSetSessionPlayers(sessionId: string) {
  const apiClient = useMemo(() => createApiClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pjIds: string[]) => {
      const result = await apiClient.POST(
        "/services/jdr/sessions/{session_id}/players",
        {
          params: { path: { session_id: sessionId } },
          body: { pj_ids: pjIds },
        },
      );
      return unwrap<SessionPlayersOut>(result);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(sessionPlayersQueryKey(sessionId), data);
    },
  });
}

export type { SessionPlayersOut };
