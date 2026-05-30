// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

const logoutMutate = vi.fn();
vi.mock("@/lib/core/auth/useLogout", () => ({
  useLogout: () => ({ mutate: logoutMutate, isPending: false }),
}));

vi.mock("@/lib/core/session/useCurrentUser", () => ({
  useCurrentUser: () => ({
    status: "authenticated",
    auth: { authId: "kenan", campaignId: "campaign-default" },
    jdr: { role: "gm", characterId: "kenan-pc", displayName: "Kenan" },
  }),
}));

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

const { Sidebar } = await import("@/components/jdr/layout/Sidebar");
const { useUIStore } = await import("@/lib/core/stores/ui");

function renderSidebar() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Sidebar />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  useUIStore.setState({ sidebarCollapsed: false });
  logoutMutate.mockClear();
});

afterEach(() => {
  useUIStore.setState({ sidebarCollapsed: false });
});

describe("<Sidebar>", () => {
  test("expanded layout: lockup + collapse button top-right, Settings + logout in footer", () => {
    renderSidebar();
    expect(screen.getByText("AI-Kaeyris")).toBeInTheDocument();
    expect(screen.getByText("JDR Assistant")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Navigation JDR" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Replier la barre latérale" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Settings/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Se déconnecter" }),
    ).toBeInTheDocument();
  });

  test("uses w-60 (240px) and h-full when expanded", () => {
    renderSidebar();
    const aside = screen.getByRole("complementary");
    expect(aside).toHaveAttribute("data-collapsed", "false");
    expect(aside.className).toMatch(/\bw-60\b/);
    expect(aside.className).toMatch(/\bh-full\b/);
  });

  test("uses w-16 (64px) and shows AK monogram when collapsed", () => {
    useUIStore.setState({ sidebarCollapsed: true });
    renderSidebar();
    const aside = screen.getByRole("complementary");
    expect(aside).toHaveAttribute("data-collapsed", "true");
    expect(aside.className).toMatch(/\bw-16\b/);
    expect(screen.getByText("AK")).toBeInTheDocument();
  });

  test("collapse button toggles useUIStore and is positioned next to the lockup", async () => {
    const user = userEvent.setup();
    renderSidebar();
    const toggle = screen.getByRole("button", {
      name: "Replier la barre latérale",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(toggle);
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
  });

  test("Settings in footer is disabled with tooltip hint", () => {
    renderSidebar();
    const settingsButton = screen.getByRole("button", { name: /Settings/i });
    expect(settingsButton).toBeDisabled();
    expect(settingsButton.getAttribute("title")).toMatch(/plus tard/i);
  });

  test("logout button calls useLogout().mutate()", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await user.click(screen.getByRole("button", { name: "Se déconnecter" }));
    expect(logoutMutate).toHaveBeenCalledOnce();
  });
});
