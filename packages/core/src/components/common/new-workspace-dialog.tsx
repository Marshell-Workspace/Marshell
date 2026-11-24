"use client";

import { AiCliLogo } from "@workspace/core/components/common/ai-cli-logos";
import { CreateWorkspaceIcon } from "@workspace/core/components/common/custom-icons";
import { ErrorBoundary } from "@workspace/core/components/common/error-boundary";
import { FolderPickerDialog } from "@workspace/core/components/common/folder-picker-dialog";
import {
  AI_AGENTS_CATALOG,
  type CliItemMeta,
} from "@workspace/core/lib/cli-catalog";
import {
  type CliItemStatus,
  checkAllCliAgents,
  invalidateCliCache,
  refreshCliEnvironment,
} from "@workspace/core/lib/cli-installer-client";
import { validateFolderPath } from "@workspace/core/lib/folder-picker-client";
import { openExternalUrl } from "@workspace/core/lib/open-url";
import {
  isAgentAvailable,
  workspaceAgentCommand,
} from "@workspace/core/lib/workspace-setup";
import { useProcessUiStore } from "@workspace/core/stores/process-ui-store";
import { useTutorialStore } from "@workspace/core/stores/tutorial-store";
import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import { useTranslations } from "@workspace/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import {
  GenieModal,
  GenieModalClose,
  GenieModalContent,
} from "@workspace/ui/components/genie-modal";
import { Input } from "@workspace/ui/components/input";
import { cn } from "@workspace/ui/lib/utils";
import {
  ArrowRight,
  Folder,
  LayoutGrid,
  RefreshCw,
  Terminal,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

interface NewWorkspaceDialogProps {
  navigate?: (path: string) => void;
  onCreated?: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

const EMPTY_RECENT_DIRECTORIES: string[] = [];

// Specific order and metadata matching the reference design exactly
const REFERENCE_AGENTS_ORDER = [
  "codex",
  "claude",
  "gemini-cli",
  "agy",
  "opencode",
  "q",
  "github-copilot",
] as const;

// Custom metadata descriptions matching the exact reference image
const AGENT_REFERENCE_DESCRIPTIONS: Record<string, string> = {
  codex: "OpenAI's official coding agent",
  claude: "Anthropic's coding agent",
  "gemini-cli": "Google's coding agent",
  agy: "Google Antigravity autonomous coding agent",
  opencode: "Open source coding agent",
  q: "AWS developer agent",
  "github-copilot": "GitHub's coding agent",
};

export function NewWorkspaceDialog({
  open,
  onOpenChange,
  onCreated,
  navigate,
}: NewWorkspaceDialogProps) {
  const t = useTranslations("Launch");
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const recentDirectories =
    useWorkspaceStore((s) => s.recentDirectories) ?? EMPTY_RECENT_DIRECTORIES;

  // Tutorial integration: advance tutorial when workspace is created
  const activeTour = useTutorialStore((s) => s.activeTour);
  const isTutorialActive = activeTour === "onboarding";
  const isTourDialogOpen = useTutorialStore(
    (s) => s.isCreateWorkspaceDialogOpen
  );

  const [name, setName] = useState("");
  // Default to 4 terminals when tutorial is guiding the user, otherwise 2
  const [terminalCount, setTerminalCount] = useState(isTutorialActive ? 4 : 2);
  const [directory, setDirectory] = useState("");
  const [autoCommand, setAutoCommand] = useState("");
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [installStatusMap, setInstallStatusMap] = useState<
    Record<string, CliItemStatus>
  >({});
  const [isDetecting, setIsDetecting] = useState(false);
  const [lastCheckedTime, setLastCheckedTime] = useState<string | null>(null);

  const autoRunInputRef = useRef<HTMLInputElement>(null);
  const chooseLayoutButtonRef = useRef<HTMLButtonElement>(null);
  const isDetectingRef = useRef(false);
  const isMountedRef = useRef(true);
  const prevOpenRef = useRef(false);
  const folderPickerJustClosedRef = useRef(false);
  const layoutPickerJustClosedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (open) {
      useTutorialStore.getState().setCreateWorkspaceDialogOpen(true);
    }
  }, [open]);

  useEffect(() => {
    if (isTutorialActive && !isTourDialogOpen && open) {
      onOpenChange(false);
    }
  }, [isTutorialActive, isTourDialogOpen, open, onOpenChange]);

  useEffect(() => {
    if (open && isTutorialActive) {
      setName((prev) => (prev.trim() ? prev : "My Workspace"));
      setTerminalCount(4);
      setDirectory((prev) => {
        if (prev.trim()) {
          return prev;
        }
        return recentDirectories[0] || "C:\\Projects\\Workspace";
      });
    }
  }, [open, isTutorialActive, recentDirectories]);

  const refreshDetection = useCallback(async (force = false) => {
    if (isDetectingRef.current) {
      return;
    }
    isDetectingRef.current = true;
    if (isMountedRef.current) {
      setIsDetecting(true);
    }

    try {
      if (force) {
        invalidateCliCache();
        await refreshCliEnvironment();
      }
      const results = await checkAllCliAgents(force);
      if (isMountedRef.current) {
        setInstallStatusMap(results);
        const now = new Date();
        const timeStr = now
          .toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })
          .toLowerCase();
        setLastCheckedTime(timeStr);
      }
    } catch (e) {
      console.warn("Failed detecting CLI items", e);
    } finally {
      isDetectingRef.current = false;
      if (isMountedRef.current) {
        setIsDetecting(false);
      }
    }
  }, []);

  const handleRefresh = async () => {
    if (isDetecting) {
      return;
    }
    await refreshDetection(true);
  };

  const applyAutoRunCommand = (command: string) => {
    setAutoCommand(command);
    setTimeout(() => {
      if (autoRunInputRef.current) {
        autoRunInputRef.current.focus();
        autoRunInputRef.current.select();
      }
    }, 60);
  };

  const handleGetCli = async (agent: CliItemMeta) => {
    const url = agent.getCliUrl || agent.docsUrl;
    if (url) {
      try {
        await openExternalUrl(url);
      } catch (err) {
        console.warn("Failed to open external url", err);
        window.open(url, "_blank", "noopener,noreferrer");
      }
    }
  };

  const handleLaunchAgent = (agent: CliItemMeta) => {
    const command = workspaceAgentCommand(agent, "direct");
    applyAutoRunCommand(command);
  };

  const handleOpenOfficialDocs = async (agent: CliItemMeta) => {
    const url = agent.docsUrl || agent.getCliUrl;
    if (url) {
      try {
        await openExternalUrl(url);
      } catch (err) {
        console.warn("Failed to open external url", err);
        window.open(url, "_blank", "noopener,noreferrer");
      }
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    refreshDetection();

    const handleFocus = () => {
      if (isMountedRef.current && open) {
        refreshDetection(true);
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [open, refreshDetection]);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setName(`Workspace ${workspaces.length + 1}`);
      // Tutorial mode defaults to 4 terminals so the user sees the recommended layout
      setTerminalCount(isTutorialActive ? 4 : 2);
      const suggestedDir =
        isTutorialActive && recentDirectories.length > 0
          ? (recentDirectories[0] ?? "")
          : isTutorialActive
            ? "C:\\Projects\\Workspace"
            : "";
      setDirectory(suggestedDir);
      setAutoCommand("");
    }
    prevOpenRef.current = open;
  }, [open, workspaces.length, isTutorialActive, recentDirectories]);

  const handleSelectDirectory = () => {
    useTutorialStore.getState().setChildSurface(true);
    setFolderPickerOpen(true);
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Please enter a workspace name.");
      return;
    }

    const trimmedDir = directory.trim();
    if (!trimmedDir) {
      toast.error("Please select or enter a working directory.");
      return;
    }

    setIsCreating(true);
    try {
      let isValid = await validateFolderPath(trimmedDir);
      if (!isValid && isTutorialActive) {
        isValid = true;
      }
      if (!isValid) {
        toast.error("Working directory does not exist or is inaccessible.");
        setIsCreating(false);
        return;
      }

      createWorkspace(
        trimmedName,
        terminalCount,
        trimmedDir,
        autoCommand.trim()
      );

      // Explicitly switch to the terminals view and close processes drawer
      useWorkspaceStore.getState().setActiveView("terminals");
      useProcessUiStore.getState().setOpen(false);

      // Notify tutorial store of workspace creation before closing dialog
      if (isTutorialActive) {
        useTutorialStore.getState().fireAction("workspace-created");
      }

      onOpenChange(false);
      if (navigate) {
        navigate("/workspace");
      }
      onCreated?.();
    } catch (err) {
      console.warn("Workspace creation validation failed", err);
      toast.error("Could not validate the working directory path.");
    } finally {
      if (isMountedRef.current) {
        setIsCreating(false);
      }
    }
  };

  const handleFolderPickerOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      folderPickerJustClosedRef.current = true;
      setTimeout(() => {
        folderPickerJustClosedRef.current = false;
      }, 350);
    }
    useTutorialStore.getState().setChildSurface(nextOpen);
    setFolderPickerOpen(nextOpen);
  };

  const handleSelectFolder = (selectedPath: string) => {
    folderPickerJustClosedRef.current = true;
    setDirectory(selectedPath);
    if (selectedPath.trim()) {
      useTutorialStore.getState().fireAction("directory-selected");
    }
    useTutorialStore.getState().setChildSurface(false);
    setFolderPickerOpen(false);
    setTimeout(() => {
      folderPickerJustClosedRef.current = false;
    }, 350);
  };

  const handleOpenLayoutPicker = () => {
    useTutorialStore.getState().setChildSurface(true);
    setLayoutPickerOpen(true);
  };

  const handleLayoutPickerOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      layoutPickerJustClosedRef.current = true;
      setTimeout(() => {
        layoutPickerJustClosedRef.current = false;
      }, 350);
    }
    useTutorialStore.getState().setChildSurface(nextOpen);
    setLayoutPickerOpen(nextOpen);
  };

  const handleApplyLayout = (count: number) => {
    layoutPickerJustClosedRef.current = true;
    setTerminalCount(count);
    const tourState = useTutorialStore.getState();
    const currentStep = tourState.getCurrentStep();
    if (
      tourState.activeTour === "onboarding" &&
      tourState.machineState === "active" &&
      currentStep?.id === "onboarding-terminal-layout"
    ) {
      tourState.nextStep();
    }
    useTutorialStore.getState().setChildSurface(false);
    setLayoutPickerOpen(false);
    setTimeout(() => {
      layoutPickerJustClosedRef.current = false;
    }, 350);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (
      !nextOpen &&
      (folderPickerOpen ||
        folderPickerJustClosedRef.current ||
        layoutPickerOpen ||
        layoutPickerJustClosedRef.current)
    ) {
      return;
    }
    useTutorialStore.getState().setCreateWorkspaceDialogOpen(nextOpen);
    onOpenChange(nextOpen);
  };

  const effectiveRecentPills = useMemo(
    () =>
      recentDirectories.slice(0, 3).map((d) => ({
        label: d.split(/[/\\]/).pop() || d,
        path: d,
      })),
    [recentDirectories]
  );

  const activeOrder = REFERENCE_AGENTS_ORDER;

  // List of agents to show in the right column
  const agentsList = useMemo(
    () =>
      activeOrder.map((id) => {
        const found = AI_AGENTS_CATALOG.find((a) => a.id === id);
        return (
          found ?? {
            id,
            name: id,
            description: "",
            command: id,
            execName: id,
          }
        );
      }),
    [activeOrder]
  );

  // Installed agents at the top, not installed agents below
  const sortedAgentsList = useMemo(
    () =>
      [...agentsList].sort((a, b) => {
        const aInstalled = isAgentAvailable(installStatusMap[a.id]);
        const bInstalled = isAgentAvailable(installStatusMap[b.id]);
        if (aInstalled === bInstalled) {
          const aIndex = (activeOrder as readonly string[]).indexOf(a.id);
          const bIndex = (activeOrder as readonly string[]).indexOf(b.id);
          return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
        }
        return aInstalled ? -1 : 1;
      }),
    [activeOrder, agentsList, installStatusMap]
  );

  return (
    <>
      <GenieModal
        onOpenChange={handleDialogOpenChange}
        open={open}
        triggerSelector='[data-workspace-trigger="new-workspace"], [data-workspace-trigger="new-workspace-collapsed"], [data-workspace-trigger="new-workspace-header"], [data-workspace-trigger="new-workspace-empty"]'
      >
        <GenieModalContent
          className="flex flex-col min-h-0 h-[94vh] max-h-[960px] w-[97vw] max-w-[1400px] gap-0 overflow-hidden border border-border/80 bg-popover p-0 text-popover-foreground shadow-2xl focus:outline-none rounded-2xl"
          onEscapeKeyDown={(e) => {
            if (
              folderPickerOpen ||
              folderPickerJustClosedRef.current ||
              layoutPickerOpen ||
              layoutPickerJustClosedRef.current
            ) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            const originalTarget = (e.detail as { originalEvent?: Event })
              ?.originalEvent?.target as HTMLElement | null;
            if (
              isTutorialActive ||
              folderPickerOpen ||
              folderPickerJustClosedRef.current ||
              layoutPickerOpen ||
              layoutPickerJustClosedRef.current ||
              originalTarget?.closest?.(
                "[data-tour-element], [data-tour-id], [data-tour], [data-tour-surface]"
              )
            ) {
              e.preventDefault();
            }
          }}
          onPointerDownOutside={(e) => {
            const originalTarget = (e.detail as { originalEvent?: Event })
              ?.originalEvent?.target as HTMLElement | null;
            if (
              isTutorialActive ||
              folderPickerOpen ||
              folderPickerJustClosedRef.current ||
              layoutPickerOpen ||
              layoutPickerJustClosedRef.current ||
              originalTarget?.closest?.(
                "[data-tour-element], [data-tour-id], [data-tour], [data-tour-surface]"
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          {/* Header (approx 74px height) */}
          <DialogHeader className="min-h-[64px] sm:h-[74px] shrink-0 flex flex-row items-center justify-between border-b border-border/70 bg-card/40 px-4 sm:px-6 py-2 sm:py-0">
            <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
              {/* Stacked windows workspace icon */}
              <div className="flex size-[38px] sm:size-[42px] items-center justify-center rounded-[10px] border border-border/80 bg-muted/60 text-foreground shadow-sm shrink-0">
                <CreateWorkspaceIcon className="size-4.5 sm:size-5 text-primary" />
              </div>
              <div className="flex flex-col min-w-0">
                <DialogTitle className="font-sans font-semibold text-foreground text-lg sm:text-[21px] leading-tight tracking-tight truncate">
                  Create Workspace
                </DialogTitle>
                <DialogDescription className="font-sans text-muted-foreground text-[11.5px] sm:text-[12.5px] leading-normal mt-0.5 line-clamp-1 sm:line-clamp-none">
                  Set up a custom dev environment with terminal layouts and
                  initial configs.
                </DialogDescription>
              </div>
            </div>

            {/* Custom subtle close button in top-right */}
            <GenieModalClose
              aria-label="Close"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer ml-2"
            >
              <X className="size-4.5" />
            </GenieModalClose>
          </DialogHeader>

          {/* Main Body (Stacked on small screens, Two Columns on large screens) */}
          <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden subtle-scrollbar flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-border/70">
            {/* Left Column (Workspace details & Environment setup) */}
            <div className="relative w-full lg:w-[54.5%] p-4 sm:p-6 lg:p-7 flex flex-col gap-6 shrink-0 lg:shrink lg:h-full lg:min-h-0 lg:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {/* Continuous vertical timeline rail running from Step 1 through Step 2 down to the bottom horizontal border */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-[30.25px] sm:left-[38.25px] lg:left-[42.25px] top-[31px] sm:top-[39px] lg:top-[43px] bottom-0 w-[1.5px] bg-border/80 z-0"
              />
              <ErrorBoundary>
                <div className="relative flex flex-col gap-5 z-10">
                  {/* STEP 1: Workspace details */}
                  <div className="relative flex items-start gap-3.5 sm:gap-4 z-10">
                    {/* Step circle indicator 1 */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className="flex size-[30px] items-center justify-center rounded-full border border-border bg-muted/60 text-foreground font-sans font-semibold text-[13px] shadow-xs">
                        1
                      </div>
                    </div>

                    {/* Step 1 Content */}
                    <div className="flex-1 min-w-0 flex flex-col gap-2 pt-0.5">
                      <div>
                        <h3 className="font-heading font-semibold text-[15px] text-foreground tracking-tight">
                          Workspace details
                        </h3>
                        <p className="font-sans text-[12px] text-muted-foreground">
                          Name your workspace and choose where it lives.
                        </p>
                      </div>

                      {/* Step 1 Card Container */}
                      <div className="mt-2 flex flex-col gap-4">
                        {/* Workspace name */}
                        <div className="flex flex-col gap-1.5">
                          <label
                            className="font-sans font-medium text-[12.5px] text-foreground/90"
                            htmlFor="ws-name"
                          >
                            Workspace name
                          </label>
                          <Input
                            className="h-[38px] rounded-[7px] border border-border/80 bg-background/70 font-sans text-[13.5px] text-foreground px-3 placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                            data-tour="workspace-name-input"
                            id="ws-name"
                            onChange={(e) => {
                              setName(e.target.value);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && name.trim()) {
                                e.preventDefault();
                                useTutorialStore
                                  .getState()
                                  .fireAction("name-entered");
                              }
                            }}
                            placeholder="Workspace 2"
                            value={name}
                          />
                        </div>

                        {/* Working directory */}
                        <div className="flex flex-col gap-1.5">
                          <label
                            className="font-sans font-medium text-[12.5px] text-foreground/90"
                            htmlFor="ws-dir"
                          >
                            Working directory
                          </label>
                          {/* Grouped directory input row */}
                          <div
                            className="flex h-[38px] items-center rounded-[7px] border border-border/80 bg-background/70 overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary"
                            data-tour="workspace-dir-input"
                          >
                            <div className="flex items-center justify-center px-3 text-muted-foreground shrink-0 border-r border-border/70">
                              <Folder className="size-4 text-muted-foreground" />
                            </div>
                            <input
                              autoCapitalize="off"
                              autoComplete="off"
                              autoCorrect="off"
                              className="flex-1 bg-transparent px-3 font-mono text-[12.5px] text-foreground outline-none min-w-0 placeholder:text-muted-foreground"
                              id="ws-dir"
                              onChange={(e) => {
                                setDirectory(e.target.value);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && directory.trim()) {
                                  e.preventDefault();
                                  useTutorialStore
                                    .getState()
                                    .fireAction("directory-selected");
                                }
                              }}
                              placeholder="C:\Users\User\Projects"
                              spellCheck={false}
                              value={directory}
                            />
                            <button
                              className="h-full px-3.5 border-l border-border/70 font-sans text-[12px] font-medium text-foreground/90 hover:bg-muted/80 hover:text-foreground transition-colors cursor-pointer shrink-0"
                              onClick={handleSelectDirectory}
                              type="button"
                            >
                              Browse...
                            </button>
                          </div>

                          {/* Recent pills row */}
                          {effectiveRecentPills.length > 0 && (
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="font-sans text-[11.5px] text-muted-foreground">
                                Recent:
                              </span>
                              {effectiveRecentPills.map((pill) => (
                                <button
                                  className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-2.5 py-0.5 font-sans text-[11px] text-foreground/85 hover:border-primary/50 hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                                  key={pill.path}
                                  onClick={() => {
                                    setDirectory(pill.path);
                                    useTutorialStore
                                      .getState()
                                      .fireAction("directory-selected");
                                  }}
                                  title={pill.path}
                                  type="button"
                                >
                                  <Folder className="size-3 text-muted-foreground" />
                                  <span>{pill.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* STEP 2: Environment setup */}
                  <div className="relative flex items-start gap-3.5 sm:gap-4 z-10">
                    {/* Step circle 2 */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className="flex size-[30px] items-center justify-center rounded-full border border-border bg-muted/60 text-foreground font-sans font-semibold text-[13px] shadow-xs">
                        2
                      </div>
                    </div>

                    {/* Step 2 Content */}
                    <div className="flex-1 min-w-0 flex flex-col gap-2 pt-0.5">
                      <div>
                        <h3 className="font-heading font-semibold text-[15px] text-foreground tracking-tight">
                          Environment setup
                        </h3>
                        <p className="font-sans text-[12px] text-muted-foreground">
                          Configure how the workspace starts and runs.
                        </p>
                      </div>

                      {/* Step 2 Card Container */}
                      <div className="mt-2 flex flex-col gap-4">
                        {/* Auto-run command row */}
                        <div className="flex flex-col gap-3 pt-1">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
                              <Terminal className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-sans font-medium text-[12.5px] text-foreground">
                                Auto-run command
                              </div>
                              <div className="font-sans text-[11.5px] text-muted-foreground truncate">
                                Run a command when the workspace starts.
                              </div>
                            </div>
                          </div>

                          <Input
                            autoCapitalize="off"
                            autoComplete="off"
                            autoCorrect="off"
                            className="h-[36px] w-full rounded-[7px] border border-border/80 bg-background/70 font-mono text-[11.5px] text-foreground px-3 placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                            data-tour="autorun-input"
                            id="auto-run-cmd"
                            onChange={(e) => setAutoCommand(e.target.value)}
                            placeholder="e.g. npm install && npm run dev"
                            ref={autoRunInputRef}
                            spellCheck={false}
                            value={autoCommand}
                          />
                        </div>

                        {/* Terminal Layout row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/60 pt-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
                              <LayoutGrid className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-sans font-medium text-[12.5px] text-foreground">
                                Terminal layout
                              </div>
                              <div className="font-sans text-[11.5px] text-muted-foreground truncate">
                                Set how many terminals you want and how they are
                                arranged.
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
                            {/* Selected terminal count indicator */}
                            <div className="flex min-w-[20px] items-center justify-center font-sans font-semibold text-[15px] text-foreground tabular-nums">
                              {terminalCount}
                            </div>

                            <button
                              className="flex items-center justify-center h-[34px] px-3.5 rounded-[8px] border border-border bg-muted/50 hover:bg-muted text-foreground text-[12px] font-medium transition-colors cursor-pointer shrink-0 shadow-xs"
                              data-tour="layout-selector"
                              onClick={handleOpenLayoutPicker}
                              ref={chooseLayoutButtonRef}
                              type="button"
                            >
                              Choose layout
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </ErrorBoundary>
            </div>

            {/* Right Column (AI Agents — 3rd section when stacked) */}
            <div
              className="relative w-full lg:w-[45.5%] p-4 sm:p-6 lg:p-7 flex flex-col gap-3 shrink-0 lg:shrink lg:h-full lg:min-h-0 lg:overflow-y-auto subtle-scrollbar"
              data-tour="workspace-ai-agents-column"
            >
              {/* Continuous vertical timeline incoming line from top border into Step 3 */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-[30.25px] sm:left-[38.25px] lg:left-[42.25px] top-0 h-[31px] sm:h-[39px] lg:h-[43px] w-[1.5px] bg-border/80 z-0"
              />
              {/* Header with Step 3 & Refresh button */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 z-10">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex size-[30px] shrink-0 items-center justify-center rounded-full border border-border bg-muted/60 text-foreground font-sans font-semibold text-[13px] shadow-xs">
                    3
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-heading font-semibold text-[15px] text-foreground tracking-tight">
                      AI agents
                    </h3>
                    <p className="font-sans text-[12px] text-muted-foreground">
                      Select and configure the AI coding agents for this
                      workspace.
                    </p>
                  </div>
                </div>

                {/* Refresh and timestamp */}
                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 pl-10 sm:pl-0">
                  <button
                    className={cn(
                      "flex items-center gap-1.5 rounded-[6px] border border-border/80 bg-muted/50 px-2.5 py-1 font-sans text-[11.5px] font-medium text-foreground/90 hover:bg-muted hover:text-foreground transition-colors cursor-pointer shrink-0",
                      isDetecting && "opacity-75"
                    )}
                    disabled={isDetecting}
                    onClick={handleRefresh}
                    type="button"
                  >
                    <RefreshCw
                      className={cn(
                        "size-3.5 text-muted-foreground",
                        isDetecting && "animate-spin text-primary"
                      )}
                    />
                    <span>Refresh</span>
                  </button>
                  <span className="font-sans text-[10px] text-muted-foreground whitespace-nowrap">
                    {lastCheckedTime
                      ? t("checkedAt", { time: lastCheckedTime })
                      : t("notChecked")}
                  </span>
                </div>
              </div>

              {/* Integrated AI Agents Container Panel */}
              <div
                className="mt-3 flex flex-col divide-y divide-border/60 border-y border-border/60"
                data-tour="workspace-ai-agents-list"
              >
                {sortedAgentsList.map((agent) => {
                  const isInstalled = isAgentAvailable(
                    installStatusMap[agent.id]
                  );
                  const desc =
                    AGENT_REFERENCE_DESCRIPTIONS[agent.id] || agent.description;

                  return (
                    <div
                      className="flex min-h-[62px] flex-wrap items-center justify-between gap-y-2 gap-x-3 px-1 sm:px-1.5 py-2.5 sm:py-3 hover:bg-muted/30 transition-colors"
                      key={agent.id}
                    >
                      {/* Left: Icon, Name & Description */}
                      <div className="flex items-center gap-3 min-w-[140px] flex-1">
                        <div className="flex size-[28px] shrink-0 items-center justify-center text-foreground">
                          <AiCliLogo
                            className="size-full object-contain"
                            id={agent.id}
                          />
                        </div>

                        <div className="flex flex-col min-w-0">
                          {agent.docsUrl || agent.getCliUrl ? (
                            <button
                              className="w-fit max-w-full cursor-pointer truncate text-left font-sans font-medium text-[13px] text-foreground leading-tight underline-offset-2 transition-colors hover:text-primary hover:underline focus-visible:underline focus-visible:outline-none"
                              onClick={() => handleOpenOfficialDocs(agent)}
                              title={`Open ${agent.name} documentation`}
                              type="button"
                            >
                              {agent.name}
                            </button>
                          ) : (
                            <span className="font-sans font-medium text-[13px] text-foreground leading-tight truncate">
                              {agent.name}
                            </span>
                          )}
                          <span className="font-sans text-[11px] text-muted-foreground leading-tight truncate mt-0.5">
                            {desc}
                          </span>
                        </div>
                      </div>

                      {/* Right: Status indicator + Action buttons */}
                      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
                        {/* Theme status indicator dot */}
                        <div className="flex items-center gap-1.5 font-sans text-[11.5px] text-foreground/85 whitespace-nowrap shrink-0">
                          <span
                            className={cn(
                              "size-2 rounded-full shrink-0",
                              isInstalled
                                ? "bg-primary shadow-xs"
                                : "bg-muted-foreground/50"
                            )}
                          />
                          <span>
                            {isDetecting
                              ? t("checking")
                              : isInstalled
                                ? t("available")
                                : !installStatusMap[agent.id] ||
                                    installStatusMap[agent.id]?.status ===
                                      "unknown"
                                  ? t("unknown")
                                  : t("notInstalled")}
                          </span>
                        </div>

                        {/* Buttons & Menu */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            aria-label={`${isInstalled ? "Launch" : t("getCli")} ${agent.name}`}
                            className="h-[28px] px-3 sm:px-3.5 rounded-[6px] border border-border/80 bg-muted/50 font-sans text-[11.5px] font-medium text-foreground hover:bg-muted hover:border-border transition-colors cursor-pointer shrink-0"
                            disabled={isDetecting}
                            onClick={() =>
                              isInstalled
                                ? handleLaunchAgent(agent)
                                : handleGetCli(agent)
                            }
                            type="button"
                          >
                            {isInstalled ? "Launch" : t("getCli")}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer (approx 70px height) */}
          <div className="min-h-[60px] sm:h-[70px] shrink-0 flex flex-wrap items-center justify-end gap-2.5 sm:gap-3 border-t border-border/70 bg-card/40 px-4 sm:px-6 lg:px-8 py-2.5 sm:py-0">
            <GenieModalClose className="h-[36px] sm:h-[38px] px-4 sm:px-5 rounded-[8px] border border-border/80 bg-muted/50 font-sans font-medium text-[12.5px] text-foreground/90 hover:bg-muted hover:text-foreground transition-colors cursor-pointer">
              Cancel
            </GenieModalClose>
            <button
              className={cn(
                "h-[36px] sm:h-[38px] min-w-[140px] sm:min-w-[178px] px-4 sm:px-5 rounded-[8px] font-sans font-medium text-[12.5px] text-primary-foreground flex items-center justify-center gap-1.5 transition-colors shadow-sm",
                name.trim() && directory.trim() && !isCreating
                  ? "bg-primary hover:bg-primary/90 cursor-pointer"
                  : "bg-primary/40 text-primary-foreground/60 cursor-not-allowed"
              )}
              data-tour="submit-workspace-btn"
              disabled={!(name.trim() && directory.trim()) || isCreating}
              onClick={handleCreate}
              type="button"
            >
              <span>{isCreating ? "Validating..." : "Create Workspace"}</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </GenieModalContent>
      </GenieModal>

      <FolderPickerDialog
        initialPath={directory}
        onOpenChange={handleFolderPickerOpenChange}
        onSelectFolder={handleSelectFolder}
        open={folderPickerOpen}
      />

      <ChooseTerminalLayoutDialog
        currentCount={terminalCount}
        onApply={handleApplyLayout}
        onOpenChange={handleLayoutPickerOpenChange}
        open={layoutPickerOpen}
        selectedCli={autoCommand.trim()}
        triggerRef={chooseLayoutButtonRef}
      />
    </>
  );
}

interface ChooseTerminalLayoutDialogProps {
  currentCount: number;
  onApply: (count: number) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  selectedCli?: string;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

const TERMINAL_LAYOUT_PRESETS: Record<
  number,
  {
    detailsDescription: string;
    dimensionLabel: string;
    rows: number[][];
  }
> = {
  1: {
    dimensionLabel: "1 row × 1 column",
    detailsDescription:
      "1 full-width terminal. Ideal for focused command-line tasks and continuous build logs.",
    rows: [[1]],
  },
  2: {
    dimensionLabel: "1 row × 2 columns",
    detailsDescription:
      "2 side-by-side terminals. Perfect for running a local development server alongside your CLI agent.",
    rows: [[1, 2]],
  },
  3: {
    dimensionLabel: "1 row × 3 columns",
    detailsDescription:
      "3 vertical terminals arranged side-by-side. Great for server, tests, and active agent execution.",
    rows: [[1, 2, 3]],
  },
  4: {
    dimensionLabel: "2 rows × 2 columns",
    detailsDescription:
      "4 terminals arranged in a 2×2 grid. Balanced setup for full-stack multi-process workflows.",
    rows: [
      [1, 2],
      [3, 4],
    ],
  },
  5: {
    dimensionLabel: "2 rows (3 top, 2 bottom)",
    detailsDescription:
      "5 terminals distributed across 2 rows. Great for microservices and auxiliary watchers.",
    rows: [
      [1, 2, 3],
      [4, 5],
    ],
  },
  6: {
    dimensionLabel: "2 rows × 3 columns",
    detailsDescription:
      "6 terminals arranged in 2 rows × 3 columns. Excellent for complex multi-container systems.",
    rows: [
      [1, 2, 3],
      [4, 5, 6],
    ],
  },
  7: {
    dimensionLabel: "2 rows (4 top, 3 bottom)",
    detailsDescription:
      "7 terminals distributed across 2 rows. Extensive workspace for multi-repo orchestrations.",
    rows: [
      [1, 2, 3, 4],
      [5, 6, 7],
    ],
  },
  8: {
    dimensionLabel: "2 rows × 4 columns",
    detailsDescription:
      "8 terminals arranged in 2 rows × 4 columns. Great for parallel work, monitoring, and comparisons.",
    rows: [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ],
  },
};

function LayoutPresetIcon({ count }: { count: number }) {
  switch (count) {
    case 1:
      return (
        <svg
          aria-hidden="true"
          className="size-4 shrink-0 text-current"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          viewBox="0 0 16 16"
        >
          <rect height="12" rx="2" width="12" x="2" y="2" />
        </svg>
      );
    case 2:
      return (
        <svg
          aria-hidden="true"
          className="size-4 shrink-0 text-current"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          viewBox="0 0 16 16"
        >
          <rect height="12" rx="1.5" width="5.5" x="2" y="2" />
          <rect height="12" rx="1.5" width="5.5" x="8.5" y="2" />
        </svg>
      );
    case 3:
      return (
        <svg
          aria-hidden="true"
          className="size-4 shrink-0 text-current"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          viewBox="0 0 16 16"
        >
          <rect height="12" rx="1" width="3.6" x="2" y="2" />
          <rect height="12" rx="1" width="3.6" x="6.2" y="2" />
          <rect height="12" rx="1" width="3.6" x="10.4" y="2" />
        </svg>
      );
    case 4:
      return (
        <svg
          aria-hidden="true"
          className="size-4 shrink-0 text-current"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          viewBox="0 0 16 16"
        >
          <rect height="5.5" rx="1.5" width="5.5" x="2" y="2" />
          <rect height="5.5" rx="1.5" width="5.5" x="8.5" y="2" />
          <rect height="5.5" rx="1.5" width="5.5" x="2" y="8.5" />
          <rect height="5.5" rx="1.5" width="5.5" x="8.5" y="8.5" />
        </svg>
      );
    case 5:
      return (
        <svg
          aria-hidden="true"
          className="size-4 shrink-0 text-current"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          viewBox="0 0 16 16"
        >
          <rect height="5.5" rx="1" width="3.6" x="2" y="2" />
          <rect height="5.5" rx="1" width="3.6" x="6.2" y="2" />
          <rect height="5.5" rx="1" width="3.6" x="10.4" y="2" />
          <rect height="5.5" rx="1" width="4" x="3.5" y="8.5" />
          <rect height="5.5" rx="1" width="4" x="8.5" y="8.5" />
        </svg>
      );
    case 6:
      return (
        <svg
          aria-hidden="true"
          className="size-4 shrink-0 text-current"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          viewBox="0 0 16 16"
        >
          <rect height="5.5" rx="1" width="3.6" x="2" y="2" />
          <rect height="5.5" rx="1" width="3.6" x="6.2" y="2" />
          <rect height="5.5" rx="1" width="3.6" x="10.4" y="2" />
          <rect height="5.5" rx="1" width="3.6" x="2" y="8.5" />
          <rect height="5.5" rx="1" width="3.6" x="6.2" y="8.5" />
          <rect height="5.5" rx="1" width="3.6" x="10.4" y="8.5" />
        </svg>
      );
    case 7:
      return (
        <svg
          aria-hidden="true"
          className="size-4 shrink-0 text-current"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          viewBox="0 0 16 16"
        >
          <rect height="5.5" rx="0.8" width="2.8" x="1.5" y="2" />
          <rect height="5.5" rx="0.8" width="2.8" x="5" y="2" />
          <rect height="5.5" rx="0.8" width="2.8" x="8.5" y="2" />
          <rect height="5.5" rx="0.8" width="2.8" x="12" y="2" />
          <rect height="5.5" rx="0.8" width="3.2" x="3" y="8.5" />
          <rect height="5.5" rx="0.8" width="3.2" x="7" y="8.5" />
          <rect height="5.5" rx="0.8" width="3.2" x="11" y="8.5" />
        </svg>
      );
    default:
      return (
        <svg
          aria-hidden="true"
          className="size-4 shrink-0 text-current"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          viewBox="0 0 16 16"
        >
          <rect height="5.5" rx="0.8" width="2.8" x="1.5" y="2" />
          <rect height="5.5" rx="0.8" width="2.8" x="5" y="2" />
          <rect height="5.5" rx="0.8" width="2.8" x="8.5" y="2" />
          <rect height="5.5" rx="0.8" width="2.8" x="12" y="2" />
          <rect height="5.5" rx="0.8" width="2.8" x="1.5" y="8.5" />
          <rect height="5.5" rx="0.8" width="2.8" x="5" y="8.5" />
          <rect height="5.5" rx="0.8" width="2.8" x="8.5" y="8.5" />
          <rect height="5.5" rx="0.8" width="2.8" x="12" y="8.5" />
        </svg>
      );
  }
}

function ChooseTerminalLayoutDialog({
  open,
  onOpenChange,
  currentCount,
  onApply,
  selectedCli = "",
  triggerRef,
}: ChooseTerminalLayoutDialogProps) {
  const [selectedCount, setSelectedCount] = useState(currentCount);

  useEffect(() => {
    if (open) {
      setSelectedCount(currentCount);
    }
  }, [open, currentCount]);

  const preset =
    TERMINAL_LAYOUT_PRESETS[selectedCount] ?? TERMINAL_LAYOUT_PRESETS[4]!;

  const effectiveCommand = selectedCli.trim() || "npm run dev";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="flex max-h-[90dvh] w-[95vw] max-w-[840px] flex-col gap-0 overflow-hidden rounded-2xl border border-border/80 bg-popover p-0 text-popover-foreground shadow-2xl focus:outline-none"
        data-tour-surface="choose-layout"
        showCloseButton={false}
        triggerRef={triggerRef}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/70 bg-card/40 px-5 py-4">
          <div>
            <DialogTitle className="font-sans font-semibold text-[15px] text-foreground tracking-tight">
              Choose terminal layout
            </DialogTitle>
            <DialogDescription className="sr-only">
              Choose terminal layout
            </DialogDescription>
          </div>
          <button
            aria-label="Close"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body (Two Columns) */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto sm:flex-row">
          {/* Left Column: 1–8 Layout List */}
          <div className="grid w-full shrink-0 grid-cols-2 gap-1 border-border/70 border-b p-3 sm:flex sm:w-[180px] sm:flex-col sm:border-r sm:border-b-0 sm:p-3.5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => {
              const isSelected = count === selectedCount;
              return (
                <button
                  aria-pressed={isSelected}
                  className={cn(
                    "flex items-center gap-2.5 h-[34px] px-3 rounded-[7px] text-[12px] font-sans font-medium transition-colors cursor-pointer text-left",
                    isSelected
                      ? "border border-primary/40 bg-muted/60 text-foreground shadow-xs font-semibold"
                      : "border border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  )}
                  key={count}
                  onClick={() => setSelectedCount(count)}
                  type="button"
                >
                  <LayoutPresetIcon count={count} />
                  <span>
                    {count} {count === 1 ? "Terminal" : "Terminals"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Column: Live preview */}
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 bg-muted/20 p-4 sm:p-5">
            {/* Workspace Preview Container */}
            <div className="rounded-2xl border border-border/60 dark:border-border bg-[var(--card)] dark:bg-[#070708] p-3 sm:p-3.5 flex flex-col shadow-sm">
              <div className="flex flex-col gap-2.5 h-[270px] sm:h-[300px] justify-center w-full">
                {preset.rows.map((rowPanes, rIdx) => (
                  <div
                    className="flex gap-2.5 flex-1 min-h-0 w-full"
                    key={rIdx}
                  >
                    {rowPanes.map((paneNum) => {
                      const isPrimary = paneNum === 1;
                      return (
                        <div
                          className={cn(
                            "flex-1 min-w-0 rounded-xl bg-[var(--terminal-bg)] border flex flex-col overflow-hidden shadow-xs",
                            isPrimary
                              ? "border-[var(--terminal-border)] shadow-xs"
                              : "border-[var(--terminal-border)]/60"
                          )}
                          key={paneNum}
                        >
                          {/* Terminal Titlebar */}
                          <div className="flex items-center justify-between h-7 px-3 bg-[var(--terminal-header)] border-b border-[var(--terminal-border)] shrink-0 select-none">
                            <div className="flex items-center gap-1.5">
                              <span className="size-2 rounded-full bg-[#ff2058]" />
                              <span className="size-2 rounded-full bg-[#ffbf00]" />
                              <span className="size-2 rounded-full bg-[#00dd98]" />
                              <span className="font-mono text-[10.5px] text-[var(--terminal-muted)] ml-1.5">
                                zsh
                              </span>
                            </div>
                            <span className="font-sans text-[11px] text-[var(--terminal-muted)] font-normal truncate">
                              Terminal {paneNum}
                            </span>
                          </div>

                          {/* Terminal Body */}
                          <div className="flex-1 p-3 font-mono text-[11px] leading-relaxed text-left select-none overflow-hidden bg-[var(--terminal-bg)]">
                            {isPrimary ? (
                              <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                                <span className="text-[var(--terminal-prompt)] font-medium shrink-0">
                                  marshell@dev:~$
                                </span>
                                <span className="text-[var(--terminal-fg)] font-medium truncate">
                                  {effectiveCommand}
                                </span>
                                <span className="inline-block w-1.5 h-3.5 bg-[var(--terminal-cursor)] animate-pulse align-middle shrink-0" />
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                                <span className="text-[var(--terminal-muted)] shrink-0">
                                  marshell@dev:~$
                                </span>
                                <span className="text-[var(--terminal-muted)] shrink-0">
                                  ...
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2.5 border-border/70 border-t bg-card/40 px-5 py-3.5">
          <button
            className="h-[32px] px-3.5 rounded-[7px] border border-border/80 bg-muted/50 font-sans text-xs font-medium text-foreground/90 hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            Cancel
          </button>
          <button
            className="h-[32px] px-4 rounded-[7px] bg-primary hover:bg-primary/90 font-sans text-xs font-semibold text-primary-foreground transition-colors cursor-pointer shadow-xs"
            onClick={() => {
              onApply(selectedCount);
              onOpenChange(false);
            }}
            type="button"
          >
            Apply layout
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
