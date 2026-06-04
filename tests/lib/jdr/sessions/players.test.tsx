// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/core/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

const { useSessionPlayers, useSetSessionPlayers, sessionPlayersQueryKey } =
  await import("@/lib/jdr/sessions/players");
const { ApiError } = await import("@/lib/core/api/errors");

const SESSION_ID = "00000000-0000-0000-0000-000000000abc";

const playersOut = {
  session_id: SESSION_ID,
  pj_ids: ["pj-1", "pj-2"],
  updated_at: "2026-06-01T10:00:00Z",
};

const wrapper = (queryClient: QueryClient) => {
  function TestProvider({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return TestProvider;
};

const makeClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      const method = typeof input === "string" ? "GET" : (input.method ?? "GET");
      if (
        url.includes(`/services/jdr/sessions/${SESSION_ID}/players`) &&
        method.toUpperCase() === "POST"
      ) {
        const body = JSON.parse((await (input as Request).clone().text()) || "{}");
        return new Response(
          JSON.stringify({ ...playersOut, pj_ids: body.pj_ids }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes(`/services/jdr/sessions/${SESSION_ID}/players`)) {
        return new Response(JSON.stringify(playersOut), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(null, { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useSessionPlayers", () => {
  test("GET /players → unwraps pj_ids under the scoped key", async () => {
    const queryClient = makeClient();
    const { result } = renderHook(() => useSessionPlayers(SESSION_ID), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pj_ids).toEqual(["pj-1", "pj-2"]);
    expect(sessionPlayersQueryKey(SESSION_ID)).toEqual([
      "jdr",
      "session-players",
      SESSION_ID,
    ]);

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const call = fetchMock.mock.calls.find((args) => {
      const request = args[0] as Request;
      return request.url.includes(`/sessions/${SESSION_ID}/players`);
    });
    if (!call) throw new Error("No GET /players call found");
    expect((call[0] as Request).credentials).toBe("include");
  });

  test("does NOT fire when sessionId is empty (enabled gate)", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(playersOut), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = makeClient();
    renderHook(() => useSessionPlayers(""), { wrapper: wrapper(queryClient) });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("surfaces error on 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ type: "about:blank", title: "Boom", status: 500 }),
          { status: 500, headers: { "content-type": "application/problem+json" } },
        ),
      ),
    );
    const queryClient = makeClient();
    const { result } = renderHook(() => useSessionPlayers(SESSION_ID), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
  });
});

describe("useSetSessionPlayers", () => {
  test("POSTs the full pj_ids set and writes the response into the cache", async () => {
    const queryClient = makeClient();
    const { result } = renderHook(() => useSetSessionPlayers(SESSION_ID), {
      wrapper: wrapper(queryClient),
    });
    await result.current.mutateAsync(["pj-3", "pj-4"]);

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const call = fetchMock.mock.calls.find((args) => {
      const request = args[0] as Request;
      return (
        request.url.includes(`/sessions/${SESSION_ID}/players`) &&
        request.method === "POST"
      );
    });
    if (!call) throw new Error("No POST /players call found");
    expect((call[0] as Request).credentials).toBe("include");
    await expect((call[0] as Request).clone().json()).resolves.toEqual({
      pj_ids: ["pj-3", "pj-4"],
    });

    const cached = queryClient.getQueryData(sessionPlayersQueryKey(SESSION_ID)) as
      | { pj_ids: string[] }
      | undefined;
    expect(cached?.pj_ids).toEqual(["pj-3", "pj-4"]);
  });

  test("propagates an ApiError when the POST fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ type: "about:blank", title: "Boom", status: 500 }),
          { status: 500, headers: { "content-type": "application/problem+json" } },
        ),
      ),
    );
    const queryClient = makeClient();
    const { result } = renderHook(() => useSetSessionPlayers(SESSION_ID), {
      wrapper: wrapper(queryClient),
    });
    await expect(result.current.mutateAsync(["pj-1"])).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
