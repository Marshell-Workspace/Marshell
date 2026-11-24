"use client";

import { FirstTaskGuide } from "@workspace/core/components/common/first-task-guide";
import { WorkspaceEmptyState } from "@workspace/core/components/common/workspace-empty-state";
import { WorkspaceChanges } from "@workspace/core/components/diff/workspace-changes";
import { PreviewBrowser } from "@workspace/core/components/preview/preview-browser";
import { ProcessesDrawer } from "@workspace/core/components/processes/process-list";
import { TerminalGrid } from "@workspace/core/components/terminal/terminal-grid";
import { useMounted } from "@workspace/core/hooks/use-mounted";
import { terminalLayoutManager } from "@workspace/core/lib/terminal-layout-manager";
import { KanbanPage } from "@workspace/core/pages/kanban-page";
import { usePreviewStore } from "@workspace/core/stores/preview-store";
import { useProcessUiStore } from "@workspace/core/stores/process-ui-store";
import { useTutorialStore } from "@workspace/core/stores/tutorial-store";
import {
  useWorkspaceStore,
  type WorkspaceViewMode,
} from "@workspace/core/stores/workspace-store";
import { cn } from "@workspace/ui/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";

export function WorkspacePage() {
  return (
    <WorkspaceContent
      onCreateWorkspace={() => {
        useTutorialStore.getState().setCreateWorkspaceDialogOpen(true);
      }}
    />
  );
}

function WorkspaceContent({
  onCreateWorkspace,
}: {
  onCreateWorkspace: () => void;
}) {
  const mounted = useMounted();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const view = useWorkspaceStore((s) => s.activeView);
  const setActiveView = useWorkspaceStore((s) => s.setActiveView);

  // Panes mount on first visit and then stay, so a preview keeps its page and devtools.
  const [visited, setVisited] = useState<Set<WorkspaceViewMode>>(
    new Set([view || "terminals"])
  );

  useEffect(() => {
    if (view) {
      setVisited((prev) => new Set(prev).add(view));
    }
  }, [view]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const paneIds = useMemo(
    () => activeWorkspace?.panes.map((p) => p.id) ?? [],
    [activeWorkspace?.panes]
  );

  const isFullscreen = usePreviewStore((s) => s.isFullscreen);

  // Ensure fullscreen is exited if we switch tabs
  useEffect(() => {
    if (view !== "preview" && isFullscreen) {
      usePreviewStore.setState({ isFullscreen: false });
    }
  }, [view, isFullscreen]);

  // Track previous view and workspace to notify terminal layout on tab switch
  const prevViewRef = useRef(view);
  const prevWorkspaceRef = useRef(activeWorkspaceId);

  useEffect(() => {
    if (
      prevViewRef.current !== view ||
      prevWorkspaceRef.current !== activeWorkspaceId
    ) {
      prevViewRef.current = view;
      prevWorkspaceRef.current = activeWorkspaceId;
      if (view === "terminals") {
        terminalLayoutManager.notifyFullscreenTransition();
      }
    }
  }, [view, activeWorkspaceId]);

  // Ensure fullscreen states are reset on mount
  useEffect(() => {
    usePreviewStore.setState({ isFullscreen: false });
  }, []);

  if (!mounted) {
    return null;
  }

  if (!activeWorkspace) {
    const emptyMode =
      workspaces.length === 0 ? "no-workspaces" : "none-selected";
    return (
      <WorkspaceEmptyState
        mode={emptyMode}
        onCreateWorkspace={onCreateWorkspace}
      />
    );
  }

  const show = (next: WorkspaceViewMode) => {
    setActiveView(next);
  };

  const hidePadding = isFullscreen && view === "preview";

  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-1 overflow-hidden",
        !hidePadding &&
          (view === "terminals" || view === "preview" || view === "board"
            ? "gap-1.5 p-0.5 sm:p-1"
            : "gap-2.5 sm:gap-3 p-2.5 sm:p-3")
      )}
    >
      <div
        className={cn(
          "relative flex min-w-0 flex-1 flex-col overflow-hidden",
          view !== "terminals" &&
            view !== "preview" &&
            "rounded-xl border border-border/40 bg-background/50 backdrop-blur-md"
        )}
      >
        {!isFullscreen && (
          <FirstTaskGuide
            key={activeWorkspace.id}
            workspaceId={activeWorkspace.id}
          />
        )}
        {/* ProcessesDrawer hidden trigger sync */}
        <ProcessesDrawer
          directory={activeWorkspace.directory}
          onOpenPort={(port) => {
            usePreviewStore
              .getState()
              .requestOpen(activeWorkspace.id, String(port));
            useProcessUiStore.getState().setOpen(false);
            show("preview");
          }}
          workspaceId={activeWorkspace.id}
        />
        {/* View Container Panes */}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Hidden, not unmounted: terminals must keep their PTY sessions. */}
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col overflow-hidden",
              view !== "terminals" && "hidden"
            )}
          >
            <TerminalGrid />
          </div>
          {visited.has("preview") && (
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col overflow-hidden",
                view !== "preview" && "hidden"
              )}
            >
              <PreviewBrowser
                active={view === "preview"}
                paneIds={paneIds}
                rootDirectory={activeWorkspace.directory}
                workspaceId={activeWorkspace.id}
              />
            </div>
          )}
          {visited.has("board") && (
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-glass-border",
                view !== "board" && "hidden"
              )}
            >
              <KanbanPage />
            </div>
          )}
          {visited.has("changes") && (
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col overflow-hidden",
                view !== "changes" && "hidden"
              )}
            >
              <WorkspaceChanges
                active={view === "changes"}
                directory={activeWorkspace.directory}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
