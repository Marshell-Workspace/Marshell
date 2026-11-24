"use client";

import { GitBranch } from "lucide-react";

/**
 * Workspace-level changes view (no active diff available in the local workspace).
 */
export function WorkspaceChanges({
  directory,
}: {
  active?: boolean;
  directory?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--tb-card-border)] bg-[var(--tb-card)]/40 p-10 text-center">
      <div className="flex size-11 items-center justify-center rounded-xl border border-border/60 bg-background/60">
        <GitBranch className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-sm text-[var(--tb-text)]">
          No workspace changes to review
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          {directory
            ? `Opened in ${directory}. Use Terminals to run git status or git diff directly.`
            : "Open a workspace folder and run git commands in Terminals."}
        </p>
      </div>
    </div>
  );
}
