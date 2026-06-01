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
const campId = "11111111-1111-1111-1111-111111111111";

vi.mock("next/navigation", () => ({
  useParams: () => ({ campId, sid: sessionIdFixture }),
}));

const { default: SessionDetailPage } = await import(
  "@/app/(jdr)/jdr/campaigns/[campId]/sessions/[sid]/page"
);

const baseSession = {
  id: sessionIdFixture,
  title: "Session 7 — La crypte oubliée",
  recorded_at: "2026-05-30T18:00:00",
  mode: "batch",
  state: "created",
  transcription_mode: "non_diarised",
  campaign_context: null,
  created_at: "2026-05-31T18:05:00",
  updated_at: "2026-05-31T18:05:00",
};

const baseCampaign = {
  id: campId,
  name: "Campagne par défaut",
  description: null,
  role: "gm",
  session_count: 1,
  last_session_at: null,
  created_at: "2026-01-12T18:00:00+00:00",
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

function stubFetch(opts: {
  session?: typeof baseSession;
  sessionStatus?: number;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes(`/services/jdr/campaigns/${campId}`)) {
        return new Response(JSON.stringify(baseCampaign), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes(`/services/jdr/sessions/${sessionIdFixture}`)) {
        if (opts.sessionStatus && opts.sessionStatus >= 400) {
          return new Response(
            JSON.stringify({
              type: "about:blank",
              title: "Not Found",
              status: opts.sessionStatus,
            }),
            {
              status: opts.sessionStatus,
              headers: { "content-type": "application/problem+json" },
            },
          );
        }
        return new Response(JSON.stringify(opts.session ?? baseSession), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(null, { status: 200 });
    }),
  );
}

describe("/jdr/campaigns/[campId]/sessions/[sid] page", () => {
  test("renders the FantasyLoader while pending", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    renderPage();
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  test("renders the session title + state badge once fetched", async () => {
    stubFetch({});
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
    stubFetch({});
    renderPage();
    const uploadCta = await screen.findByRole("button", {
      name: "Uploader l'audio de la séance",
    });
    expect(uploadCta).toBeDisabled();
    expect(uploadCta.getAttribute("title")).toMatch(/Epic 3/);
  });

  test("swaps the CTA to 'Lire l'audio' (disabled) once state >= audio_uploaded", async () => {
    stubFetch({ session: { ...baseSession, state: "audio_uploaded" } });
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

  test("renders the CampaignBreadcrumb link to the parent campaign", async () => {
    stubFetch({});
    renderPage();
    const breadcrumbLink = await screen.findByRole("link", {
      name: /Campagne par défaut/,
    });
    expect(breadcrumbLink).toHaveAttribute(
      "href",
      `/jdr/campaigns/${campId}`,
    );
  });

  test("never exposes the session UUID anywhere in the visible DOM text", async () => {
    stubFetch({});
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText(sessionIdFixture)).not.toBeInTheDocument();
  });

  test("parses naive backend recorded_at as UTC (regression guard for BD-5 TZ bug)", async () => {
    stubFetch({});
    renderPage();
    const timeEl = await screen.findByText(
      (_, node) => node?.tagName.toLowerCase() === "time",
    );
    expect(timeEl.getAttribute("datetime")).toBe("2026-05-30T18:00:00");
  });

  test("surfaces 'Session introuvable.' on session error", async () => {
    stubFetch({ sessionStatus: 404 });
    renderPage();
    expect(
      await screen.findByText("Session introuvable."),
    ).toBeInTheDocument();
  });
});
