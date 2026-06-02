// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
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

const { SessionEditDialog } = await import(
  "@/components/jdr/sessions/SessionEditForm"
);

const sampleSession = {
  id: "ses-1",
  title: "Session 12 — La cité engloutie",
  recorded_at: "2026-05-30T20:00:00+00:00",
  mode: "batch" as const,
  state: "created" as const,
  transcription_mode: "non_diarised" as const,
  campaign_context: "Bibliothèque oubliée. PNJ Eilord à surveiller.",
  created_at: "2026-05-30T20:00:00+00:00",
  updated_at: "2026-05-30T20:00:00+00:00",
};

const updatedSession = {
  ...sampleSession,
  title: "Session 12 — La cité engloutie (corrigée)",
};

type OnOpenChange = (open: boolean) => void;

function renderDialog(opts: {
  fetchImpl?: (
    input: Request | string,
    init?: RequestInit,
  ) => Promise<Response>;
  onOpenChange?: OnOpenChange;
} = {}) {
  const onOpenChange = (opts.onOpenChange ?? vi.fn()) as OnOpenChange;
  if (opts.fetchImpl) {
    vi.stubGlobal("fetch", vi.fn(opts.fetchImpl));
  } else {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(updatedSession), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <SessionEditDialog
        open
        onOpenChange={onOpenChange}
        session={sampleSession}
        campaignId="camp-uuid"
      />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

describe("<SessionEditDialog>", () => {
  test("pre-fills the form with the current title and campaign_context", () => {
    renderDialog();
    expect(
      (screen.getByLabelText("Titre") as HTMLInputElement).value,
    ).toBe(sampleSession.title);
    expect(
      (
        screen.getByLabelText(
          /Contexte de campagne/i,
        ) as HTMLTextAreaElement
      ).value,
    ).toBe(sampleSession.campaign_context);
  });

  test("renders the dialog title and helper text below the textarea", () => {
    renderDialog();
    expect(
      screen.getByRole("heading", { name: "Modifier la session" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/orientation narrative envoyé au LLM/i),
    ).toBeInTheDocument();
  });

  test("submits PATCH with the new title and closes the dialog on success", async () => {
    type PatchBody = {
      title?: string;
      campaign_context?: string | null;
    };
    let patchBody: PatchBody | null = null;
    const onOpenChange = vi.fn();
    renderDialog({
      onOpenChange,
      fetchImpl: async (input, init) => {
        const method =
          typeof input === "string" ? init?.method : (input.method ?? "GET");
        if (method?.toUpperCase() === "PATCH") {
          if (typeof input !== "string") {
            patchBody = await input.clone().json();
          }
          return new Response(JSON.stringify(updatedSession), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(null, { status: 200 });
      },
    });

    const user = userEvent.setup();
    const titleInput = screen.getByLabelText("Titre") as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, "Session 12 — La cité engloutie (corrigée)");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect((patchBody as PatchBody | null)?.title).toBe(
      "Session 12 — La cité engloutie (corrigée)",
    );
  });

  test("clearing the campaign_context sends null in the PATCH body", async () => {
    type PatchBody = {
      title?: string;
      campaign_context?: string | null;
    };
    let patchBody: PatchBody | null = null;
    renderDialog({
      fetchImpl: async (input, init) => {
        const method =
          typeof input === "string" ? init?.method : (input.method ?? "GET");
        if (method?.toUpperCase() === "PATCH") {
          if (typeof input !== "string") {
            patchBody = await input.clone().json();
          }
          return new Response(
            JSON.stringify({ ...sampleSession, campaign_context: null }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(null, { status: 200 });
      },
    });

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText(/Contexte de campagne/i));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(patchBody).not.toBeNull();
    });
    expect((patchBody as PatchBody | null)?.campaign_context).toBeNull();
  });

  test("Annuler closes the dialog without submitting", async () => {
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("rejects an empty title with the French zod error", async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Titre"));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(
      await screen.findByText("Titre requis."),
    ).toBeInTheDocument();
  });

  test("surfaces a generic error on 422", async () => {
    renderDialog({
      fetchImpl: async (input, init) => {
        const method =
          typeof input === "string" ? init?.method : (input.method ?? "GET");
        if (method?.toUpperCase() === "PATCH") {
          return new Response(
            JSON.stringify({
              type: "about:blank",
              title: "Validation Error",
              status: 422,
            }),
            {
              status: 422,
              headers: { "content-type": "application/problem+json" },
            },
          );
        }
        return new Response(null, { status: 200 });
      },
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(
      await screen.findByText(/Modification impossible/i),
    ).toBeInTheDocument();
  });

  test("surfaces the 403 message on a forbidden response", async () => {
    renderDialog({
      fetchImpl: async (input, init) => {
        const method =
          typeof input === "string" ? init?.method : (input.method ?? "GET");
        if (method?.toUpperCase() === "PATCH") {
          return new Response(
            JSON.stringify({
              type: "about:blank",
              title: "Forbidden",
              status: 403,
            }),
            {
              status: 403,
              headers: { "content-type": "application/problem+json" },
            },
          );
        }
        return new Response(null, { status: 200 });
      },
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(
      await screen.findByText(
        /Tu n'as pas les permissions pour modifier cette session/i,
      ),
    ).toBeInTheDocument();
  });
});
