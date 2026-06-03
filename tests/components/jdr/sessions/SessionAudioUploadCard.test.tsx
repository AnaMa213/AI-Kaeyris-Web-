// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/core/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastErrorMock(...args) },
}));

const audioMocks = vi.hoisted(() => ({
  shouldReduce: vi.fn(() => false),
  reduceAudio: vi.fn(),
}));

vi.mock("@/lib/audio/provider", () => ({
  shouldReduce: audioMocks.shouldReduce,
  isReducerRequired: vi.fn(() => false),
  MAX_UPLOAD_BYTES: 25 * 1024 * 1024,
}));

vi.mock("@/lib/audio/reduce", () => ({
  reduceAudio: audioMocks.reduceAudio,
}));

const { SessionAudioUploadCard } = await import(
  "@/components/jdr/sessions/SessionAudioUploadCard"
);

const sampleSession = {
  id: "ses-1",
  title: "Session 12",
  recorded_at: "2026-05-30T20:00:00+00:00",
  mode: "batch" as const,
  state: "created" as const,
  transcription_mode: "non_diarised" as const,
  campaign_context: null,
  created_at: "2026-05-30T20:00:00+00:00",
  updated_at: "2026-05-30T20:00:00+00:00",
};

function renderCard(props: {
  session?: typeof sampleSession;
  onUploadSuccess?: (jobId: string) => void;
  fetchImpl?: (
    input: Request | string,
    init?: RequestInit,
  ) => Promise<Response>;
} = {}) {
  if (props.fetchImpl) {
    vi.stubGlobal("fetch", vi.fn(props.fetchImpl));
  } else {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 })),
    );
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <SessionAudioUploadCard
          session={props.session ?? sampleSession}
          onUploadSuccess={props.onUploadSuccess}
        />
      </QueryClientProvider>,
    ),
  };
}

function makeDataTransfer(file: File): DataTransfer {
  return {
    files: [file] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: ["Files"],
    dropEffect: "copy",
    effectAllowed: "copy",
    clearData: vi.fn(),
    getData: vi.fn(),
    setData: vi.fn(),
    setDragImage: vi.fn(),
  } as unknown as DataTransfer;
}

