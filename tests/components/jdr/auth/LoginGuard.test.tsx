// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const replaceMock = vi.fn();
let searchMock = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => new URLSearchParams(searchMock),
}));

const userMock = vi.hoisted(() => ({
  current: { status: "loading" } as unknown,
}));

vi.mock("@/lib/core/session/useCurrentUser", () => ({
  useCurrentUser: () => userMock.current,
}));

const { LoginGuard } = await import("@/components/jdr/auth/LoginGuard");

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
  searchMock = "";
});

describe("<LoginGuard>", () => {
  test("renders children when status='unauthenticated'", () => {
    asUnauthenticated();
    render(
      <LoginGuard>
        <p>login form</p>
      </LoginGuard>,
    );
    expect(screen.getByText("login form")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  test("hides children and renders loader while status='loading'", () => {
    asLoading();
    render(
      <LoginGuard>
        <p>login form</p>
      </LoginGuard>,
    );
    expect(screen.queryByText("login form")).not.toBeInTheDocument();
    expect(screen.getByText(/Vérification/i)).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  test("redirects to /jdr/sessions when authenticated", async () => {
    asAuthenticated();
    render(
      <LoginGuard>
        <p>login form</p>
      </LoginGuard>,
    );
    expect(screen.queryByText("login form")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/jdr/sessions");
    });
  });

  test("redirects to /jdr/sessions regardless of any ?from= query param", async () => {
    searchMock = "from=%2Fjdr%2Fusers";
    asAuthenticated();
    render(
      <LoginGuard>
        <p>login form</p>
      </LoginGuard>,
    );
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/jdr/sessions");
    });
  });
});
