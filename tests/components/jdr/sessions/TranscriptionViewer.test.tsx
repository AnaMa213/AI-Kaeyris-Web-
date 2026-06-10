// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/core/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

const { TranscriptionViewer } = await import(
  "@/components/jdr/sessions/TranscriptionViewer"
);

const SESSION_ID = "00000000-0000-0000-0000-000000000abc";

type Chunk = { chunk_id: string; ordre: number; text: string };
type Segment = {
  speaker_label: string;
  text: string;
  start_seconds: number;
  end_seconds: number;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type":
        status >= 400 ? "application/problem+json" : "application/json",
    },
  });
}

function stubFetch(opts: {
  chunks?: Chunk[];
  segments?: Segment[];
  chunksStatus?: number;
  transcriptionStatus?: number;
}) {
  const fetchMock = vi.fn(async (input: Request | string) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.includes("/chunks")) {
      if (opts.chunksStatus && opts.chunksStatus >= 400) {
        return json(
          { type: "about:blank", title: "absent", status: opts.chunksStatus },
          opts.chunksStatus,
        );
      }
      return json({ session_id: SESSION_ID, items: opts.chunks ?? [] });
    }
    if (url.includes("/transcription")) {
      if (opts.transcriptionStatus && opts.transcriptionStatus >= 400) {
        return json(
          {
            type: "about:blank",
            title: "absent",
            status: opts.transcriptionStatus,
          },
          opts.transcriptionStatus,
        );
      }
      return json({
        session_id: SESSION_ID,
        language: "fr",
        model_used: "whisper-x",
        provider: "mock",
        completed_at: "2026-06-01T10:00:00Z",
        segments: opts.segments ?? [],
      });
    }
    return json({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderViewer(mode: "non_diarised" | "diarised") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TranscriptionViewer sessionId={SESSION_ID} transcriptionMode={mode} />
    </QueryClientProvider>,
  );
}

function calledUrls(fetchMock: ReturnType<typeof stubFetch>): string[] {
  return fetchMock.mock.calls.map((call) => {
    const input = call[0] as Request | string;
    return typeof input === "string" ? input : input.url;
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("TranscriptionViewer — non_diarised", () => {
  test("stitches chunks in `ordre` order", async () => {
    stubFetch({
      chunks: [
        { chunk_id: "c2", ordre: 2, text: "DEUXIEME" },
        { chunk_id: "c1", ordre: 1, text: "PREMIER" },
      ],
    });
    const { container } = renderViewer("non_diarised");
    await screen.findByText("PREMIER");
    const text = container.textContent ?? "";
    expect(text.indexOf("PREMIER")).toBeLessThan(text.indexOf("DEUXIEME"));
  });

  test("404 not-ready shows a calm message, not an error", async () => {
    stubFetch({ chunksStatus: 404 });
    renderViewer("non_diarised");
    expect(
      await screen.findByText("La transcription n'est pas encore disponible."),
    ).toBeTruthy();
  });

  test("empty chunk list shows an empty state", async () => {
    stubFetch({ chunks: [] });
    renderViewer("non_diarised");
    expect(await screen.findByText("Transcription vide.")).toBeTruthy();
  });

  test("never calls the diarised endpoint (no wrong-mode)", async () => {
    const fetchMock = stubFetch({
      chunks: [{ chunk_id: "c1", ordre: 1, text: "Texte" }],
    });
    renderViewer("non_diarised");
    await screen.findByText("Texte");
    const urls = calledUrls(fetchMock);
    expect(urls.some((u) => u.includes("/chunks"))).toBe(true);
    expect(urls.some((u) => u.includes("/transcription"))).toBe(false);
  });
});

describe("TranscriptionViewer — diarised", () => {
  test("renders segments with speaker labels", async () => {
    stubFetch({
      segments: [
        {
          speaker_label: "speaker_1",
          text: "Bonjour à tous.",
          start_seconds: 0,
          end_seconds: 1,
        },
        {
          speaker_label: "speaker_2",
          text: "Salut.",
          start_seconds: 1,
          end_seconds: 2,
        },
      ],
    });
    renderViewer("diarised");
    expect(await screen.findByText("Bonjour à tous.")).toBeTruthy();
    expect(screen.getByText("speaker_1")).toBeTruthy();
    expect(screen.getByText("speaker_2")).toBeTruthy();
    expect(screen.getByText("Salut.")).toBeTruthy();
  });

  test("groups consecutive segments from the same speaker", async () => {
    stubFetch({
      segments: [
        { speaker_label: "speaker_1", text: "A", start_seconds: 0, end_seconds: 1 },
        { speaker_label: "speaker_1", text: "B", start_seconds: 1, end_seconds: 2 },
        { speaker_label: "speaker_2", text: "C", start_seconds: 2, end_seconds: 3 },
      ],
    });
    renderViewer("diarised");
    expect(await screen.findByText("A B")).toBeTruthy();
    expect(screen.getAllByText("speaker_1")).toHaveLength(1);
    expect(screen.getByText("speaker_2")).toBeTruthy();
    expect(screen.getByText("C")).toBeTruthy();
  });

  test("never calls the non_diarised endpoint (no wrong-mode)", async () => {
    const fetchMock = stubFetch({
      segments: [
        {
          speaker_label: "speaker_1",
          text: "Texte",
          start_seconds: 0,
          end_seconds: 1,
        },
      ],
    });
    renderViewer("diarised");
    await screen.findByText("Texte");
    const urls = calledUrls(fetchMock);
    expect(urls.some((u) => u.includes("/transcription"))).toBe(true);
    expect(urls.some((u) => u.includes("/chunks"))).toBe(false);
  });
});

describe("TranscriptionViewer — loading", () => {
  test("shows a loading placeholder while fetching", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderViewer("non_diarised");
    expect(screen.getByText("Chargement de la transcription…")).toBeTruthy();
  });
});
