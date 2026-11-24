"use client";

import { Dialog, DialogContentLarge } from "@workspace/ui/components/dialog";
import type React from "react";

interface PanelProps {
  children: React.ReactNode;
  isOpen: boolean;
  maxWidthClass?: string;
  onClose: () => void;
  title: string;
}

export function Panel({
  isOpen,
  onClose,
  title,
  children,
  maxWidthClass = "max-w-4xl",
}: PanelProps) {
  return (
    /**
     * Radix Dialog.Root fully controls the open/close lifecycle.
     * Dialog.Portal (inside DialogContentLarge) hoists the overlay
     * and dialog surface to document.body — making it a true overlay layer
     * independent of the React component tree and normal page layout.
     *
     * Radix handles natively:
     *  - Body scroll-lock (no layout shift)
     *  - Focus trap (Tab / Shift+Tab)
     *  - Escape key dismissal
     *  - aria-modal + role="dialog"
     *  - Focus restoration to trigger element on close
     *  - Enter/exit animations via data-[state=open/closed] CSS classes
     */
    <Dialog
      modal={true}
      onOpenChange={(open) => !open && onClose()}
      open={isOpen}
    >
      <DialogContentLarge
        backdropClassName="bg-black/65 backdrop-blur-[2px]"
        maxWidthClassName={maxWidthClass}
        onClose={onClose}
        title={title}
      >
        {children}
      </DialogContentLarge>
    </Dialog>
  );
}
