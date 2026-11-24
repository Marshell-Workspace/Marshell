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
import { AlertTriangle } from "lucide-react";
import type * as React from "react";

interface DeleteTerminalDialogProps {
  name?: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}

export function DeleteTerminalDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  name,
}: DeleteTerminalDialogProps) {
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
        className="w-full max-w-[420px] gap-4 rounded-xl border border-border bg-popover p-5 text-popover-foreground shadow-lg"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="gap-3 text-left">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle
                className="size-4 text-destructive"
                strokeWidth={2}
              />
            </div>
            <div className="space-y-1 pr-6">
              <DialogTitle className="font-display font-semibold text-base text-popover-foreground tracking-tight">
                Delete Terminal?
              </DialogTitle>
              <DialogDescription className="font-sans text-muted-foreground text-sm leading-relaxed">
                Are you sure you want to close{" "}
                <span className="font-medium text-popover-foreground">
                  {terminalDisplayName}
                </span>
                ?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <p className="border-destructive/50 border-l-2 py-0.5 pl-3 font-sans text-muted-foreground text-xs leading-relaxed">
          Any running processes or unsaved commands in this terminal will be
          terminated.
        </p>

        <DialogFooter className="mt-1 flex flex-row items-center justify-end gap-2.5 sm:gap-2.5">
          <Button
            className="h-8.5 rounded-lg px-3.5 font-sans font-medium text-muted-foreground text-xs hover:bg-accent hover:text-foreground active:scale-[0.98]"
            onClick={() => onOpenChange(false)}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            autoFocus
            className="h-8.5 rounded-lg px-3.5 font-sans font-medium text-xs shadow-xs active:scale-[0.98]"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            type="button"
            variant="destructive"
          >
            Delete Terminal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
