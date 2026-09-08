"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeUUID } from "@/lib/uuid";
import { useTerminalFocusStore } from "@/stores/terminal-focus-store";

export interface TerminalPane {
  id: string;
  name?: string;
  title: string;
}

const FRIENDLY_NAMES = [
  "Nova",
  "Pixel",
  "Sage",
  "Echo",
  "Zelda",
  "Cosmo",
  "Nimbus",
  "Rune",
  "Ember",
  "Lark",
  "Ella",
  "Theo",
  "Vela",
  "Koda",
  "Zara",
  "Orin",
  "Luna",
  "Juno",
  "Remy",
  "Dax",
  "Iris",
  "Faye",
  "Wren",
  "Sola",
  "Kai",
];

export interface Workspace {
  autoCommand?: string;
  createdAt: number;
  directory?: string;
  id: string;
  isPinned?: boolean;
  name: string;
  panes: TerminalPane[];
  terminalCount: number;
}

interface WorkspaceState {
  activeWorkspaceId: string | null;
  addTerminal: (workspaceId: string) => TerminalPane | null;
  createWorkspace: (
    name: string,
    terminalCount: number,
    directory?: string,
    autoCommand?: string
  ) => Workspace;
  deleteTerminal: (workspaceId: string, terminalId: string) => void;
  deleteWorkspace: (id: string) => void;
  duplicateWorkspace: (id: string) => void;
  recentDirectories: string[];
  renameWorkspace: (id: string, name: string) => void;
  replaceTerminal: (workspaceId: string, terminalId: string) => string | null;
  setActiveWorkspace: (id: string) => void;
  togglePinWorkspace: (id: string) => void;
  workspaces: Workspace[];
}

function generateId(): string {
  return safeUUID();
}

