"use client";

import { CardDetails } from "@workspace/core/components/kanban/card-details";
import { PriorityBars } from "@workspace/core/components/kanban/kanban-card";
import {
  EXTERNAL_EDITORS,
  type ExternalEditor,
} from "@workspace/core/lib/editor";
import { useCardDrawerStore } from "@workspace/core/stores/card-drawer-store";
import { useEditorStore } from "@workspace/core/stores/editor-store";
import { useKanbanStore } from "@workspace/core/stores/kanban-store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { SquareKanban } from "lucide-react";
import { useId } from "react";

/** The detail panel of a task card. */
export function CardDrawer() {
  const { cardId, close } = useCardDrawerStore();
  const card = useKanbanStore((s) => s.cards.find((c) => c.id === cardId));
  const { editor, setEditor } = useEditorStore();
  const editorId = useId();
  const columnTitle = useKanbanStore(
    (s) => s.columns.find((c) => c.id === card?.columnId)?.title
  );

  return (
    <Dialog onOpenChange={(open) => !open && close()} open={Boolean(card)}>
      <DialogContent
        className="flex h-[min(780px,calc(100vh-2rem))] max-h-[calc(100vh-2rem)] w-[95vw] flex-col gap-0 overflow-hidden border border-[var(--tb-card-border)] bg-[var(--tb-panel-bg)] p-0 shadow-2xl backdrop-blur-xl focus:outline-none sm:max-w-[1000px] rounded-[16px] text-[var(--tb-text)] font-sans"
        showCloseButton={true}
      >
        {card && (
          <>
            <DialogHeader className="flex-shrink-0 gap-3 border-b border-[var(--tb-card-border)] bg-[var(--tb-panel-bg)] px-6 pt-5 pb-4 text-[var(--tb-text)]">
              <div className="flex items-center justify-between gap-3.5 pr-10">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-[var(--tb-control-border)] bg-[var(--tb-control-bg)] text-[var(--tb-icon)] shadow-xs">
                    <SquareKanban className="size-5 stroke-[1.8]" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="select-none truncate text-[20px] font-semibold text-[var(--tb-text)] leading-tight">
                      {card.title}
                    </DialogTitle>
                    <DialogDescription asChild>
                      <div className="flex items-center gap-1.5 text-[13px] text-[var(--tb-muted)] mt-1 font-normal">
                        <span>{columnTitle || "Task"}</span>
                        <span>·</span>
                        <PriorityBars priority={card.priority} />
                        <span className="capitalize">
                          {card.priority
                            ? `${card.priority} priority`
                            : "no priority"}
                        </span>
                      </div>
                    </DialogDescription>
                  </div>
                </div>

                <div className="ml-auto flex items-center gap-2 text-[var(--tb-muted)] text-[12px]">
                  <span>Editor</span>
                  <Select
                    onValueChange={(val) => setEditor(val as ExternalEditor)}
                    value={editor}
                  >
                    <SelectTrigger
                      className="h-8 rounded-[8px] border border-[var(--tb-chip-border)] bg-[var(--tb-field-bg)] text-[var(--tb-text)] text-[12px] px-2.5"
                      id={editorId}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      align="end"
                      className="rounded-[12px] border border-[var(--tb-popover-border)] bg-[var(--tb-popover-bg)] p-1 text-[var(--tb-text)] shadow-[var(--tb-popover-shadow)]"
                    >
                      {EXTERNAL_EDITORS.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </DialogHeader>

            <div className="subtle-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
              <CardDetails card={card} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
