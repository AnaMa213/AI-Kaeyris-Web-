// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";

const useQueryForTest = () => useQuery({ queryKey: ["pjs"] });

vi.mock("@/lib/core/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

const { useListPjs, useCreatePj } = await import("@/lib/jdr/pjs/queries");
const { ApiError } = await import("@/lib/core/api/errors");

const samplePj = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Eldrin",
  created_at: "2026-05-30T10:00:00Z",
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
      const method =
        typeof input === "string" ? "GET" : (input.method ?? "GET");
      if (
        url.endsWith("/services/jdr/pjs") &&
        method.toUpperCase() === "GET"
      ) {
        return new Response(
          JSON.stringify({ items: [samplePj], total: 1 }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }
      if (
        url.endsWith("/services/jdr/pjs") &&
        method.toUpperCase() === "POST"
      ) {
        return new Response(JSON.stringify(samplePj), {
          status: 201,
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

describe("useListPjs", () => {
  test("calls GET /services/jdr/pjs with credentials: include", async () => {
    const queryClient = makeClient();
    const { result } = renderHook(() => useListPjs(), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toEqual([samplePj]);
    expect(result.current.data?.total).toBe(1);

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const call = fetchMock.mock.calls.find((args) => {
      const request = args[0] as Request;
      return (
        request.url.endsWith("/services/jdr/pjs") && request.method === "GET"
      );
    });
    if (!call) throw new Error("No GET /pjs call found");
    expect((call[0] as Request).credentials).toBe("include");
  });

  test("surfaces error on 409 duplicate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: "https://kaeyris.local/errors/duplicate-pj",
            title: "Duplicate PJ",
            status: 409,
          }),
          {
            status: 409,
            headers: { "content-type": "application/problem+json" },
          },
        ),
      ),
    );
    const queryClient = makeClient();
    const { result } = renderHook(() => useListPjs(), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
  });
});

describe("useCreatePj", () => {
  test("POSTs to /services/jdr/pjs with the name body and returns the created PJ", async () => {
    const queryClient = makeClient();
    const { result } = renderHook(() => useCreatePj(), {
      wrapper: wrapper(queryClient),
    });
    const data = await result.current.mutateAsync({ name: "Eldrin" });
    expect(data).toEqual(samplePj);

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const call = fetchMock.mock.calls.find((args) => {
      const request = args[0] as Request;
      return (
        request.url.endsWith("/services/jdr/pjs") && request.method === "POST"
      );
    });
    if (!call) throw new Error("No POST /pjs call found");
    const request = call[0] as Request;
    expect(request.credentials).toBe("include");
    await expect(request.clone().json()).resolves.toEqual({ name: "Eldrin" });
  });

  test("invalidates the ['pjs'] query on success so a mounted observer refetches", async () => {
    const queryClient = makeClient();
    let refetchCount = 0;
    queryClient.setQueryDefaults(["pjs"], {
      queryFn: () => {
        refetchCount += 1;
        return Promise.resolve({ items: [], total: 0 });
      },
    });
    // Mount an observer so invalidation triggers a refetch.
    const observerHook = renderHook(() => useQueryForTest(), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() =>
      expect(observerHook.result.current.isSuccess).toBe(true),
    );
    expect(refetchCount).toBe(1);

    const mutationHook = renderHook(() => useCreatePj(), {
      wrapper: wrapper(queryClient),
    });
    await mutationHook.result.current.mutateAsync({ name: "Galadriel" });

    await waitFor(() => expect(refetchCount).toBe(2));
  });

  test("propagates 409 duplicate as ApiError on POST", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: "https://kaeyris.local/errors/duplicate-pj",
            title: "Duplicate PJ",
            status: 409,
          }),
          {
            status: 409,
            headers: { "content-type": "application/problem+json" },
          },
        ),
      ),
    );
    const queryClient = makeClient();
    const { result } = renderHook(() => useCreatePj(), {
      wrapper: wrapper(queryClient),
    });
    await expect(
      result.current.mutateAsync({ name: "Eldrin" }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
