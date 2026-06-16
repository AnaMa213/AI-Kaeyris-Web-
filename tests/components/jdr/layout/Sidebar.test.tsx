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

const routerPushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
  usePathname: () => "/jdr/campaigns",
}));

function asAdmin() {
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

function asNonAdmin() {
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
  routerPushMock.mockClear();
  asAdmin();
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

  test("uses w-20 (80px) and shows the AI-Kaeyris sigil when collapsed", () => {
    useUIStore.setState({ sidebarCollapsed: true });
    renderSidebar();
    const aside = screen.getByRole("complementary");
    expect(aside).toHaveAttribute("data-collapsed", "true");
    expect(aside.className).toMatch(/\bw-20\b/);
    expect(
      screen.getByLabelText("AI-Kaeyris JDR Assistant"),
    ).toBeInTheDocument();
  });

  test("collapsed header keeps the sigil and the expand chevron on the same row", () => {
    useUIStore.setState({ sidebarCollapsed: true });
    renderSidebar();
    const expandButton = screen.getByRole("button", {
      name: "Déplier la barre latérale",
    });
    const sigil = screen.getByLabelText("AI-Kaeyris JDR Assistant");
    expect(expandButton.parentElement).toBe(sigil.parentElement);
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

  test("admin sees the Settings button enabled in the footer", () => {
    asAdmin();
    renderSidebar();
    const settingsButton = screen.getByRole("button", { name: /Settings/i });
    expect(settingsButton).toBeInTheDocument();
    expect(settingsButton).not.toBeDisabled();
  });

  test("non-admin user does NOT see the Settings button", () => {
    asNonAdmin();
    renderSidebar();
    expect(
      screen.queryByRole("button", { name: /Settings/i }),
    ).not.toBeInTheDocument();
  });

  test("clicking Settings (admin only) navigates to /jdr/settings", async () => {
    asAdmin();
    const user = userEvent.setup();
    renderSidebar();
    await user.click(screen.getByRole("button", { name: /Settings/i }));
    expect(routerPushMock).toHaveBeenCalledWith("/jdr/settings");
  });

  test("logout button calls useLogout().mutate()", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await user.click(screen.getByRole("button", { name: "Se déconnecter" }));
    expect(logoutMutate).toHaveBeenCalledOnce();
  });

  test("admin sees the Utilisateurs button in the footer", () => {
    asAdmin();
    renderSidebar();
    expect(
      screen.getByRole("button", { name: /Utilisateurs/i }),
    ).toBeInTheDocument();
  });

  test("non-admin user does NOT see the Utilisateurs button", () => {
    asNonAdmin();
    renderSidebar();
    expect(
      screen.queryByRole("button", { name: /Utilisateurs/i }),
    ).not.toBeInTheDocument();
  });

  test("clicking Utilisateurs (admin only) navigates to /jdr/users", async () => {
    asAdmin();
    const user = userEvent.setup();
    renderSidebar();
    await user.click(screen.getByRole("button", { name: /Utilisateurs/i }));
    expect(routerPushMock).toHaveBeenCalledWith("/jdr/users");
  });
});
