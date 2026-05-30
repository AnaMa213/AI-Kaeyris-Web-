import { createApiClient } from "@/lib/core/api/client";
import { AuthError } from "@/lib/core/api/errors";
import type { AuthMeResponse } from "@/lib/core/session/types";

export const SESSION_QUERY_KEY = ["session", "me"] as const;

let cachedClient: ReturnType<typeof createApiClient> | null = null;
function getClient() {
  if (!cachedClient) cachedClient = createApiClient();
  return cachedClient;
}

async function fetchAuthMe(): Promise<AuthMeResponse> {
  const { data } = await getClient().GET("/services/jdr/auth/me");
  if (!data) {
    throw new AuthError({
      type: "about:blank",
      title: "Session invalide",
      status: 401,
    });
  }
  return data as AuthMeResponse;
}

export const sessionQueryOptions = {
  queryKey: SESSION_QUERY_KEY,
  queryFn: fetchAuthMe,
  staleTime: 5 * 60_000,
  retry: false,
} as const;
