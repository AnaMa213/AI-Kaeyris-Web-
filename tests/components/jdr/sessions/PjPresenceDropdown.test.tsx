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

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccessMock(...a),
    error: (...a: unknown[]) => toastErrorMock(...a),
  },
}));

const { PjPresenceDropdown } = await import(
  "@/components/jdr/sessions/PjPresenceDropdown"
);

const SESSION_ID = "00000000-0000-0000-0000-000000000abc";
const CAMPAIGN_ID = "11111111-1111-1111-1111-111111111111";

const roster = [
  { id: "pj-1", name: "Eldrin", campaign_id: CAMPAIGN_ID, created_at: "2026-05-30T10:00:00Z" },
  { id: "pj-2", name: "Galadriel", campaign_id: CAMPAIGN_ID, created_at: "2026-05-30T11:00:00Z" },
];

function stub(opts: { roster?: typeof roster; declared?: string[]; postStatus?: number } = {}) {
  const postBodies: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      const method = typeof input === "string" ? "GET" : (input.method ?? "GET");
      if (url.includes("/services/jdr/pjs")) {
        return new Response(
          JSON.stringify({ items: opts.roster ?? roster, total: (opts.roster ?? roster).length }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes(`/sessions/${SESSION_ID}/players`) && method.toUpperCase() === "POST") {
        const body = JSON.parse((await (input as Request).clone().text()) || "{}");
        postBodies.push(body);
        if (opts.postStatus && opts.postStatus >= 400) {
          return new Response(JSON.stringify({ type: "about:blank", title: "Boom", status: opts.postStatus }), {
            status: opts.postStatus,
            headers: { "content-type": "application/problem+json" },
          });
        }
        return new Response(JSON.stringify({ session_id: SESSION_ID, pj_ids: body.pj_ids, updated_at: "2026-06-01T10:00:00Z" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes(`/sessions/${SESSION_ID}/players`)) {
        return new Response(
          JSON.stringify({ session_id: SESSION_ID, pj_ids: opts.declared ?? [], updated_at: "2026-06-01T10:00:00Z" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(null, { status: 200 });
    }),
  );
  return { postBodies };
}

const renderDropdown = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <PjPresenceDropdown sessionId={SESSION_ID} campaignId={CAMPAIGN_ID} />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  toastSuccessMock.mockClear();
  toastErrorMock.mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("<PjPresenceDropdown> (Story 4.7 S6)", () => {
  test("opens to a checkbox item per roster PJ, pre-checking declared ones", async () => {
    stub({ declared: ["pj-1"] });
    const user = userEvent.setup();
    renderDropdown();
    await user.click(
      await screen.findByRole("button", { name: /Qui était présent/i }),
    );
    const eldrin = await screen.findByRole("menuitemcheckbox", {
      name: "Eldrin",
    });
    const galadriel = screen.getByRole("menuitemcheckbox", {
      name: "Galadriel",
    });
    expect(eldrin).toHaveAttribute("aria-checked", "true");
    expect(galadriel).toHaveAttribute("aria-checked", "false");
  });

  test("submits the FULL selected set (replacement, not delta)", async () => {
    const { postBodies } = stub({ declared: ["pj-1"] });
    const user = userEvent.setup();
    renderDropdown();
    await user.click(
      await screen.findByRole("button", { name: /Qui était présent/i }),
    );
    await screen.findByRole("menuitemcheckbox", { name: "Eldrin" });
    // uncheck Eldrin, check Galadriel → full set must be ["pj-2"]; menu stays open
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Eldrin" }));
    await user.click(
      screen.getByRole("menuitemcheckbox", { name: "Galadriel" }),
    );
    await user.click(screen.getByRole("button", { name: /Enregistrer/i }));
    await waitFor(() => expect(postBodies.length).toBe(1));
    expect(postBodies[0]).toEqual({ pj_ids: ["pj-2"] });
    expect(toastSuccessMock).toHaveBeenCalled();
  });

  test("empty roster → hint to add PJs, no save button", async () => {
    stub({ roster: [], declared: [] });
    const user = userEvent.setup();
    renderDropdown();
    await user.click(
      await screen.findByRole("button", { name: /Qui était présent/i }),
    );
    expect(
      await screen.findByText(/Ajoute d'abord des PJs/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Enregistrer/i }),
    ).not.toBeInTheDocument();
  });

  test("save is disabled when the selection is empty", async () => {
    const { postBodies } = stub({ declared: ["pj-1"] });
    const user = userEvent.setup();
    renderDropdown();
    await user.click(
      await screen.findByRole("button", { name: /Qui était présent/i }),
    );
    await user.click(
      await screen.findByRole("menuitemcheckbox", { name: "Eldrin" }),
    );
    expect(screen.getByRole("button", { name: /Enregistrer/i })).toBeDisabled();
    expect(postBodies).toHaveLength(0);
  });

  test("surfaces an error toast when the POST fails", async () => {
    stub({ declared: [], postStatus: 500 });
    const user = userEvent.setup();
    renderDropdown();
    await user.click(
      await screen.findByRole("button", { name: /Qui était présent/i }),
    );
    await user.click(
      await screen.findByRole("menuitemcheckbox", { name: "Eldrin" }),
    );
    await user.click(screen.getByRole("button", { name: /Enregistrer/i }));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
  });
});
