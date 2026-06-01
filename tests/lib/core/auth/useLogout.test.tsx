// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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

const replaceMock = vi.fn();
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

const { useLogout } = await import("@/lib/core/auth/useLogout");
const { SESSION_QUERY_KEY } = await import(
  "@/lib/core/session/queries"
);

function LogoutProbe() {
  const logout = useLogout();
  return (
    <button type="button" onClick={() => logout.mutate()}>
      Logout
    </button>
  );
}

const renderProbe = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <LogoutProbe />
    </QueryClientProvider>,
  );
  return queryClient;
};

beforeEach(() => {
  replaceMock.mockReset();
  pushMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useLogout", () => {
  test("pins the session cache to the unauth placeholder (user.id='') BEFORE the network call", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise(() => undefined)),
    );

    const user = userEvent.setup();
    const queryClient = renderProbe();
    queryClient.setQueryData(SESSION_QUERY_KEY, {
      user: { id: "kenan", username: "Kenan", system_role: "admin" },
      active_campaign: {
        id: "c1",
        name: "Default",
        role: "gm",
        character_id: "kenan-pc",
      },
    });

    await user.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => {
      const data = queryClient.getQueryData(SESSION_QUERY_KEY) as
        | { user: { id: string }; active_campaign: unknown }
        | undefined;
      expect(data?.user.id).toBe("");
      expect(data?.active_campaign).toBeNull();
      expect(replaceMock).toHaveBeenCalledWith("/login");
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  test("removes non-session queries from the cache but preserves the session sentinel entry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise(() => undefined)),
    );

    const user = userEvent.setup();
    const queryClient = renderProbe();
    queryClient.setQueryData(["users"], { items: [] });
    queryClient.setQueryData(["sessions", "library"], { items: [] });

    await user.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => {
      expect(queryClient.getQueryData(["users"])).toBeUndefined();
      expect(
        queryClient.getQueryData(["sessions", "library"]),
      ).toBeUndefined();
      expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toBeDefined();
    });
  });

  test("POSTs to /services/jdr/auth/logout with credentials: include (fire-and-forget)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toBe("http://localhost:8000/services/jdr/auth/logout");
    expect(request.method).toBe("POST");
    expect(request.credentials).toBe("include");
  });

  test("redirect still happens even if the backend logout call fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/login");
    });
  });
});
