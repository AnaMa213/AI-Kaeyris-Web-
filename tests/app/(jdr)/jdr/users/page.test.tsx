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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const { default: UsersPage } = await import("@/app/(jdr)/jdr/users/page");

const sampleUser = {
  id: "u-1",
  username: "alice",
  system_role: "user" as const,
  status: "active" as const,
  created_at: "2026-05-29T10:00:00Z",
  updated_at: "2026-05-29T10:00:00Z",
  last_login_at: null,
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <UsersPage />
    </QueryClientProvider>,
  );
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("<UsersPage>", () => {
  test("shows the FantasyLoader while loading", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderPage();
    expect(
      screen.getByLabelText("Consultation du grimoire des comptes..."),
    ).toBeInTheDocument();
  });

  test("shows the empty state when the user list is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    renderPage();
    expect(await screen.findByText("Aucun compte créé")).toBeInTheDocument();
    expect(
      screen.getByText("Tu es seul à régner sur le grimoire."),
    ).toBeInTheDocument();
  });

  test("renders the UsersTable when users are returned", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ items: [sampleUser] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    renderPage();
    expect(await screen.findByText("alice")).toBeInTheDocument();
    expect(screen.getByText("Utilisateur")).toBeInTheDocument();
  });
});
