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

vi.mock("@/lib/core/session/useCurrentUser", () => ({
  useCurrentUser: () => ({
    status: "authenticated" as const,
    auth: { authId: "kenan", username: "kenan", systemRole: "admin" as const },
    activeCampaign: {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Campagne par défaut",
      role: "gm" as const,
      characterId: "kenan-pc",
    },
  }),
}));

const { default: NewSessionPage } = await import(
  "@/app/(jdr)/jdr/sessions/new/page"
);

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <NewSessionPage />
    </QueryClientProvider>,
  );
  return queryClient;
};

const sampleSession = {
  id: "00000000-0000-0000-0000-000000000abc",
  title: "Session 7",
  recorded_at: "2026-05-31T18:00:00.000Z",
  mode: "batch",
  state: "created",
  transcription_mode: "non_diarised",
  campaign_context: null,
  created_at: "2026-05-31T18:05:00.000Z",
  updated_at: "2026-05-31T18:05:00.000Z",
};

describe("/jdr/sessions/new page", () => {
  test("renders the page header + the NewSessionForm", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: "Nouvelle session" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Titre")).toBeInTheDocument();
    expect(screen.getByLabelText("Date de la séance")).toBeInTheDocument();
  });

  test("submitting the form POSTs to /sessions and redirects to /jdr/sessions/{id}", async () => {
    pushMock.mockClear();
    const fetchMock = vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      const method =
        typeof input === "string" ? "GET" : (input.method ?? "GET");
      if (
        url.endsWith("/services/jdr/sessions") &&
        method.toUpperCase() === "POST"
      ) {
        return new Response(JSON.stringify(sampleSession), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("Titre"), "Session 7");
    await user.click(
      screen.getByRole("button", { name: "Créer la session" }),
    );

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        "/jdr/sessions/00000000-0000-0000-0000-000000000abc",
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
        url.endsWith("/services/jdr/sessions") &&
        method.toUpperCase() === "POST"
      ) {
        await createGate;
        return new Response(JSON.stringify(sampleSession), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("Titre"), "Session 7");
    await user.dblClick(
      screen.getByRole("button", { name: "Créer la session" }),
    );

    const postCallsBeforeResolve = fetchMock.mock.calls.filter((args) => {
      const request = args[0] as Request;
      return (
        request.url.endsWith("/services/jdr/sessions") &&
        request.method === "POST"
      );
    });
    expect(postCallsBeforeResolve).toHaveLength(1);

    resolveCreate();
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        "/jdr/sessions/00000000-0000-0000-0000-000000000abc",
      );
    });
  });

  test("Annuler redirects back to /jdr/sessions", async () => {
    pushMock.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(pushMock).toHaveBeenCalledWith("/jdr/sessions");
  });

  test("surfaces a generic error when the POST fails", async () => {
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
    await user.type(screen.getByLabelText("Titre"), "Session 7");
    await user.click(
      screen.getByRole("button", { name: "Créer la session" }),
    );

    expect(
      await screen.findByText(/Création impossible/i),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
