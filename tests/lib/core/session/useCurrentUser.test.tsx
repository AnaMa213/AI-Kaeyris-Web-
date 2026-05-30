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

const mockAuthMeSpy = vi.fn();
vi.mock("@/lib/core/api/mocks/auth-me", () => ({
  mockAuthMe: () => mockAuthMeSpy(),
}));

const { SESSION_QUERY_KEY } = await import(
  "@/lib/core/session/SessionProvider"
);
const { useCurrentUser } = await import("@/lib/core/session/useCurrentUser");
const { default: SessionProvider } = await import(
  "@/lib/core/session/SessionProvider"
);

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
  user: { id: "kenan", username: "Kenan" },
  active_campaign: {
    id: "campaign-default",
    name: "Campagne par défaut",
    role: "gm",
    character_id: "kenan-pc",
  },
};

beforeEach(() => {
  mockAuthMeSpy.mockReset();
});

describe("useCurrentUser()", () => {
  test("returns 'loading' on first render when cache is empty", () => {
    mockAuthMeSpy.mockReturnValue(new Promise(() => undefined));
    const client = makeClient();
    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: wrap(client),
    });
    expect(result.current.status).toBe("loading");
  });

  test("returns 'authenticated' triplet when cache holds a valid auth-me response", () => {
    mockAuthMeSpy.mockReturnValue(new Promise(() => undefined));
    const client = makeClient();
    client.setQueryData(SESSION_QUERY_KEY, validResponse);

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: wrap(client),
    });

    expect(result.current).toEqual({
      status: "authenticated",
      auth: { authId: "kenan", campaignId: "campaign-default" },
      jdr: { role: "gm", characterId: "kenan-pc", displayName: "Kenan" },
    });
  });

  test("returns 'unauthenticated' when active_campaign is null in cache", () => {
    mockAuthMeSpy.mockReturnValue(new Promise(() => undefined));
    const client = makeClient();
    client.setQueryData(SESSION_QUERY_KEY, {
      user: { id: "kenan", username: "Kenan" },
      active_campaign: null,
    } satisfies AuthMeResponse);

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: wrap(client),
    });

    expect(result.current.status).toBe("unauthenticated");
  });

  test("dedup: queryFn fires exactly once when SessionProvider and useCurrentUser observe the same key", async () => {
    mockAuthMeSpy.mockResolvedValue(validResponse);
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
      expect(mockAuthMeSpy).toHaveBeenCalledTimes(1);
    });
  });
});
