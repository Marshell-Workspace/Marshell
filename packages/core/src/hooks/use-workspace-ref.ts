"use client";

import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";

export interface WorkspaceRef {
  directory?: string;
  id: string;
}

/** The active workspace as `{ id, directory }`, or undefined when none is open. */
export function useWorkspaceRef(): WorkspaceRef | undefined {
  const id = useWorkspaceStore((s) => s.activeWorkspaceId);
  const directory = useWorkspaceStore(
    (s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId)?.directory
  );
  return id ? { directory, id } : undefined;
}
