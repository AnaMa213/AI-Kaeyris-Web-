// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const SESSION_ID = "00000000-0000-0000-0000-000000000abc";

vi.mock("@/lib/core/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ sid: SESSION_ID }),
}));

const MySessionReadPage = (
  await import("@/app/(player)/me/sessions/[sid]/page")
).default;

function stub(opts: { summaryStatus?: number } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/summary")) {
        if (opts.summaryStatus && opts.summaryStatus >= 400) {
          return new Response(
            JSON.stringify({ type: "about:blank", title: "absent", status: opts.summaryStatus }),
            { status: opts.summaryStatus, headers: { "content-type": "application/problem+json" } },
          );
        }
        return new Response(
          JSON.stringify({ session_id: SESSION_ID, text: "Mon résumé de joueur.", model_used: "x", generated_at: "2026-06-01T10:00:00Z" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      // narrative / elements / pov — not asserted here
      return new Response(
        JSON.stringify({ session_id: SESSION_ID, text: "", elements: [], model_used: "x", generated_at: "2026-06-01T10:00:00Z" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }),
  );
}

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MySessionReadPage />
    </QueryClientProvider>,
  );
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("player session read page (Story 8.4)", () => {
  test("shows the 4 read sections and the summary, with no write affordances", async () => {
    stub();
    renderPage();
    expect(screen.getByRole("tab", { name: "Résumé" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Récit" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Éléments" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Mon POV" })).toBeInTheDocument();

    expect(
      await screen.findByText("Mon résumé de joueur."),
    ).toBeInTheDocument();

    // Read-only: no edit / generate / regenerate affordance anywhere.
    expect(
      screen.queryByRole("button", { name: /Modifier|Générer|Régénérer/i }),
    ).not.toBeInTheDocument();
  });

  test("an absent summary shows a calm placeholder, not an error", async () => {
    stub({ summaryStatus: 404 });
    renderPage();
    expect(
      await screen.findByText(/pas encore disponible/i),
    ).toBeInTheDocument();
  });
});
