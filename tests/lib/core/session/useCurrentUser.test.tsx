// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { AuthMeResponse } from "@/lib/core/session/types";

vi.mock("@/lib/core/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

const { SESSION_QUERY_KEY } = await import(
  "@/lib/core/session/SessionProvider"
);
const { useCurrentUser } = await import("@/lib/core/session/useCurrentUser");

function wrap(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

describe("useCurrentUser()", () => {
  test("returns 'unauthenticated' when query cache is empty", () => {
    const client = makeClient();
    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: wrap(client),
    });
    expect(result.current.status).toBe("unauthenticated");
  });

  test("returns 'authenticated' triplet when cache holds a valid auth-me response", () => {
    const client = makeClient();
    const response: AuthMeResponse = {
      user: { id: "kenan", username: "Kenan" },
      active_campaign: {
        id: "campaign-default",
        name: "Campagne par défaut",
        role: "gm",
        character_id: "kenan-pc",
      },
    };
    client.setQueryData(SESSION_QUERY_KEY, response);

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: wrap(client),
    });

    expect(result.current).toEqual({
      status: "authenticated",
      auth: { authId: "kenan", campaignId: "campaign-default" },
      jdr: { role: "gm", characterId: "kenan-pc", displayName: "Kenan" },
    });
  });

  test("returns 'unauthenticated' when active_campaign is null", () => {
    const client = makeClient();
    const response: AuthMeResponse = {
      user: { id: "kenan", username: "Kenan" },
      active_campaign: null,
    };
    client.setQueryData(SESSION_QUERY_KEY, response);

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: wrap(client),
    });

    expect(result.current.status).toBe("unauthenticated");
  });

  test("does not trigger a fetch (enabled: false)", () => {
    const client = makeClient();
    let fetchCount = 0;
    client.setQueryDefaults(SESSION_QUERY_KEY, {
      queryFn: () => {
        fetchCount += 1;
        return Promise.resolve({} as AuthMeResponse);
      },
    });

    renderHook(() => useCurrentUser(), { wrapper: wrap(client) });

    expect(fetchCount).toBe(0);
  });
});
