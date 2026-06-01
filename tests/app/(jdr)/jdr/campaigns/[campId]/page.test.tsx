// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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

const pushMock = vi.fn();
const campId = "11111111-1111-1111-1111-111111111111";
vi.mock("next/navigation", () => ({
  useParams: () => ({ campId }),
  useRouter: () => ({ push: pushMock }),
}));

const { default: CampaignDetailPage } = await import(
  "@/app/(jdr)/jdr/campaigns/[campId]/page"
);

const campaign = {
  id: campId,
  name: "Les Royaumes Brisés",
  description: "Une trahison ancienne.",
  role: "gm" as const,
  session_count: 2,
  last_session_at: "2026-05-30T20:00:00+00:00",
  created_at: "2026-01-12T18:00:00+00:00",
};

const session1 = {
  id: "ses-1",
  title: "Session 12 — La cité engloutie",
  recorded_at: "2026-05-30T20:00:00+00:00",
  mode: "batch" as const,
  state: "created" as const,
  transcription_mode: "non_diarised" as const,
  campaign_context: null,
  created_at: "2026-05-30T20:00:00+00:00",
  updated_at: "2026-05-30T20:00:00+00:00",
};

const session2 = {
  id: "ses-2",
  title: "Session 11 — Le pacte rompu",
  recorded_at: "2026-05-24T20:00:00+00:00",
  mode: "batch" as const,
  state: "transcribed" as const,
  transcription_mode: "non_diarised" as const,
  campaign_context: null,
  created_at: "2026-05-24T20:00:00+00:00",
  updated_at: "2026-05-24T20:00:00+00:00",
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <CampaignDetailPage />
    </QueryClientProvider>,
  );
}

function stubFetch(opts: {
  campaign?: typeof campaign;
  sessions?: Array<Record<string, unknown>>;
  campaignStatus?: number;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      if (
        url.includes(`/services/jdr/campaigns/${campId}`) &&
        !url.includes("?")
      ) {
        if (opts.campaignStatus && opts.campaignStatus >= 400) {
          return new Response(
            JSON.stringify({
              type: "about:blank",
              title: "Not Found",
              status: opts.campaignStatus,
            }),
            {
              status: opts.campaignStatus,
              headers: { "content-type": "application/problem+json" },
            },
          );
        }
        return new Response(JSON.stringify(opts.campaign ?? campaign), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/services/jdr/sessions")) {
        return new Response(
          JSON.stringify({
            items: opts.sessions ?? [],
            total: opts.sessions?.length ?? 0,
            page: 1,
            size: 50,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(null, { status: 200 });
    }),
  );
}

beforeEach(() => {
  pushMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("/jdr/campaigns/[campId] page", () => {
  test("renders the FantasyLoader while pending", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    renderPage();
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  test("renders the error banner on 404", async () => {
    stubFetch({ campaignStatus: 404 });
    renderPage();
    expect(
      await screen.findByText("Campagne introuvable."),
    ).toBeInTheDocument();
  });

  test("renders the header with name, description, meta + Modifier + Nouvelle session buttons", async () => {
    stubFetch({ sessions: [session1] });
    renderPage();
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Les Royaumes Brisés",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Une trahison ancienne.")).toBeInTheDocument();
    expect(screen.getByText(/sessions · démarrée le/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Modifier" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Nouvelle session" }),
    ).toBeInTheDocument();
  });

  test("renders the EmptyState when no sessions are returned", async () => {
    stubFetch({ sessions: [] });
    renderPage();
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Aucune session dans cette campagne.",
      }),
    ).toBeInTheDocument();
  });

  test("renders sessions ordered by recorded_at desc", async () => {
    stubFetch({ sessions: [session2, session1] });
    renderPage();
    const titles = await screen.findAllByRole("heading", { level: 3 });
    expect(titles[0]).toHaveTextContent("Session 12 — La cité engloutie");
    expect(titles[1]).toHaveTextContent("Session 11 — Le pacte rompu");
  });

  test("renders the PJs placeholder text", async () => {
    stubFetch({ sessions: [session1] });
    renderPage();
    expect(
      await screen.findByText(
        "Les PJs liés à cette campagne arrivent bientôt.",
      ),
    ).toBeInTheDocument();
  });

  test("header CTA navigates to /jdr/campaigns/[campId]/sessions/new", async () => {
    stubFetch({ sessions: [session1] });
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    await user.click(
      screen.getByRole("button", { name: "Nouvelle session" }),
    );
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        `/jdr/campaigns/${campId}/sessions/new`,
      ),
    );
  });

  test("clicking a session row navigates to /jdr/campaigns/[campId]/sessions/[sid]", async () => {
    stubFetch({ sessions: [session1] });
    renderPage();
    const link = await screen.findByRole("link", {
      name: /Session 12/,
    });
    expect(link).toHaveAttribute(
      "href",
      `/jdr/campaigns/${campId}/sessions/${session1.id}`,
    );
  });

  test("never exposes the campaign UUID anywhere in the visible DOM text", async () => {
    stubFetch({ sessions: [session1] });
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText(campId)).not.toBeInTheDocument();
  });
});
