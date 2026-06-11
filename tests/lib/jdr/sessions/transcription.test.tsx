// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from "vitest";
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
  useSessionChunks,
  useSessionTranscription,
  useSessionTranscriptionMarkdown,
  useDownloadTranscriptionMarkdown,
  useUpdateTranscriptionMarkdown,
  transcriptionMarkdownQueryKey,
} = await import("@/lib/jdr/sessions/transcription");
const { isArtifactAbsentError } = await import("@/lib/jdr/sessions/artifacts");
const { ApiError } = await import("@/lib/core/api/errors");

const SESSION_ID = "00000000-0000-0000-0000-000000000abc";

function wrapper(queryClient: QueryClient) {
  return function TestProvider({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const makeClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

type FetchHandler = (input: Request | string) => Promise<Response>;

function stubFetch(handler: FetchHandler) {
  const fetchMock = vi.fn(handler);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type":
        status >= 400 ? "application/problem+json" : "application/json",
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useSessionChunks (non_diarised)", () => {
  test("returns the chunk list on 200", async () => {
    stubFetch(async () =>
      json({
        session_id: SESSION_ID,
        items: [
          { chunk_id: "c1", ordre: 1, text: "Premier morceau." },
          { chunk_id: "c2", ordre: 2, text: "Second morceau." },
        ],
      }),
    );
    const { result } = renderHook(
      () => useSessionChunks(SESSION_ID, { enabled: true }),
      { wrapper: wrapper(makeClient()) },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(2);
  });

  test("404 transcription-not-ready surfaces as an absent error (status preserved)", async () => {
    stubFetch(async () =>
      json(
        { type: "about:blank", title: "transcription-not-ready", status: 404 },
        404,
      ),
    );
    const { result } = renderHook(
      () => useSessionChunks(SESSION_ID, { enabled: true }),
      { wrapper: wrapper(makeClient()) },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isArtifactAbsentError(result.current.error)).toBe(true);
  });

  test("enabled:false issues no request", async () => {
    const fetchMock = stubFetch(async () => json({}));
    const { result } = renderHook(
      () => useSessionChunks(SESSION_ID, { enabled: false }),
      { wrapper: wrapper(makeClient()) },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useSessionTranscription (diarised)", () => {
  test("returns the diarised transcription on 200", async () => {
    stubFetch(async () =>
      json({
        session_id: SESSION_ID,
        language: "fr",
        model_used: "whisper-x",
        provider: "mock",
        completed_at: "2026-06-01T10:00:00Z",
        segments: [
          {
            speaker_label: "speaker_1",
            text: "Bonjour à tous.",
            start_seconds: 0,
            end_seconds: 1.5,
          },
        ],
      }),
    );
    const { result } = renderHook(
      () => useSessionTranscription(SESSION_ID, { enabled: true }),
      { wrapper: wrapper(makeClient()) },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.segments[0]?.speaker_label).toBe("speaker_1");
  });

  test("enabled:false issues no request", async () => {
    const fetchMock = stubFetch(async () => json({}));
    const { result } = renderHook(
      () => useSessionTranscription(SESSION_ID, { enabled: false }),
      { wrapper: wrapper(makeClient()) },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useDownloadTranscriptionMarkdown", () => {
  function markdown(body: string, status = 200) {
    return new Response(body, {
      status,
      headers: { "content-type": "text/markdown" },
    });
  }

  test("hits /transcription.md with parseAs:text and returns the raw markdown", async () => {
    const fetchMock = stubFetch(async () => markdown("# Séance\n\nBonjour."));
    const { result } = renderHook(
      () => useDownloadTranscriptionMarkdown(SESSION_ID),
      { wrapper: wrapper(makeClient()) },
    );
    const text = await result.current.mutateAsync();
    expect(text).toBe("# Séance\n\nBonjour.");
    const url =
      typeof fetchMock.mock.calls[0]?.[0] === "string"
        ? (fetchMock.mock.calls[0]?.[0] as string)
        : (fetchMock.mock.calls[0]?.[0] as Request).url;
    expect(url.endsWith("/transcription.md")).toBe(true);
  });

  test("surfaces an ApiError on >=400", async () => {
    stubFetch(async () =>
      json({ type: "about:blank", title: "boom", status: 500 }, 500),
    );
    const { result } = renderHook(
      () => useDownloadTranscriptionMarkdown(SESSION_ID),
      { wrapper: wrapper(makeClient()) },
    );
    await expect(result.current.mutateAsync()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("useSessionTranscriptionMarkdown", () => {
  function markdown(body: string, status = 200) {
    return new Response(body, {
      status,
      headers: { "content-type": "text/markdown" },
    });
  }

  test("hits /transcription.md with parseAs:text and returns the raw markdown", async () => {
    const fetchMock = stubFetch(async () => markdown("# Seance\n\nBonjour."));
    const { result } = renderHook(
      () => useSessionTranscriptionMarkdown(SESSION_ID, { enabled: true }),
      { wrapper: wrapper(makeClient()) },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe("# Seance\n\nBonjour.");
    const url =
      typeof fetchMock.mock.calls[0]?.[0] === "string"
        ? (fetchMock.mock.calls[0]?.[0] as string)
        : (fetchMock.mock.calls[0]?.[0] as Request).url;
    expect(url.endsWith("/transcription.md")).toBe(true);
  });

  test("enabled:false issues no request", () => {
    const fetchMock = stubFetch(async () => markdown("# Seance"));
    const { result } = renderHook(
      () => useSessionTranscriptionMarkdown(SESSION_ID, { enabled: false }),
      { wrapper: wrapper(makeClient()) },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useUpdateTranscriptionMarkdown", () => {
  test("PUTs content_md and seeds the markdown query on success", async () => {
    const queryClient = makeClient();
    const fetchMock = stubFetch(async (input) => {
      const request = input as Request;
      expect(request.method).toBe("PUT");
      expect(request.url.endsWith("/transcription")).toBe(true);
      expect(await request.clone().json()).toEqual({
        content_md: "# Corrige\n\nTexte",
      });
      return json({
        session_id: SESSION_ID,
        content_md: "# Corrige\n\nTexte",
        is_edited: true,
        updated_at: "2026-06-11T08:00:00Z",
      });
    });
    const { result } = renderHook(
      () => useUpdateTranscriptionMarkdown(SESSION_ID),
      { wrapper: wrapper(queryClient) },
    );
    await expect(
      result.current.mutateAsync({ content_md: "# Corrige\n\nTexte" }),
    ).resolves.toMatchObject({
      content_md: "# Corrige\n\nTexte",
      is_edited: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      queryClient.getQueryData(transcriptionMarkdownQueryKey(SESSION_ID)),
    ).toBe("# Corrige\n\nTexte");
  });

  test("surfaces ApiError on a 409 session-not-transcribed response", async () => {
    stubFetch(async () =>
      json(
        {
          type: "about:blank",
          title: "session-not-transcribed",
          status: 409,
        },
        409,
      ),
    );
    const { result } = renderHook(
      () => useUpdateTranscriptionMarkdown(SESSION_ID),
      { wrapper: wrapper(makeClient()) },
    );
    await expect(
      result.current.mutateAsync({ content_md: "# Trop tot" }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
