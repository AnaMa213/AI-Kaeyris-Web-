// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/core/api/errors";

vi.mock("@/lib/core/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

const {
  useListCampaigns,
  useCreateCampaign,
  useGetCampaign,
  CAMPAIGNS_QUERY_KEY,
  campaignQueryKey,
} = await import("@/lib/jdr/campaigns/queries");

const sampleCampaign = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Les Royaumes Brisés",
  description: "Un royaume autrefois uni se déchire.",
  role: "gm" as const,
  session_count: 12,
  last_session_at: "2026-05-29T18:30:00+00:00",
  created_at: "2026-01-12T18:00:00+00:00",
};

const samplePage = {
  items: [sampleCampaign],
  total: 1,
  page: 1,
  size: 50,
};

const makeClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

const wrapper = (client: QueryClient) => {
  function TestProvider({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return TestProvider;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useListCampaigns", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string) => {
        const url = typeof input === "string" ? input : input.url;
        const method =
          typeof input === "string" ? "GET" : (input.method ?? "GET");
        if (
          url.endsWith("/services/jdr/campaigns") &&
          method.toUpperCase() === "GET"
        ) {
          return new Response(JSON.stringify(samplePage), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(null, { status: 200 });
      }),
    );
  });

  test("fetches the campaign list under queryKey ['campaigns']", async () => {
    const client = makeClient();
    const { result } = renderHook(() => useListCampaigns(), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0].name).toBe("Les Royaumes Brisés");
    expect(CAMPAIGNS_QUERY_KEY).toEqual(["campaigns"]);
  });
});

describe("useGetCampaign", () => {
  test("fetches a single campaign by id under queryKey ['campaigns', id]", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string) => {
        const url = typeof input === "string" ? input : input.url;
        const method =
          typeof input === "string" ? "GET" : (input.method ?? "GET");
        if (
          url.includes("/services/jdr/campaigns/") &&
          method.toUpperCase() === "GET"
        ) {
          return new Response(JSON.stringify(sampleCampaign), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(null, { status: 200 });
      }),
    );

    const client = makeClient();
    const { result } = renderHook(() => useGetCampaign(sampleCampaign.id), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe("Les Royaumes Brisés");
    expect(campaignQueryKey(sampleCampaign.id)).toEqual([
      "campaigns",
      sampleCampaign.id,
    ]);
  });

  test("does NOT fire the GET when id is empty (enabled gate)", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(sampleCampaign), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = makeClient();
    renderHook(() => useGetCampaign(""), { wrapper: wrapper(client) });
    // Give time for any async effect to fire if it would.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useCreateCampaign", () => {
  test("POSTs a campaign and invalidates the list query on success", async () => {
    let postBody: unknown = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.url;
        const method =
          typeof input === "string" ? init?.method : (input.method ?? "GET");
        if (
          url.endsWith("/services/jdr/campaigns") &&
          method?.toUpperCase() === "POST"
        ) {
          if (typeof input !== "string") postBody = await input.clone().json();
          return new Response(JSON.stringify(sampleCampaign), {
            status: 201,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(null, { status: 200 });
      }),
    );

    const client = makeClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCreateCampaign(), {
      wrapper: wrapper(client),
    });

    result.current.mutate({
      name: "Les Royaumes Brisés",
      description: "Un royaume autrefois uni se déchire.",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(sampleCampaign.id);
    expect(postBody).toEqual({
      name: "Les Royaumes Brisés",
      description: "Un royaume autrefois uni se déchire.",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: CAMPAIGNS_QUERY_KEY,
    });
  });

  test("omits description from the body when undefined", async () => {
    let postBody: Record<string, unknown> | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.url;
        const method =
          typeof input === "string" ? init?.method : (input.method ?? "GET");
        if (
          url.endsWith("/services/jdr/campaigns") &&
          method?.toUpperCase() === "POST"
        ) {
          if (typeof input !== "string") postBody = await input.clone().json();
          return new Response(JSON.stringify(sampleCampaign), {
            status: 201,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(null, { status: 200 });
      }),
    );

    const client = makeClient();
    const { result } = renderHook(() => useCreateCampaign(), {
      wrapper: wrapper(client),
    });
    result.current.mutate({ name: "Royaumes" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(postBody).toEqual({ name: "Royaumes" });
    expect(postBody && "description" in postBody).toBe(false);
  });

  test("propagates a backend error as ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
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

    const client = makeClient();
    const { result } = renderHook(() => useCreateCampaign(), {
      wrapper: wrapper(client),
    });
    result.current.mutate({ name: "Royaumes" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
  });
});
