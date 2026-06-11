// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/core/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/lib/core/browser/downloadTextFile", () => ({
  downloadTextFile: vi.fn(),
}));

const { TranscriptionViewer } = await import(
  "@/components/jdr/sessions/TranscriptionViewer"
);
const { toast } = await import("sonner");
const { downloadTextFile } = await import(
  "@/lib/core/browser/downloadTextFile"
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
  markdown?: string;
  markdownStatus?: number;
  updatedMarkdown?: string;
  editStatus?: number;
}) {
  const fetchMock = vi.fn(async (input: Request | string) => {
    const url = typeof input === "string" ? input : input.url;
    const method = typeof input === "string" ? "GET" : (input.method ?? "GET");
    // `.md` must be matched before `/transcription` (it is a sub-path of it).
    if (url.endsWith("/transcription.md") && method.toUpperCase() === "GET") {
      if (opts.markdownStatus && opts.markdownStatus >= 400) {
        return json(
          { type: "about:blank", title: "boom", status: opts.markdownStatus },
          opts.markdownStatus,
        );
      }
      return new Response(opts.markdown ?? "# Transcription\n\nContenu.", {
        status: 200,
        headers: { "content-type": "text/markdown" },
      });
    }
    if (url.includes("/transcription") && method.toUpperCase() === "PUT") {
      if (opts.editStatus && opts.editStatus >= 400) {
        return json(
          {
            type: "about:blank",
            title:
              opts.editStatus === 409
                ? "session-not-transcribed"
                : "session-not-found",
            status: opts.editStatus,
          },
          opts.editStatus,
        );
      }
      return json({
        session_id: SESSION_ID,
        content_md: opts.updatedMarkdown ?? "# Transcription corrigee",
        is_edited: true,
        updated_at: "2026-06-11T08:00:00Z",
      });
    }
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

function renderViewer(
  mode: "non_diarised" | "diarised",
  sessionTitle = "Ma Séance",
  props: { canEdit?: boolean; editingBlocked?: boolean } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TranscriptionViewer
        sessionId={SESSION_ID}
        transcriptionMode={mode}
        sessionTitle={sessionTitle}
        canEdit={props.canEdit}
        editingBlocked={props.editingBlocked}
      />
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
  test("renders the canonical Markdown transcription", async () => {
    stubFetch({
      markdown: "# Transcription\n\nPREMIER\n\nDEUXIEME",
    });
    const { container } = renderViewer("non_diarised");
    await screen.findByText(/PREMIER/);
    const text = container.textContent ?? "";
    expect(text.indexOf("PREMIER")).toBeLessThan(text.indexOf("DEUXIEME"));
  });

  test("404 not-ready shows a calm message, not an error", async () => {
    stubFetch({ markdownStatus: 404 });
    renderViewer("non_diarised");
    expect(
      await screen.findByText("La transcription n'est pas encore disponible."),
    ).toBeTruthy();
  });

  test("empty markdown shows an empty state", async () => {
    stubFetch({ markdown: "   " });
    renderViewer("non_diarised");
    expect(await screen.findByText("Transcription vide.")).toBeTruthy();
  });

  test("uses only the mode-agnostic Markdown endpoint", async () => {
    const fetchMock = stubFetch({
      markdown: "Texte",
    });
    renderViewer("non_diarised");
    await screen.findByText("Texte");
    const urls = calledUrls(fetchMock);
    expect(urls.some((u) => u.endsWith("/transcription.md"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/chunks"))).toBe(false);
    expect(urls.some((u) => u.endsWith("/transcription"))).toBe(false);
  });
});

describe("TranscriptionViewer — diarised", () => {
  test("renders canonical Markdown for diarised sessions too", async () => {
    stubFetch({
      markdown: "**speaker_1** : Bonjour a tous.\n\n**speaker_2** : Salut.",
    });
    renderViewer("diarised");
    expect(await screen.findByText(/Bonjour a tous/)).toBeTruthy();
    expect(screen.getByText(/Salut/)).toBeTruthy();
  });

  test("does not call chunks or structured transcription endpoints", async () => {
    const fetchMock = stubFetch({
      markdown: "Texte",
    });
    renderViewer("diarised");
    await screen.findByText(/Texte/);
    const urls = calledUrls(fetchMock);
    expect(urls.some((u) => u.endsWith("/transcription.md"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/chunks"))).toBe(false);
    expect(urls.some((u) => u.endsWith("/transcription"))).toBe(false);
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

describe("TranscriptionViewer — download (.md)", () => {
  const downloadButton = () =>
    screen.queryByRole("button", { name: /Télécharger/ });

  test("shows the download button once content is rendered (non_diarised)", async () => {
    stubFetch({ markdown: "Texte" });
    renderViewer("non_diarised");
    await screen.findByText("Texte");
    expect(downloadButton()).toBeTruthy();
  });

  test("shows the download button once content is rendered (diarised)", async () => {
    stubFetch({ markdown: "Salut" });
    renderViewer("diarised");
    await screen.findByText("Salut");
    expect(downloadButton()).toBeTruthy();
  });

  test("hides the button while loading", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderViewer("non_diarised");
    expect(downloadButton()).toBeNull();
  });

  test("hides the button on a not-ready (404) transcription", async () => {
    stubFetch({ markdownStatus: 404 });
    renderViewer("non_diarised");
    await screen.findByText("La transcription n'est pas encore disponible.");
    expect(downloadButton()).toBeNull();
  });

  test("hides the button on an empty transcription", async () => {
    stubFetch({ markdown: "   " });
    renderViewer("non_diarised");
    await screen.findByText("Transcription vide.");
    expect(downloadButton()).toBeNull();
  });

  test("clicking saves the markdown via downloadTextFile with a title-based filename", async () => {
    stubFetch({
      markdown: "# Ma Séance\n\nTexte",
    });
    renderViewer("non_diarised", "Ma Séance");
    const button = await screen.findByRole("button", { name: /Télécharger/ });
    fireEvent.click(button);
    await waitFor(() =>
      expect(downloadTextFile).toHaveBeenCalledWith(
        "transcription-ma-seance.md",
        "# Ma Séance\n\nTexte",
      ),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  test("a failed download raises a toast and writes no file", async () => {
    let markdownGetCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string) => {
        const url = typeof input === "string" ? input : input.url;
        if (url.endsWith("/transcription.md")) {
          markdownGetCount += 1;
          if (markdownGetCount === 1) {
            return new Response("Texte", {
              status: 200,
              headers: { "content-type": "text/markdown" },
            });
          }
          return json({ type: "about:blank", title: "boom", status: 500 }, 500);
        }
        return json({});
      }),
    );
    renderViewer("non_diarised");
    const button = await screen.findByRole("button", { name: /Télécharger/ });
    fireEvent.click(button);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Impossible de télécharger la transcription.",
      ),
    );
    expect(downloadTextFile).not.toHaveBeenCalled();
  });
});

describe("TranscriptionViewer — inline edit", () => {
  const editButton = () => screen.queryByRole("button", { name: "Modifier" });

  test("hides the edit action by default", async () => {
    stubFetch({ markdown: "# Transcription\n\nTexte" });
    renderViewer("non_diarised");
    await screen.findByText(/Texte/);
    expect(editButton()).toBeNull();
  });

  test("shows a GM-only edit action and pre-fills the Markdown textarea", async () => {
    stubFetch({ markdown: "# Transcription\n\nTexte" });
    renderViewer("non_diarised", "Ma Séance", { canEdit: true });
    await screen.findByText(/Texte/);
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    expect(
      screen.getByRole("textbox", { name: "Transcription Markdown" }),
    ).toHaveValue("# Transcription\n\nTexte");
  });

  test("cancel discards local edits without sending PUT", async () => {
    const fetchMock = stubFetch({ markdown: "# Original\n\nTexte" });
    renderViewer("non_diarised", "Ma Séance", { canEdit: true });
    await screen.findByText(/Texte/);
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Transcription Markdown" }),
      { target: { value: "# Brouillon" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(await screen.findByText(/Original/)).toBeTruthy();
    expect(
      fetchMock.mock.calls.some((call) => {
        const input = call[0] as Request | string;
        return typeof input !== "string" && input.method === "PUT";
      }),
    ).toBe(false);
  });

  test("saving persists the edited markdown and re-renders it", async () => {
    const fetchMock = stubFetch({
      markdown: "# Original",
      updatedMarkdown: "# Corrige\n\nTexte relu",
    });
    renderViewer("non_diarised", "Ma Séance", { canEdit: true });
    await screen.findByText(/Original/);
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Transcription Markdown" }),
      { target: { value: "# Corrige\n\nTexte relu" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await screen.findByText(/Texte relu/);
    const putCall = fetchMock.mock.calls.find((call) => {
      const input = call[0] as Request | string;
      return typeof input !== "string" && input.method === "PUT";
    });
    expect(putCall).toBeTruthy();
    expect(await ((putCall?.[0] as Request).clone().json())).toEqual({
      content_md: "# Corrige\n\nTexte relu",
    });
  });

  test("does not save blank content", async () => {
    const fetchMock = stubFetch({ markdown: "# Original" });
    renderViewer("non_diarised", "Ma Séance", { canEdit: true });
    await screen.findByText(/Original/);
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Transcription Markdown" }),
      { target: { value: "   " } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(
      await screen.findByText("La transcription ne peut pas être vide."),
    ).toBeTruthy();
    expect(
      fetchMock.mock.calls.some((call) => {
        const input = call[0] as Request | string;
        return typeof input !== "string" && input.method === "PUT";
      }),
    ).toBe(false);
  });

  test("disables editing while a transcription job is active", async () => {
    const fetchMock = stubFetch({ markdown: "# Original" });
    renderViewer("non_diarised", "Ma Séance", {
      canEdit: true,
      editingBlocked: true,
    });
    await screen.findByText(/Original/);
    const button = screen.getByRole("button", { name: "Modifier" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      "title",
      "Transcription en cours — modification bloquée.",
    );
    fireEvent.click(button);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(
      fetchMock.mock.calls.some((call) => {
        const input = call[0] as Request | string;
        return typeof input !== "string" && input.method === "PUT";
      }),
    ).toBe(false);
  });

  test("keeps the editor open and maps a 409 backend error", async () => {
    stubFetch({ markdown: "# Original", editStatus: 409 });
    renderViewer("non_diarised", "Ma Séance", { canEdit: true });
    await screen.findByText(/Original/);
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Transcription Markdown" }),
      { target: { value: "# Corrige" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(
      await screen.findByText("La transcription n'est pas encore disponible."),
    ).toBeTruthy();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
});
