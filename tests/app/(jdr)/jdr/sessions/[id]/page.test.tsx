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

const baseSession = {
  id: sessionIdFixture,
  title: "Session 7 — La crypte oubliée",
  // naive backend timestamp on purpose: exercises parseBackendDate.
  recorded_at: "2026-05-30T18:00:00",
  mode: "batch",
  state: "created",
  transcription_mode: "non_diarised",
  campaign_context: null,
  created_at: "2026-05-31T18:05:00",
  updated_at: "2026-05-31T18:05:00",
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

function stubFetch(session: typeof baseSession) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(session), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
}

describe("/jdr/sessions/[id] page", () => {
  test("renders the FantasyLoader while pending", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    renderPage();
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  test("renders the session title + state badge once fetched", async () => {
    stubFetch(baseSession);
    renderPage();
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Session 7 — La crypte oubliée",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Créée")).toBeInTheDocument();
  });

  test("shows the 'Uploader l'audio' CTA disabled when state is 'created'", async () => {
    stubFetch(baseSession);
    renderPage();
    const uploadCta = await screen.findByRole("button", {
      name: "Uploader l'audio de la séance",
    });
    expect(uploadCta).toBeDisabled();
    expect(uploadCta.getAttribute("title")).toMatch(/Epic 3/);
  });

  test("swaps the CTA to 'Lire l'audio' (disabled) once state >= audio_uploaded", async () => {
    stubFetch({ ...baseSession, state: "audio_uploaded" });
    renderPage();
    const playCta = await screen.findByRole("button", {
      name: "Lire l'audio de la séance",
    });
    expect(playCta).toBeDisabled();
    expect(playCta.getAttribute("title")).toMatch(/Epic 3/);
    expect(
      screen.queryByRole("button", { name: "Uploader l'audio de la séance" }),
    ).not.toBeInTheDocument();
  });

  test("never exposes the session UUID anywhere in the visible DOM text", async () => {
    stubFetch(baseSession);
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText(sessionIdFixture)).not.toBeInTheDocument();
  });

  test("parses naive backend recorded_at as UTC (regression guard for BD-5 TZ bug)", async () => {
    // recorded_at "2026-05-30T18:00:00" should be parsed as 18:00 UTC,
    // NOT as 18:00 local. We assert via the <time dateTime> attribute,
    // which echoes the raw backend value.
    stubFetch(baseSession);
    renderPage();
    const timeEl = await screen.findByText(
      (_, node) => node?.tagName.toLowerCase() === "time",
    );
    expect(timeEl.getAttribute("datetime")).toBe("2026-05-30T18:00:00");
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
