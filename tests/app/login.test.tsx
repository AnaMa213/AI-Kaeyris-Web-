// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

const pushMock = vi.fn();
let currentSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

const { default: LoginPage } = await import("@/app/login/page");

const renderLoginPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <LoginPage />
    </QueryClientProvider>,
  );
  return queryClient;
};

beforeEach(() => {
  pushMock.mockReset();
  currentSearch = "";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("<LoginPage> happy path", () => {
  test("redirects to / on 200 without ?from", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    );
    const user = userEvent.setup();
    renderLoginPage();
    await user.click(screen.getByText("MJ"));
    await user.type(screen.getByLabelText("Mot de passe"), "hunter2");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
  });

  test("redirects to ?from= when relative", async () => {
    currentSearch = "from=/jdr/sessions/abc";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    );
    const user = userEvent.setup();
    renderLoginPage();
    await user.click(screen.getByText("MJ"));
    await user.type(screen.getByLabelText("Mot de passe"), "hunter2");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/jdr/sessions/abc"),
    );
  });
});

describe("<LoginPage> open-redirect guard", () => {
  test("rejects absolute URL in ?from=", async () => {
    currentSearch = "from=https://evil.com";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    );
    const user = userEvent.setup();
    renderLoginPage();
    await user.click(screen.getByText("MJ"));
    await user.type(screen.getByLabelText("Mot de passe"), "hunter2");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
  });

  test("rejects protocol-relative URL in ?from=", async () => {
    currentSearch = "from=//evil.com";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    );
    const user = userEvent.setup();
    renderLoginPage();
    await user.click(screen.getByText("MJ"));
    await user.type(screen.getByLabelText("Mot de passe"), "hunter2");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
  });
});

describe("<LoginPage> error paths", () => {
  test("401 surfaces inline error and does not redirect", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: "about:blank",
            title: "Invalid credentials",
            status: 401,
          }),
          {
            status: 401,
            headers: { "content-type": "application/problem+json" },
          },
        ),
      ),
    );
    const user = userEvent.setup();
    renderLoginPage();
    await user.click(screen.getByText("MJ"));
    await user.type(screen.getByLabelText("Mot de passe"), "hunter2");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(
      await screen.findByText("Identifiants invalides."),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
