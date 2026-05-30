// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/jdr/sessions",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const userMock = vi.hoisted(() => ({
  current: {
    status: "authenticated" as const,
    auth: { authId: "kenan", campaignId: "campaign-default" },
    jdr: { role: "gm", characterId: "kenan-pc", displayName: "Kenan" },
  } as unknown,
}));

vi.mock("@/lib/core/session/useCurrentUser", () => ({
  useCurrentUser: () => userMock.current,
}));

const { SidebarNav } = await import("@/components/jdr/layout/SidebarNav");

function asGm() {
  userMock.current = {
    status: "authenticated",
    auth: { authId: "kenan", campaignId: "campaign-default" },
    jdr: { role: "gm", characterId: "kenan-pc", displayName: "Kenan" },
  };
}

function asPlayer() {
  userMock.current = {
    status: "authenticated",
    auth: { authId: "alice", campaignId: "campaign-default" },
    jdr: { role: "player", characterId: "alice-pc", displayName: "Alice" },
  };
}

function asLoading() {
  userMock.current = { status: "loading" };
}

describe("<SidebarNav>", () => {
  test("GM sees Sessions, PJs, Utilisateurs in order (Settings moved to footer)", () => {
    asGm();
    render(<SidebarNav />);
    const nav = screen.getByRole("navigation", { name: "Navigation JDR" });
    const labels = Array.from(nav.children).map(
      (el) => el.textContent?.trim() ?? "",
    );
    expect(labels).toEqual(["Sessions", "PJs", "Utilisateurs"]);
  });

  test("Player only sees Sessions (PJs and Utilisateurs hidden)", () => {
    asPlayer();
    render(<SidebarNav />);
    const nav = screen.getByRole("navigation", { name: "Navigation JDR" });
    const labels = Array.from(nav.children).map(
      (el) => el.textContent?.trim() ?? "",
    );
    expect(labels).toEqual(["Sessions"]);
  });

  test("Loading state hides gm-only items", () => {
    asLoading();
    render(<SidebarNav />);
    const nav = screen.getByRole("navigation", { name: "Navigation JDR" });
    const labels = Array.from(nav.children).map(
      (el) => el.textContent?.trim() ?? "",
    );
    expect(labels).toEqual(["Sessions"]);
  });

  test("active item (matching pathname) carries aria-current='page'", () => {
    asGm();
    render(<SidebarNav />);
    const sessionsLink = screen.getByRole("link", { name: /Sessions/i });
    expect(sessionsLink).toHaveAttribute("aria-current", "page");
  });

  test("PJs is rendered disabled with aria-disabled and tooltip hint", () => {
    asGm();
    render(<SidebarNav />);
    const pjsButton = screen.getByRole("button", { name: /PJs/i });
    expect(pjsButton).toBeDisabled();
    expect(pjsButton).toHaveAttribute("aria-disabled", "true");
    expect(pjsButton.getAttribute("title")).toMatch(/plus tard/i);
  });

  test("active item label has visual emphasis class indicating selection", () => {
    asGm();
    render(<SidebarNav />);
    const sessionsLink = screen.getByRole("link", { name: /Sessions/i });
    expect(sessionsLink.className).toMatch(/surface-overlay/);
  });

  test("collapsed mode hides labels visually but keeps them accessible via aria-label", () => {
    asGm();
    render(<SidebarNav collapsed />);
    const sessionsLink = screen.getByRole("link", { name: /Sessions/i });
    expect(sessionsLink.getAttribute("aria-label")).toBe("Sessions");
  });
});
