"use client";

import {
  getNextAvailableTerminalColor,
  shuffleArray,
  TERMINAL_IDENTITY_PALETTE,
} from "@workspace/core/config/terminal-colors";
import { safeStorage } from "@workspace/core/lib/safe-json";
import { safeUUID } from "@workspace/core/lib/uuid";
import { useKanbanStore } from "@workspace/core/stores/kanban-store";
import { useTerminalFocusStore } from "@workspace/core/stores/terminal-focus-store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface TerminalPane {
  /** Overrides the workspace's own autoCommand for this one terminal (e.g. a specific CLI agent). */
  autoCommand?: string;
  /** Unique status dot color assigned to this terminal instance. */
  color?: string;
  id: string;
  /** Last CLI explicitly launched in this pane; used only when starting a new session. */
  lastCliCommand?: string;
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
  /** Lets terminals running Claude Code / Codex / Antigravity message each other by name. Default off. */
  teamChatEnabled?: boolean;
  terminalCount: number;
}

export type WorkspaceViewMode = "board" | "changes" | "preview" | "terminals";

interface WorkspaceState {
  activeView: WorkspaceViewMode;
  activeWorkspaceId: string | null;
  addTerminal: (
    workspaceId: string,
    autoCommand?: string
  ) => TerminalPane | null;
  createWorkspace: (
    name: string,
    terminalCount: number,
    directory?: string,
    autoCommand?: string,
    teamChatEnabled?: boolean
  ) => Workspace;
  deleteTerminal: (workspaceId: string, terminalId: string) => void;
  deleteWorkspace: (id: string) => void;
  duplicateWorkspace: (id: string) => void;
  getTerminalStartupCommand: (
    terminalId: string,
    fallback?: string
  ) => string | undefined;
  recentDirectories: string[];
  renameWorkspace: (id: string, name: string) => void;
  replaceTerminal: (workspaceId: string, terminalId: string) => string | null;
  setActiveView: (view: WorkspaceViewMode) => void;
  setActiveWorkspace: (id: string) => void;
  setTeamChatEnabled: (id: string, enabled: boolean) => void;
  setTerminalCliCommand: (terminalId: string, command: string) => void;
  setWorkspaceDirectory: (id: string, directory: string) => void;
  togglePinWorkspace: (id: string) => void;
  workspaces: Workspace[];
}

function generateId(): string {
  return safeUUID();
}

/** The old hardcoded terminal status green that predates the identity-color system. */
const LEGACY_GREEN = "#34d399";

export function ensureWorkspaceColors(workspace: Workspace): Workspace {
  let changed = false;
  const usedColors = new Set<string>();

  const updatedPanes = workspace.panes.map((p) => {
    const isValid =
      p.color &&
      p.color !== LEGACY_GREEN &&
      (TERMINAL_IDENTITY_PALETTE as readonly string[]).includes(p.color) &&
      !usedColors.has(p.color);

    if (isValid) {
      usedColors.add(p.color!);
      return p;
    }

    changed = true;
    const color = getNextAvailableTerminalColor(usedColors);
    usedColors.add(color);
    return { ...p, color };
  });

  if (!changed) {
    return workspace;
  }
  return { ...workspace, panes: updatedPanes };
}

function createPanes(count: number): TerminalPane[] {
  const maxOffset = FRIENDLY_NAMES.length - count;
  const offset = maxOffset > 0 ? Math.floor(Math.random() * maxOffset) : 0;
  const shuffledColors = shuffleArray(TERMINAL_IDENTITY_PALETTE);
  return Array.from({ length: count }, (_, i) => ({
    color: shuffledColors[i % shuffledColors.length],
    id: generateId(),
    name: FRIENDLY_NAMES[(offset + i) % FRIENDLY_NAMES.length],
    title: `Terminal ${i + 1}`,
  }));
}

