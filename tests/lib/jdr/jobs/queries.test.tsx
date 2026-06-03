// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
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
