// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from "vitest";
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

const alice = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  username: "alice",
  system_role: "user" as const,
  status: "active" as const,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  last_login_at: null,
};

const aragorn = {
  id: "pj-aragorn",
  name: "Aragorn",
  campaign_id: CAMPAIGN_ID,
  created_at: "2026-05-30T10:00:00Z",
  user_id: null as string | null,
};

const legolas = {
  id: "pj-legolas",
  name: "Legolas",
  campaign_id: CAMPAIGN_ID,
  created_at: "2026-05-29T10:00:00Z",
  user_id: alice.id as string | null,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubFetch(opts: {
  pjs?: Array<typeof aragorn>;
  pjsStatus?: number;
  pjsPending?: boolean;
  users?: Array<typeof alice>;
}) {
  if (opts.pjsPending) {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    return;
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      const method =
        typeof input === "string" ? "GET" : (input.method ?? "GET");
      const upper = method.toUpperCase();
      if (url.includes("/services/jdr/users")) {
        return new Response(
          JSON.stringify({
            items: opts.users ?? [alice],
            total: (opts.users ?? [alice]).length,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      // PATCH /services/jdr/pjs/{id} — return the updated PjOut.
      if (url.includes("/services/jdr/pjs/") && upper === "PATCH") {
        const body = (await (input as Request).clone().json()) as {
          name?: string;
          user_id?: string | null;
        };
        return new Response(
          JSON.stringify({
            ...aragorn,
            ...body,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
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
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    expect(
      fetchMock.mock.calls.some((args) => {
        const input = args[0] as Request | string;
        const url = typeof input === "string" ? input : input.url;
        return url.includes("/services/jdr/users");
      }),
    ).toBe(false);
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

  test("does NOT render the stray Mock chip (C2)", async () => {
    stubFetch({ pjs: [aragorn] });
    renderCard();
    await screen.findByText("Aragorn");
    expect(screen.queryByText("Mock")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/suppression d'un PJ est encore mockée/i),
    ).not.toBeInTheDocument();
  });

  test("shows the link state in each row (linked username / Non lié)", async () => {
    stubFetch({ pjs: [aragorn, legolas], users: [alice] });
    renderCard();
    // legolas is linked to alice, aragorn is unlinked.
    expect(await screen.findByText(/Joueur : @alice/)).toBeInTheDocument();
    expect(screen.getByText(/Non lié/)).toBeInTheDocument();
  });

  test("clicking a row Éditer button opens the edit dialog prefilled", async () => {
    stubFetch({ pjs: [legolas], users: [alice] });
    const user = userEvent.setup();
    renderCard();
    await user.click(
      await screen.findByRole("button", { name: "Éditer le PJ Legolas" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Modifier le PJ" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nom du PJ")).toHaveValue("Legolas");
    expect(
      (screen.getByLabelText("Joueur lié") as HTMLSelectElement).value,
    ).toBe(alice.id);
  });

  test("submitting the edit dialog PATCHes the PJ and closes", async () => {
    stubFetch({ pjs: [aragorn], users: [alice] });
    const user = userEvent.setup();
    renderCard();
    await user.click(
      await screen.findByRole("button", { name: "Éditer le PJ Aragorn" }),
    );
    await screen.findByRole("heading", { name: "Modifier le PJ" });
    await user.selectOptions(screen.getByLabelText("Joueur lié"), alice.id);
    await user.click(screen.getByRole("button", { name: "Mettre à jour" }));

    await waitFor(() => {
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      const patched = fetchMock.mock.calls.some((args) => {
        const request = args[0] as Request;
        return (
          request.url.includes("/services/jdr/pjs/") &&
          request.method === "PATCH"
        );
      });
      expect(patched).toBe(true);
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Modifier le PJ" }),
      ).not.toBeInTheDocument(),
    );
  });
});
