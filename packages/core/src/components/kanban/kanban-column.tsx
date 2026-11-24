"use client";

import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PenIcon } from "@workspace/core/components/common/custom-icons";
import { KanbanCard } from "@workspace/core/components/kanban/kanban-card";
import { deleteCardsSafely } from "@workspace/core/lib/kanban-actions";
import { filterCards } from "@workspace/core/lib/kanban-filter";
import type { KanbanColumn as KanbanColumnType } from "@workspace/core/stores/kanban-store";
import { useKanbanStore } from "@workspace/core/stores/kanban-store";
import { useKanbanUiStore } from "@workspace/core/stores/kanban-ui-store";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Input } from "@workspace/ui/components/input";
import { cn } from "@workspace/ui/lib/utils";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { Fragment, memo, useState } from "react";

interface KanbanColumnProps {
  column: KanbanColumnType;
  isFlex?: boolean;
  onDeleteColumn: (id: string) => void;
}

function StatusRing({ title }: { title: string }) {
  if (/backlog|to.?do|icebox/i.test(title)) {
    return (
      <svg className="size-[22px] shrink-0" viewBox="0 0 22 22">
        <circle
          className="fill-none stroke-[#8e8e96] dark:stroke-[#71717a]"
          cx="11"
          cy="11"
          r="8.5"
          strokeDasharray="3 2.5"
          strokeWidth="1.8"
        />
      </svg>
    );
  }
  if (/progress|doing|active|wip/i.test(title)) {
    return (
      <svg className="size-[22px] shrink-0 -rotate-90" viewBox="0 0 22 22">
        <circle
          className="fill-none stroke-[var(--tb-ring-track)]"
          cx="11"
          cy="11"
          r="8.5"
          strokeWidth="2"
        />
        <circle
          className="fill-none stroke-[#3b82f6]"
          cx="11"
          cy="11"
          r="8.5"
          strokeDasharray={2 * Math.PI * 8.5}
          strokeDashoffset={2 * Math.PI * 8.5 * 0.4}
          strokeLinecap="round"
          strokeWidth="2.5"
        />
      </svg>
    );
  }
  if (/review|qa\b|testing/i.test(title)) {
    return (
      <svg className="size-[22px] shrink-0 -rotate-90" viewBox="0 0 22 22">
        <circle
          className="fill-none stroke-[var(--tb-ring-track)]"
          cx="11"
          cy="11"
          r="8.5"
          strokeWidth="2"
        />
        <circle
          className="fill-none stroke-[#f59e0b]"
          cx="11"
          cy="11"
          r="8.5"
          strokeDasharray={2 * Math.PI * 8.5}
          strokeDashoffset={2 * Math.PI * 8.5 * 0.3}
          strokeLinecap="round"
          strokeWidth="2.5"
        />
      </svg>
    );
  }
  if (/done|complete|shipped|merged/i.test(title)) {
    return (
      <svg className="size-[22px] shrink-0" viewBox="0 0 22 22">
        <circle
          className="fill-none stroke-[#22c55e]"
          cx="11"
          cy="11"
          r="8.5"
          strokeWidth="2"
        />
      </svg>
    );
  }
  return (
    <svg className="size-[22px] shrink-0" viewBox="0 0 22 22">
      <circle
        className="fill-none stroke-[var(--tb-ring-track)]"
        cx="11"
        cy="11"
        r="8.5"
        strokeWidth="2"
      />
    </svg>
  );
}

interface InlineCardFormProps {
  newCardTitle: string;
  onCancel: () => void;
  onChangeTitle: (val: string) => void;
  onSubmit: () => void;
}

