// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/core/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

const {
  useMySessions,
  useMySummary,
  isPlayerArtifactAbsentError,
} = await import("@/lib/jdr/player/queries");
const { ApiError } = await import("@/lib/core/api/errors");

const SESSION_ID = "00000000-0000-0000-0000-000000000abc";

const wrapper = (queryClient: QueryClient) => {
  function TestProvider({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return TestProvider;
};

const makeClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("player read hooks (Story 8.4)", () => {
  test("useMySessions GETs /me/sessions and sorts newest first", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string) => {
        const url = typeof input === "string" ? input : input.url;
        expect(url).toContain("/services/jdr/me/sessions");
        return new Response(
          JSON.stringify({
            items: [
              { session_id: "a", title: "Vieille", recorded_at: "2026-01-01T00:00:00Z" },
              { session_id: "b", title: "Récente", recorded_at: "2026-06-01T00:00:00Z" },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );
    const queryClient = makeClient();
    const { result } = renderHook(() => useMySessions(), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((s) => s.session_id)).toEqual(["b", "a"]);
  });

  test("useMySummary GETs the player-scoped summary", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string) => {
        const url = typeof input === "string" ? input : input.url;
        expect(url).toContain(`/me/sessions/${SESSION_ID}/summary`);
        return new Response(
          JSON.stringify({ session_id: SESSION_ID, text: "Mon résumé.", model_used: "x", generated_at: "2026-06-01T10:00:00Z" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );
    const queryClient = makeClient();
    const { result } = renderHook(() => useMySummary(SESSION_ID), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.text).toBe("Mon résumé.");
  });

  test("a 404 surfaces as an absent-artifact error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ type: "about:blank", title: "absent", status: 404 }),
          { status: 404, headers: { "content-type": "application/problem+json" } },
        ),
      ),
    );
    const queryClient = makeClient();
    const { result } = renderHook(() => useMySummary(SESSION_ID), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(isPlayerArtifactAbsentError(result.current.error)).toBe(true);
  });
});
