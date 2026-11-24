"use client";

import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { ArrowRight, GitPullRequest, ListTodo, X } from "lucide-react";
import { useEffect, useState } from "react";

const GLOBAL_FIRST_TASK_GUIDE_KEY = "marshell-first-task-guide-dismissed";

export function FirstTaskGuide({
  workspaceId: _workspaceId,
}: {
  workspaceId: string;
}) {
  const [dismissed, setDismissed] = useState(true);
  const workspaces = useWorkspaceStore((state) => state.workspaces);

  useEffect(() => {
    try {
      const isDismissed =
        localStorage.getItem(GLOBAL_FIRST_TASK_GUIDE_KEY) === "dismissed";
      const isFirstWorkspace = workspaces.length <= 1;
      setDismissed(isDismissed || !isFirstWorkspace);
    } catch {
      setDismissed(true);
    }
  }, [workspaces.length]);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(GLOBAL_FIRST_TASK_GUIDE_KEY, "dismissed");
    } catch {
      /* Visible dismissal still works. */
    }
  };

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          dismiss();
        }
      }}
      open={!dismissed}
    >
      <DialogContent
        className="gap-0 overflow-hidden border-border/70 bg-background p-0 sm:max-w-lg"
        data-tour-element="first-task-guide"
        showCloseButton={false}
      >
        <DialogHeader className="gap-3 border-b border-border/60 px-6 pt-7 pb-6 text-left">
          <DialogTitle className="pr-8 font-medium text-xl tracking-tight">
            Your workspace is ready
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Use terminals, track tasks on the board, or review git changes.
          </DialogDescription>
        </DialogHeader>
        <button
          aria-label="Dismiss guide"
          className="absolute top-4 right-4 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={dismiss}
          type="button"
        >
          <X className="size-4" />
        </button>
        <div className="flex flex-col gap-2 p-6">
          <Button
            className="h-11 w-full justify-start gap-3 px-4"
            onClick={() => {
              dismiss();
              useWorkspaceStore.getState().setActiveView("board");
            }}
            variant="outline"
          >
            <ListTodo className="size-4 text-muted-foreground" />
            Open Tasks
            <ArrowRight className="ml-auto size-4 text-muted-foreground" />
          </Button>
          <Button
            className="h-11 w-full justify-start gap-3 px-4"
            onClick={() => {
              dismiss();
              useWorkspaceStore.getState().setActiveView("changes");
            }}
            variant="outline"
          >
            <GitPullRequest className="size-4 text-muted-foreground" />
            Review Changes
            <ArrowRight className="ml-auto size-4 text-muted-foreground" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
