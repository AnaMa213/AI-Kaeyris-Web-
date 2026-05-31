// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
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

const sessionIdFixture = "00000000-0000-0000-0000-000000000abc";
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: sessionIdFixture }),
}));

const { default: SessionDetailPage } = await import(
  "@/app/(jdr)/jdr/sessions/[id]/page"
);

const sampleSession = {
  id: sessionIdFixture,
  title: "Session 7 — La crypte oubliée",
  recorded_at: "2026-05-30T18:00:00.000Z",
  mode: "batch",
  state: "created",
  transcription_mode: "non_diarised",
  campaign_context: null,
  created_at: "2026-05-31T18:05:00.000Z",
  updated_at: "2026-05-31T18:05:00.000Z",
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <SessionDetailPage />
    </QueryClientProvider>,
  );
  return queryClient;
};

describe("/jdr/sessions/[id] stub page", () => {
  test("renders the FantasyLoader while pending", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    renderPage();
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  test("renders the session title + state badge once fetched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(sampleSession), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    renderPage();
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Session 7 — La crypte oubliée",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Créée")).toBeInTheDocument();
  });

  test("renders the Audio + Transcription EmptyState placeholders with disabled CTAs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(sampleSession), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    renderPage();
    expect(
      await screen.findByText("Aucun audio uploadé"),
    ).toBeInTheDocument();
    expect(screen.getByText("En attente d'audio")).toBeInTheDocument();

    const uploadCta = screen.getByRole("button", { name: "Uploader" });
    expect(uploadCta).toBeDisabled();
    expect(uploadCta.getAttribute("title")).toMatch(/Epic 3/);

    const transcriptionCta = screen.getByRole("button", {
      name: "Voir la transcription",
    });
    expect(transcriptionCta).toBeDisabled();
  });

  test("never exposes the session UUID anywhere in the visible DOM text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(sampleSession), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText(sessionIdFixture)).not.toBeInTheDocument();
  });

  test("surfaces 'Session introuvable.' on error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: "about:blank",
            title: "Not Found",
            status: 404,
          }),
          {
            status: 404,
            headers: { "content-type": "application/problem+json" },
          },
        ),
      ),
    );
    renderPage();
    expect(
      await screen.findByText("Session introuvable."),
    ).toBeInTheDocument();
  });
});
