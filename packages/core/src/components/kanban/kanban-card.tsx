"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PenIcon } from "@workspace/core/components/common/custom-icons";
import {
  EXTERNAL_EDITORS,
  openInExternalEditor,
} from "@workspace/core/lib/editor";
import type { Priority } from "@workspace/core/lib/kanban-filter";
import { useCardDrawerStore } from "@workspace/core/stores/card-drawer-store";
import {
  type KanbanCard as KanbanCardType,
  useKanbanStore,
} from "@workspace/core/stores/kanban-store";
import { useKanbanUiStore } from "@workspace/core/stores/kanban-ui-store";
import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { cn } from "@workspace/ui/lib/utils";
import {
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  MoreHorizontal,
  Tag,
  Terminal,
  Trash2,
} from "lucide-react";
import { memo } from "react";
import { toast } from "sonner";

interface KanbanCardProps {
  card: KanbanCardType;
  isDone?: boolean;
  onAddBelow?: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleSelect?: (id: string) => void;
  selected?: boolean;
}

export function PriorityBars({
  priority,
  className,
  showNone = false,
}: {
  priority?: Priority | string | null;
  className?: string;
  showNone?: boolean;
}) {
  const p = (priority ?? "").toLowerCase();

  // If no priority is selected and showNone is false, do not display the ping bars
  if (!p || p === "none") {
    if (!showNone) {
      return null;
    }
    return (
      <div
        aria-label="Priority: none"
        className={cn(
          "inline-flex items-end gap-[1.5px] h-3.5 shrink-0 select-none",
          className
        )}
        role="img"
      >
        <span className="w-[2.5px] h-[5px] rounded-[1px] bg-[var(--tb-inactive-priority-bar)]" />
        <span className="w-[2.5px] h-[9px] rounded-[1px] bg-[var(--tb-inactive-priority-bar)]" />
        <span className="w-[2.5px] h-[13px] rounded-[1px] bg-[var(--tb-inactive-priority-bar)]" />
      </div>
    );
  }

  // If urgent, show lightning bolt inside circle (scaled to match text height)
  if (p === "urgent") {
    return (
      <div
        aria-label="Priority: urgent"
        className={cn(
          "inline-flex items-center justify-center size-4.5 shrink-0 select-none text-[var(--tb-priority-high)]",
          className
        )}
        role="img"
      >
        <svg
          className="size-4.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="9" />
          <path
            d="M13 5.5L7.5 13H12L11 18.5L16.5 11H12L13 5.5Z"
            fill="currentColor"
            stroke="none"
          />
        </svg>
      </div>
    );
  }

  const isHigh = p === "high";
  const isMedium = p === "medium";
  const isLow = p === "low";

  const bar1Color = isHigh
    ? "bg-[var(--tb-priority-high)]"
    : isMedium
      ? "bg-[var(--tb-priority-medium)]"
      : isLow
        ? "bg-[var(--tb-priority-low)]"
        : "bg-[var(--tb-inactive-priority-bar)]";

  const bar2Color = isHigh
    ? "bg-[var(--tb-priority-high)]"
    : isMedium
      ? "bg-[var(--tb-priority-medium)]"
      : "bg-[var(--tb-inactive-priority-bar)]";

  const bar3Color = isHigh
    ? "bg-[var(--tb-priority-high)]"
    : "bg-[var(--tb-inactive-priority-bar)]";

  return (
    <div
      aria-label={`Priority: ${priority || "none"}`}
      className={cn(
        "inline-flex items-end gap-[1.5px] h-3.5 shrink-0 select-none",
        className
      )}
      role="img"
    >
      <span className={cn("w-[2.5px] h-[5px] rounded-[1px]", bar1Color)} />
      <span className={cn("w-[2.5px] h-[9px] rounded-[1px]", bar2Color)} />
      <span className={cn("w-[2.5px] h-[13px] rounded-[1px]", bar3Color)} />
    </div>
  );
}

