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

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const { useLogout } = await import("@/lib/core/auth/useLogout");

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
  pushMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useLogout", () => {
  test("POSTs to /services/jdr/auth/logout with credentials: include", async () => {
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

  test("clears the query cache on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    const user = userEvent.setup();
    const queryClient = renderProbe();
    queryClient.setQueryData(["foo"], "bar");
    expect(queryClient.getQueryData(["foo"])).toBe("bar");

    await user.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() =>
      expect(queryClient.getQueryData(["foo"])).toBeUndefined(),
    );
  });

  test("routes to /login on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByRole("button", { name: "Logout" }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
  });
});
