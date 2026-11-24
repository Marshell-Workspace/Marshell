"use client";

import { toggleApplicationFullscreen } from "@workspace/core/lib/fullscreen-manager";
import { terminalLayoutManager } from "@workspace/core/lib/terminal-layout-manager";
import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import { create } from "zustand";

interface TerminalFocusState {
  activeTerminalId: string | null;
  focusCallbacks: Record<string, () => boolean | undefined>;
  focusedTerminalId: string | null;
  focusTerminal: (id: string) => boolean;
  focusTerminalByIndex: (index: number) => boolean;
  fullscreenTerminalId: string | null;
  isAppFullscreen: boolean;
  pendingTerminalId: string | null;
  registerTerminal: (
    id: string,
    focusFn: () => boolean | undefined
  ) => () => void;
  releaseTerminalFocus: (terminalId?: string) => void;
  setActiveTerminalId: (id: string | null) => void;
  setAppFullscreen: (fullscreen: boolean) => void;
  setFocusedTerminalId: (id: string | null) => void;
  setFullscreenTerminalId: (id: string | null) => void;
  toggleAppFullscreen: () => Promise<boolean>;
  toggleTerminalFullscreen: (id?: string) => void;
}

export const useTerminalFocusStore = create<TerminalFocusState>()(
  (set, get) => ({
    activeTerminalId: null,
    focusedTerminalId: null,
    fullscreenTerminalId: null,
    isAppFullscreen: false,
    pendingTerminalId: null,
    focusCallbacks: {},

    setActiveTerminalId: (id: string | null) => {
      set({ activeTerminalId: id });
    },

    setFocusedTerminalId: (id: string | null) => {
      set((state) => ({
        focusedTerminalId: id,
        activeTerminalId: id ?? state.activeTerminalId,
        pendingTerminalId: id ? null : state.pendingTerminalId,
      }));
    },

    setFullscreenTerminalId: (id: string | null) => {
      set({ fullscreenTerminalId: id });
      terminalLayoutManager.notifyFullscreenTransition(id ?? undefined);
    },

    setAppFullscreen: (fullscreen: boolean) => {
      set({ isAppFullscreen: fullscreen });
      terminalLayoutManager.notifyFullscreenTransition();
    },

    releaseTerminalFocus: (terminalId) => {
      if (typeof document !== "undefined") {
        const activeEl = document.activeElement as HTMLElement | null;
        if (
          activeEl?.closest(".xterm") &&
          (!terminalId || get().focusedTerminalId === terminalId)
        ) {
          activeEl.blur();
        }
      }

      set((state) => ({
        focusedTerminalId:
          !terminalId || state.focusedTerminalId === terminalId
            ? null
            : state.focusedTerminalId,
        activeTerminalId:
          !terminalId || state.activeTerminalId === terminalId
            ? null
            : state.activeTerminalId,
        pendingTerminalId:
          !terminalId || state.pendingTerminalId === terminalId
            ? null
            : state.pendingTerminalId,
      }));
    },

    registerTerminal: (id: string, focusFn: () => boolean | undefined) => {
      set((state) => ({
        focusCallbacks: { ...state.focusCallbacks, [id]: focusFn },
      }));
      if (get().pendingTerminalId === id) {
        get().focusTerminal(id);
      }
      return () => {
        set((state) => {
          const { [id]: _, ...rest } = state.focusCallbacks;
          return {
            focusCallbacks: rest,
            focusedTerminalId:
              state.focusedTerminalId === id ? null : state.focusedTerminalId,
            activeTerminalId:
              state.activeTerminalId === id ? null : state.activeTerminalId,
            fullscreenTerminalId:
              state.fullscreenTerminalId === id
                ? null
                : state.fullscreenTerminalId,
            pendingTerminalId:
              state.pendingTerminalId === id ? null : state.pendingTerminalId,
          };
        });
      };
    },

    focusTerminal: (id: string) => {
      const { workspaces, activeWorkspaceId, activeView } =
        useWorkspaceStore.getState();
      const workspace = workspaces.find((candidate) =>
        candidate.panes.some((pane) => pane.id === id)
      );
      if (
        workspace &&
        (workspace.id !== activeWorkspaceId || activeView !== "terminals")
      ) {
        return false;
      }
      const fn = get().focusCallbacks[id];
      if (fn) {
        if (fn() === false) {
          set({ pendingTerminalId: id });
          return false;
        }
        set({
          focusedTerminalId: id,
          activeTerminalId: id,
          pendingTerminalId: null,
        });
        return true;
      }
      if (workspace) {
        set({ pendingTerminalId: id });
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

    toggleTerminalFullscreen: (targetId?: string) => {
      const state = get();
      const id = targetId ?? state.focusedTerminalId ?? state.activeTerminalId;
      if (!id) {
        return;
      }

      const nextId = state.fullscreenTerminalId === id ? null : id;
      set({ fullscreenTerminalId: nextId });
      terminalLayoutManager.notifyFullscreenTransition(nextId ?? id);
    },

    toggleAppFullscreen: async () => {
      const nextState = await toggleApplicationFullscreen();
      set({ isAppFullscreen: nextState });
      terminalLayoutManager.notifyFullscreenTransition();
      return nextState;
    },
  })
);
