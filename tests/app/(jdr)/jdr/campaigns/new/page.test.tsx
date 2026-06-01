// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
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

const { default: NewCampaignPage } = await import(
  "@/app/(jdr)/jdr/campaigns/new/page"
);

const sampleCampaign = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Royaumes Brisés",
  description: null,
  role: "gm" as const,
  session_count: 0,
  last_session_at: null,
  created_at: "2026-05-31T18:05:00+00:00",
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <NewCampaignPage />
    </QueryClientProvider>,
  );
  return queryClient;
};

describe("/jdr/campaigns/new page", () => {
  test("renders the page header + the CampaignForm", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: "Nouvelle campagne" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nom")).toBeInTheDocument();
  });

  test("submits the form, POSTs to /campaigns, and redirects to /jdr/campaigns/{id}", async () => {
    pushMock.mockClear();
    const fetchMock = vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      const method =
        typeof input === "string" ? "GET" : (input.method ?? "GET");
      if (
        url.endsWith("/services/jdr/campaigns") &&
        method.toUpperCase() === "POST"
      ) {
        return new Response(JSON.stringify(sampleCampaign), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("Nom"), "Royaumes Brisés");
    await user.click(
      screen.getByRole("button", { name: "Créer la campagne" }),
    );
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        "/jdr/campaigns/11111111-1111-1111-1111-111111111111",
      );
    });
  });

  test("double submit while pending sends a single POST", async () => {
    pushMock.mockClear();
    let resolveCreate!: () => void;
    const createGate = new Promise<void>((resolve) => {
      resolveCreate = resolve;
    });
    const fetchMock = vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      const method =
        typeof input === "string" ? "GET" : (input.method ?? "GET");
      if (
        url.endsWith("/services/jdr/campaigns") &&
        method.toUpperCase() === "POST"
      ) {
        await createGate;
        return new Response(JSON.stringify(sampleCampaign), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("Nom"), "Royaumes Brisés");
    await user.dblClick(
      screen.getByRole("button", { name: "Créer la campagne" }),
    );

    const postCallsBeforeResolve = fetchMock.mock.calls.filter((args) => {
      const request = args[0] as Request;
      return (
        request.url.endsWith("/services/jdr/campaigns") &&
        request.method === "POST"
      );
    });
    expect(postCallsBeforeResolve).toHaveLength(1);

    resolveCreate();
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        "/jdr/campaigns/11111111-1111-1111-1111-111111111111",
      );
    });
  });

  test("Annuler redirects back to /jdr/campaigns", async () => {
    pushMock.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(pushMock).toHaveBeenCalledWith("/jdr/campaigns");
  });

  test("surfaces 'Tu as déjà une campagne avec ce nom' on duplicate 409", async () => {
    pushMock.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: "https://kaeyris.local/errors/duplicate-campaign",
            title: "Duplicate campaign name",
            status: 409,
          }),
          {
            status: 409,
            headers: { "content-type": "application/problem+json" },
          },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("Nom"), "Royaumes Brisés");
    await user.click(
      screen.getByRole("button", { name: "Créer la campagne" }),
    );
    expect(
      await screen.findByText(/Tu as déjà une campagne avec ce nom/i),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  test("surfaces a generic error message on 422", async () => {
    pushMock.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: "about:blank",
            title: "Validation Error",
            status: 422,
          }),
          {
            status: 422,
            headers: { "content-type": "application/problem+json" },
          },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("Nom"), "Royaumes Brisés");
    await user.click(
      screen.getByRole("button", { name: "Créer la campagne" }),
    );
    expect(
      await screen.findByText(/Création impossible/i),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
