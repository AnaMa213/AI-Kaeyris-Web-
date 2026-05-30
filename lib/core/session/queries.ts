import { useMockSession } from "@/lib/core/config";
import { mockAuthMe } from "@/lib/core/api/mocks/auth-me";
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
  if (useMockSession) {
    // V1 transitional: BD-4 (/auth/me) ships separately. Probe a real
    // authenticated endpoint so the session cookie is actually validated
    // by the backend. 401 -> AuthInterceptor redirects to /login.
    try {
      await getClient().GET("/services/jdr/users");
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError({
        type: "about:blank",
        title: "Session non vérifiable",
        status: 401,
      });
    }
    return mockAuthMe();
  }
  throw new Error(
    "Real /services/jdr/auth/me wiring lands with BD-4. Toggle useMockSession until then.",
  );
}

export const sessionQueryOptions = {
  queryKey: SESSION_QUERY_KEY,
  queryFn: fetchAuthMe,
  staleTime: 5 * 60_000,
  retry: false,
} as const;