function createPanes(count: number): TerminalPane[] {
  const maxOffset = FRIENDLY_NAMES.length - count;
  const offset = maxOffset > 0 ? Math.floor(Math.random() * maxOffset) : 0;
  return Array.from({ length: count }, (_, i) => ({
    id: generateId(),
    title: `Terminal ${i + 1}`,
    name: FRIENDLY_NAMES[(offset + i) % FRIENDLY_NAMES.length],
  }));
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      activeWorkspaceId: null,
      workspaces: [],
      recentDirectories: [],
      addTerminal: (workspaceId: string) => {
        let createdPane: TerminalPane | null = null;
        set((state) => {
          const workspace = state.workspaces.find((w) => w.id === workspaceId);
          if (!workspace || workspace.panes.length >= 8) {
            return {};
          }

          const usedNames = new Set(workspace.panes.map((p) => p.name));
          const availableNames = FRIENDLY_NAMES.filter(
            (n) => !usedNames.has(n)
          );
          const randomName =
            availableNames.length > 0
              ? availableNames[
                  Math.floor(Math.random() * availableNames.length)
                ]
              : FRIENDLY_NAMES[
                  Math.floor(Math.random() * FRIENDLY_NAMES.length)
                ];

          const newIndex = workspace.panes.length;
          createdPane = {
            id: generateId(),
            title: `Terminal ${newIndex + 1}`,
            name: randomName,
          };

          const newPanes = [...workspace.panes, createdPane];

          return {
            workspaces: state.workspaces.map((w) =>
              w.id === workspaceId
                ? {
                    ...w,
                    panes: newPanes,
                    terminalCount: newPanes.length,
                  }
                : w
            ),
          };
        });

        if (createdPane) {
          const newId = (createdPane as TerminalPane).id;
          setTimeout(() => {
            useTerminalFocusStore.getState().focusTerminal(newId);
          }, 50);
        }

        return createdPane;
      },
      deleteTerminal: (workspaceId: string, terminalId: string) => {
        // 1. Terminate backend PTY process
        import("@tauri-apps/api/core")
          .then(({ isTauri, invoke }) => {
            if (isTauri()) {
              invoke("close_terminal", { id: terminalId }).catch(() => {
                /* ignore */
              });
            }
          })
          .catch(() => {
            /* ignore */
          });

        // 2. Handle active focus migration
        const { focusedTerminalId, focusTerminal, setFocusedTerminalId } =
          useTerminalFocusStore.getState();

        set((state) => {
          const workspace = state.workspaces.find((w) => w.id === workspaceId);
          if (!workspace) {
            return {};
          }

          const deletedIndex = workspace.panes.findIndex(
            (p) => p.id === terminalId
          );
          if (deletedIndex === -1) {
            return {};
          }

          const remainingPanes = workspace.panes
            .filter((p) => p.id !== terminalId)
            .map((p, idx) => ({
              ...p,
              title: `Terminal ${idx + 1}`,
            }));

          if (focusedTerminalId === terminalId) {
            let nextFocusTarget: string | null = null;
            if (remainingPanes.length > 0) {
              if (deletedIndex < remainingPanes.length) {
                nextFocusTarget = remainingPanes[deletedIndex]?.id ?? null;
              } else {
                nextFocusTarget = remainingPanes.at(-1)?.id ?? null;
              }
            }

            if (nextFocusTarget) {
              setTimeout(() => {
                focusTerminal(nextFocusTarget);
              }, 50);
            } else {
              setFocusedTerminalId(null);
            }
          }

          const updatedWorkspaces = state.workspaces.map((w) =>
            w.id === workspaceId
              ? {
                  ...w,
                  panes: remainingPanes,
                  terminalCount: remainingPanes.length,
                }
              : w
          );

          return {
            workspaces: updatedWorkspaces,
          };
        });
      },
      replaceTerminal: (workspaceId: string, terminalId: string) => {
        // 1. Terminate old backend PTY process
        import("@tauri-apps/api/core")
          .then(({ isTauri, invoke }) => {
            if (isTauri()) {
              invoke("close_terminal", { id: terminalId }).catch(() => {
                /* ignore */
              });
            }
          })
          .catch(() => {
            /* ignore */
          });

        const newTerminalId = generateId();

        set((state) => {
          const workspace = state.workspaces.find((w) => w.id === workspaceId);
          if (!workspace) {
            return {};
          }

          const paneIndex = workspace.panes.findIndex(
            (p) => p.id === terminalId
          );
          if (paneIndex === -1) {
            return {};
          }

          const oldPane = workspace.panes[paneIndex];
          if (!oldPane) {
            return {};
          }

          const newPanes = [...workspace.panes];
          newPanes[paneIndex] = {
            ...oldPane,
            id: newTerminalId,
          };

          return {
            workspaces: state.workspaces.map((w) =>
              w.id === workspaceId
                ? {
                    ...w,
                    panes: newPanes,
                  }
                : w
            ),
          };
        });

        // 2. Automatically migrate focus to the newly spawned terminal instance
        setTimeout(() => {
          useTerminalFocusStore.getState().focusTerminal(newTerminalId);
        }, 50);

        return newTerminalId;
      },
      createWorkspace: (
        name: string,
        terminalCount: number,
        directory?: string,
        autoCommand?: string
      ) => {
        const clamped = Math.min(8, Math.max(1, terminalCount));
        const workspace: Workspace = {
          createdAt: Date.now(),
          id: generateId(),
          name,
          terminalCount: clamped,
          panes: createPanes(clamped),
          directory,
          autoCommand,
          isPinned: false,
        };
        set((state) => {
          const currentRecent = state.recentDirectories || [];
          let updatedRecent = currentRecent;
          if (directory) {
            updatedRecent = [
              directory,
              ...currentRecent.filter((d) => d !== directory),
            ].slice(0, 5);
          }
          return {
            activeWorkspaceId: workspace.id,
            workspaces: [...state.workspaces, workspace],
            recentDirectories: updatedRecent,
          };
        });
        return workspace;
      },
      deleteWorkspace: (id: string) => {
        set((state) => {
          const workspace = state.workspaces.find((w) => w.id === id);
          if (workspace) {
            import("@tauri-apps/api/core")
              .then(({ isTauri, invoke }) => {
                if (isTauri()) {
                  for (const pane of workspace.panes) {
                    invoke("close_terminal", { id: pane.id }).catch(() => {
                      /* ignore */
                    });
                  }
                }
              })
              .catch(() => {
                /* ignore */
              });
          }

          const remaining = state.workspaces.filter((w) => w.id !== id);
          return {
            activeWorkspaceId:
              state.activeWorkspaceId === id
                ? (remaining[0]?.id ?? null)
                : state.activeWorkspaceId,
            workspaces: remaining,
          };
        });
      },
      duplicateWorkspace: (id: string) => {
        set((state) => {
          const workspace = state.workspaces.find((w) => w.id === id);
          if (!workspace) {
            return {};
          }
          const duplicated: Workspace = {
            ...workspace,
            id: generateId(),
            createdAt: Date.now(),
            name: `${workspace.name} (Copy)`,
            panes: createPanes(workspace.terminalCount),
            isPinned: false,
          };
          return {
            workspaces: [...state.workspaces, duplicated],
            activeWorkspaceId: duplicated.id,
          };
        });
      },
      renameWorkspace: (id: string, name: string) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id ? { ...w, name } : w
          ),
        }));
      },
      setActiveWorkspace: (id: string) => {
        set({ activeWorkspaceId: id });
        const workspace = get().workspaces.find((w) => w.id === id);
        if (workspace && workspace.panes.length > 0) {
          const focusedId = useTerminalFocusStore.getState().focusedTerminalId;
          const isFocusedInWorkspace = workspace.panes.some(
            (p) => p.id === focusedId
          );
          if (!isFocusedInWorkspace) {
            const firstPane = workspace.panes[0];
            if (firstPane) {
              setTimeout(() => {
                useTerminalFocusStore.getState().focusTerminal(firstPane.id);
              }, 60);
            }
          }
        }
      },
      togglePinWorkspace: (id: string) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id ? { ...w, isPinned: !w.isPinned } : w
          ),
        }));
      },
    }),
    {
      name: "hyperion-workspaces-v2",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
