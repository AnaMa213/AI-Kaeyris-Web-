// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/lib/core/browser/downloadTextFile", () => ({
  downloadTextFile: vi.fn(),
}));

const { TranscriptionDialog } = await import(
  "@/components/jdr/sessions/TranscriptionDialog"
);
const { toast } = await import("sonner");
const { downloadTextFile } = await import(
  "@/lib/core/browser/downloadTextFile"
);

const SESSION_ID = "00000000-0000-0000-0000-000000000abc";

const DIARISED_PAYLOAD = {
  session_id: SESSION_ID,
  language: "fr",
  model_used: "whisper-x",
  provider: "mock",
  completed_at: "2026-06-01T10:00:00Z",
  segments: [
    {
      speaker_label: "speaker_1",
      text: "Salutations, aventuriers.",
      start_seconds: 0,
      end_seconds: 1.5,
    },
  ],
};

const CHUNKS_PAYLOAD = {
  session_id: SESSION_ID,
  items: [{ chunk_id: "c1", ordre: 1, text: "Premier morceau." }],
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

function stubFetch(opts: { markdown?: string } = {}) {
  const fetchMock = vi.fn(async (input: Request | string) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.endsWith("/transcription.md")) {
      return new Response(opts.markdown ?? "# Transcription\n\nContenu brut.", {
        status: 200,
        headers: { "content-type": "text/markdown" },
      });
    }
    if (url.endsWith("/chunks")) return json(CHUNKS_PAYLOAD);
    if (url.endsWith("/transcription")) return json(DIARISED_PAYLOAD);
    return json({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderDialog(
  props: {
    open?: boolean;
    mode?: "diarised" | "non_diarised";
    canEdit?: boolean;
    onOpenChange?: (open: boolean) => void;
  } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TranscriptionDialog
        open={props.open ?? true}
        onOpenChange={props.onOpenChange ?? vi.fn()}
        sessionId={SESSION_ID}
        transcriptionMode={props.mode ?? "non_diarised"}
        sessionTitle="Ma Séance"
        canEdit={props.canEdit}
      />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("<TranscriptionDialog> (Story 4.21)", () => {
  test("does not render the transcription content while closed", () => {
    stubFetch();
    renderDialog({ open: false });
    expect(screen.queryByText(/Contenu brut/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Télécharger en JSON/ }),
    ).not.toBeInTheDocument();
  });

  test("reuses the TranscriptionViewer to show the raw transcription when open", async () => {
    stubFetch({ markdown: "# Transcription\n\nLe héros entre dans la crypte." });
    renderDialog({ open: true });
    expect(
      await screen.findByText(/Premier morceau/),
    ).toBeInTheDocument();
  });

  test("outside click closes the dialog", async () => {
    stubFetch();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderDialog({ open: true, onOpenChange });

    await screen.findByText(/Premier morceau/);
    const backdrop = document.querySelector('[data-slot="dialog-overlay"]');
    expect(backdrop).not.toBeNull();
    await user.click(backdrop as HTMLElement);

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  test("Escape does not close the dialog", async () => {
    stubFetch();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderDialog({ open: true, onOpenChange });

    await screen.findByText(/Premier morceau/);
    await user.keyboard("{Escape}");

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  test("the X close button still closes the dialog", async () => {
    stubFetch();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderDialog({ open: true, onOpenChange });

    await screen.findByText(/Premier morceau/);
    await user.click(screen.getByRole("button", { name: /close/i }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  test("downloads the EXACT non_diarised API response as JSON", async () => {
    stubFetch();
    const user = userEvent.setup();
    renderDialog({ open: true, mode: "non_diarised" });
    await user.click(
      await screen.findByRole("button", { name: /Télécharger en JSON/ }),
    );
    await waitFor(() =>
      expect(downloadTextFile).toHaveBeenCalledWith(
        "transcription-ma-seance.json",
        JSON.stringify(CHUNKS_PAYLOAD, null, 2),
        "application/json",
      ),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  test("downloads the EXACT diarised API response as JSON", async () => {
    stubFetch();
    const user = userEvent.setup();
    renderDialog({ open: true, mode: "diarised" });
    await user.click(
      await screen.findByRole("button", { name: /Télécharger en JSON/ }),
    );
    await waitFor(() =>
      expect(downloadTextFile).toHaveBeenCalledWith(
        "transcription-ma-seance.json",
        JSON.stringify(DIARISED_PAYLOAD, null, 2),
        "application/json",
      ),
    );
  });

  test("a failed JSON fetch raises a toast and writes no file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string) => {
        const url = typeof input === "string" ? input : input.url;
        if (url.endsWith("/transcription.md")) {
          return new Response("# T\n\nContenu", {
            status: 200,
            headers: { "content-type": "text/markdown" },
          });
        }
        return json({ type: "about:blank", title: "boom", status: 500 }, 500);
      }),
    );
    const user = userEvent.setup();
    renderDialog({ open: true, mode: "non_diarised" });
    await user.click(
      await screen.findByRole("button", { name: /Télécharger en JSON/ }),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Impossible de télécharger la transcription.",
      ),
    );
    expect(downloadTextFile).not.toHaveBeenCalled();
  });

  test("exposes the GM inline edit affordance inside the dialog", async () => {
    stubFetch({ markdown: "# Transcription\n\nTexte corrigeable" });
    renderDialog({ open: true, mode: "diarised", canEdit: true });
    await screen.findByText(/Texte corrigeable/);
    expect(
      screen.getByRole("button", { name: "Modifier" }),
    ).toBeInTheDocument();
  });
});
