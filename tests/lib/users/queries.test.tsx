// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

const {
  useCreateUser,
  useDeleteUser,
  useUpdateUser,
  useUsers,
} = await import("@/lib/users/queries");

const sampleUser = {
  id: "u-1",
  username: "alice",
  profile: "user" as const,
  status: "active" as const,
  created_at: "2026-05-29T10:00:00Z",
  updated_at: "2026-05-29T10:00:00Z",
  last_login_at: null,
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
        url.endsWith("/services/jdr/users") &&
        method.toUpperCase() === "GET"
      ) {
        return new Response(JSON.stringify({ items: [sampleUser] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (
        url.endsWith("/services/jdr/users") &&
        method.toUpperCase() === "POST"
      ) {
        return new Response(JSON.stringify(sampleUser), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      }
      if (method.toUpperCase() === "PATCH") {
        return new Response(JSON.stringify(sampleUser), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (method.toUpperCase() === "DELETE") {
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

describe("useUsers", () => {
  test("calls GET /services/jdr/users with credentials: include", async () => {
    const queryClient = makeClient();
    const { result } = renderHook(() => useUsers(), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toEqual([sampleUser]);
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const call = fetchMock.mock.calls.find((args) => {
      const request = args[0] as Request;
      return request.url.endsWith("/services/jdr/users");
    });
    expect(call).toBeDefined();
    const request = call![0] as Request;
    expect(request.method).toBe("GET");
    expect(request.credentials).toBe("include");
  });
});

describe("useCreateUser", () => {
  test("POSTs and invalidates ['users'] on success", async () => {
    const queryClient = makeClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreateUser(), {
      wrapper: wrapper(queryClient),
    });
    result.current.mutate({
      username: "bob",
      profile: "user",
      password: "secret",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["users"] });
  });
});

describe("useUpdateUser", () => {
  test("PATCHes and invalidates ['users'] on success", async () => {
    const queryClient = makeClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUpdateUser(), {
      wrapper: wrapper(queryClient),
    });
    result.current.mutate({ id: "u-1", body: { profile: "gm" } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["users"] });
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const call = fetchMock.mock.calls.find((args) => {
      const request = args[0] as Request;
      return request.url.endsWith("/services/jdr/users/u-1");
    });
    expect(call).toBeDefined();
    expect((call![0] as Request).method).toBe("PATCH");
  });
});

describe("useDeleteUser", () => {
  test("DELETEs and invalidates ['users'] on success", async () => {
    const queryClient = makeClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useDeleteUser(), {
      wrapper: wrapper(queryClient),
    });
    result.current.mutate("u-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["users"] });
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const call = fetchMock.mock.calls.find((args) => {
      const request = args[0] as Request;
      return request.url.endsWith("/services/jdr/users/u-1");
    });
    expect(call).toBeDefined();
    expect((call![0] as Request).method).toBe("DELETE");
  });
});
