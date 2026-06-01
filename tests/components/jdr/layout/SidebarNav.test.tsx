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
    auth: {
      authId: "kenan",
      username: "kenan",
      systemRole: "admin" as const,
    },
    activeCampaign: {
      id: "campaign-default",
      name: "Campagne par défaut",
      role: "gm" as const,
      characterId: "kenan-pc",
    },
  } as unknown,
}));

vi.mock("@/lib/core/session/useCurrentUser", () => ({
  useCurrentUser: () => userMock.current,
}));

const { SidebarNav } = await import("@/components/jdr/layout/SidebarNav");

function asAdminGm() {
  userMock.current = {
    status: "authenticated",
    auth: { authId: "kenan", username: "kenan", systemRole: "admin" },
    activeCampaign: {
      id: "campaign-default",
      name: "Campagne par défaut",
      role: "gm",
      characterId: "kenan-pc",
    },
  };
}

function asUserPj() {
  userMock.current = {
    status: "authenticated",
    auth: { authId: "alice", username: "alice", systemRole: "user" },
    activeCampaign: {
      id: "campaign-default",
      name: "Campagne par défaut",
      role: "pj",
      characterId: "alice-pc",
    },
  };
}

function asAdminWithoutCampaign() {
  userMock.current = {
    status: "authenticated",
    auth: { authId: "kenan", username: "kenan", systemRole: "admin" },
    activeCampaign: null,
  };
}

function asLoading() {
  userMock.current = { status: "loading" };
}

describe("<SidebarNav>", () => {
  test("Admin + GM sees Campagnes, Sessions, PJs, Utilisateurs in order", () => {
    asAdminGm();
    render(<SidebarNav />);
    const nav = screen.getByRole("navigation", { name: "Navigation JDR" });
    const labels = Array.from(nav.children).map(
      (el) => el.textContent?.trim() ?? "",
    );
    expect(labels).toEqual(["Campagnes", "Sessions", "PJs", "Utilisateurs"]);
  });

  test("user + pj sees Campagnes + Sessions only (PJs hidden — not gm, Utilisateurs hidden — not admin)", () => {
    asUserPj();
    render(<SidebarNav />);
    const nav = screen.getByRole("navigation", { name: "Navigation JDR" });
    const labels = Array.from(nav.children).map(
      (el) => el.textContent?.trim() ?? "",
    );
    expect(labels).toEqual(["Campagnes", "Sessions"]);
  });

  test("Admin without active campaign sees Campagnes + Sessions + Utilisateurs (no PJs because not gm of any active campaign)", () => {
    asAdminWithoutCampaign();
    render(<SidebarNav />);
    const nav = screen.getByRole("navigation", { name: "Navigation JDR" });
    const labels = Array.from(nav.children).map(
      (el) => el.textContent?.trim() ?? "",
    );
    expect(labels).toEqual(["Campagnes", "Sessions", "Utilisateurs"]);
  });

  test("Loading state hides admin-only and campaignGm-only items", () => {
    asLoading();
    render(<SidebarNav />);
    const nav = screen.getByRole("navigation", { name: "Navigation JDR" });
    const labels = Array.from(nav.children).map(
      (el) => el.textContent?.trim() ?? "",
    );
    expect(labels).toEqual(["Campagnes", "Sessions"]);
  });

  test("active item (matching pathname) carries aria-current='page'", () => {
    asAdminGm();
    render(<SidebarNav />);
    const sessionsLink = screen.getByRole("link", { name: /Sessions/i });
    expect(sessionsLink).toHaveAttribute("aria-current", "page");
  });

  test("PJs is rendered as an active link for an admin+gm user", () => {
    asAdminGm();
    render(<SidebarNav />);
    const pjsLink = screen.getByRole("link", { name: /PJs/i });
    expect(pjsLink).toHaveAttribute("href", "/jdr/pjs");
    expect(pjsLink).not.toHaveAttribute("aria-disabled", "true");
  });

  test("active item label has visual emphasis class indicating selection", () => {
    asAdminGm();
    render(<SidebarNav />);
    const sessionsLink = screen.getByRole("link", { name: /Sessions/i });
    expect(sessionsLink.className).toMatch(/surface-overlay/);
  });

  test("collapsed mode hides labels visually but keeps them accessible via aria-label", () => {
    asAdminGm();
    render(<SidebarNav collapsed />);
    const sessionsLink = screen.getByRole("link", { name: /Sessions/i });
    expect(sessionsLink.getAttribute("aria-label")).toBe("Sessions");
  });

  test("Campagnes is rendered as the first nav item and points to /jdr/campaigns", () => {
    asAdminGm();
    render(<SidebarNav />);
    const nav = screen.getByRole("navigation", { name: "Navigation JDR" });
    const firstLink = nav.querySelector("a");
    expect(firstLink).not.toBeNull();
    expect(firstLink?.getAttribute("href")).toBe("/jdr/campaigns");
    expect(firstLink?.textContent?.trim()).toBe("Campagnes");
  });

  test("Campagnes is visible to non-admin / pj users (always visible)", () => {
    asUserPj();
    render(<SidebarNav />);
    expect(screen.getByRole("link", { name: /Campagnes/i })).toBeInTheDocument();
  });
});
