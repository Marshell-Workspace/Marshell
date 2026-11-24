"use client";

import { safeStorage } from "@workspace/core/lib/safe-json";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Track active sidebar state and mobile drawer state.
export type ActivePanel = "sidebar" | "none";

interface LayoutState {
  // Active Panel ("sidebar" | "none")
  activePanel: ActivePanel;
  closeAll: () => void;
  // Active Sidebar Toggle state (explicit boolean derived cleanly from activePanel)
  isSidebarOpen: boolean;

  // Mobile Menu Drawer state
  mobileMenuOpen: boolean;

  setActivePanel: (panel: ActivePanel) => void;
  setMobileMenuOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      activePanel: "sidebar",
      isSidebarOpen: true,
      mobileMenuOpen: false,

      setActivePanel: (panel: ActivePanel) => {
        if (panel === "sidebar") {
          set({
            activePanel: "sidebar",
            isSidebarOpen: true,
          });
        } else {
          set({
            activePanel: "none",
            isSidebarOpen: false,
          });
        }
      },

      toggleSidebar: () => {
        const current = get().activePanel;
        if (current === "sidebar") {
          get().setActivePanel("none");
        } else {
          get().setActivePanel("sidebar");
        }
      },

      setSidebarOpen: (open: boolean) => {
        if (open) {
          get().setActivePanel("sidebar");
        } else if (get().activePanel === "sidebar") {
          get().setActivePanel("none");
        }
      },

      closeAll: () => {
        get().setActivePanel("none");
      },

      setMobileMenuOpen: (open: boolean) => set({ mobileMenuOpen: open }),
    }),
    {
      name: "marshell_layout_state",
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => {
        const panel: ActivePanel =
          state.activePanel === "sidebar" ? "sidebar" : "none";
        return {
          activePanel: panel,
          isSidebarOpen: panel === "sidebar",
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state && state.activePanel !== "sidebar") {
          state.activePanel = "none";
          state.isSidebarOpen = false;
        }
      },
    }
  )
);
