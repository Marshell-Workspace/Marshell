"use client";

import { AlertTriangle } from "lucide-react";
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
        className="sm:max-w-md rounded-2xl border border-[var(--glass-border-strong)] bg-[#121215]/95 p-6 shadow-[var(--glass-shadow-floating)] backdrop-blur-2xl"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="gap-2">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-red-500/25 bg-[#25090e]/90 text-[#ff2e4d] shadow-[0_0_12px_rgba(255,46,77,0.15)]">
              <AlertTriangle
                className="size-5.5 text-[#ff2e4d]"
                strokeWidth={2.2}
              />
            </div>
            <div>
              <DialogTitle className="font-bold text-foreground text-lg tracking-tight">
                Delete Terminal?
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-muted-foreground/80 text-xs">
                Are you sure you want to close{" "}
                <span className="font-semibold text-foreground">
                  {terminalDisplayName}
                </span>
                ?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-xl border border-red-500/25 bg-[#20060a]/60 p-3.5 font-normal text-[#ff425e] text-xs leading-relaxed">
          Any running processes or unsaved commands inside this terminal session
          will be terminated immediately.
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            className="rounded-xl border border-white/10 bg-[#19191d] px-4 py-2 font-medium text-white text-xs shadow-2xs transition-all hover:bg-[#26262d] hover:text-white active:scale-[0.98]"
            onClick={() => onOpenChange(false)}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            autoFocus
            className="rounded-xl bg-[#e50914] px-4 py-2 font-semibold text-white text-xs shadow-md shadow-red-950/40 transition-all hover:bg-[#ff1f2d] hover:shadow-[0_0_18px_rgba(229,9,20,0.35)] focus-visible:ring-2 focus-visible:ring-red-500 active:scale-[0.98]"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            type="button"
          >
            Delete Terminal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
