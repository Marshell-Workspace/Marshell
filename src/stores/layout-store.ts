import { create } from "zustand";
import { persist } from "zustand/middleware";
import { terminalLayoutManager } from "@/lib/terminal-layout-manager";

export type ActivePanel = "sidebar" | "agent" | "none";

// Transition duration matching the 300ms cubic-bezier transition
const PANEL_TRANSITION_MS = 250;

let pendingTransitionTimer: ReturnType<typeof setTimeout> | null = null;

function clearPendingTransition() {
  if (pendingTransitionTimer !== null) {
    clearTimeout(pendingTransitionTimer);
    pendingTransitionTimer = null;
  }
}

interface LayoutState {
  activePanel: ActivePanel;
  closeAll: () => void;
  openAgent: () => void;
  openSidebar: () => void;
  setActivePanel: (panel: ActivePanel) => void;
  setAgentOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleAgent: () => void;
  toggleSidebar: () => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      activePanel: "sidebar",

      setActivePanel: (panel: ActivePanel) => {
        clearPendingTransition();
        terminalLayoutManager.startTransition(350);
        set({ activePanel: panel });
      },

      openSidebar: () => {
        const current = get().activePanel;
        if (current === "sidebar") {
          return;
        }

        clearPendingTransition();
        terminalLayoutManager.startTransition(350);

        if (current === "agent") {
          // 1. Close Main Agent first
          set({ activePanel: "none" });

          // 2. Open Sidebar after transition
          pendingTransitionTimer = setTimeout(() => {
            set({ activePanel: "sidebar" });
            pendingTransitionTimer = null;
          }, PANEL_TRANSITION_MS);
        } else {
          // Neither is open, open immediately
          set({ activePanel: "sidebar" });
        }
      },

      openAgent: () => {
        const current = get().activePanel;
        if (current === "agent") {
          return;
        }

        clearPendingTransition();
        terminalLayoutManager.startTransition(350);

        if (current === "sidebar") {
          // 1. Close Sidebar first
          set({ activePanel: "none" });

          // 2. Open Main Agent after transition
          pendingTransitionTimer = setTimeout(() => {
            terminalLayoutManager.startTransition(350);
            set({ activePanel: "agent" });
            pendingTransitionTimer = null;
          }, PANEL_TRANSITION_MS);
        } else {
          // Neither is open, open immediately
          set({ activePanel: "agent" });
        }
      },

      toggleSidebar: () => {
        const current = get().activePanel;
        clearPendingTransition();
        terminalLayoutManager.startTransition(350);

        if (current === "sidebar") {
          // Currently open -> close it immediately
          set({ activePanel: "none" });
        } else if (current === "agent") {
          // Agent is open -> close agent first, then open sidebar
          set({ activePanel: "none" });
          pendingTransitionTimer = setTimeout(() => {
            terminalLayoutManager.startTransition(350);
            set({ activePanel: "sidebar" });
            pendingTransitionTimer = null;
          }, PANEL_TRANSITION_MS);
        } else {
          // None is open -> open sidebar immediately
          set({ activePanel: "sidebar" });
        }
      },

      toggleAgent: () => {
        const current = get().activePanel;
        clearPendingTransition();
        terminalLayoutManager.startTransition(350);

        if (current === "agent") {
          // Currently open -> close it immediately
          set({ activePanel: "none" });
        } else if (current === "sidebar") {
          // Sidebar is open -> close sidebar first, then open agent
          set({ activePanel: "none" });
          pendingTransitionTimer = setTimeout(() => {
            terminalLayoutManager.startTransition(350);
            set({ activePanel: "agent" });
            pendingTransitionTimer = null;
          }, PANEL_TRANSITION_MS);
        } else {
          // None is open -> open agent immediately
          set({ activePanel: "agent" });
        }
      },

      setSidebarOpen: (open: boolean) => {
        if (open) {
          get().openSidebar();
        } else {
          clearPendingTransition();
          if (get().activePanel === "sidebar") {
            terminalLayoutManager.startTransition(350);
            set({ activePanel: "none" });
          }
        }
      },

      setAgentOpen: (open: boolean) => {
        if (open) {
          get().openAgent();
        } else {
          clearPendingTransition();
          if (get().activePanel === "agent") {
            terminalLayoutManager.startTransition(350);
            set({ activePanel: "none" });
          }
        }
      },

      closeAll: () => {
        clearPendingTransition();
        terminalLayoutManager.startTransition(350);
        set({ activePanel: "none" });
      },
    }),
    {
      name: "hyperion_layout_state",
      partialize: (state) => ({ activePanel: state.activePanel }),
    }
  )
);
