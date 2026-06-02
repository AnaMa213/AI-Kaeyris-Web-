// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastErrorMock(...args) },
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

describe("<SessionAudioUploadCard>", () => {
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
  });

  test("dropping a non-M4A file fires toast.error with the rejection message and stays on the dropzone", () => {
    toastErrorMock.mockClear();
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
    expect(
      screen.getByRole("button", { name: /Glisse ton M4A/ }),
    ).toBeInTheDocument();
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
