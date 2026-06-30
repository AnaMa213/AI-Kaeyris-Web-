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

const {
  useSummaryArtifact,
  useGenerateSummary,
  summaryArtifactQueryKey,
  useNarrativeArtifact,
  useGenerateNarrative,
  narrativeArtifactQueryKey,
  useElementsArtifact,
  useGenerateElements,
  elementsArtifactQueryKey,
  useGeneratePovs,
  usePovArtifact,
  povArtifactQueryKey,
  povArtifactSessionKey,
  isArtifactAbsentError,
  usePatchSummary,
  usePutElements,
  isArtifactEditedError,
  isArtifactBusyError,
  isElementsEmptyClearUnconfirmedError,
} = await import("@/lib/jdr/sessions/artifacts");
const { jobQueryKey } = await import("@/lib/jdr/jobs/queries");
const { ApiError } = await import("@/lib/core/api/errors");

const SESSION_ID = "00000000-0000-0000-0000-000000000abc";
const PJ_ID = "22222222-2222-2222-2222-222222222222";

const summaryOut = {
  session_id: SESSION_ID,
  text: "Les héros entrent dans la crypte.",
  model_used: "claude-x",
  generated_at: "2026-06-01T10:00:00Z",
};

const narrativeOut = {
  session_id: SESSION_ID,
  text: "Au cœur de la nuit, les héros franchirent le seuil.",
  model_used: "claude-x",
  generated_at: "2026-06-01T10:00:00Z",
};

const elementsOut = {
  session_id: SESSION_ID,
  elements: [
    { category: "PNJ", name: "Grom", description: "Forgeron taciturne." },
    { category: "Lieux", name: "La crypte", description: "Humide et oubliée." },
  ],
  model_used: "claude-x",
  generated_at: "2026-06-01T10:00:00Z",
};

