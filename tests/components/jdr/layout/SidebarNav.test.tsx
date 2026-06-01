// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const pathnameMock = vi.hoisted(() => vi.fn(() => "/jdr/campaigns"));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
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
  beforeEach(() => {
    pathnameMock.mockReturnValue("/jdr/campaigns");
  });

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

  test("Campagnes remains active on nested campaign routes", () => {
    pathnameMock.mockReturnValue(
      "/jdr/campaigns/11111111-1111-1111-1111-111111111111/sessions/ses-1",
    );
    render(<SidebarNav />);
    const link = screen.getByRole("link", { name: /Campagnes/i });
    expect(link).toHaveAttribute("aria-current", "page");
  });
});
