// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

const { CampaignPjsCard } = await import(
  "@/components/jdr/campaigns/CampaignPjsCard"
);

const CAMPAIGN_ID = "11111111-1111-1111-1111-111111111111";

const sampleCampaign = {
  id: CAMPAIGN_ID,
  name: "Les Royaumes Brisés",
  description: null,
  role: "gm" as "gm" | "pj",
  session_count: 2,
  last_session_at: null,
  created_at: "2026-01-12T18:00:00+00:00",
};

const aragorn = {
  id: "pj-aragorn",
  name: "Aragorn",
  campaign_id: CAMPAIGN_ID,
  created_at: "2026-05-30T10:00:00Z",
};

const legolas = {
  id: "pj-legolas",
  name: "Legolas",
  campaign_id: CAMPAIGN_ID,
  created_at: "2026-05-29T10:00:00Z",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubFetch(opts: {
  pjs?: Array<typeof aragorn>;
  pjsStatus?: number;
  pjsPending?: boolean;
}) {
  if (opts.pjsPending) {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    return;
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/services/jdr/pjs")) {
        if (opts.pjsStatus && opts.pjsStatus >= 400) {
          return new Response(
            JSON.stringify({
              type: "about:blank",
              title: "Server error",
              status: opts.pjsStatus,
            }),
            {
              status: opts.pjsStatus,
              headers: { "content-type": "application/problem+json" },
            },
          );
        }
        return new Response(
          JSON.stringify({
            items: opts.pjs ?? [],
            total: opts.pjs?.length ?? 0,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }
      return new Response(null, { status: 200 });
    }),
  );
}

function renderCard(campaign: typeof sampleCampaign = sampleCampaign) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <CampaignPjsCard campaign={campaign} />
    </QueryClientProvider>,
  );
}

describe("<CampaignPjsCard>", () => {
  test("renders the loading state while fetching", () => {
    stubFetch({ pjsPending: true });
    renderCard();
    expect(screen.getByText(/Chargement des PJs/)).toBeInTheDocument();
  });

  test("renders an error banner on a backend error", async () => {
    stubFetch({ pjsStatus: 500 });
    renderCard();
    expect(
      await screen.findByText(
        /Les PJs de cette campagne n'ont pas pu être chargés\./,
      ),
    ).toBeInTheDocument();
  });

  test("renders the EmptyState with CTA for a GM with no PJ", async () => {
    stubFetch({ pjs: [] });
    renderCard();
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Aucun PJ dans cette campagne.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Ajouter un PJ" }).length,
    ).toBeGreaterThan(0);
  });

  test("renders a quiet read-only message for a PJ user with no PJ", async () => {
    stubFetch({ pjs: [] });
    renderCard({ ...sampleCampaign, role: "pj" });
    expect(
      await screen.findByText(/Aucun PJ dans cette campagne pour le moment\./),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ajouter un PJ" }),
    ).not.toBeInTheDocument();
  });

  test("renders names + Supprimer buttons for a GM with PJs", async () => {
    stubFetch({ pjs: [aragorn, legolas] });
    renderCard();
    expect(await screen.findByText("Aragorn")).toBeInTheDocument();
    expect(screen.getByText("Legolas")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Supprimer le PJ Aragorn" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Supprimer le PJ Legolas" }),
    ).toBeInTheDocument();
  });

  test("renders names WITHOUT Supprimer buttons for a PJ user", async () => {
    stubFetch({ pjs: [aragorn] });
    renderCard({ ...sampleCampaign, role: "pj" });
    expect(await screen.findByText("Aragorn")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Supprimer le PJ/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ajouter un PJ" }),
    ).not.toBeInTheDocument();
  });

  test("clicking the header Ajouter button opens the PjForm dialog", async () => {
    stubFetch({ pjs: [aragorn] });
    const user = userEvent.setup();
    renderCard();
    await screen.findByText("Aragorn");
    await user.click(screen.getByRole("button", { name: "Ajouter un PJ" }));
    expect(
      await screen.findByRole("heading", { name: "Nouveau PJ" }),
    ).toBeInTheDocument();
  });

  test("clicking a row Supprimer button opens the PjDeleteConfirm dialog", async () => {
    stubFetch({ pjs: [aragorn] });
    const user = userEvent.setup();
    renderCard();
    await user.click(
      await screen.findByRole("button", { name: "Supprimer le PJ Aragorn" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Supprimer Aragorn ?" }),
    ).toBeInTheDocument();
  });
});
