// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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
  useListCampaignPjs,
  useCreateCampaignPj,
  useDeleteCampaignPj,
  campaignPjsListQueryKey,
} = await import("@/lib/jdr/pjs/queries");
const { ApiError } = await import("@/lib/core/api/errors");

const CAMPAIGN_ID = "11111111-1111-1111-1111-111111111111";

const samplePj = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Eldrin",
  campaign_id: CAMPAIGN_ID,
  created_at: "2026-05-30T10:00:00Z",
};

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

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      const method =
        typeof input === "string" ? "GET" : (input.method ?? "GET");
      if (
        /\/services\/jdr\/pjs(\?|$)/.test(url) &&
        method.toUpperCase() === "GET"
      ) {
        return new Response(
          JSON.stringify({ items: [samplePj], total: 1 }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }
      if (
        url.endsWith("/services/jdr/pjs") &&
        method.toUpperCase() === "POST"
      ) {
        return new Response(JSON.stringify(samplePj), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      }
      if (
        url.includes("/services/jdr/pjs/") &&
        method.toUpperCase() === "DELETE"
      ) {
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useListCampaignPjs", () => {
  test("calls GET /services/jdr/pjs?campaign_id=… and stores under the scoped query key", async () => {
    const queryClient = makeClient();
    const { result } = renderHook(() => useListCampaignPjs(CAMPAIGN_ID), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toEqual([samplePj]);

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const call = fetchMock.mock.calls.find((args) => {
      const request = args[0] as Request;
      return (
        request.url.includes("/services/jdr/pjs") &&
        request.url.includes(`campaign_id=${CAMPAIGN_ID}`) &&
        request.method === "GET"
      );
    });
    if (!call) throw new Error("No GET /pjs?campaign_id=… call found");
    expect((call[0] as Request).credentials).toBe("include");
    expect(campaignPjsListQueryKey(CAMPAIGN_ID)).toEqual([
      "pjs",
      "list",
      { campaignId: CAMPAIGN_ID },
    ]);
  });

  test("does NOT fire the GET when campaignId is empty (enabled gate)", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ items: [], total: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const queryClient = makeClient();
    renderHook(() => useListCampaignPjs(""), {
      wrapper: wrapper(queryClient),
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("surfaces error on 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: "about:blank",
            title: "Server error",
            status: 500,
          }),
          {
            status: 500,
            headers: { "content-type": "application/problem+json" },
          },
        ),
      ),
    );
    const queryClient = makeClient();
    const { result } = renderHook(() => useListCampaignPjs(CAMPAIGN_ID), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
  });
});

describe("useCreateCampaignPj", () => {
  test("POSTs /services/jdr/pjs with name + campaign_id in the body", async () => {
    const queryClient = makeClient();
    const { result } = renderHook(() => useCreateCampaignPj(CAMPAIGN_ID), {
      wrapper: wrapper(queryClient),
    });
    await result.current.mutateAsync({ name: "Aragorn" });

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const call = fetchMock.mock.calls.find((args) => {
      const request = args[0] as Request;
      return (
        request.url.endsWith("/services/jdr/pjs") && request.method === "POST"
      );
    });
    if (!call) throw new Error("No POST /pjs call found");
    expect((call[0] as Request).credentials).toBe("include");
    await expect((call[0] as Request).clone().json()).resolves.toEqual({
      name: "Aragorn",
      campaign_id: CAMPAIGN_ID,
    });
  });

  test("invalidates the campaign-scoped key on success", async () => {
    const queryClient = makeClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateCampaignPj(CAMPAIGN_ID), {
      wrapper: wrapper(queryClient),
    });
    await result.current.mutateAsync({ name: "Aragorn" });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: campaignPjsListQueryKey(CAMPAIGN_ID),
    });
  });

  test("propagates 409 duplicate as ApiError on POST", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: "https://kaeyris.local/errors/duplicate-pj",
            title: "Duplicate PJ",
            status: 409,
          }),
          {
            status: 409,
            headers: { "content-type": "application/problem+json" },
          },
        ),
      ),
    );
    const queryClient = makeClient();
    const { result } = renderHook(() => useCreateCampaignPj(CAMPAIGN_ID), {
      wrapper: wrapper(queryClient),
    });
    await expect(
      result.current.mutateAsync({ name: "Eldrin" }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("useDeleteCampaignPj", () => {
  test("calls DELETE /services/jdr/pjs/{id} with credentials: include", async () => {
    const queryClient = makeClient();
    const { result } = renderHook(() => useDeleteCampaignPj(CAMPAIGN_ID), {
      wrapper: wrapper(queryClient),
    });
    await result.current.mutateAsync(samplePj.id);

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const call = fetchMock.mock.calls.find((args) => {
      const request = args[0] as Request;
      return (
        request.url.endsWith(`/services/jdr/pjs/${samplePj.id}`) &&
        request.method === "DELETE"
      );
    });
    if (!call) throw new Error("No DELETE /pjs/:id call found");
    expect((call[0] as Request).credentials).toBe("include");
  });

  test("mutates the campaign-scoped cache locally without triggering a refetch", async () => {
    const queryClient = makeClient();
    queryClient.setQueryData(campaignPjsListQueryKey(CAMPAIGN_ID), {
      items: [samplePj, { ...samplePj, id: "pj-2", name: "Galadriel" }],
      total: 2,
    });
    let refetchCount = 0;
    queryClient.setQueryDefaults(campaignPjsListQueryKey(CAMPAIGN_ID), {
      queryFn: () => {
        refetchCount += 1;
        return Promise.resolve({ items: [], total: 0 });
      },
    });

    const { result } = renderHook(() => useDeleteCampaignPj(CAMPAIGN_ID), {
      wrapper: wrapper(queryClient),
    });
    await result.current.mutateAsync(samplePj.id);

    const cached = queryClient.getQueryData(
      campaignPjsListQueryKey(CAMPAIGN_ID),
    ) as { items: { id: string }[]; total: number } | undefined;
    expect(cached?.items.map((p) => p.id)).toEqual(["pj-2"]);
    expect(cached?.total).toBe(1);
    expect(refetchCount).toBe(0);
  });

  test("propagates an ApiError when the DELETE call fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: "about:blank",
            title: "Server error",
            status: 500,
          }),
          {
            status: 500,
            headers: { "content-type": "application/problem+json" },
          },
        ),
      ),
    );
    const queryClient = makeClient();
    const { result } = renderHook(() => useDeleteCampaignPj(CAMPAIGN_ID), {
      wrapper: wrapper(queryClient),
    });
    await expect(
      result.current.mutateAsync(samplePj.id),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
