"use client";

import { create } from "zustand";
import { useWorkspaceStore } from "@/stores/workspace-store";

interface TerminalFocusState {
  focusCallbacks: Record<string, () => void>;
  focusedTerminalId: string | null;
  focusTerminal: (id: string) => boolean;
  focusTerminalByIndex: (index: number) => boolean;
  registerTerminal: (id: string, focusFn: () => void) => () => void;
  setFocusedTerminalId: (id: string | null) => void;
}

export const useTerminalFocusStore = create<TerminalFocusState>()(
  (set, get) => ({
    focusedTerminalId: null,
    focusCallbacks: {},

    setFocusedTerminalId: (id: string | null) => {
      set({ focusedTerminalId: id });
    },

    registerTerminal: (id: string, focusFn: () => void) => {
      set((state) => ({
        focusCallbacks: { ...state.focusCallbacks, [id]: focusFn },
      }));
      return () => {
        set((state) => {
          const { [id]: _, ...rest } = state.focusCallbacks;
          return {
            focusCallbacks: rest,
            focusedTerminalId:
              state.focusedTerminalId === id ? null : state.focusedTerminalId,
          };
        });
      };
    },

    focusTerminal: (id: string) => {
      const fn = get().focusCallbacks[id];
      if (fn) {
        set({ focusedTerminalId: id });
        fn();
        return true;
      }
      return false;
    },

    focusTerminalByIndex: (index: number) => {
      const { workspaces, activeWorkspaceId } = useWorkspaceStore.getState();
      const activeWorkspace = workspaces.find(
        (w) => w.id === activeWorkspaceId
      );
      if (!activeWorkspace?.panes) {
        return false;
      }

      if (index < 0 || index >= activeWorkspace.panes.length) {
        return false;
      }

      const targetPane = activeWorkspace.panes[index];
      if (!targetPane) {
        return false;
      }

      return get().focusTerminal(targetPane.id);
    },
  })
);
