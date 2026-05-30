import { useMockSession } from "@/lib/core/config";
import { mockAuthMe } from "@/lib/core/api/mocks/auth-me";
import type { AuthMeResponse } from "@/lib/core/session/types";

export const SESSION_QUERY_KEY = ["session", "me"] as const;

async function fetchAuthMe(): Promise<AuthMeResponse> {
  if (useMockSession) {
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
