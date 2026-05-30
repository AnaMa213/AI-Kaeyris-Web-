// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const replaceMock = vi.fn();
let pathnameMock = "/jdr/users";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => pathnameMock,
}));

const userMock = vi.hoisted(() => ({
  current: { status: "loading" } as unknown,
}));

vi.mock("@/lib/core/session/useCurrentUser", () => ({
  useCurrentUser: () => userMock.current,
}));

const { AuthGuard } = await import("@/components/jdr/auth/AuthGuard");

function asAuthenticated() {
  userMock.current = {
    status: "authenticated",
    auth: { authId: "kenan", campaignId: "campaign-default" },
    jdr: { role: "gm", characterId: "kenan-pc", displayName: "Kenan" },
  };
}
function asLoading() {
  userMock.current = { status: "loading" };
}
function asUnauthenticated() {
  userMock.current = { status: "unauthenticated" };
}

beforeEach(() => {
  replaceMock.mockReset();
  pathnameMock = "/jdr/users";
});

describe("<AuthGuard>", () => {
  test("renders FantasyLoader and does NOT render children when status='loading'", () => {
    asLoading();
    render(
      <AuthGuard>
        <p>protected</p>
      </AuthGuard>,
    );
    expect(screen.getByText(/Ouverture du grimoire/i)).toBeInTheDocument();
    expect(screen.queryByText("protected")).not.toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  test("renders children when status='authenticated'", () => {
    asAuthenticated();
    render(
      <AuthGuard>
        <p>protected</p>
      </AuthGuard>,
    );
    expect(screen.getByText("protected")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  test("redirects to /login?from=...&expired=true when status='unauthenticated' and does NOT render children", async () => {
    asUnauthenticated();
    render(
      <AuthGuard>
        <p>protected</p>
      </AuthGuard>,
    );
    expect(screen.queryByText("protected")).not.toBeInTheDocument();
    expect(screen.getByText(/Redirection/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(
        "/login?from=%2Fjdr%2Fusers&expired=true",
      );
    });
  });

  test("preserves the current pathname in the from query param", async () => {
    pathnameMock = "/jdr/sessions/abc-123";
    asUnauthenticated();
    render(
      <AuthGuard>
        <p>protected</p>
      </AuthGuard>,
    );
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(
        "/login?from=%2Fjdr%2Fsessions%2Fabc-123&expired=true",
      );
    });
  });
});
