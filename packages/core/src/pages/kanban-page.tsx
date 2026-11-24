"use client";

import { CardDrawer } from "@workspace/core/components/kanban/card-drawer";
import { KanbanBoard } from "@workspace/core/components/kanban/kanban-board";
import { KanbanBulkActionBar } from "@workspace/core/components/kanban/kanban-bulk-action-bar";
import { KanbanFilterBar } from "@workspace/core/components/kanban/kanban-filter-bar";
import { KanbanListView } from "@workspace/core/components/kanban/kanban-list-view";
import { RepoSettingsDialog } from "@workspace/core/components/kanban/repo-settings-dialog";
import { useKanbanUiStore } from "@workspace/core/stores/kanban-ui-store";
import { useProcessPolling } from "@workspace/core/stores/process-live-store";
import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

export function KanbanPage() {
  const { viewMode } = useKanbanUiStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const activeWorkspaceIdForPolling = useWorkspaceStore(
    (s) => s.activeWorkspaceId
  );
  useProcessPolling(
    activeWorkspaceIdForPolling ? [activeWorkspaceIdForPolling] : []
  );
  const workspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId)
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--tb-bg)] text-[var(--tb-text)] font-sans">
      {/* Fixed responsive toolbar independent of horizontal board scrolling */}
      <div className="shrink-0 px-5 py-3 sm:px-6 sm:py-3.5 border-b border-transparent @container">
        <KanbanFilterBar onOpenSettings={() => setSettingsOpen(true)} />
      </div>

      {/* Main Board / List View Area confined to remaining viewport */}
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden px-5 pb-4 sm:px-6 sm:pb-5">
        <AnimatePresence mode="wait">
          {viewMode === "list" ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-1 min-h-0 min-w-0 flex-col overflow-y-auto subtle-scrollbar"
              exit={{ opacity: 0, y: 6 }}
              initial={{ opacity: 0, y: 6 }}
              key="list-view"
              transition={{ duration: 0.18, ease: "easeInOut" }}
            >
              <KanbanListView />
            </motion.div>
          ) : (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-1 min-h-0 min-w-0 overflow-hidden"
              exit={{ opacity: 0, y: 6 }}
              initial={{ opacity: 0, y: 6 }}
              key="board-view"
              transition={{ duration: 0.18, ease: "easeInOut" }}
            >
              <KanbanBoard />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <KanbanBulkActionBar />
      <CardDrawer />
      <RepoSettingsDialog
        onOpenChange={setSettingsOpen}
        open={settingsOpen}
        repoPath={workspace?.directory ?? workspace?.name ?? "default"}
        workspaceId={workspace?.id}
      />
    </div>
  );
}
