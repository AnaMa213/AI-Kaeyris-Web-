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
  useCreateSession,
  useGetSession,
  useListSessions,
  useUpdateSession,
  useDeleteSession,
  useSessionAudioMutation,
  sessionQueryKey,
  sessionsListQueryKey,
} = await import("@/lib/jdr/sessions/queries");
const { jobQueryKey } = await import("@/lib/jdr/jobs/queries");
const { campaignQueryKey } = await import("@/lib/jdr/campaigns/queries");
const { ApiError } = await import("@/lib/core/api/errors");

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

const campaignId = "11111111-1111-1111-1111-111111111111";

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
  test("POSTs to /services/jdr/sessions with the chosen transcription_mode (default non_diarised)", async () => {
    const queryClient = makeClient();
    const { result } = renderHook(() => useCreateSession(), {
      wrapper: wrapper(queryClient),
    });
    const data = await result.current.mutateAsync({
      title: "Session 7",
      recorded_at: "2026-05-31T20:00",
      campaign_id: "11111111-1111-1111-1111-111111111111",
      transcription_mode: "non_diarised",
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
    expect(body.campaign_id).toBe("11111111-1111-1111-1111-111111111111");
    // recorded_at must be converted to ISO UTC (toIsoUtc helper).
    expect(body.recorded_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
    );
  });

  test("forwards an explicit diarised transcription_mode on the wire", async () => {
    const queryClient = makeClient();
    const { result } = renderHook(() => useCreateSession(), {
      wrapper: wrapper(queryClient),
    });
    await result.current.mutateAsync({
      title: "Session 8",
      recorded_at: "2026-05-31T20:00",
      campaign_id: "11111111-1111-1111-1111-111111111111",
      transcription_mode: "diarised",
    });

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const call = fetchMock.mock.calls.find((args) => {
      const request = args[0] as Request;
      return (
        request.url.endsWith("/services/jdr/sessions") &&
        request.method === "POST"
      );
    });
    if (!call) throw new Error("No POST /sessions call found");
    const body = await (call[0] as Request).clone().json();
    expect(body.transcription_mode).toBe("diarised");
  });
});

