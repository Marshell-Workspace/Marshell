"use client";

import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { RotateCcw } from "lucide-react";
import type * as React from "react";

interface ResetTerminalDialogProps {
  name?: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}

export function ResetTerminalDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  name,
}: ResetTerminalDialogProps) {
  const terminalDisplayName = name ? `${name} (${title})` : title;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onConfirm();
      onOpenChange(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="w-full max-w-[420px] rounded-2xl border border-border bg-[#0d0e11]/95 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="gap-3 text-left">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <RotateCcw
                className="size-4 text-amber-600 dark:text-amber-400"
                strokeWidth={2}
              />
            </div>
            <div className="space-y-1 pr-6">
              <DialogTitle className="font-display font-semibold text-foreground text-lg tracking-tight">
                Reset Shell Session?
              </DialogTitle>
              <DialogDescription className="font-sans text-muted-foreground text-xs leading-relaxed">
                This terminal has an active running process:{" "}
                <span className="font-medium text-foreground">
                  {terminalDisplayName}
                </span>
                .
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 font-sans text-amber-700 dark:text-amber-300 text-xs leading-relaxed">
          Resetting will terminate the current session and any running commands.
          This action cannot be undone.
        </div>

        <DialogFooter className="mt-1 flex flex-row items-center justify-end gap-2.5 sm:gap-2.5">
          <Button
            className="h-8.5 rounded-lg border border-border bg-transparent px-3.5 font-sans font-medium text-muted-foreground text-xs hover:bg-accent hover:text-foreground active:scale-[0.98]"
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            autoFocus
            className="h-8.5 rounded-lg border border-amber-500/30 bg-amber-600/90 px-3.5 font-sans font-medium text-foreground text-xs shadow-xs hover:bg-amber-600 focus-visible:ring-1 focus-visible:ring-amber-500/50 active:scale-[0.98]"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            type="button"
          >
            Reset Terminal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