const povOut = {
  session_id: SESSION_ID,
  pj_id: PJ_ID,
  text: "Mira sentit la crypte lui murmurer son nom.",
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

function jobFor(id: string, kind: string) {
  return {
    id,
    kind,
    session_id: SESSION_ID,
    status: "queued",
    queued_at: "2026-06-01T10:00:00Z",
  };
}

function stubFetch(opts: { getStatus?: number; povStatus?: number; povBody?: unknown } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      const method = typeof input === "string" ? "GET" : (input.method ?? "GET");
      const isPost = method.toUpperCase() === "POST";

      if (url.includes("/artifacts/narrative")) {
        if (isPost) {
          return new Response(JSON.stringify(jobFor("job-narrative-1", "narrative")), {
            status: 202,
            headers: { "content-type": "application/json" },
          });
        }
        if (opts.getStatus && opts.getStatus >= 400) {
          return new Response(
            JSON.stringify({ type: "about:blank", title: "absent", status: opts.getStatus }),
            { status: opts.getStatus, headers: { "content-type": "application/problem+json" } },
          );
        }
        return new Response(JSON.stringify(narrativeOut), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/artifacts/elements")) {
        if (isPost) {
          return new Response(JSON.stringify(jobFor("job-elements-1", "elements")), {
            status: 202,
            headers: { "content-type": "application/json" },
          });
        }
        if (opts.getStatus && opts.getStatus >= 400) {
          return new Response(
            JSON.stringify({ type: "about:blank", title: "absent", status: opts.getStatus }),
            { status: opts.getStatus, headers: { "content-type": "application/problem+json" } },
          );
        }
        return new Response(JSON.stringify(elementsOut), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/artifacts/povs")) {
        if (isPost) {
          return new Response(JSON.stringify(jobFor("job-povs-1", "povs")), {
            status: 202,
            headers: { "content-type": "application/json" },
          });
        }
        if (opts.povStatus && opts.povStatus >= 400) {
          return new Response(
            JSON.stringify({
              type: "about:blank",
              title: "pov absent",
              status: opts.povStatus,
            }),
            {
              status: opts.povStatus,
              headers: { "content-type": "application/problem+json" },
            },
          );
        }
        const povBody = Object.hasOwn(opts, "povBody") ? opts.povBody : povOut;
        return new Response(JSON.stringify(povBody), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/artifacts/summary") && isPost) {
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
    const job = await result.current.mutateAsync(undefined);
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

describe("useNarrativeArtifact (Story 4.4)", () => {
  test("GET narrative → unwraps the artifact under the scoped key", async () => {
    const queryClient = makeClient();
    const { result } = renderHook(() => useNarrativeArtifact(SESSION_ID), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.text).toBe(narrativeOut.text);
    expect(narrativeArtifactQueryKey(SESSION_ID)).toEqual([
      "jdr",
      "artifact",
      "narrative",
      SESSION_ID,
    ]);
  });

  test("a not-yet-generated narrative (404) surfaces as error, not data", async () => {
    stubFetch({ getStatus: 404 });
    const queryClient = makeClient();
    const { result } = renderHook(() => useNarrativeArtifact(SESSION_ID), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeInstanceOf(ApiError);
  });
});

describe("useElementsArtifact (Story 4.4)", () => {
  test("GET elements → unwraps the flat category-tagged list under the scoped key", async () => {
    const queryClient = makeClient();
    const { result } = renderHook(() => useElementsArtifact(SESSION_ID), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.elements?.[0]?.name).toBe("Grom");
    expect(result.current.data?.elements?.[0]?.category).toBe("PNJ");
    expect(elementsArtifactQueryKey(SESSION_ID)).toEqual([
      "jdr",
      "artifact",
      "elements",
      SESSION_ID,
    ]);
  });

  test("a not-yet-generated elements card (422) surfaces as error, not data", async () => {
    stubFetch({ getStatus: 422 });
    const queryClient = makeClient();
    const { result } = renderHook(() => useElementsArtifact(SESSION_ID), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

describe("usePovArtifact (Story 5.7)", () => {
  test("GET one PJ POV -> unwraps the artifact under the scoped key", async () => {
    const queryClient = makeClient();
    const { result } = renderHook(() => usePovArtifact(SESSION_ID, PJ_ID), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.text).toBe(povOut.text);
    expect(povArtifactQueryKey(SESSION_ID, PJ_ID)).toEqual([
      "jdr",
      "artifact",
      "pov",
      SESSION_ID,
      PJ_ID,
    ]);
    expect(povArtifactSessionKey(SESSION_ID)).toEqual([
      "jdr",
      "artifact",
      "pov",
      SESSION_ID,
    ]);
  });

  test.each([404, 422])(
    "a missing POV (%s) surfaces as an absent artifact error",
    async (status) => {
      stubFetch({ povStatus: status });
      const queryClient = makeClient();
      const { result } = renderHook(() => usePovArtifact(SESSION_ID, PJ_ID), {
        wrapper: wrapper(queryClient),
      });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeInstanceOf(ApiError);
      expect(isArtifactAbsentError(result.current.error)).toBe(true);
    },
  );

  test("200 null remains absent because presence is Boolean(data?.text)", async () => {
    stubFetch({ povBody: null });
    const queryClient = makeClient();
    const { result } = renderHook(() => usePovArtifact(SESSION_ID, PJ_ID), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Boolean(result.current.data?.text)).toBe(false);
  });

  test("does NOT fire until both sessionId and pjId are present", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(povOut), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = makeClient();
    renderHook(() => usePovArtifact(SESSION_ID, ""), {
      wrapper: wrapper(queryClient),
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("derived-artifact generators seed the job cache (Story 4.4)", () => {
  test.each([
    ["narrative", () => useGenerateNarrative(SESSION_ID), "job-narrative-1"],
    ["elements", () => useGenerateElements(SESSION_ID), "job-elements-1"],
    ["povs", () => useGeneratePovs(SESSION_ID), "job-povs-1"],
  ] as const)(
    "POST /artifacts/%s returns a JobQueuedOut and seeds jobQueryKey",
    async (kind, hook, jobId) => {
      const queryClient = makeClient();
      const { result } = renderHook(hook, { wrapper: wrapper(queryClient) });
      const job = await result.current.mutateAsync(undefined);
      expect(job.id).toBe(jobId);

      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      const call = fetchMock.mock.calls.find((args) => {
        const request = args[0] as Request;
        return (
          request.url.includes(`/artifacts/${kind}`) && request.method === "POST"
        );
      });
      if (!call) throw new Error(`No POST /artifacts/${kind} call found`);
      expect((call[0] as Request).credentials).toBe("include");

      const cached = queryClient.getQueryData(jobQueryKey(jobId));
      expect(cached).toMatchObject({ id: jobId, kind });
    },
  );
});

const editedSummaryOut = {
  ...summaryOut,
  text: "Texte corrigé par le MJ.",
  is_edited: true,
  edited_at: "2026-06-02T09:00:00Z",
  edited_by: "key-1",
};

function problemBody(type: string, status: number) {
  return JSON.stringify({
    type: `https://kaeyris.local/errors/${type}`,
    title: type,
    status,
    detail: "x",
  });
}

describe("artifact edit mutations (Story 8.1/8.2/8.3 — BD-23/BD-26)", () => {
  test("usePatchSummary PATCHes the text and seeds the summary read cache", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(editedSummaryOut), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    const queryClient = makeClient();
    const { result } = renderHook(() => usePatchSummary(SESSION_ID), {
      wrapper: wrapper(queryClient),
    });
    const data = await result.current.mutateAsync("Texte corrigé par le MJ.");
    expect(data.is_edited).toBe(true);
    expect(data.text).toBe("Texte corrigé par le MJ.");

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.method).toBe("PATCH");
    expect(request.url).toContain("/artifacts/summary");
    expect(
      queryClient.getQueryData(summaryArtifactQueryKey(SESSION_ID)),
    ).toEqual(editedSummaryOut);
  });

  test("usePutElements sends confirm_empty=true only when clearing is confirmed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ ...elementsOut, elements: [], is_edited: true }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );
    const queryClient = makeClient();
    const { result } = renderHook(() => usePutElements(SESSION_ID), {
      wrapper: wrapper(queryClient),
    });
    await result.current.mutateAsync({ elements: [], confirmEmpty: true });

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.method).toBe("PUT");
    expect(request.url).toContain("confirm_empty=true");
  });

  test("a 409 artifact-busy on edit is surfaced as a discriminated ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(problemBody("artifact-busy", 409), {
            status: 409,
            headers: { "content-type": "application/problem+json" },
          }),
      ),
    );
    const queryClient = makeClient();
    const { result } = renderHook(() => usePatchSummary(SESSION_ID), {
      wrapper: wrapper(queryClient),
    });
    const err = await result.current.mutateAsync("x").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(isArtifactBusyError(err)).toBe(true);
    expect(isArtifactEditedError(err)).toBe(false);
  });

  test("the conflict discriminators match their RFC 9457 type slug specifically", () => {
    const edited = new ApiError({
      type: "https://kaeyris.local/errors/artifact-edited",
      title: "x",
      status: 409,
    });
    const busy = new ApiError({
      type: "https://kaeyris.local/errors/artifact-busy",
      title: "x",
      status: 409,
    });
    const emptyClear = new ApiError({
      type: "https://kaeyris.local/errors/elements-empty-clear-unconfirmed",
      title: "x",
      status: 422,
    });
    expect(isArtifactEditedError(edited)).toBe(true);
    expect(isArtifactBusyError(busy)).toBe(true);
    expect(isElementsEmptyClearUnconfirmedError(emptyClear)).toBe(true);
    // Each discriminator is specific to its own slug.
    expect(isArtifactEditedError(busy)).toBe(false);
    expect(isElementsEmptyClearUnconfirmedError(edited)).toBe(false);
    expect(isArtifactBusyError("not an error")).toBe(false);
  });
});
