// @vitest-environment jsdom

import { beforeEach, describe, expect, test } from "vitest";
import { useUIStore } from "@/lib/core/stores/ui";

describe("useUIStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useUIStore.setState({ sidebarCollapsed: false });
  });

  test("default state has sidebar expanded", () => {
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  test("toggleSidebarCollapsed flips the boolean", () => {
    useUIStore.getState().toggleSidebarCollapsed();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    useUIStore.getState().toggleSidebarCollapsed();
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  test("setSidebarCollapsed assigns the value", () => {
    useUIStore.getState().setSidebarCollapsed(true);
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
  });

  test("persist writes to localStorage under kaeyris-ui", () => {
    useUIStore.getState().setSidebarCollapsed(true);
    const raw = window.localStorage.getItem("kaeyris-ui");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.sidebarCollapsed).toBe(true);
  });
});
