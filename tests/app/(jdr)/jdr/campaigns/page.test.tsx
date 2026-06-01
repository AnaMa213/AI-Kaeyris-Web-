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
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const { default: CampaignsPage } = await import(
  "@/app/(jdr)/jdr/campaigns/page"
);

const sampleCampaign = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Les Royaumes Brisés",
  description: null,
  role: "gm" as const,
  session_count: 0,
  last_session_at: null,
  created_at: "2026-01-12T18:00:00+00:00",
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <CampaignsPage />
    </QueryClientProvider>,
  );
  return queryClient;
};

beforeEach(() => {
  pushMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("/jdr/campaigns page", () => {
  test("renders the FantasyLoader while pending", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    renderPage();
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  test("renders the EmptyState when items is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ items: [], total: 0, page: 1, size: 50 }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    renderPage();
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Aucune campagne encore.",
      }),
    ).toBeInTheDocument();
  });

  test("renders the list of campaigns when items are present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [sampleCampaign],
            total: 1,
            page: 1,
            size: 50,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    renderPage();
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Les Royaumes Brisés",
      }),
    ).toBeInTheDocument();
  });

  test("renders an error banner on 5xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: "about:blank",
            title: "Server error",
            status: 500,
          }),
          { status: 500, headers: { "content-type": "application/problem+json" } },
        ),
      ),
    );
    renderPage();
    expect(
      await screen.findByText("Impossible de charger les campagnes."),
    ).toBeInTheDocument();
  });

  test("header CTA navigates to /jdr/campaigns/new", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ items: [], total: 0, page: 1, size: 50 }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", {
      level: 2,
      name: "Aucune campagne encore.",
    });
    // Both the header and EmptyState render a "Nouvelle campagne" CTA — pick the
    // header (first in DOM) to assert routing from the page chrome itself.
    const buttons = screen.getAllByRole("button", { name: "Nouvelle campagne" });
    await user.click(buttons[0]);
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/jdr/campaigns/new"),
    );
  });
});