describe("useReplaceSessionAudio (Story 3.5)", () => {
  const replaceResponse = {
    session_id: sampleSession.id,
    path: "data/audio/replaced.m4a",
    sha256: "b".repeat(64),
    size_bytes: 2048,
    duration_seconds: 720,
    uploaded_at: "2026-06-04T10:00:00.000Z",
    job_id: "job-replace-1",
  };

  function stubReplaceFetch(
    deleteResponse: () => Response,
    calls: string[],
  ) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.url;
        const method = (
          typeof input === "string" ? init?.method : input.method
        ) ?? "GET";
        if (url.endsWith(`/sessions/${sampleSession.id}/audio`)) {
          calls.push(method.toUpperCase());
          if (method.toUpperCase() === "DELETE") return deleteResponse();
          if (method.toUpperCase() === "POST") {
            return new Response(JSON.stringify(replaceResponse), {
              status: 202,
              headers: { "content-type": "application/json" },
            });
          }
        }
        return new Response(null, { status: 200 });
      }),
    );
  }

  test("DELETEs then POSTs (in order), seeds the job cache and patches the session optimistically", async () => {
    const calls: string[] = [];
    stubReplaceFetch(() => new Response(null, { status: 204 }), calls);

    const queryClient = makeClient();
    queryClient.setQueryData(sessionQueryKey(sampleSession.id), {
      ...sampleSession,
      state: "transcription_failed",
    });

    const { result } = renderHook(
      () => useSessionAudioMutation(sampleSession.id, { replace: true }),
      { wrapper: wrapper(queryClient) },
    );
    await result.current.mutateAsync(
      new File(["x"], "new.m4a", { type: "audio/mp4" }),
    );

    expect(calls).toEqual(["DELETE", "POST"]);
    expect(queryClient.getQueryData(jobQueryKey("job-replace-1"))).toMatchObject(
      { id: "job-replace-1", status: "queued", kind: "transcription" },
    );
    expect(
      queryClient.getQueryData(sessionQueryKey(sampleSession.id)),
    ).toMatchObject({
      state: "audio_uploaded",
      current_job_id: "job-replace-1",
    });
  });

  test("a 409 from DELETE rejects and never attempts the POST", async () => {
    const calls: string[] = [];
    stubReplaceFetch(
      () =>
        new Response(
          JSON.stringify({ type: "about:blank", title: "Conflict", status: 409 }),
          { status: 409, headers: { "content-type": "application/problem+json" } },
        ),
      calls,
    );

    const queryClient = makeClient();
    const { result } = renderHook(
      () => useSessionAudioMutation(sampleSession.id, { replace: true }),
      { wrapper: wrapper(queryClient) },
    );

    await expect(
      result.current.mutateAsync(new File(["x"], "new.m4a", { type: "audio/mp4" })),
    ).rejects.toBeInstanceOf(ApiError);
    expect(calls).toEqual(["DELETE"]);
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

describe("useListSessions", () => {
  test("fetches the campaign-scoped session list with ?campaign_id query param", async () => {
    const capturedUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string) => {
        const url = typeof input === "string" ? input : input.url;
        if (url.includes("/services/jdr/sessions")) {
          capturedUrls.push(url);
          return new Response(
            JSON.stringify({
              items: [sampleSession],
              total: 1,
              page: 1,
              size: 50,
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }
        return new Response(null, { status: 200 });
      }),
    );

    const queryClient = makeClient();
    const { result } = renderHook(
      () => useListSessions({ campaignId: "camp-uuid" }),
      { wrapper: wrapper(queryClient) },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
    expect(capturedUrls.some((u) => u.includes("campaign_id=camp-uuid"))).toBe(
      true,
    );
  });

  test("exposes a queryKey scoped by campaignId", () => {
    expect(sessionsListQueryKey("camp-uuid")).toEqual([
      "sessions",
      "list",
      { campaignId: "camp-uuid" },
    ]);
  });
});

describe("useUpdateSession", () => {
  test("PATCHes /sessions/{id} with the right body when title + campaign_context are set", async () => {
    let patchBody: Record<string, unknown> | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.url;
        const method =
          typeof input === "string" ? init?.method : (input.method ?? "GET");
        if (
          url.includes("/services/jdr/sessions/") &&
          method?.toUpperCase() === "PATCH"
        ) {
          if (typeof input !== "string") {
            patchBody = await input.clone().json();
          }
          return new Response(
            JSON.stringify({
              ...sampleSession,
              title: "Session 12 (updated)",
              campaign_context: "Une bibliothèque oubliée.",
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }
        return new Response(null, { status: 200 });
      }),
    );

    const queryClient = makeClient();
    const { result } = renderHook(
      () => useUpdateSession(sampleSession.id, "camp-uuid"),
      { wrapper: wrapper(queryClient) },
    );

    result.current.mutate({
      title: "Session 12 (updated)",
      campaign_context: "Une bibliothèque oubliée.",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(patchBody).toEqual({
      title: "Session 12 (updated)",
      campaign_context: "Une bibliothèque oubliée.",
    });
  });

  test("PATCH body has campaign_context: null when the input string is empty (clear semantic)", async () => {
    let patchBody: Record<string, unknown> | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.url;
        const method =
          typeof input === "string" ? init?.method : (input.method ?? "GET");
        if (
          url.includes("/services/jdr/sessions/") &&
          method?.toUpperCase() === "PATCH"
        ) {
          if (typeof input !== "string") {
            patchBody = await input.clone().json();
          }
          return new Response(
            JSON.stringify({ ...sampleSession, campaign_context: null }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }
        return new Response(null, { status: 200 });
      }),
    );

    const queryClient = makeClient();
    const { result } = renderHook(
      () => useUpdateSession(sampleSession.id),
      { wrapper: wrapper(queryClient) },
    );

    result.current.mutate({ title: "OK", campaign_context: "   " });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(patchBody).toEqual({ title: "OK", campaign_context: null });
  });

  test("invalidates both sessionQueryKey and sessionsListQueryKey on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.url;
        const method =
          typeof input === "string" ? init?.method : (input.method ?? "GET");
        if (
          url.includes("/services/jdr/sessions/") &&
          method?.toUpperCase() === "PATCH"
        ) {
          return new Response(JSON.stringify(sampleSession), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(null, { status: 200 });
      }),
    );

    const queryClient = makeClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(
      () => useUpdateSession(sampleSession.id, "camp-uuid"),
      { wrapper: wrapper(queryClient) },
    );

    result.current.mutate({ title: "Updated" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calls = invalidateSpy.mock.calls.map((args) => args[0]);
    expect(calls).toContainEqual({
      queryKey: sessionQueryKey(sampleSession.id),
    });
    expect(calls).toContainEqual({
      queryKey: sessionsListQueryKey("camp-uuid"),
    });
  });
});

describe("useUploadSessionAudio", () => {
  const sessionId = "ses-upload-1";
  const audioResponse = {
    session_id: sessionId,
    path: "data/audio/ses-upload-1.m4a",
    sha256: "a".repeat(64),
    size_bytes: 12345,
    duration_seconds: null,
    uploaded_at: "2026-05-31T19:00:00+00:00",
    job_id: "job-uuid-7",
  };

  test("POSTs FormData and on success seeds the job cache + invalidates the session", async () => {
    let capturedRequest: Request | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.url;
        if (url.endsWith(`/services/jdr/sessions/${sessionId}/audio`)) {
          if (typeof input !== "string") capturedRequest = input;
          else {
            capturedRequest = new Request(url, init);
          }
          return new Response(JSON.stringify(audioResponse), {
            status: 202,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(null, { status: 200 });
      }),
    );

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const setSpy = vi.spyOn(client, "setQueryData");

    const { result } = renderHook(() => useSessionAudioMutation(sessionId), {
      wrapper: wrapper(client),
    });
    const file = new File(["x"], "demo.m4a", { type: "audio/mp4" });
    await result.current.mutateAsync(file);

    expect((capturedRequest as Request | null)?.method).toBe("POST");
    expect((capturedRequest as Request | null)?.credentials).toBe("include");

    expect(setSpy).toHaveBeenCalledWith(
      jobQueryKey(audioResponse.job_id),
      expect.objectContaining({
        id: audioResponse.job_id,
        kind: "transcription",
        session_id: sessionId,
        status: "queued",
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: sessionQueryKey(sessionId),
    });
  });

  test("optimistically marks the cached session as audio_uploaded after upload success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string) => {
        const url = typeof input === "string" ? input : input.url;
        if (url.endsWith(`/services/jdr/sessions/${sessionId}/audio`)) {
          return new Response(JSON.stringify(audioResponse), {
            status: 202,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(null, { status: 200 });
      }),
    );

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    client.setQueryData(sessionQueryKey(sessionId), {
      ...sampleSession,
      id: sessionId,
      state: "created",
    });

    const { result } = renderHook(() => useSessionAudioMutation(sessionId), {
      wrapper: wrapper(client),
    });
    const file = new File(["x"], "demo.m4a", { type: "audio/mp4" });
    await result.current.mutateAsync(file);

    expect(client.getQueryData(sessionQueryKey(sessionId))).toMatchObject({
      id: sessionId,
      state: "audio_uploaded",
      // Story 3.4 : le pointeur backend (BD-8) est peuplé tout de suite côté
      // cache pour que le polling se réarme sans attendre le refetch.
      current_job_id: audioResponse.job_id,
      updated_at: audioResponse.uploaded_at,
    });
  });

  test("invalidates the parent campaign after session deletion", async () => {
    const client = makeClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(
      () => useDeleteSession(sampleSession.id, campaignId),
      { wrapper: wrapper(client) },
    );

    await result.current.mutateAsync();

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: sessionsListQueryKey(campaignId),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: campaignQueryKey(campaignId),
    });
  });

  test("propagates a 413 payload-too-large as ApiError with status preserved", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: "about:blank",
            title: "Payload too large",
            status: 413,
          }),
          {
            status: 413,
            headers: { "content-type": "application/problem+json" },
          },
        ),
      ),
    );

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const { result } = renderHook(() => useSessionAudioMutation(sessionId), {
      wrapper: wrapper(client),
    });
    const file = new File(["x"], "demo.m4a", { type: "audio/mp4" });
    await expect(result.current.mutateAsync(file)).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  test("propagates a 422 validation error as ApiError with status preserved", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: "about:blank",
            title: "Validation Error",
            status: 422,
          }),
          {
            status: 422,
            headers: { "content-type": "application/problem+json" },
          },
        ),
      ),
    );

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const { result } = renderHook(() => useSessionAudioMutation(sessionId), {
      wrapper: wrapper(client),
    });
    const file = new File(["x"], "demo.m4a", { type: "audio/mp4" });
    await expect(result.current.mutateAsync(file)).rejects.toMatchObject({
      problem: { status: 422 },
    });
  });

  test("propagates a 403 forbidden as ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: "about:blank",
            title: "Forbidden",
            status: 403,
          }),
          {
            status: 403,
            headers: { "content-type": "application/problem+json" },
          },
        ),
      ),
    );

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const { result } = renderHook(() => useSessionAudioMutation(sessionId), {
      wrapper: wrapper(client),
    });
    const file = new File(["x"], "demo.m4a", { type: "audio/mp4" });
    await expect(result.current.mutateAsync(file)).rejects.toMatchObject({
      problem: { status: 403 },
    });
  });
});
