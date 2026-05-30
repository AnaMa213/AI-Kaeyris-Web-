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

const { SidebarNav } = await import("@/components/jdr/layout/SidebarNav");

describe("<SidebarNav>", () => {
  test("renders all four nav items in order: Sessions, PJs, Utilisateurs, Settings", () => {
    render(<SidebarNav />);
    const nav = screen.getByRole("navigation", { name: "Navigation JDR" });
    const labels = Array.from(nav.children).map(
      (el) => el.textContent?.trim() ?? "",
    );
    expect(labels).toEqual(["Sessions", "PJs", "Utilisateurs", "Settings"]);
  });

  test("active item (matching pathname) carries aria-current='page'", () => {
    render(<SidebarNav />);
    const sessionsLink = screen.getByRole("link", { name: /Sessions/i });
    expect(sessionsLink).toHaveAttribute("aria-current", "page");
  });

  test("PJs and Settings items are rendered disabled with aria-disabled='true'", () => {
    render(<SidebarNav />);
    const pjsButton = screen.getByRole("button", { name: /PJs/i });
    const settingsButton = screen.getByRole("button", { name: /Settings/i });
    expect(pjsButton).toBeDisabled();
    expect(pjsButton).toHaveAttribute("aria-disabled", "true");
    expect(settingsButton).toBeDisabled();
    expect(settingsButton).toHaveAttribute("aria-disabled", "true");
  });

  test("disabled items expose a tooltip hint via title attribute", () => {
    render(<SidebarNav />);
    const pjsButton = screen.getByRole("button", { name: /PJs/i });
    expect(pjsButton.getAttribute("title")).toMatch(/plus tard/i);
  });

  test("active item label has visual emphasis class indicating selection", () => {
    render(<SidebarNav />);
    const sessionsLink = screen.getByRole("link", { name: /Sessions/i });
    expect(sessionsLink.className).toMatch(/surface-overlay/);
  });

  test("collapsed mode hides labels visually but keeps them accessible via aria-label", () => {
    render(<SidebarNav collapsed />);
    const sessionsLink = screen.getByRole("link", { name: /Sessions/i });
    expect(sessionsLink.getAttribute("aria-label")).toBe("Sessions");
  });
});
