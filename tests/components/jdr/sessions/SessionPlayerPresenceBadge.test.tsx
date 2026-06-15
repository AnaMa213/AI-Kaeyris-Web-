// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/core/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

const { SessionPlayerPresenceBadge } = await import(
  "@/components/jdr/sessions/SessionPlayerPresenceBadge"
);

const SESSION_ID = "00000000-0000-0000-0000-000000000abc";
const CAMP_ID = "11111111-1111-1111-1111-111111111111";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubFetch(opts: { pjIds: string[]; roster: Array<{ id: string; name: string }> }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes(`/services/jdr/sessions/${SESSION_ID}/players`)) {
        return json({ session_id: SESSION_ID, pj_ids: opts.pjIds });
      }
      if (url.includes("/services/jdr/pjs")) {
        return json({
          items: opts.roster.map((pj) => ({
            id: pj.id,
            name: pj.name,
            campaign_id: CAMP_ID,
            user_id: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          })),
          total: opts.roster.length,
          page: 1,
          size: 50,
        });
      }
      return json({});
    }),
  );
}

function renderBadge() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SessionPlayerPresenceBadge sessionId={SESSION_ID} campaignId={CAMP_ID} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("<SessionPlayerPresenceBadge> (Story 4.23 AC5)", () => {
  test("shows the player count and resolves the declared PJ names", async () => {
    stubFetch({
      pjIds: ["pj-1", "pj-2"],
      roster: [
        { id: "pj-1", name: "Kaelin" },
        { id: "pj-2", name: "Sora" },
      ],
    });
    renderBadge();
    const badge = await screen.findByLabelText(
      "2 joueurs déclarés : Kaelin, Sora",
    );
    expect(badge).toHaveTextContent("2");
  });

  test("renders nothing when no player is declared", async () => {
    stubFetch({ pjIds: [], roster: [] });
    const { container } = renderBadge();
    // Give the players query a tick to settle, then assert no badge rendered.
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  test("falls back to a placeholder for a pj_id absent from the roster", async () => {
    stubFetch({ pjIds: ["ghost"], roster: [] });
    renderBadge();
    expect(
      await screen.findByLabelText("1 joueur déclaré : PJ inconnu"),
    ).toBeInTheDocument();
  });
});
