// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from "vitest";
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

const { CampaignBreadcrumb } = await import(
  "@/components/jdr/campaigns/CampaignBreadcrumb"
);

const campaignId = "11111111-1111-1111-1111-111111111111";

function renderBreadcrumb() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <CampaignBreadcrumb campaignId={campaignId} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("<CampaignBreadcrumb>", () => {
  test("renders the link to /jdr/campaigns/{id} regardless of fetch state", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    renderBreadcrumb();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", `/jdr/campaigns/${campaignId}`);
  });

  test("renders a skeleton placeholder while the campaign name is pending", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    renderBreadcrumb();
    expect(screen.getByText("...")).toBeInTheDocument();
  });

  test("renders the campaign name once the query succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: campaignId,
            name: "Les Royaumes Brisés",
            description: null,
            role: "gm",
            session_count: 0,
            last_session_at: null,
            created_at: "2026-01-12T18:00:00+00:00",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    renderBreadcrumb();
    expect(
      await screen.findByText("Les Royaumes Brisés"),
    ).toBeInTheDocument();
  });

  test("renders a 'Campagne introuvable' fallback when the GET fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ type: "about:blank", title: "Not Found", status: 404 }),
          { status: 404, headers: { "content-type": "application/problem+json" } },
        ),
      ),
    );
    renderBreadcrumb();
    expect(
      await screen.findByText("Campagne introuvable"),
    ).toBeInTheDocument();
  });
});
