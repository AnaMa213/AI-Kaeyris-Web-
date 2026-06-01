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
const replaceMock = vi.fn();
let currentSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

const unauthorizedResponse = () =>
  new Response(
    JSON.stringify({
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
    }),
    {
      status: 401,
      headers: { "content-type": "application/problem+json" },
    },
  );

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

const setupStatusResponse = (body: { required: boolean }) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const makeFetchMock = (loginResponse: () => Response) =>
  vi.fn(async (input: Request | string) => {
    const url = typeof input === "string" ? input : input.url;
    const method =
      typeof input === "string" ? "GET" : (input.method ?? "GET");
    if (url.endsWith("/services/jdr/auth/setup/status")) {
      return setupStatusResponse({ required: false });
    }
    if (url.endsWith("/services/jdr/auth/login")) {
      return loginResponse();
    }
    if (
      url.endsWith("/services/jdr/users") &&
      method.toUpperCase() === "GET"
    ) {
      // LoginGuard session probe: stays "unauthenticated" so the LoginForm
      // renders and the existing assertions still apply.
      return unauthorizedResponse();
    }
    return new Response(null, { status: 200 });
  });

const findLoginCall = (
  fetchMock: ReturnType<typeof makeFetchMock>,
): Request => {
  const call = fetchMock.mock.calls.find((args) => {
    const request = args[0] as Request;
    return request.url.endsWith("/services/jdr/auth/login");
  });
  if (!call) throw new Error("No login call found in fetch mock");
  return call[0] as Request;
};

const fillAndSubmit = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByText("MJ"));
  await user.type(screen.getByLabelText("Nom d'utilisateur"), "alice");
  await user.type(screen.getByLabelText("Mot de passe"), "hunter2");
  await user.click(screen.getByRole("button", { name: "Se connecter" }));
};

beforeEach(() => {
  pushMock.mockReset();
  replaceMock.mockReset();
  currentSearch = "";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("<LoginPage> happy path", () => {
  test("redirects to /jdr/sessions on 200", async () => {
    const fetchMock = makeFetchMock(() => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderLoginPage();
    await fillAndSubmit(user);
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/jdr/sessions"),
    );

    const request = findLoginCall(fetchMock);
    expect(request.url).toBe("http://localhost:8000/services/jdr/auth/login");
    expect(request.method).toBe("POST");
    expect(request.credentials).toBe("include");
    expect(request.headers.get("content-type")).toBe("application/json");
    await expect(request.clone().json()).resolves.toEqual({
      username: "alice",
      password: "hunter2",
    });
  });

  test("ignores any ?from= and still redirects to /jdr/sessions", async () => {
    currentSearch = "from=/jdr/sessions/abc";
    vi.stubGlobal(
      "fetch",
      makeFetchMock(() => new Response(null, { status: 200 })),
    );
    const user = userEvent.setup();
    renderLoginPage();
    await fillAndSubmit(user);
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/jdr/sessions"),
    );
  });
});

describe("<LoginPage> ?from= is ignored (security and UX guarantee)", () => {
  test("absolute URL in ?from= is ignored", async () => {
    currentSearch = "from=https://evil.com";
    vi.stubGlobal(
      "fetch",
      makeFetchMock(() => new Response(null, { status: 200 })),
    );
    const user = userEvent.setup();
    renderLoginPage();
    await fillAndSubmit(user);
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/jdr/sessions"),
    );
  });

  test("protocol-relative URL in ?from= is ignored", async () => {
    currentSearch = "from=//evil.com";
    vi.stubGlobal(
      "fetch",
      makeFetchMock(() => new Response(null, { status: 200 })),
    );
    const user = userEvent.setup();
    renderLoginPage();
    await fillAndSubmit(user);
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/jdr/sessions"),
    );
  });

  test("backslash-normalized external URL in ?from= is ignored", async () => {
    currentSearch = "from=/%5C%5Cevil.com";
    vi.stubGlobal(
      "fetch",
      makeFetchMock(() => new Response(null, { status: 200 })),
    );
    const user = userEvent.setup();
    renderLoginPage();
    await fillAndSubmit(user);
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/jdr/sessions"),
    );
  });
});

describe("<LoginPage> setup-status branching", () => {
  test("renders <SetupWizard> when setup/status returns required:true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string) => {
        const url = typeof input === "string" ? input : input.url;
        const method =
          typeof input === "string" ? "GET" : (input.method ?? "GET");
        if (url.endsWith("/services/jdr/auth/setup/status")) {
          return setupStatusResponse({ required: true });
        }
        if (
          url.endsWith("/services/jdr/users") &&
          method.toUpperCase() === "GET"
        ) {
          return unauthorizedResponse();
        }
        return new Response(null, { status: 200 });
      }),
    );
    renderLoginPage();
    expect(
      await screen.findByRole("heading", {
        name: "Créer le premier compte MJ",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("MJ", { selector: "span" }),
    ).not.toBeInTheDocument();
  });

  test("renders <ProfilePicker> when setup/status returns required:false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string) => {
        const url = typeof input === "string" ? input : input.url;
        const method =
          typeof input === "string" ? "GET" : (input.method ?? "GET");
        if (url.endsWith("/services/jdr/auth/setup/status")) {
          return setupStatusResponse({ required: false });
        }
        if (
          url.endsWith("/services/jdr/users") &&
          method.toUpperCase() === "GET"
        ) {
          return unauthorizedResponse();
        }
        return new Response(null, { status: 200 });
      }),
    );
    renderLoginPage();
    expect(await screen.findByText("Joueur")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Créer le premier compte MJ" }),
    ).not.toBeInTheDocument();
  });

  test("renders [aria-busy] placeholder while setup/status is pending", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderLoginPage();
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Créer le premier compte MJ" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Joueur")).not.toBeInTheDocument();
  });
});

describe("<LoginPage> expired banner", () => {
  test("renders the 'Session expirée' banner when ?expired=true", async () => {
    currentSearch = "expired=true";
    vi.stubGlobal(
      "fetch",
      makeFetchMock(() => new Response(null, { status: 200 })),
    );
    renderLoginPage();
    expect(
      await screen.findByText("Session expirée, reconnectez-vous."),
    ).toBeInTheDocument();
  });

  test("does NOT render the banner when ?expired is absent", async () => {
    currentSearch = "";
    vi.stubGlobal(
      "fetch",
      makeFetchMock(() => new Response(null, { status: 200 })),
    );
    renderLoginPage();
    // Wait for the ProfilePicker to render so the loading state passes.
    await screen.findByText("Joueur");
    expect(
      screen.queryByText("Session expirée, reconnectez-vous."),
    ).not.toBeInTheDocument();
  });
});

describe("<LoginPage> error paths", () => {
  test("401 surfaces inline error and does not redirect", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock(
        () =>
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
    await fillAndSubmit(user);
    expect(
      await screen.findByText("Identifiants invalides."),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
