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

const { useSummaryArtifact, useGenerateSummary, summaryArtifactQueryKey } =
  await import("@/lib/jdr/sessions/artifacts");
const { jobQueryKey } = await import("@/lib/jdr/jobs/queries");
const { ApiError } = await import("@/lib/core/api/errors");

const SESSION_ID = "00000000-0000-0000-0000-000000000abc";

const summaryOut = {
  session_id: SESSION_ID,
  text: "Les héros entrent dans la crypte.",
  model_used: "claude-x",
  generated_at: "2026-06-01T10:00:00Z",
};

const jobQueued = {
  id: "job-summary-1",
  kind: "summary",
  session_id: SESSION_ID,
  status: "queued",
  queued_at: "2026-06-01T10:00:00Z",
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

function stubFetch(opts: { getStatus?: number } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      const method = typeof input === "string" ? "GET" : (input.method ?? "GET");
      if (url.includes("/artifacts/summary") && method.toUpperCase() === "POST") {
        return new Response(JSON.stringify(jobQueued), {
          status: 202,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/artifacts/summary")) {
        if (opts.getStatus && opts.getStatus >= 400) {
          return new Response(
            JSON.stringify({ type: "about:blank", title: "absent", status: opts.getStatus }),
            { status: opts.getStatus, headers: { "content-type": "application/problem+json" } },
          );
        }
        return new Response(JSON.stringify(summaryOut), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(null, { status: 200 });
    }),
  );
}

beforeEach(() => stubFetch());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useSummaryArtifact", () => {
  test("GET summary → unwraps the artifact under the scoped key", async () => {
    const queryClient = makeClient();
    const { result } = renderHook(() => useSummaryArtifact(SESSION_ID), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.text).toBe(summaryOut.text);
    expect(summaryArtifactQueryKey(SESSION_ID)).toEqual([
      "jdr",
      "artifact",
      "summary",
      SESSION_ID,
    ]);
  });

  test("a not-yet-generated summary (404) surfaces as error, not data", async () => {
    stubFetch({ getStatus: 404 });
    const queryClient = makeClient();
    const { result } = renderHook(() => useSummaryArtifact(SESSION_ID), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeInstanceOf(ApiError);
  });

  test("does NOT fire when sessionId is empty (enabled gate)", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(summaryOut), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = makeClient();
    renderHook(() => useSummaryArtifact(""), { wrapper: wrapper(queryClient) });
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useGenerateSummary", () => {
  test("POSTs and seeds the job cache from the returned JobQueuedOut", async () => {
    const queryClient = makeClient();
    const { result } = renderHook(() => useGenerateSummary(SESSION_ID), {
      wrapper: wrapper(queryClient),
    });
    const job = await result.current.mutateAsync();
    expect(job.id).toBe("job-summary-1");

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const call = fetchMock.mock.calls.find((args) => {
      const request = args[0] as Request;
      return request.url.includes("/artifacts/summary") && request.method === "POST";
    });
    if (!call) throw new Error("No POST /artifacts/summary call found");
    expect((call[0] as Request).credentials).toBe("include");

    // The job is seeded so <JobStateBadge>/useJob can read it without a refetch.
    const cached = queryClient.getQueryData(jobQueryKey("job-summary-1"));
    expect(cached).toMatchObject({ id: "job-summary-1", kind: "summary" });
  });
});
