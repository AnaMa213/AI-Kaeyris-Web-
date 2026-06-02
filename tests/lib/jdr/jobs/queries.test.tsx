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

const { useJob, jobQueryKey, JOBS_QUERY_KEY } = await import(
  "@/lib/jdr/jobs/queries"
);

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