beforeEach(() => {
  toastErrorMock.mockClear();
  audioMocks.shouldReduce.mockClear().mockReturnValue(false);
  audioMocks.reduceAudio.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("<SessionAudioUploadCard> — Story 3.1 baseline (reducer not triggered)", () => {
  test("initial render shows the dropzone (no file selected)", () => {
    renderCard();
    expect(
      screen.getByRole("button", { name: /Glisse ton M4A/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Fichier prêt/),
    ).not.toBeInTheDocument();
  });

  test("dropping a valid M4A shows the selected-file card (filename + Envoyer), NOT the loading ritual", () => {
    renderCard();
    const dropzone = screen.getByRole("button", { name: /Glisse ton M4A/ });
    const file = new File(["x".repeat(2_097_152)], "demo.m4a", {
      type: "audio/mp4",
    });

    fireEvent.drop(dropzone, { dataTransfer: makeDataTransfer(file) });

    // The selected filename is shown so the MJ confirms before sending.
    expect(screen.getByText("demo.m4a")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Envoyer" }),
    ).toBeInTheDocument();
    // The loading ritual must NOT appear before the user clicks Envoyer.
    expect(
      screen.queryByText("Le parchemin se prépare"),
    ).not.toBeInTheDocument();
    // shouldReduce was consulted with the file size and returned false.
    expect(audioMocks.shouldReduce).toHaveBeenCalledWith(2_097_152);
    // reduceAudio must NOT be called on the neutral path.
    expect(audioMocks.reduceAudio).not.toHaveBeenCalled();
  });

  test("dropping a non-M4A file fires toast.error and stays on the dropzone", () => {
    renderCard();
    const dropzone = screen.getByRole("button", { name: /Glisse ton M4A/ });
    const file = new File(["x"], "demo.txt", { type: "text/plain" });

    fireEvent.drop(dropzone, { dataTransfer: makeDataTransfer(file) });

    expect(toastErrorMock).toHaveBeenCalledWith(
      "Format non supporté. Glisse un fichier .m4a.",
    );
    expect(
      screen.queryByText("Le parchemin se prépare"),
    ).not.toBeInTheDocument();
  });

  test("clicking 'Changer de fichier' from the selected-file card returns to the dropzone", async () => {
    renderCard();
    const dropzone = screen.getByRole("button", { name: /Glisse ton M4A/ });
    const file = new File(["x"], "demo.m4a", { type: "audio/mp4" });
    fireEvent.drop(dropzone, { dataTransfer: makeDataTransfer(file) });
    expect(screen.getByText("demo.m4a")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Changer de fichier" }),
    );

    expect(screen.queryByText("demo.m4a")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Glisse ton M4A/ }),
    ).toBeInTheDocument();
  });

  test("the Envoyer button is enabled once a file is selected (Story 3.3)", () => {
    renderCard();
    const dropzone = screen.getByRole("button", { name: /Glisse ton M4A/ });
    const file = new File(["x"], "demo.m4a", { type: "audio/mp4" });
    fireEvent.drop(dropzone, { dataTransfer: makeDataTransfer(file) });

    const sendButton = screen.getByRole("button", { name: "Envoyer" });
    expect(sendButton).not.toBeDisabled();
  });
});

describe("<SessionAudioUploadCard> — Story 3.3 upload paths", () => {
  const audioResponse = {
    session_id: "ses-1",
    path: "data/audio/ses-1.m4a",
    sha256: "a".repeat(64),
    size_bytes: 1024,
    duration_seconds: null,
    uploaded_at: "2026-05-30T20:01:00+00:00",
    job_id: "job-uuid-42",
  };

  test("clicking Envoyer triggers the POST and calls onUploadSuccess with the job_id", async () => {
    const onUploadSuccess = vi.fn();
    const { queryClient } = renderCard({
      onUploadSuccess,
      fetchImpl: async () =>
        new Response(JSON.stringify(audioResponse), {
          status: 202,
          headers: { "content-type": "application/json" },
        }),
    });
    const dropzone = screen.getByRole("button", { name: /Glisse ton M4A/ });
    fireEvent.drop(dropzone, {
      dataTransfer: makeDataTransfer(
        new File(["x"], "demo.m4a", { type: "audio/mp4" }),
      ),
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Envoyer" }));

    await waitFor(() => {
      expect(onUploadSuccess).toHaveBeenCalledWith("job-uuid-42", null);
    });
    // The mutation seeded the job cache.
    const cached = queryClient.getQueryData(["jdr", "job", "job-uuid-42"]);
    expect(cached).toMatchObject({
      id: "job-uuid-42",
      status: "queued",
      kind: "transcription",
    });
  });

  test("during uploading both Envoyer and Annuler are disabled and the label shows 'Envoi en cours…'", async () => {
    let resolveResp: ((r: Response) => void) | null = null;
    renderCard({
      fetchImpl: () =>
        new Promise<Response>((resolve) => {
          resolveResp = resolve;
        }),
    });
    const dropzone = screen.getByRole("button", { name: /Glisse ton M4A/ });
    fireEvent.drop(dropzone, {
      dataTransfer: makeDataTransfer(
        new File(["x"], "demo.m4a", { type: "audio/mp4" }),
      ),
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Envoyer" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Envoi en cours/ }),
      ).toBeDisabled(),
    );
    expect(screen.getByRole("button", { name: "Annuler" })).toBeDisabled();

    (resolveResp as ((r: Response) => void) | null)?.(
      new Response(JSON.stringify(audioResponse), {
        status: 202,
        headers: { "content-type": "application/json" },
      }),
    );
  });

  test("on 413 the rejection toast surfaces the reducer hint", async () => {
    renderCard({
      fetchImpl: async () =>
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
    });
    const dropzone = screen.getByRole("button", { name: /Glisse ton M4A/ });
    fireEvent.drop(dropzone, {
      dataTransfer: makeDataTransfer(
        new File(["x"], "demo.m4a", { type: "audio/mp4" }),
      ),
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Envoyer" }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        expect.stringContaining("Fichier trop volumineux"),
      );
    });
    // The card stays in the preparing phase (file kept for retry) → Envoyer present.
    expect(screen.getByRole("button", { name: "Envoyer" })).toBeInTheDocument();
  });
});

describe("<SessionAudioUploadCard> — Story 3.2 reducer paths (transparent reduce)", () => {
  test("large file with reducer required → reducing act (no Envoyer) then preparing (Envoyer appears)", async () => {
    audioMocks.shouldReduce.mockReturnValue(true);
    const reducedFile = new File(["small"], "demo.reduced.m4a", {
      type: "audio/mp4",
    });
    let resolveReduce: (file: File) => void = () => {};
    audioMocks.reduceAudio.mockImplementation(
      (_file, onProgress) =>
        new Promise<File>((resolve) => {
          onProgress?.(50);
          resolveReduce = resolve;
        }),
    );

    renderCard();
    const dropzone = screen.getByRole("button", { name: /Glisse ton M4A/ });
    const large = new File(["x".repeat(1024)], "big.m4a", {
      type: "audio/mp4",
    });
    fireEvent.drop(dropzone, { dataTransfer: makeDataTransfer(large) });

    // Reducing: the fantasy act shows, but Envoyer is not offered yet.
    expect(
      await screen.findByText("Le parchemin se prépare"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Envoyer" }),
    ).not.toBeInTheDocument();
    // The reduce is transparent: no percentage leaks into the DOM.
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();

    resolveReduce(reducedFile);

    // Preparing: Envoyer is now offered (no filename shown).
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Envoyer" })).toBeInTheDocument(),
    );
    expect(screen.queryByText("demo.reduced.m4a")).not.toBeInTheDocument();
  });

  test("reducing act renders no technical vocabulary (ffmpeg / réduction / %)", async () => {
    audioMocks.shouldReduce.mockReturnValue(true);
    audioMocks.reduceAudio.mockImplementation((_file, onProgress) => {
      onProgress?.(42);
      return new Promise<File>(() => {});
    });

    const { container } = renderCard();
    const dropzone = screen.getByRole("button", { name: /Glisse ton M4A/ });
    fireEvent.drop(dropzone, {
      dataTransfer: makeDataTransfer(
        new File(["x"], "big.m4a", { type: "audio/mp4" }),
      ),
    });

    await screen.findByText("Le parchemin se prépare");
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/ffmpeg/i);
    expect(text).not.toMatch(/réduction/i);
    expect(text).not.toMatch(/%/);
  });

  test("Annuler during reducing returns to idle without firing an error toast", async () => {
    audioMocks.shouldReduce.mockReturnValue(true);
    let capturedSignal: AbortSignal | undefined;
    audioMocks.reduceAudio.mockImplementation((_file, _onProgress, signal) => {
      capturedSignal = signal;
      return new Promise<File>(() => {});
    });

    renderCard();
    const dropzone = screen.getByRole("button", { name: /Glisse ton M4A/ });
    const large = new File(["x"], "big.m4a", { type: "audio/mp4" });
    fireEvent.drop(dropzone, { dataTransfer: makeDataTransfer(large) });

    await screen.findByText("Le parchemin se prépare");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Annuler" }));

    expect(capturedSignal?.aborted).toBe(true);
    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /Glisse ton M4A/ }),
    ).toBeInTheDocument();
  });

  test("a cancelled reduction cannot overwrite a newer reduction result", async () => {
    audioMocks.shouldReduce.mockReturnValue(true);
    let resolveFirst: (file: File) => void = () => {};
    let resolveSecond: (file: File) => void = () => {};
    audioMocks.reduceAudio
      .mockImplementationOnce(
        () =>
          new Promise<File>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<File>((resolve) => {
            resolveSecond = resolve;
          }),
      );

    renderCard();
    const firstDropzone = screen.getByRole("button", { name: /Glisse ton M4A/ });
    fireEvent.drop(firstDropzone, {
      dataTransfer: makeDataTransfer(
        new File(["x"], "first.m4a", { type: "audio/mp4" }),
      ),
    });
    await screen.findByText("Le parchemin se prépare");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Annuler" }));

    const secondDropzone = screen.getByRole("button", { name: /Glisse ton M4A/ });
    fireEvent.drop(secondDropzone, {
      dataTransfer: makeDataTransfer(
        new File(["y"], "second.m4a", { type: "audio/mp4" }),
      ),
    });
    await screen.findByText("Le parchemin se prépare");

    // Resolving the cancelled (stale) reduction must be ignored: still reducing,
    // Envoyer not offered.
    resolveFirst(new File(["old"], "first.reduced.m4a", { type: "audio/mp4" }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(
      screen.queryByRole("button", { name: "Envoyer" }),
    ).not.toBeInTheDocument();

    // Resolving the current reduction advances to preparing → Envoyer appears.
    resolveSecond(
      new File(["new"], "second.reduced.m4a", { type: "audio/mp4" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Envoyer" })).toBeInTheDocument(),
    );
  });

  test("ffmpeg error → toast.error fires and the card returns to idle", async () => {
    audioMocks.shouldReduce.mockReturnValue(true);
    audioMocks.reduceAudio.mockRejectedValueOnce(new Error("boom"));

    renderCard();
    const dropzone = screen.getByRole("button", { name: /Glisse ton M4A/ });
    const large = new File(["x"], "big.m4a", { type: "audio/mp4" });
    fireEvent.drop(dropzone, { dataTransfer: makeDataTransfer(large) });

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        "La réduction audio a échoué. Réessaie ou choisis un fichier plus petit.",
      ),
    );
    expect(
      screen.getByRole("button", { name: /Glisse ton M4A/ }),
    ).toBeInTheDocument();
  });

  test("AbortError thrown from reduceAudio is swallowed silently (no toast, no UI change)", async () => {
    audioMocks.shouldReduce.mockReturnValue(true);
    audioMocks.reduceAudio.mockRejectedValueOnce(
      new DOMException("Aborted", "AbortError"),
    );

    renderCard();
    const dropzone = screen.getByRole("button", { name: /Glisse ton M4A/ });
    const large = new File(["x"], "big.m4a", { type: "audio/mp4" });
    fireEvent.drop(dropzone, { dataTransfer: makeDataTransfer(large) });

    // Reducing act rendered first; since reduceAudio rejects with AbortError
    // we stay on the reducing screen (no resetToIdle, no toast).
    await screen.findByText("Le parchemin se prépare");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