export const MAX_TERMINALS_PER_WORKSPACE = 8;

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      activeView: "terminals",
      activeWorkspaceId: null,
      workspaces: [],
      recentDirectories: [],
      getTerminalStartupCommand: (terminalId, fallback) => {
        for (const workspace of get().workspaces) {
          const pane = workspace.panes.find(
            (candidate) => candidate.id === terminalId
          );
          if (pane) {
            return (
              pane.lastCliCommand ??
              pane.autoCommand ??
              workspace.autoCommand ??
              fallback
            );
          }
        }
        return fallback;
      },
      setTerminalCliCommand: (terminalId, command) => {
        set((state) => ({
          workspaces: state.workspaces.map((workspace) => {
            if (
              !workspace.panes.some(
                (pane) =>
                  pane.id === terminalId && pane.lastCliCommand !== command
              )
            ) {
              return workspace;
            }
            return {
              ...workspace,
              panes: workspace.panes.map((pane) =>
                pane.id === terminalId
                  ? { ...pane, lastCliCommand: command }
                  : pane
              ),
            };
          }),
        }));
      },
      setActiveView: (activeView) => {
        if (activeView !== "terminals" && activeView !== get().activeView) {
          useTerminalFocusStore.getState().releaseTerminalFocus();
        }
        set({ activeView });
      },
      addTerminal: (workspaceId: string, autoCommand?: string) => {
        let createdPane: TerminalPane | null = null;
        set((state) => {
          const rawWorkspace = state.workspaces.find(
            (w) => w.id === workspaceId
          );
          if (
            !rawWorkspace ||
            rawWorkspace.panes.length >= MAX_TERMINALS_PER_WORKSPACE
          ) {
            return {};
          }
          const workspace = ensureWorkspaceColors(rawWorkspace);

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

          const usedColors = workspace.panes
            .map((p) => p.color)
            .filter(Boolean) as string[];
          const randomColor = getNextAvailableTerminalColor(usedColors);

          const newIndex = workspace.panes.length;
          createdPane = {
            autoCommand,
            color: randomColor,
            id: generateId(),
            name: randomName,
            title: `Terminal ${newIndex + 1}`,
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
                : ensureWorkspaceColors(w)
            ),
          };
        });

        if (createdPane) {
          const newId = (createdPane as TerminalPane).id;
          useTerminalFocusStore.getState().focusTerminal(newId);
        }

        return createdPane;
      },
      deleteTerminal: (workspaceId: string, terminalId: string) => {
        // 1. Terminate backend PTY process & orchestrator registration
        import("@tauri-apps/api/core")
          .then(({ isTauri, invoke }) => {
            if (isTauri()) {
              const attemptClose = (retries: number): void => {
                invoke("close_terminal", { id: terminalId }).catch(() => {
                  if (retries > 0) {
                    setTimeout(
                      () => attemptClose(retries - 1),
                      500 * (4 - retries)
                    );
                  } else {
                    console.warn(
                      `[workspace-store] Failed to close terminal ${terminalId} after retries — possible zombie PTY`
                    );
                  }
                });
              };
              attemptClose(3);
            }
          })
          .catch(() => {
            /* Tauri API not available (browser dev mode) */
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

          // Calculate focus migration if deleted terminal was focused
          if (focusedTerminalId === terminalId) {
            let nextFocusTarget: string | null = null;
            if (remainingPanes.length > 0) {
              // Priority: Next terminal (which shifted to deletedIndex), else Previous terminal
              if (deletedIndex < remainingPanes.length) {
                nextFocusTarget = remainingPanes[deletedIndex]?.id ?? null;
              } else {
                nextFocusTarget = remainingPanes.at(-1)?.id ?? null;
              }
            }

            if (nextFocusTarget) {
              focusTerminal(nextFocusTarget);
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
        if (
          !get().workspaces.some(
            (workspace) =>
              workspace.id === workspaceId &&
              workspace.panes.some((pane) => pane.id === terminalId)
          )
        ) {
          return null;
        }
        // 1. Terminate old backend PTY process & orchestrator registration
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
        useTerminalFocusStore.getState().focusTerminal(newTerminalId);

        return newTerminalId;
      },
      createWorkspace: (
        name: string,
        terminalCount: number,
        directory?: string,
        autoCommand?: string,
        teamChatEnabled?: boolean
      ) => {
        const clamped = Math.min(
          MAX_TERMINALS_PER_WORKSPACE,
          Math.max(1, terminalCount)
        );
        const workspace: Workspace = {
          createdAt: Date.now(),
          id: generateId(),
          name,
          terminalCount: clamped,
          panes: createPanes(clamped),
          directory,
          autoCommand,
          teamChatEnabled: teamChatEnabled ?? false,
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
            activeView: "terminals",
            workspaces: [...state.workspaces, workspace],
            recentDirectories: updatedRecent,
          };
        });
        return workspace;
      },
      deleteWorkspace: (id: string) => {
        const workspace = get().workspaces.find((w) => w.id === id);
        if (workspace) {
          // 1. Terminate backend Tauri PTYs
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

          useKanbanStore.getState().deleteWorkspaceBoard(id);

          // 2. Clean up focused terminal reference if it belonged to this workspace
          const focusStore = useTerminalFocusStore.getState();
          const paneIds = new Set(workspace.panes.map((p) => p.id));
          if (
            focusStore.focusedTerminalId &&
            paneIds.has(focusStore.focusedTerminalId)
          ) {
            focusStore.setFocusedTerminalId(null);
          }
        }

        set((state) => {
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
            activeView: "terminals",
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
        useTerminalFocusStore.getState().releaseTerminalFocus();
        set({ activeWorkspaceId: id });
      },
      setTeamChatEnabled: (id: string, enabled: boolean) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id ? { ...w, teamChatEnabled: enabled } : w
          ),
        }));
      },
      setWorkspaceDirectory: (id: string, directory: string) => {
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
            workspaces: state.workspaces.map((w) =>
              w.id === id ? { ...w, directory } : w
            ),
            recentDirectories: updatedRecent,
          };
        });
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
      name: "marshell-workspaces-v2",
      storage: createJSONStorage(() => safeStorage),
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return;
        }
        state.workspaces = state.workspaces.map((w) =>
          ensureWorkspaceColors(w)
        );
        try {
          const raw =
            typeof window === "undefined"
              ? null
              : localStorage.getItem("marshell-general-settings");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.state?.restoreTabsOnStartup === false) {
              state.activeWorkspaceId = null;
            }
          }
        } catch {
          // Keep current state if parse fails
        }
      },
    }
  )
);

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).useWorkspaceStore =
    useWorkspaceStore;
}
