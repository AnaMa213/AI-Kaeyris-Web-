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

const { useSessionChunks, useSessionTranscription } = await import(
  "@/lib/jdr/sessions/transcription"
);
const { isArtifactAbsentError } = await import("@/lib/jdr/sessions/artifacts");

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
