// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AuthMeResponse } from "@/lib/core/session/types";

vi.mock("@/lib/core/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

const authMeResponse: AuthMeResponse = {
  user: { id: "kenan-uuid", username: "kenan" },
  active_campaign: {
    id: "campaign-default-uuid",
    name: "Campagne par défaut",
    role: "gm",
    character_id: "kenan-pc-uuid",
  },
};

const authMeGet = vi
  .fn()
  .mockResolvedValue({ data: authMeResponse, error: undefined });

vi.mock("@/lib/core/api/client", () => ({
  createApiClient: () => ({ GET: authMeGet }),
}));

const { default: SessionProvider, SESSION_QUERY_KEY } = await import(
  "@/lib/core/session/SessionProvider"
);

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

describe("<SessionProvider>", () => {
  test("populates the session query cache by calling GET /services/jdr/auth/me", async () => {
    const client = makeClient();
    render(
      <QueryClientProvider client={client}>
        <SessionProvider>
          <span>child</span>
        </SessionProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      const data = client.getQueryData(SESSION_QUERY_KEY) as
        | AuthMeResponse
        | undefined;
      expect(data?.user.username).toBe("kenan");
      expect(data?.active_campaign?.role).toBe("gm");
    });
    expect(authMeGet).toHaveBeenCalledWith("/services/jdr/auth/me");
  });
});
