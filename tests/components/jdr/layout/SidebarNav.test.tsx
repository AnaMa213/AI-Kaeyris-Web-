// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/jdr/campaigns",
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
  test("renders Campagnes as the only nav item (Story 2.6 restructure)", () => {
    render(<SidebarNav />);
    const nav = screen.getByRole("navigation", { name: "Navigation JDR" });
    const labels = Array.from(nav.children).map(
      (el) => el.textContent?.trim() ?? "",
    );
    expect(labels).toEqual(["Campagnes"]);
  });

  test("Campagnes link points to /jdr/campaigns and carries aria-current on active path", () => {
    render(<SidebarNav />);
    const link = screen.getByRole("link", { name: /Campagnes/i });
    expect(link).toHaveAttribute("href", "/jdr/campaigns");
    expect(link).toHaveAttribute("aria-current", "page");
  });

  test("Sessions, PJs, Utilisateurs items are NOT in the global sidebar nav anymore", () => {
    render(<SidebarNav />);
    expect(
      screen.queryByRole("link", { name: /Sessions/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^PJs$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Utilisateurs/i }),
    ).not.toBeInTheDocument();
  });

  test("collapsed mode keeps the Campagnes link accessible via aria-label", () => {
    render(<SidebarNav collapsed />);
    const link = screen.getByRole("link", { name: /Campagnes/i });
    expect(link.getAttribute("aria-label")).toBe("Campagnes");
  });

  test("active item carries the visual emphasis class", () => {
    render(<SidebarNav />);
    const link = screen.getByRole("link", { name: /Campagnes/i });
    expect(link.className).toMatch(/surface-overlay/);
  });
});
