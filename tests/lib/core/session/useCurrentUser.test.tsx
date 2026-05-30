// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, waitFor } from "@testing-library/react";
import type { AuthMeResponse } from "@/lib/core/session/types";

vi.mock("@/lib/core/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

const authMeGet = vi.fn();
vi.mock("@/lib/core/api/client", () => ({
  createApiClient: () => ({ GET: authMeGet }),
}));

const { SESSION_QUERY_KEY } = await import(
  "@/lib/core/session/SessionProvider"
);
const { useCurrentUser } = await import("@/lib/core/session/useCurrentUser");
const { default: SessionProvider } = await import(
  "@/lib/core/session/SessionProvider"
);
const { AuthError } = await import("@/lib/core/api/errors");

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

const validResponse: AuthMeResponse = {
  user: { id: "kenan-uuid", username: "kenan" },
  active_campaign: {
    id: "campaign-default-uuid",
    name: "Campagne par défaut",
    role: "gm",
    character_id: "kenan-pc-uuid",
  },
};

beforeEach(() => {
  authMeGet.mockReset();
});

describe("useCurrentUser()", () => {
  test("returns 'loading' on first render when cache is empty", () => {
    authMeGet.mockReturnValue(new Promise(() => undefined));
    const client = makeClient();
    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: wrap(client),
    });
    expect(result.current.status).toBe("loading");
  });

  test("returns 'authenticated' triplet when cache holds a valid auth-me response", () => {
    authMeGet.mockReturnValue(new Promise(() => undefined));
    const client = makeClient();
    client.setQueryData(SESSION_QUERY_KEY, validResponse);

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: wrap(client),
    });

    expect(result.current).toEqual({
      status: "authenticated",
      auth: { authId: "kenan-uuid", campaignId: "campaign-default-uuid" },
      jdr: {
        role: "gm",
        characterId: "kenan-pc-uuid",
        displayName: "kenan",
      },
    });
  });

  test("returns 'unauthenticated' when active_campaign is null in cache", () => {
    authMeGet.mockReturnValue(new Promise(() => undefined));
    const client = makeClient();
    client.setQueryData(SESSION_QUERY_KEY, {
      user: { id: "kenan-uuid", username: "kenan" },
      active_campaign: null,
    } satisfies AuthMeResponse);

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: wrap(client),
    });

    expect(result.current.status).toBe("unauthenticated");
  });

  test("dedup: /auth/me GET fires exactly once when SessionProvider and useCurrentUser observe the same key", async () => {
    authMeGet.mockResolvedValue({ data: validResponse, error: undefined });
    const client = makeClient();

    function Child() {
      useCurrentUser();
      return null;
    }

    render(
      <QueryClientProvider client={client}>
        <SessionProvider>
          <Child />
        </SessionProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(authMeGet).toHaveBeenCalledTimes(1);
    });
    expect(authMeGet).toHaveBeenCalledWith("/services/jdr/auth/me");
  });

  test("AuthError thrown from /auth/me leaves the hook in 'unauthenticated' and surfaces AuthError to query cache", async () => {
    authMeGet.mockRejectedValue(
      new AuthError({
        type: "about:blank",
        title: "Session expirée",
        status: 401,
      }),
    );
    const client = makeClient();

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: wrap(client),
    });

    await waitFor(() => {
      expect(result.current.status).toBe("unauthenticated");
    });

    const state = client.getQueryState(SESSION_QUERY_KEY);
    expect(state?.error).toBeInstanceOf(AuthError);
  });

  test("Empty /auth/me response (no data) is treated as AuthError", async () => {
    authMeGet.mockResolvedValue({ data: undefined, error: undefined });
    const client = makeClient();

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: wrap(client),
    });

    await waitFor(() => {
      expect(result.current.status).toBe("unauthenticated");
    });

    const state = client.getQueryState(SESSION_QUERY_KEY);
    expect(state?.error).toBeInstanceOf(AuthError);
  });
});
