// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { AuthInterceptor } from "@/lib/core/api/interceptors";
import { ApiError, AuthError, NetworkError } from "@/lib/core/api/errors";

const pushMock = vi.fn();
let currentPathname = "/jdr";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => currentPathname,
}));

const makeClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

const renderWithInterceptor = (
  children: React.ReactNode,
  queryClient = makeClient(),
) => {
  render(
    <QueryClientProvider client={queryClient}>
      <AuthInterceptor />
      {children}
    </QueryClientProvider>,
  );
  return queryClient;
};

beforeEach(() => {
  pushMock.mockReset();
  currentPathname = "/jdr";
});

afterEach(() => {
  vi.restoreAllMocks();
});

function FailingQueryProbe({ error }: { error: unknown }) {
  useQuery({
    queryKey: ["test-query"],
    queryFn: async () => {
      throw error;
    },
    retry: false,
  });
  return null;
}

function FailingMutationProbe({ error }: { error: unknown }) {
  const mutation = useMutation({
    mutationFn: async () => {
      throw error;
    },
  });
  // Trigger the mutation on mount.
  if (mutation.isIdle) {
    mutation.mutate();
  }
  return null;
}

describe("<AuthInterceptor>", () => {
  test("redirects to /login?from=...&expired=true on AuthError from a query", async () => {
    const authError = new AuthError({
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
    });
    renderWithInterceptor(<FailingQueryProbe error={authError} />);
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/login?from=%2Fjdr&expired=true"),
    );
  });

  test("redirects on AuthError from a mutation", async () => {
    const authError = new AuthError({
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
    });
    renderWithInterceptor(<FailingMutationProbe error={authError} />);
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/login?from=%2Fjdr&expired=true"),
    );
  });

  test("clears the query cache before redirecting on AuthError", async () => {
    const queryClient = makeClient();
    queryClient.setQueryData(["private", "profile"], { username: "alice" });
    expect(queryClient.getQueryData(["private", "profile"])).toEqual({
      username: "alice",
    });

    const authError = new AuthError({
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
    });
    renderWithInterceptor(<FailingQueryProbe error={authError} />, queryClient);

    await waitFor(() =>
      expect(queryClient.getQueryData(["private", "profile"])).toBeUndefined(),
    );
    expect(pushMock).toHaveBeenCalledWith("/login?from=%2Fjdr&expired=true");
  });

  test("does NOT redirect when pathname starts with /login (loop prevention)", async () => {
    currentPathname = "/login";
    const authError = new AuthError({
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
    });
    renderWithInterceptor(<FailingQueryProbe error={authError} />);
    // Give react-query time to observe the error and run subscribers.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(pushMock).not.toHaveBeenCalled();
  });

  test("does NOT redirect on non-AuthError (ApiError 500 / NetworkError)", async () => {
    const apiError = new ApiError({
      type: "about:blank",
      title: "Server error",
      status: 500,
    });
    renderWithInterceptor(<FailingQueryProbe error={apiError} />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(pushMock).not.toHaveBeenCalled();

    pushMock.mockReset();
    const networkError = new NetworkError();
    renderWithInterceptor(<FailingQueryProbe error={networkError} />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(pushMock).not.toHaveBeenCalled();
  });

  test("does NOT redirect when the failing query is the session probe (['session','me'] is owned by <AuthGuard>)", async () => {
    function FailingSessionProbe({ error }: { error: unknown }) {
      useQuery({
        queryKey: ["session", "me"],
        queryFn: async () => {
          throw error;
        },
        retry: false,
      });
      return null;
    }
    const authError = new AuthError({
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
    });
    renderWithInterceptor(<FailingSessionProbe error={authError} />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(pushMock).not.toHaveBeenCalled();
  });

  test("component returns null (no DOM)", () => {
    const queryClient = makeClient();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <AuthInterceptor />
      </QueryClientProvider>,
    );
    expect(container.firstChild).toBeNull();
  });
});
