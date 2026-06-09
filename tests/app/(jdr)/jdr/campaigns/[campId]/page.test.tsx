// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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
  role: "gm" as "gm" | "pj",
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
  sessionsStatus?: number;
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
        if (opts.sessionsStatus && opts.sessionsStatus >= 400) {
          return new Response(
            JSON.stringify({
              type: "about:blank",
              title: "Internal Server Error",
              status: opts.sessionsStatus,
            }),
            {
              status: opts.sessionsStatus,
              headers: { "content-type": "application/problem+json" },
            },
          );
        }
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

  test("renders the header with name, description, meta + Modifier + Supprimer for GM", async () => {
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
    expect(
      screen.getByRole("button", { name: "Modifier" }),
    ).not.toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Supprimer" }),
    ).not.toBeDisabled();
  });

  // Story 4.8 (C5): the create-session CTA lives on the Sessions section header,
  // not the campaign header — one single primary affordance (empty-state aside).
  test("places the 'Nouvelle session' button within the Sessions section for GM", async () => {
    stubFetch({ sessions: [session1] });
    renderPage();
    await screen.findByRole("heading", {
      level: 1,
      name: "Les Royaumes Brisés",
    });
    const sessionsRegion = screen.getByRole("region", { name: "Sessions" });
    expect(
      within(sessionsRegion).getByRole("button", { name: "Nouvelle session" }),
    ).toBeInTheDocument();
    // No duplicate: exactly one create CTA on the page when sessions exist.
    expect(
      screen.getAllByRole("button", { name: "Nouvelle session" }),
    ).toHaveLength(1);
  });

  test("hides Modifier and Supprimer buttons for a player campaign role", async () => {
    stubFetch({
      campaign: { ...campaign, role: "pj", session_count: 0 },
      sessions: [],
    });
    renderPage();
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Modifier" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Supprimer" }),
    ).not.toBeInTheDocument();
  });

  test("clicking Modifier opens the edit dialog with the campaign name pre-filled", async () => {
    stubFetch({ sessions: [session1] });
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { level: 1, name: campaign.name });
    await user.click(screen.getByRole("button", { name: "Modifier" }));
    expect(
      await screen.findByRole("heading", { name: "Modifier la campagne" }),
    ).toBeInTheDocument();
    expect((screen.getByLabelText("Nom") as HTMLInputElement).value).toBe(
      campaign.name,
    );
  });

  test("clicking Supprimer opens the delete confirmation dialog", async () => {
    stubFetch({ sessions: [session1] });
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { level: 1, name: campaign.name });
    await user.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(
      await screen.findByRole("heading", {
        name: `Supprimer ${campaign.name} ?`,
      }),
    ).toBeInTheDocument();
  });

  test("does NOT render the placeholder 'Contexte de campagne / Story 2.9' aside anymore", async () => {
    stubFetch({ sessions: [session1] });
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText(/Story 2\.9/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Contexte de campagne/i }),
    ).not.toBeInTheDocument();
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

  test("renders a sessions error instead of the empty state when the scoped list fails", async () => {
    stubFetch({ sessionsStatus: 500 });
    renderPage();
    expect(
      await screen.findByText(
        "Les sessions de cette campagne n'ont pas pu être chargées.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        level: 2,
        name: "Aucune session dans cette campagne.",
      }),
    ).not.toBeInTheDocument();
  });

  test("hides create-session actions for a player campaign role", async () => {
    stubFetch({
      campaign: { ...campaign, role: "pj", session_count: 0 },
      sessions: [],
    });
    renderPage();
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Nouvelle session" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Les sessions créées par le MJ apparaîtront ici."),
    ).toBeInTheDocument();
  });

  test("renders sessions ordered by recorded_at desc", async () => {
    stubFetch({ sessions: [session2, session1] });
    renderPage();
    const titles = await screen.findAllByRole("heading", { level: 3 });
    expect(titles[0]).toHaveTextContent("Session 12 — La cité engloutie");
    expect(titles[1]).toHaveTextContent("Session 11 — Le pacte rompu");
  });

  test("no longer renders the legacy PJs placeholder text", async () => {
    stubFetch({ sessions: [session1] });
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(
      screen.queryByText("Les PJs liés à cette campagne arrivent bientôt."),
    ).not.toBeInTheDocument();
  });

  test("renders the <CampaignPjsCard> with its 'PJs' heading", async () => {
    stubFetch({ sessions: [session1] });
    renderPage();
    expect(
      await screen.findByRole("heading", { level: 2, name: "PJs" }),
    ).toBeInTheDocument();
  });

  test("the Nouvelle session CTA navigates to /jdr/campaigns/[campId]/sessions/new", async () => {
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
