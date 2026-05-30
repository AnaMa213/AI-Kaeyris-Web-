// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/core/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
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
  test("populates the session query cache from the V1 mock", async () => {
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
        | { user: { username: string } }
        | undefined;
      expect(data?.user.username).toBe("Kenan");
    });
  });
});
