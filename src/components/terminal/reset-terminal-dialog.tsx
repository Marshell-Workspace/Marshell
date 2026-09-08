"use client";

import { RotateCcw } from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog";

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
        className="sm:max-w-md border-border/70 bg-popover shadow-2xl backdrop-blur-xl"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="gap-2">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 shadow-sm">
              <RotateCcw className="size-5" />
            </div>
            <div>
              <DialogTitle className="font-bold text-foreground text-lg tracking-tight">
                Reset Shell Session?
              </DialogTitle>
              <DialogDescription className="text-muted-foreground/80 text-xs">
                This terminal (
                <span className="font-semibold text-foreground">
                  {terminalDisplayName}
                </span>
                ) currently has an active running process.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-amber-600 dark:text-amber-400 text-xs leading-relaxed">
          Resetting will terminate the current session and any running commands.
          This action cannot be undone.
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            autoFocus
            className="bg-amber-600 text-white shadow-sm hover:bg-amber-700 focus-visible:ring-amber-500/30"
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
