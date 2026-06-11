// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/core/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

const { useJob, jobQueryKey, JOBS_QUERY_KEY, jobRefetchInterval, isJobNotFound } =
  await import("@/lib/jdr/jobs/queries");

const { ApiError } = await import("@/lib/core/api/errors");

const notFoundError = new ApiError({
  type: "https://kaeyris.local/errors/job-not-found",
  title: "Job not found",
  status: 404,
});

const ageFrom = (ms: number) => new Date(Date.now() - ms).toISOString();

const sampleJob = {
  id: "job-uuid-1",
  kind: "transcription" as const,
  session_id: "ses-uuid-1",
  status: "queued" as const,
  failure_reason: null,
  queued_at: "2026-05-30T20:00:00+00:00",
  started_at: null,
  ended_at: null,
};

const makeClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

function wrapper(client: QueryClient) {
  function Provider({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return Provider;
}

describe("query key factories", () => {
  test("JOBS_QUERY_KEY is the index, jobQueryKey is per-job under ['jdr', 'job', id]", () => {
    expect(JOBS_QUERY_KEY).toEqual(["jdr", "jobs"]);
    expect(jobQueryKey("abc")).toEqual(["jdr", "job", "abc"]);
  });
});

describe("useJob", () => {
  test("returns the cached JobOut without firing a network request (enabled=false)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const client = makeClient();
    client.setQueryData(jobQueryKey(sampleJob.id), sampleJob);

    const { result } = renderHook(() => useJob(sampleJob.id), {
      wrapper: wrapper(client),
    });

    // Give time for any effect to (not) fire.
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual(sampleJob);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  test("with jobId=null the hook stays disabled and never fetches", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const client = makeClient();
    renderHook(() => useJob(null), { wrapper: wrapper(client) });
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("jobRefetchInterval — back-off", () => {
  test("undefined job (no data yet) → fast poll (1000ms)", () => {
    expect(jobRefetchInterval(undefined)).toBe(1000);
  });

  test("terminal job (succeeded/failed) → stops polling (false)", () => {
    expect(
      jobRefetchInterval({ ...sampleJob, status: "succeeded" }),
    ).toBe(false);
    expect(jobRefetchInterval({ ...sampleJob, status: "failed" })).toBe(false);
  });

  test("young running job (<10s) → 1000ms", () => {
    expect(
      jobRefetchInterval({
        ...sampleJob,
        status: "running",
        queued_at: ageFrom(3_000),
      }),
    ).toBe(1000);
  });

  test("mid-age job (<30s) → 3000ms; old job (>30s) → 5000ms", () => {
    expect(
      jobRefetchInterval({
        ...sampleJob,
        status: "running",
        queued_at: ageFrom(20_000),
      }),
    ).toBe(3000);
    expect(
      jobRefetchInterval({
        ...sampleJob,
        status: "running",
        queued_at: ageFrom(60_000),
      }),
    ).toBe(5000);
  });
});

describe("isJobNotFound — garde anti-boucle 404", () => {
  test("ApiError 404 → true (stoppe le polling)", () => {
    expect(isJobNotFound(notFoundError)).toBe(true);
  });

  test("autre ApiError (ex. 500) → false (le polling continue)", () => {
    const serverError = new ApiError({
      type: "about:blank",
      title: "Server error",
      status: 500,
    });
    expect(isJobNotFound(serverError)).toBe(false);
  });

  test("erreur non-ApiError ou absente → false", () => {
    expect(isJobNotFound(new Error("network"))).toBe(false);
    expect(isJobNotFound(undefined)).toBe(false);
    expect(isJobNotFound(null)).toBe(false);
  });
});

// Story 4.19 — useJob consumes the BD-14 SSE stream (when EventSource exists)
// and falls back to polling otherwise. jsdom has no EventSource, so the rest of
// this suite already exercises the polling path; here we install a mock.
class MockEventSource {
  static instances: MockEventSource[] = [];
  static reset() {
    MockEventSource.instances = [];
  }
  withCredentials: boolean;
  onopen: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  closed = false;
  private listeners: Record<string, Array<(e: MessageEvent) => void>> = {};
  constructor(_url: string, init?: { withCredentials?: boolean }) {
    this.withCredentials = init?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }
  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    (this.listeners[type] ??= []).push(cb);
  }
  removeEventListener(type: string, cb: (e: MessageEvent) => void) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== cb);
  }
  close() {
    this.closed = true;
  }
  open() {
    this.onopen?.(new Event("open"));
  }
  emitProgress(data: unknown) {
    const evt = { data: JSON.stringify(data) } as MessageEvent;
    (this.listeners["progress"] ?? []).forEach((cb) => cb(evt));
  }
}

const runningJob = {
  ...sampleJob,
  status: "running" as const,
  queued_at: new Date().toISOString(),
  started_at: new Date().toISOString(),
};

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("useJob — SSE consumption + polling fallback (Story 4.19)", () => {
  afterEach(() => {
    MockEventSource.reset();
    vi.unstubAllGlobals();
  });

  test("a terminal SSE event drives useJob to the terminal status (shared cache)", async () => {
    vi.stubGlobal("EventSource", MockEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(runningJob)),
    );
    const client = makeClient();
    const { result } = renderHook(() => useJob("job-sse", { live: true }), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.data?.status).toBe("running"));

    act(() => {
      MockEventSource.instances[0].open();
      MockEventSource.instances[0].emitProgress({ status: "succeeded" });
    });
    await waitFor(() => expect(result.current.data?.status).toBe("succeeded"));
  });

  test("while SSE is connected, polling is suspended (no extra GET)", async () => {
    vi.stubGlobal("EventSource", MockEventSource);
    const fetchMock = vi.fn(async () => jsonResponse(runningJob));
    vi.stubGlobal("fetch", fetchMock);
    const client = makeClient();
    const { result } = renderHook(() => useJob("job-sse", { live: true }), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.data?.status).toBe("running"));

    act(() => MockEventSource.instances[0].open());
    const callsAfterConnect = fetchMock.mock.calls.length;
    // Well past the 1s back-off: a live poll would have fired ≥1 more GET.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(fetchMock.mock.calls.length).toBe(callsAfterConnect);
  });

  test("with EventSource unavailable, a live job still polls (fallback GET fires)", async () => {
    vi.stubGlobal("EventSource", undefined);
    const fetchMock = vi.fn(async () => jsonResponse(runningJob));
    vi.stubGlobal("fetch", fetchMock);
    const client = makeClient();
    renderHook(() => useJob("job-poll", { live: true }), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(MockEventSource.instances).toHaveLength(0);
  });
});