function InlineCardForm({
  newCardTitle,
  onCancel,
  onChangeTitle,
  onSubmit,
}: InlineCardFormProps) {
  return (
    <form
      className="flex animate-in flex-col gap-3 rounded-xl border border-glass-border-strong bg-glass-surface-elevated p-3 shadow-lg backdrop-blur-md fade-in-0 slide-in-from-top-1"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <Input
        aria-label="Card title"
        autoFocus
        className="h-9 rounded-lg text-sm"
        onChange={(e) => onChangeTitle(e.target.value)}
        placeholder="Card title…"
        value={newCardTitle}
      />

      <div className="flex items-center gap-2 pt-0.5">
        <Button
          className="h-7.5 px-3.5 text-xs font-medium transition-ui motion-fast active:scale-95 cursor-pointer shadow-xs"
          disabled={!newCardTitle.trim()}
          size="sm"
          type="submit"
        >
          Add card
        </Button>
        <Button
          className="h-7.5 px-2.5 text-muted-foreground text-xs hover:text-foreground transition-colors cursor-pointer"
          onClick={onCancel}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

export const KanbanColumn = memo(function KanbanColumn({
  column,
  isFlex,
  onDeleteColumn,
}: KanbanColumnProps) {
  const { addCard, cards } = useKanbanStore();
  const {
    collapsedColumnIds,
    filters,
    selection,
    toggleCollapseColumn,
    toggleSelected,
  } = useKanbanUiStore();
  const isCollapsed = collapsedColumnIds.includes(column.id);
  const renameColumn = useKanbanStore((s) => s.renameColumn);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addingAfterCardId, setAddingAfterCardId] = useState<string | null>(
    null
  );
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(column.title);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // What the column actually holds, before filtering. The empty state has to
  // key off this: a filter that hides every card does not make the column
  // empty, and offering "Add card" there would be wrong.
  const allColumnCards = cards.filter((c) => c.columnId === column.id);
  const columnCards = filterCards(allColumnCards, filters, () => false);
  const hasCards = allColumnCards.length > 0;
  // Cards exist but the current filter/search hides all of them.
  const isFilteredEmpty = hasCards && columnCards.length === 0;
  const cardIds = columnCards.map((c) => c.id);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: column.id,
    data: { type: "column", column },
  });

  const style: React.CSSProperties = {
    transform: isDragging ? undefined : CSS.Translate.toString(transform),
    transition: isDragging ? undefined : (transition ?? "transform 180ms ease"),
    willChange: isDragging ? undefined : "transform",
  };

  const cancelAdding = () => {
    setNewCardTitle("");
    setIsAdding(false);
    setAddingAfterCardId(null);
  };

  const handleAddCard = () => {
    const title = newCardTitle.trim();
    if (!title) {
      return;
    }
    addCard(column.id, title, "", undefined, addingAfterCardId ?? undefined);
    setNewCardTitle("");
    setIsAdding(false);
    setAddingAfterCardId(null);
  };

  const handleSaveTitle = () => {
    const clean = titleValue.trim();
    if (clean && clean !== column.title) {
      renameColumn(column.id, clean);
    } else {
      setTitleValue(column.title);
    }
    setIsEditingTitle(false);
  };

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className={cn(
        "relative flex flex-col self-stretch tb-surface-transition min-w-0",
        isCollapsed
          ? "w-12 shrink-0"
          : isFlex
            ? "flex-1 min-w-[240px]"
            : "w-[360px] shrink-0"
      )}
      exit={{
        flex: "0 0 0px",
        marginLeft: "-0.5rem",
        marginRight: "-0.5rem",
        minWidth: 0,
        opacity: 0,
        overflow: "hidden",
        scale: 0.95,
        transition: {
          duration: 0.32,
          ease: [0.32, 0.72, 0, 1],
          opacity: { duration: 0.2 },
          scale: { duration: 0.25 },
        },
        width: 0,
        y: -10,
      }}
      initial={{ opacity: 0, scale: 0.95, y: -30 }}
      layout
      ref={setNodeRef}
      style={style}
      transition={{
        damping: 30,
        stiffness: 450,
        type: "spring",
      }}
    >
      {isCollapsed ? (
        <div
          className={cn(
            "group relative flex h-full w-full min-w-0 cursor-pointer flex-col items-center justify-between overflow-hidden rounded-[16px] border border-transparent dark:border-[var(--tb-column-border)] bg-[var(--tb-column)] py-4 shadow-xs transition-colors select-none",
            isDragging && "opacity-40",
            isOver &&
              "bg-[var(--tb-col-hover-bg)] border-[1.5px] border-[var(--tb-col-hover-border)] shadow-[var(--tb-col-hover-shadow)] rounded-[14px]"
          )}
          onClick={() => toggleCollapseColumn(column.id)}
          title={`Click to expand ${column.title}`}
          {...attributes}
          {...listeners}
        >
          <div className="flex flex-col items-center gap-4 pt-1">
            <StatusRing title={column.title} />
            <span
              className="font-medium text-[15px] tracking-tight text-[var(--tb-text)] whitespace-nowrap"
              style={{
                writingMode: "vertical-rl",
              }}
            >
              {column.title}
            </span>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "relative flex flex-col overflow-hidden rounded-[16px] border border-transparent dark:border-[var(--tb-column-border)] bg-[var(--tb-column)] p-[10px] h-full w-full min-w-0 transition-colors",
            isDragging && "opacity-40",
            isOver &&
              "bg-[var(--tb-col-hover-bg)] border-[1.5px] border-[var(--tb-col-hover-border)] shadow-[var(--tb-col-hover-shadow)] rounded-[14px]"
          )}
        >
          <div
            className="group flex shrink-0 items-center justify-between gap-1.5 px-2 py-1.5 cursor-grab active:cursor-grabbing select-none"
            {...attributes}
            {...listeners}
          >
            {isEditingTitle ? (
              <div
                className="flex flex-1 items-center gap-1 min-w-0"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <input
                  autoFocus
                  className="flex-1 rounded-[6px] border border-[var(--tb-chip-border)] bg-[var(--tb-card)] px-2 py-0.5 text-[15px] font-medium text-[var(--tb-text)] outline-none focus:ring-1 focus:ring-[var(--tb-diff-add)]"
                  onBlur={handleSaveTitle}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSaveTitle();
                    }
                    if (e.key === "Escape") {
                      setTitleValue(column.title);
                      setIsEditingTitle(false);
                    }
                  }}
                  value={titleValue}
                />
              </div>
            ) : (
              <div
                className="flex min-w-0 items-center gap-2 text-left"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setIsEditingTitle(true);
                }}
                title="Double click to rename column"
              >
                <StatusRing title={column.title} />
                <span className="truncate font-medium text-[18px] tracking-tight text-[var(--tb-text)] leading-tight">
                  {column.title}
                </span>
              </div>
            )}

            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {/* 3 dots menu with Rename and Delete */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label={`Column options for ${column.title}`}
                    className="flex size-6 cursor-pointer items-center justify-center rounded-[6px] text-[var(--tb-icon)] hover:text-[var(--tb-text)] hover:bg-[var(--tb-chip-bg)] transition-colors"
                    type="button"
                  >
                    <MoreHorizontal className="size-4 stroke-[1.8]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-[160px] rounded-[10px] border border-[var(--tb-popover-border)] bg-[var(--tb-popover-bg)] p-1.5 shadow-[var(--tb-popover-shadow)] text-[var(--tb-text)]"
                >
                  <DropdownMenuItem
                    className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-[13px] font-medium text-[var(--tb-text)] hover:bg-[var(--tb-popover-hover)] focus:bg-[var(--tb-popover-hover)] outline-none"
                    onClick={() => setIsEditingTitle(true)}
                  >
                    <PenIcon className="size-3.5 stroke-[1.8] text-[var(--tb-icon)]" />
                    <span>Rename</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-[13px] font-medium text-[var(--tb-diff-del)] hover:bg-[var(--tb-popover-hover)] focus:bg-[var(--tb-popover-hover)] outline-none"
                    onClick={() => {
                      if (hasCards) {
                        setIsDeleteDialogOpen(true);
                      } else {
                        onDeleteColumn(column.id);
                      }
                    }}
                  >
                    <Trash2 className="size-3.5 stroke-[1.8]" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Add card icon */}
              <button
                aria-label={`Add card to ${column.title}`}
                className="flex size-6 cursor-pointer items-center justify-center rounded-[6px] text-[var(--tb-icon)] hover:text-[var(--tb-text)] hover:bg-[var(--tb-chip-bg)] transition-colors"
                onClick={() => {
                  setAddingAfterCardId(null);
                  setIsAdding(true);
                }}
                title="Add card"
                type="button"
              >
                <Plus className="size-4 stroke-[1.8]" />
              </button>
            </div>
          </div>

          <div className="subtle-scrollbar flex min-h-0 flex-1 flex-col gap-[12px] overflow-y-auto px-1 pt-2 pb-1">
            <SortableContext
              items={cardIds}
              strategy={verticalListSortingStrategy}
            >
              {isFilteredEmpty && !isAdding ? (
                /* Cards exist but are filtered out — not an empty column, so this
               must not offer "Add card". */
                <div className="flex flex-1 flex-col items-center justify-center gap-1 px-3 text-center">
                  <span className="font-medium text-[var(--tb-muted)] text-xs">
                    No matching cards
                  </span>
                  <span className="text-[11px] text-[var(--tb-muted)]/70">
                    {allColumnCards.length} hidden by the current filter
                  </span>
                </div>
              ) : columnCards.length === 0 && !isAdding ? (
                /* Genuinely empty: centered Add card */
                <button
                  className="flex flex-1 flex-col items-center justify-center gap-1.5 p-6 text-[var(--tb-muted)] hover:text-[var(--tb-text)] transition-colors cursor-pointer"
                  onClick={() => {
                    setAddingAfterCardId(null);
                    setIsAdding(true);
                  }}
                  type="button"
                >
                  <span className="flex size-9 items-center justify-center rounded-[8px] border border-dashed border-[var(--tb-chip-border)] bg-transparent text-[var(--tb-icon)] transition-colors">
                    <Plus className="size-4 stroke-[1.8]" />
                  </span>
                  <span className="font-medium text-[12px] mt-1">Add card</span>
                </button>
              ) : (
                columnCards.map((card) => (
                  <Fragment key={card.id}>
                    <KanbanCard
                      card={card}
                      isDone={/done|complete|shipped|merged/i.test(
                        column.title
                      )}
                      onAddBelow={(id) => {
                        setAddingAfterCardId(id);
                        setIsAdding(true);
                      }}
                      onDelete={(id) => {
                        deleteCardsSafely([id]);
                      }}
                      onToggleSelect={toggleSelected}
                      selected={selection.includes(card.id)}
                    />
                    {isAdding && addingAfterCardId === card.id && (
                      <InlineCardForm
                        newCardTitle={newCardTitle}
                        onCancel={cancelAdding}
                        onChangeTitle={setNewCardTitle}
                        onSubmit={handleAddCard}
                      />
                    )}
                  </Fragment>
                ))
              )}
            </SortableContext>

            {!isAdding && columnCards.length > 0 && (
              <button
                className="flex w-full items-center justify-center gap-1.5 py-2.5 rounded-[10px] text-[12.5px] font-medium border border-dashed border-[var(--tb-chip-border)] hover:border-[var(--tb-text)]/40 hover:bg-[var(--tb-chip-bg)] text-[var(--tb-muted)] hover:text-[var(--tb-text)] transition-colors cursor-pointer select-none"
                onClick={() => {
                  setAddingAfterCardId(null);
                  setIsAdding(true);
                }}
                type="button"
              >
                <Plus className="size-3.5 stroke-[2]" />
                <span>Add card</span>
              </button>
            )}

            {isAdding &&
              (addingAfterCardId === null || columnCards.length === 0) && (
                <InlineCardForm
                  newCardTitle={newCardTitle}
                  onCancel={cancelAdding}
                  onChangeTitle={setNewCardTitle}
                  onSubmit={handleAddCard}
                />
              )}
          </div>
        </div>
      )}

      <Dialog onOpenChange={setIsDeleteDialogOpen} open={isDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Column</DialogTitle>
            <DialogDescription className="leading-relaxed">
              This column consists of{" "}
              {allColumnCards.map((c) => `"${c.title}"`).join(", ")}, would you
              like to delete it?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              onClick={() => setIsDeleteDialogOpen(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                onDeleteColumn(column.id);
                setIsDeleteDialogOpen(false);
              }}
              variant="destructive"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
});
