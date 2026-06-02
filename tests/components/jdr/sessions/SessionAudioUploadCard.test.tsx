// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
    render(<SessionAudioUploadCard session={sampleSession} />);
    expect(
      screen.getByRole("button", { name: /Glisse ton M4A/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Fichier prêt/),
    ).not.toBeInTheDocument();
  });

  test("dropping a valid M4A transitions to the preparing panel with filename + MB", () => {
    render(<SessionAudioUploadCard session={sampleSession} />);
    const dropzone = screen.getByRole("button", { name: /Glisse ton M4A/ });
    const file = new File(["x".repeat(2_097_152)], "demo.m4a", {
      type: "audio/mp4",
    });

    fireEvent.drop(dropzone, { dataTransfer: makeDataTransfer(file) });

    expect(screen.getByText(/Fichier prêt/)).toBeInTheDocument();
    expect(screen.getByText("demo.m4a")).toBeInTheDocument();
    expect(screen.getByText(/2\.0 MB/)).toBeInTheDocument();
    // shouldReduce was consulted with the file size and returned false.
    expect(audioMocks.shouldReduce).toHaveBeenCalledWith(2_097_152);
    // reduceAudio must NOT be called on the neutral path.
    expect(audioMocks.reduceAudio).not.toHaveBeenCalled();
  });

  test("dropping a non-M4A file fires toast.error and stays on the dropzone", () => {
    render(<SessionAudioUploadCard session={sampleSession} />);
    const dropzone = screen.getByRole("button", { name: /Glisse ton M4A/ });
    const file = new File(["x"], "demo.txt", { type: "text/plain" });

    fireEvent.drop(dropzone, { dataTransfer: makeDataTransfer(file) });

    expect(toastErrorMock).toHaveBeenCalledWith(
      "Format non supporté. Glisse un fichier .m4a.",
    );
    expect(
      screen.queryByText(/Fichier prêt/),
    ).not.toBeInTheDocument();
  });

  test("clicking Annuler from the preparing panel returns to the dropzone", async () => {
    render(<SessionAudioUploadCard session={sampleSession} />);
    const dropzone = screen.getByRole("button", { name: /Glisse ton M4A/ });
    const file = new File(["x"], "demo.m4a", { type: "audio/mp4" });
    fireEvent.drop(dropzone, { dataTransfer: makeDataTransfer(file) });
    expect(screen.getByText(/Fichier prêt/)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Annuler" }));

    expect(
      screen.queryByText(/Fichier prêt/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Glisse ton M4A/ }),
    ).toBeInTheDocument();
  });

  test("the Envoyer button is disabled with the Story 3.3 hint", () => {
    render(<SessionAudioUploadCard session={sampleSession} />);
    const dropzone = screen.getByRole("button", { name: /Glisse ton M4A/ });
    const file = new File(["x"], "demo.m4a", { type: "audio/mp4" });
    fireEvent.drop(dropzone, { dataTransfer: makeDataTransfer(file) });

    const sendButton = screen.getByRole("button", { name: "Envoyer" });
    expect(sendButton).toBeDisabled();
    expect(sendButton.getAttribute("title")).toBe("Disponible avec Story 3.3");
  });
});

describe("<SessionAudioUploadCard> — Story 3.2 reducer paths", () => {
  test("large file with reducer required → enters reducing phase then preparing", async () => {
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

    render(<SessionAudioUploadCard session={sampleSession} />);
    const dropzone = screen.getByRole("button", { name: /Glisse ton M4A/ });
    const large = new File(["x".repeat(1024)], "big.m4a", {
      type: "audio/mp4",
    });
    fireEvent.drop(dropzone, { dataTransfer: makeDataTransfer(large) });

    expect(
      await screen.findByRole("heading", { name: "Réduction audio" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/50%/)).toBeInTheDocument();

    resolveReduce(reducedFile);

    await waitFor(() =>
      expect(screen.getByText(/Fichier prêt/)).toBeInTheDocument(),
    );
    expect(screen.getByText("demo.reduced.m4a")).toBeInTheDocument();
  });

  test("Annuler during reducing returns to idle without firing an error toast", async () => {
    audioMocks.shouldReduce.mockReturnValue(true);
    let capturedSignal: AbortSignal | undefined;
    audioMocks.reduceAudio.mockImplementation((_file, _onProgress, signal) => {
      capturedSignal = signal;
      return new Promise<File>(() => {});
    });

    render(<SessionAudioUploadCard session={sampleSession} />);
    const dropzone = screen.getByRole("button", { name: /Glisse ton M4A/ });
    const large = new File(["x"], "big.m4a", { type: "audio/mp4" });
    fireEvent.drop(dropzone, { dataTransfer: makeDataTransfer(large) });

    await screen.findByRole("heading", { name: "Réduction audio" });

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
        (_file, onProgress) =>
          new Promise<File>((resolve) => {
            onProgress?.(75);
            resolveSecond = resolve;
          }),
      );

    render(<SessionAudioUploadCard session={sampleSession} />);
    const firstDropzone = screen.getByRole("button", { name: /Glisse ton M4A/ });
    fireEvent.drop(firstDropzone, {
      dataTransfer: makeDataTransfer(
        new File(["x"], "first.m4a", { type: "audio/mp4" }),
      ),
    });
    await screen.findByRole("heading", { name: "Réduction audio" });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Annuler" }));

    const secondDropzone = screen.getByRole("button", { name: /Glisse ton M4A/ });
    fireEvent.drop(secondDropzone, {
      dataTransfer: makeDataTransfer(
        new File(["y"], "second.m4a", { type: "audio/mp4" }),
      ),
    });
    await screen.findByText(/75%/);

    resolveFirst(new File(["old"], "first.reduced.m4a", { type: "audio/mp4" }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText("first.reduced.m4a")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Réduction audio" }),
    ).toBeInTheDocument();

    resolveSecond(
      new File(["new"], "second.reduced.m4a", { type: "audio/mp4" }),
    );
    await waitFor(() =>
      expect(screen.getByText("second.reduced.m4a")).toBeInTheDocument(),
    );
  });

  test("ffmpeg error → toast.error fires and the card returns to idle", async () => {
    audioMocks.shouldReduce.mockReturnValue(true);
    audioMocks.reduceAudio.mockRejectedValueOnce(new Error("boom"));

    render(<SessionAudioUploadCard session={sampleSession} />);
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

    render(<SessionAudioUploadCard session={sampleSession} />);
    const dropzone = screen.getByRole("button", { name: /Glisse ton M4A/ });
    const large = new File(["x"], "big.m4a", { type: "audio/mp4" });
    fireEvent.drop(dropzone, { dataTransfer: makeDataTransfer(large) });

    // Reducing panel rendered first, then since reduceAudio rejects with AbortError
    // we stay on the reducing screen (no resetToIdle, no toast).
    await screen.findByRole("heading", { name: "Réduction audio" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
