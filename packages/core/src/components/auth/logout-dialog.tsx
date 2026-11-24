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
import { Loader2, LogOut } from "lucide-react";
import type * as React from "react";

interface LogoutDialogProps {
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function LogoutDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: LogoutDialogProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      e.preventDefault();
      onConfirm();
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="border-border/70 bg-popover shadow-2xl backdrop-blur-xl sm:max-w-md"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="gap-2">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive shadow-sm">
              <LogOut className="size-5" />
            </div>
            <div>
              <DialogTitle className="font-bold text-foreground text-lg tracking-tight">
                Log out?
              </DialogTitle>
              <DialogDescription className="text-muted-foreground/80 text-xs">
                Are you sure you want to log out of your Marshell account?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-muted-foreground text-xs leading-relaxed">
          You will need to sign in again through the Marshell web portal to
          resume your session.
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            disabled={isLoading}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            autoFocus={true}
            className="bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 focus-visible:ring-destructive/30"
            disabled={isLoading}
            onClick={onConfirm}
            type="button"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Logging out...
              </>
            ) : (
              "Log out"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
