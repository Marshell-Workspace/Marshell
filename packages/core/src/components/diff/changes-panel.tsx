"use client";

import type { KanbanCard } from "@workspace/core/stores/kanban-store";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { cn } from "@workspace/ui/lib/utils";
import { GitBranch, X } from "lucide-react";

/**
 * Placeholder diff view when no branch comparison source is active.
 */
export function ChangesView({
  cardId: _cardId,
  className,
  onClose,
}: {
  active?: boolean;
  cardId: string;
  className?: string;
  onClose?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--tb-card-border)] bg-[var(--tb-card)]/50 p-10 text-center",
        className
      )}
    >
      <GitBranch className="size-8 text-muted-foreground/60" />
      <p className="text-xs text-muted-foreground">
        No local diff active for this task.
      </p>
      {onClose && (
        <button
          aria-label="Close changes panel"
          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          onClick={onClose}
          type="button"
        >
          <X className="size-3" />
          <span>Close</span>
        </button>
      )}
    </div>
  );
}

/** The review view in a dialog, opened from a task card. */
export function ChangesPanel({
  card,
  onOpenChange,
  open,
}: {
  card: KanbanCard;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="flex h-[85vh] flex-col gap-2 sm:max-w-6xl p-5"
        jellyDrag={false}
        onPointerDown={(e) => e.stopPropagation()}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          Review changes: {card.title}
        </DialogTitle>
        <ChangesView cardId={card.id} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
