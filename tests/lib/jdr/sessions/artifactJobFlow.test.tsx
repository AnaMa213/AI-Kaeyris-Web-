// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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

const { useArtifactJobFlow, ARTIFACT_JOB_LABELS } = await import(
  "@/lib/jdr/sessions/artifactJobFlow"
);

const SESSION_ID = "00000000-0000-0000-0000-000000000abc";
const keyFactory = (sessionId: string) =>
  ["jdr", "artifact", "narrative", sessionId] as const;

function stubJob(status: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/jobs/")) {
        return new Response(
          JSON.stringify({
            id: "job-x",
            kind: "narrative",
            session_id: SESSION_ID,
            status,
            failure_reason: null,
            queued_at: "2026-06-01T10:00:00Z",
            started_at: "2026-06-01T10:00:01Z",
            ended_at: null,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(null, { status: 200 });
    }),
  );
}

function stubJobNotFound() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/jobs/")) {
        return new Response(
          JSON.stringify({
            type: "about:blank",
            title: "job not found",
            status: 404,
          }),
          { status: 404, headers: { "content-type": "application/problem+json" } },
        );
      }
      return new Response(null, { status: 200 });
    }),
  );
}

const wrap = (queryClient: QueryClient) =>
  function Provider({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

const makeClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

beforeEach(() => stubJob("running"));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useArtifactJobFlow (Story 4.4)", () => {
  test("exposes the shared artifact job labels", () => {
    expect(ARTIFACT_JOB_LABELS.running).toBe("Génération en cours");
    expect(ARTIFACT_JOB_LABELS.succeeded).toBe("Généré");
  });

  test("jobActive is false until a job is queued, true while it runs", async () => {
    const queryClient = makeClient();
    const { result } = renderHook(
      () => useArtifactJobFlow({ sessionId: SESSION_ID, isPresent: false, keyFactory }),
      { wrapper: wrap(queryClient) },
    );
    expect(result.current.jobActive).toBe(false);

    act(() => result.current.onJobQueued("job-x"));
    await waitFor(() => expect(result.current.jobActive).toBe(true));
  });

  test("invalidates the artifact key once the job succeeds", async () => {
    stubJob("succeeded");
    const queryClient = makeClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(
      () => useArtifactJobFlow({ sessionId: SESSION_ID, isPresent: false, keyFactory }),
      { wrapper: wrap(queryClient) },
    );
    act(() => result.current.onJobQueued("job-x"));
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: keyFactory(SESSION_ID) }),
    );
  });

  test("keeps refetching briefly after succeeded, then exposes an unavailable state", async () => {
    vi.useFakeTimers();
    stubJob("succeeded");
    const queryClient = makeClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(
      () => useArtifactJobFlow({ sessionId: SESSION_ID, isPresent: false, keyFactory }),
      { wrapper: wrap(queryClient) },
    );

    act(() => result.current.onJobQueued("job-x"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(spy).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 6; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }

    expect(result.current.artifactUnavailable).toBe(true);
    expect(result.current.jobActive).toBe(false);
  });

  test("a job lookup error is treated as a failed flow, not an active job", async () => {
    stubJobNotFound();
    const queryClient = makeClient();
    const { result } = renderHook(
      () => useArtifactJobFlow({ sessionId: SESSION_ID, isPresent: false, keyFactory }),
      { wrapper: wrap(queryClient) },
    );
    act(() => result.current.onJobQueued("job-missing"));
    await waitFor(() => expect(result.current.jobLookupFailed).toBe(true));
    expect(result.current.jobFailed).toBe(true);
    expect(result.current.jobActive).toBe(false);
  });

  test("isPresent collapses jobActive even with a job in flight (no button flash)", async () => {
    const queryClient = makeClient();
    const { result } = renderHook(
      () => useArtifactJobFlow({ sessionId: SESSION_ID, isPresent: true, keyFactory }),
      { wrapper: wrap(queryClient) },
    );
    act(() => result.current.onJobQueued("job-x"));
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.jobActive).toBe(false);
  });

  // Story 4.5 — regeneration: content is already present the whole time.
  test("regeneration invalidates the artifact key on succeeded even when content is already present", async () => {
    stubJob("succeeded");
    const queryClient = makeClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(
      () => useArtifactJobFlow({ sessionId: SESSION_ID, isPresent: true, keyFactory }),
      { wrapper: wrap(queryClient) },
    );
    act(() => result.current.onJobQueued("job-x"));
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: keyFactory(SESSION_ID) }),
    );
  });

  test("regeneration keeps invalidating until the artifact version changes", async () => {
    vi.useFakeTimers();
    stubJob("succeeded");
    const queryClient = makeClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    let artifactVersion = "old-version";
    const { result, rerender } = renderHook(
      () =>
        useArtifactJobFlow({
          sessionId: SESSION_ID,
          isPresent: true,
          keyFactory,
          artifactVersion,
        }),
      { wrapper: wrap(queryClient) },
    );

    act(() => result.current.onJobQueued("job-x"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.current.artifactSettling).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(spy).toHaveBeenCalledTimes(2);

    artifactVersion = "new-version";
    rerender();
    expect(result.current.artifactSettling).toBe(false);
    const callsAfterReplacement = spy.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(spy).toHaveBeenCalledTimes(callsAfterReplacement);
  });

  test("jobInFlight is true while running, false once the job succeeds", async () => {
    stubJob("running");
    const queryClient = makeClient();
    const { result } = renderHook(
      () => useArtifactJobFlow({ sessionId: SESSION_ID, isPresent: true, keyFactory }),
      { wrapper: wrap(queryClient) },
    );
    expect(result.current.jobInFlight).toBe(false);
    act(() => result.current.onJobQueued("job-x"));
    await waitFor(() => expect(result.current.jobInFlight).toBe(true));
  });

  test("jobInFlight is false once the job succeeds", async () => {
    stubJob("succeeded");
    const queryClient = makeClient();
    const { result } = renderHook(
      () => useArtifactJobFlow({ sessionId: SESSION_ID, isPresent: true, keyFactory }),
      { wrapper: wrap(queryClient) },
    );
    act(() => result.current.onJobQueued("job-x"));
    await waitFor(() => expect(result.current.jobSucceeded).toBe(true));
    expect(result.current.jobInFlight).toBe(false);
  });
});
