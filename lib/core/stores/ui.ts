import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type UIState = {
  sidebarCollapsed: boolean;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (value: boolean) => void;
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebarCollapsed: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
    }),
    {
      name: "kaeyris-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
);
