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

const { useCreateSession, useGetSession, sessionQueryKey } = await import(
  "@/lib/jdr/sessions/queries"
);

const sampleSession = {
  id: "00000000-0000-0000-0000-000000000abc",
  title: "Session 7 — La crypte oubliée",
  recorded_at: "2026-05-31T18:00:00.000Z",
  mode: "batch" as const,
  state: "created" as const,
  transcription_mode: "non_diarised" as const,
  campaign_context: null,
  created_at: "2026-05-31T18:05:00.000Z",
  updated_at: "2026-05-31T18:05:00.000Z",
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
        url.endsWith("/services/jdr/sessions") &&
        method.toUpperCase() === "POST"
      ) {
        return new Response(JSON.stringify(sampleSession), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      }
      if (
        url.includes("/services/jdr/sessions/") &&
        method.toUpperCase() === "GET"
      ) {
        return new Response(JSON.stringify(sampleSession), {
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

describe("useCreateSession", () => {
  test("POSTs to /services/jdr/sessions with transcription_mode hardcoded to 'non_diarised'", async () => {
    const queryClient = makeClient();
    const { result } = renderHook(() => useCreateSession(), {
      wrapper: wrapper(queryClient),
    });
    const data = await result.current.mutateAsync({
      title: "Session 7",
      recorded_at: "2026-05-31T20:00",
    });
    expect(data).toEqual(sampleSession);

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const call = fetchMock.mock.calls.find((args) => {
      const request = args[0] as Request;
      return (
        request.url.endsWith("/services/jdr/sessions") &&
        request.method === "POST"
      );
    });
    if (!call) throw new Error("No POST /sessions call found");
    const request = call[0] as Request;
    expect(request.credentials).toBe("include");

    const body = await request.clone().json();
    expect(body.title).toBe("Session 7");
    expect(body.transcription_mode).toBe("non_diarised");
    // recorded_at must be converted to ISO UTC (toIsoUtc helper).
    expect(body.recorded_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
    );
  });
});

describe("useGetSession", () => {
  test("calls GET /services/jdr/sessions/{id} with credentials: include", async () => {
    const queryClient = makeClient();
    const { result } = renderHook(() => useGetSession(sampleSession.id), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleSession);

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const call = fetchMock.mock.calls.find((args) => {
      const request = args[0] as Request;
      return (
        request.url.includes(`/services/jdr/sessions/${sampleSession.id}`) &&
        request.method === "GET"
      );
    });
    if (!call) throw new Error("No GET /sessions/{id} call found");
    expect((call[0] as Request).credentials).toBe("include");
  });

  test("does NOT fire the GET when id is empty (enabled gate)", async () => {
    const queryClient = makeClient();
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockClear();

    const { result } = renderHook(() => useGetSession(""), {
      wrapper: wrapper(queryClient),
    });
    // Give react-query a tick to (not) fire.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(result.current.fetchStatus).toBe("idle");

    const getCalls = fetchMock.mock.calls.filter((args) => {
      const request = args[0] as Request;
      return request.url.includes("/services/jdr/sessions/");
    });
    expect(getCalls.length).toBe(0);
  });

  test("exposes the right queryKey via sessionQueryKey() factory", () => {
    expect(sessionQueryKey("abc")).toEqual(["sessions", "abc"]);
  });
});
