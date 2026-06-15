// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/core/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

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

const CAMP_ID = "11111111-1111-1111-1111-111111111111";

function stubFetch(campaignName = "Les Royaumes Brisés") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: CAMP_ID,
          name: campaignName,
          description: null,
          role: "gm",
          session_count: 0,
          last_session_at: null,
          created_at: "2026-01-01T00:00:00Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ),
  );
}

function renderNav(props: { collapsed?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SidebarNav {...props} />
    </QueryClientProvider>,
  );
}

describe("<SidebarNav>", () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue("/jdr/campaigns");
    stubFetch();
  });

  test("renders Campagnes as the only nav item (Story 2.6 restructure)", () => {
    renderNav();
    const nav = screen.getByRole("navigation", { name: "Navigation JDR" });
    const labels = Array.from(nav.children).map(
      (el) => el.textContent?.trim() ?? "",
    );
    expect(labels).toEqual(["Campagnes"]);
  });

  test("Campagnes link points to /jdr/campaigns and carries aria-current on active path", () => {
    renderNav();
    const link = screen.getByRole("link", { name: /Campagnes/i });
    expect(link).toHaveAttribute("href", "/jdr/campaigns");
    expect(link).toHaveAttribute("aria-current", "page");
  });

  test("Sessions, PJs, Utilisateurs items are NOT in the global sidebar nav anymore", () => {
    renderNav();
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
    renderNav({ collapsed: true });
    const link = screen.getByRole("link", { name: /Campagnes/i });
    expect(link.getAttribute("aria-label")).toBe("Campagnes");
  });

  test("active item carries the visual emphasis class", () => {
    renderNav();
    const link = screen.getByRole("link", { name: /Campagnes/i });
    expect(link.className).toMatch(/surface-overlay/);
  });

  test("on a nested campaign route, the drill-in nav links back to the list and marks the overview as current", async () => {
    pathnameMock.mockReturnValue(`/jdr/campaigns/${CAMP_ID}/sessions/ses-1`);
    renderNav();
    // Clear « back to all campaigns » button.
    const back = screen.getByRole("link", { name: /Toutes les campagnes/i });
    expect(back).toHaveAttribute("href", "/jdr/campaigns");
    // The campaign overview section is the active page in this context.
    const overview = screen.getByRole("link", { name: /Vue d'ensemble/i });
    expect(overview).toHaveAttribute("href", `/jdr/campaigns/${CAMP_ID}`);
    expect(overview).toHaveAttribute("aria-current", "page");
  });

  test("Story 4.23 AC7 — a selected campaign turns the sidebar into its context (back, name, sections)", async () => {
    pathnameMock.mockReturnValue(`/jdr/campaigns/${CAMP_ID}/sessions/ses-1`);
    renderNav();
    // Back button + campaign name shown as a title (not a link).
    expect(
      screen.getByRole("link", { name: /Toutes les campagnes/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Les Royaumes Brisés"),
    ).toBeInTheDocument();
    // PJs / Lore are present but disabled placeholders.
    for (const label of ["PJs", "Lore"]) {
      const entry = screen.getByRole("button", { name: label });
      expect(entry).toBeDisabled();
      expect(entry).toHaveAttribute("title", "Disponible plus tard");
    }
  });

  test("Story 4.23 AC7 — no campaign sections on the campaigns list route", () => {
    pathnameMock.mockReturnValue("/jdr/campaigns");
    renderNav();
    expect(
      screen.queryByRole("button", { name: "PJs" }),
    ).not.toBeInTheDocument();
  });

  test("Story 4.23 AC7 — the create route ('new') is not treated as a campaign", () => {
    pathnameMock.mockReturnValue("/jdr/campaigns/new");
    renderNav();
    expect(
      screen.queryByRole("button", { name: "Lore" }),
    ).not.toBeInTheDocument();
  });

  test("Story 4.23 AC7 — the drill-in persists in collapsed mode as icon-only items", async () => {
    pathnameMock.mockReturnValue(`/jdr/campaigns/${CAMP_ID}`);
    renderNav({ collapsed: true });
    // Back + sections stay reachable by accessible name even when icon-only.
    expect(
      await screen.findByRole("link", { name: "Toutes les campagnes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Vue d'ensemble" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PJs" })).toBeInTheDocument();
    // The campaign name text label is not rendered while collapsed.
    expect(screen.queryByText("Les Royaumes Brisés")).not.toBeInTheDocument();
  });
});