export function PriorityPill({
  priority,
  className,
}: {
  cardId?: string;
  className?: string;
  interactive?: boolean;
  priority?: Priority | string;
}) {
  return <PriorityBars className={className} priority={priority} />;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;

  if (diff < MINUTE_MS) {
    return "just now";
  }
  if (diff < HOUR_MS) {
    return `${Math.floor(diff / MINUTE_MS)}m ago`;
  }
  if (diff < DAY_MS) {
    return `${Math.floor(diff / HOUR_MS)}h ago`;
  }
  const days = Math.floor(diff / DAY_MS);
  if (days < 30) {
    return `${days}d ago`;
  }
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export const KanbanCard = memo(function KanbanCard({
  card,
  isDone = false,
  onAddBelow: _onAddBelow,
  onDelete,
  onToggleSelect,
  selected = false,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, data: { type: "card", card } });

  const style: React.CSSProperties = {
    opacity: isDragging ? 0.3 : 1,
    transform: isDragging ? undefined : CSS.Translate.toString(transform),
    transition,
    willChange: isDragging ? undefined : "transform",
  };

  const compactCards = useKanbanUiStore((s) => s.compactCards);
  const repoPath = useWorkspaceStore(
    (s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId)?.directory
  );
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const columns = useKanbanStore((s) => s.columns);
  const moveCard = useKanbanStore((s) => s.moveCard);

  const colIdx = columns.findIndex((c) => c.id === card.columnId);
  const nextCol =
    colIdx >= 0 && colIdx < columns.length - 1 ? columns[colIdx + 1] : null;

  const isCardCompleted = isDone || selected;

  if (compactCards) {
    return (
      <div
        className={cn(
          "group/card relative flex items-center justify-between rounded-[12px] border border-[var(--tb-card-border)] bg-[var(--tb-card)] px-3 py-2 shadow-[var(--tb-card-shadow)] tb-surface-transition cursor-grab active:cursor-grabbing hover:border-[var(--tb-text)]/30 gap-2",
          isDragging && "opacity-40 border-dashed",
          selected && "ring-2 ring-[var(--tb-diff-add)]/50"
        )}
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
      >
        <button
          className={cn(
            "min-w-0 flex-1 truncate cursor-pointer text-left font-medium text-[13px] leading-snug transition-colors tracking-tight",
            isCardCompleted
              ? "line-through text-[var(--tb-muted)]"
              : "text-[var(--tb-text)] hover:opacity-80"
          )}
          onClick={() => useCardDrawerStore.getState().open(card.id)}
          type="button"
        >
          {card.title}
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group/card relative flex flex-col gap-2 rounded-2xl border border-[var(--tb-card-border)] bg-[var(--tb-card)] p-3.5 shadow-sm tb-surface-transition cursor-grab active:cursor-grabbing text-[var(--tb-text)]",
        isDragging && "opacity-40 border-dashed",
        selected && "ring-2 ring-[var(--tb-diff-add)]/50"
      )}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      {/* Row 1: Checkbox + Title + More options */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {onToggleSelect && (
            <button
              aria-disabled={isDone}
              aria-label={`Select ${card.title}`}
              className={cn(
                "size-4 rounded-[5px] border-[1.5px] flex items-center justify-center transition-colors shrink-0",
                isDone ? "cursor-default opacity-85" : "cursor-pointer",
                isCardCompleted
                  ? "border-[var(--tb-diff-add)] bg-[var(--tb-diff-add)] text-foreground"
                  : "border-[var(--tb-checkbox-border)] bg-transparent hover:border-[var(--tb-text)]"
              )}
              disabled={isDone}
              onClick={(e) => {
                e.stopPropagation();
                if (isDone) {
                  return;
                }
                onToggleSelect(card.id);
              }}
              type="button"
            >
              {isCardCompleted && (
                <Check className="size-3 stroke-[2.5] text-foreground" />
              )}
            </button>
          )}

          <button
            className={cn(
              "min-w-0 flex-1 truncate cursor-pointer text-left font-semibold text-[14px] leading-snug transition-colors tracking-tight",
              isCardCompleted
                ? "line-through text-[var(--tb-muted)]"
                : "text-[var(--tb-text)] hover:opacity-80"
            )}
            onClick={() => useCardDrawerStore.getState().open(card.id)}
            type="button"
          >
            {card.title}
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild={true}>
              <button
                aria-label="Card options"
                className="flex size-6 items-center justify-center rounded-[6px] text-[var(--tb-icon)] opacity-70 transition-opacity hover:opacity-100 hover:text-[var(--tb-text)] cursor-pointer shrink-0"
                type="button"
              >
                <MoreHorizontal className="size-4 stroke-[1.8]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-[196px] rounded-[12px] border border-[var(--tb-popover-border)] bg-[var(--tb-popover-bg)] p-1.5 shadow-[var(--tb-popover-shadow)] text-[var(--tb-text)]"
            >
              <DropdownMenuItem
                className="flex h-8 cursor-pointer items-center gap-2 rounded-[7px] px-2 text-[13px] text-[var(--tb-text)] hover:bg-[var(--tb-popover-hover)] transition-colors"
                onClick={() => useCardDrawerStore.getState().open(card.id)}
              >
                <PenIcon className="size-[15px] stroke-[1.8] text-[var(--tb-icon)]" />
                <span>Open details</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                className="flex h-8 cursor-pointer items-center gap-2 rounded-[7px] px-2 text-[13px] text-[var(--tb-text)] hover:bg-[var(--tb-popover-hover)] transition-colors"
                onClick={() => useCardDrawerStore.getState().open(card.id)}
              >
                <Tag className="size-[15px] stroke-[1.8] text-[var(--tb-icon)]" />
                <span>Edit tags</span>
              </DropdownMenuItem>

              {nextCol && (
                <DropdownMenuItem
                  className="flex h-8 cursor-pointer items-center gap-2 rounded-[7px] px-2 text-[13px] text-[var(--tb-text)] hover:bg-[var(--tb-popover-hover)] transition-colors"
                  onClick={() => moveCard(card.id, nextCol.id, 0)}
                >
                  <ChevronRight className="size-[15px] stroke-[1.8] text-[var(--tb-icon)]" />
                  <span>Move to {nextCol.title}</span>
                </DropdownMenuItem>
              )}

              <div className="h-px bg-[var(--tb-dashed-divider)] my-1" />

              <DropdownMenuItem
                className="flex h-8 cursor-pointer items-center gap-2 rounded-[7px] px-2 text-[13px] text-[var(--tb-diff-del)] hover:bg-[var(--tb-popover-hover)] hover:text-[var(--tb-diff-del)] transition-colors"
                onClick={() => onDelete(card.id)}
              >
                <Trash2 className="size-[15px] stroke-[1.8] text-[var(--tb-diff-del)]" />
                <span>Delete task</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Row 2: Priority (bars + name) on left, Clock + relative time on right */}
      <div className="flex items-center justify-between gap-2 min-w-0 text-[12px] text-[var(--tb-muted)] font-normal">
        <div className="flex items-center gap-1.5 min-w-0">
          <PriorityBars priority={card.priority} showNone={true} />
          <span className="capitalize font-medium text-[11.5px] text-[var(--tb-muted)]">
            {card.priority || "None"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Clock className="size-3.5 stroke-[1.8] text-[var(--tb-icon)] shrink-0" />
          <span>{formatRelativeTime(card.createdAt)}</span>
        </div>
      </div>

      {/* Optional Description */}
      {card.description && (
        <p className="line-clamp-2 text-[12.5px] leading-[18px] text-[var(--tb-muted)] font-normal">
          {card.description}
        </p>
      )}

      {/* Subtle Divider */}
      <div className="h-px w-full bg-[var(--tb-card-border)]/60 my-0.5" />

      {/* Action row */}
      <div className="flex items-center justify-between gap-2 pt-0.5 min-w-0">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {/* Terminal icon */}
          <button
            aria-label="Open terminal"
            className="flex size-7 items-center justify-center rounded-lg text-[var(--tb-muted)] hover:text-[var(--tb-text)] hover:bg-[var(--tb-chip-bg)] transition-colors cursor-pointer shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              if (repoPath) {
                createWorkspace(card.title, 1, repoPath);
                toast.success("Opened terminal in workspace");
              } else {
                toast.error("Open a workspace folder first");
              }
            }}
            title="Open terminal"
            type="button"
          >
            <Terminal className="size-3.5 stroke-[1.8]" />
          </button>

          {/* Open-external icon */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild={true}>
              <button
                aria-label="Open in external editor"
                className="flex size-7 items-center justify-center rounded-lg text-[var(--tb-muted)] hover:text-[var(--tb-text)] hover:bg-[var(--tb-chip-bg)] transition-colors cursor-pointer shrink-0"
                onClick={(e) => e.stopPropagation()}
                title="Open in external editor"
                type="button"
              >
                <ExternalLink className="size-3.5 stroke-[1.8]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-48 rounded-[12px] border border-[var(--tb-popover-border)] bg-[var(--tb-popover-bg)] p-1.5 shadow-[var(--tb-popover-shadow)] text-[var(--tb-text)]"
            >
              {EXTERNAL_EDITORS.map((editor) => (
                <DropdownMenuItem
                  className="flex h-8 cursor-pointer items-center gap-2 rounded-[7px] px-2 text-[13px] text-[var(--tb-text)] hover:bg-[var(--tb-popover-hover)] transition-colors"
                  key={editor.id}
                  onClick={async () => {
                    if (repoPath) {
                      try {
                        await openInExternalEditor(repoPath, editor.id);
                        toast.success(`Launching ${editor.label}`);
                      } catch (err: unknown) {
                        toast.error(
                          err instanceof Error ? err.message : String(err)
                        );
                      }
                    } else {
                      toast.error("Open a workspace folder first");
                    }
                  }}
                >
                  <span>{editor.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
});
