// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
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

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const { default: LauncherPage } = await import("@/app/(launcher)/page");
const { SESSION_QUERY_KEY } = await import(
  "@/lib/core/session/SessionProvider"
);

function renderWith(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <LauncherPage />
    </QueryClientProvider>,
  );
}

describe("<LauncherPage>", () => {
  test("renders the FantasyLoader while session resolves", () => {
    pushMock.mockClear();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    renderWith(client);
    expect(screen.getByText(/Ouverture du grimoire/i)).toBeInTheDocument();
  });

  test("redirects to /jdr/sessions once authenticated cache is hydrated", async () => {
    pushMock.mockClear();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(SESSION_QUERY_KEY, {
      user: { id: "kenan", username: "Kenan" },
      active_campaign: {
        id: "campaign-default",
        name: "Campagne par défaut",
        role: "gm",
        character_id: "kenan-pc",
      },
    });
    renderWith(client);
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/jdr/sessions"),
    );
  });
});
