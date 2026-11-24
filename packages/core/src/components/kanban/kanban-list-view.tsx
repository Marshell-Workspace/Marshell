"use client";

import { PriorityBars } from "@workspace/core/components/kanban/kanban-card";
import { deleteCardsSafely } from "@workspace/core/lib/kanban-actions";
import {
  filterCards,
  PRIORITIES,
  type Priority,
} from "@workspace/core/lib/kanban-filter";
import { useCardDrawerStore } from "@workspace/core/stores/card-drawer-store";
import {
  type KanbanCard,
  type KanbanColumn,
  useKanbanStore,
} from "@workspace/core/stores/kanban-store";
import { useKanbanUiStore } from "@workspace/core/stores/kanban-ui-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { cn } from "@workspace/ui/lib/utils";
import { ArrowDown, ArrowUp, Check, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

type SortKey = "priority" | "status" | "title" | "updated";

/** Unset priority sorts last; urgent first. */
const NO_PRIORITY_RANK = 99;

function ListPrioritySelect({
  cardId,
  priority,
}: {
  cardId: string;
  priority?: Priority;
}) {
  const updateCard = useKanbanStore((s) => s.updateCard);

  return (
    <Select
      onValueChange={(val) =>
        updateCard(cardId, {
          priority: (val === "none" ? undefined : val) as Priority | undefined,
        })
      }
      value={priority ?? "none"}
    >
      <SelectTrigger
        aria-label={`Priority: ${priority || "none"}`}
        className="h-7.5 w-full max-w-[130px] rounded-lg border-[var(--tb-chip-border)] bg-[var(--tb-chip-bg)] hover:border-[var(--tb-text)]/30 text-[11px] font-medium text-[var(--tb-text)] shadow-2xs transition-colors px-2.5"
      >
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          <PriorityBars priority={priority} showNone={true} />
          <span className="capitalize text-[11px] truncate">
            {priority || "None"}
          </span>
        </div>
      </SelectTrigger>
      <SelectContent align="start">
        <SelectItem className="text-xs" value="none">
          <div className="flex items-center gap-2">
            <PriorityBars priority={null} showNone={true} />
            <span>None</span>
          </div>
        </SelectItem>
        {PRIORITIES.map((p) => (
          <SelectItem className="text-xs" key={p} value={p}>
            <div className="flex items-center gap-2">
              <PriorityBars priority={p} />
              <span className="capitalize">{p}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ListRow({
  card,
  column,
  columns,
  onMove,
  onToggle,
  selected,
}: {
  card: KanbanCard;
  column?: KanbanColumn;
  columns: KanbanColumn[];
  onMove: (id: string, columnId: string) => void;
  onToggle: (id: string) => void;
  selected: boolean;
}) {
  const openDrawer = useCardDrawerStore((s) => s.open);
  const isDone = Boolean(
    column?.title && /done|complete|shipped|merged/i.test(column.title)
  );
  const isCompleted = isDone || selected;

  return (
    <tr
      className={cn(
        "group border-b border-[var(--tb-card-border)] last:border-b-0 align-middle transition-colors",
        selected
          ? "bg-[var(--tb-field-bg)]"
          : "hover:bg-[var(--tb-field-bg)]/40"
      )}
    >
      <td className="w-12 px-3 py-3 text-center align-middle">
        <button
          aria-disabled={isDone}
          aria-label={`Select ${card.title}`}
          className={cn(
            "size-4 rounded-[5px] border-[1.5px] flex items-center justify-center transition-colors shrink-0 mx-auto",
            isDone ? "cursor-default opacity-85" : "cursor-pointer",
            isCompleted
              ? "border-[var(--tb-diff-add)] bg-[var(--tb-diff-add)] text-foreground"
              : "border-[var(--tb-checkbox-border)] bg-transparent hover:border-[var(--tb-text)]"
          )}
          disabled={isDone}
          onClick={(e) => {
            e.stopPropagation();
            if (isDone) {
              return;
            }
            onToggle(card.id);
          }}
          type="button"
        >
          {isCompleted && (
            <Check className="size-3 stroke-[2.5] text-foreground" />
          )}
        </button>
      </td>
      <td
        className="px-3.5 py-3 align-middle cursor-pointer min-w-0"
        onClick={() => openDrawer(card.id)}
      >
        <div className="flex items-center gap-2 min-w-0 pr-1">
          <span
            className={cn(
              "font-medium text-[13px] leading-snug transition-colors tracking-tight truncate",
              selected
                ? "line-through text-[var(--tb-muted)]"
                : "text-[var(--tb-text)] hover:opacity-80"
            )}
          >
            {card.title}
          </span>
          {card.description && (
            <span className="text-[11px] text-[var(--tb-muted)] truncate hidden xl:inline max-w-[260px]">
              — {card.description}
            </span>
          )}
        </div>
      </td>
      <td className="px-3.5 py-3 align-middle text-left">
        <ListPrioritySelect cardId={card.id} priority={card.priority} />
      </td>
      <td className="px-3.5 py-3 align-middle text-left">
        <Select
          onValueChange={(val) => onMove(card.id, val)}
          value={card.columnId}
        >
          <SelectTrigger
            aria-label={`Status of ${card.title}`}
            className="h-7.5 w-full max-w-[140px] rounded-lg border-[var(--tb-chip-border)] bg-[var(--tb-chip-bg)] hover:border-[var(--tb-text)]/30 text-[11px] font-medium text-[var(--tb-text)] shadow-2xs transition-colors px-2.5"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {columns.map((c) => (
              <SelectItem className="text-xs" key={c.id} value={c.id}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="hidden md:table-cell px-3.5 py-3 text-left align-middle font-mono text-[11px] text-[var(--tb-muted)] whitespace-nowrap">
        <span>
          {new Date(card.updatedAt ?? card.createdAt).toLocaleDateString(
            undefined,
            {
              month: "short",
              day: "numeric",
            }
          )}
        </span>
      </td>
      <td className="w-20 px-2 py-3 text-center align-middle">
        <div className="flex items-center justify-center gap-1">
          <button
            aria-label={`Delete ${card.title}`}
            className="size-7 inline-flex items-center justify-center rounded-lg text-[var(--tb-muted)] hover:bg-rose-500/15 hover:text-[var(--tb-diff-del)] transition-colors cursor-pointer"
            onClick={() => {
              deleteCardsSafely([card.id]);
            }}
            title="Delete task"
            type="button"
          >
            <Trash2 className="size-3.5 stroke-[1.8]" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export function KanbanListView() {
  const { cards, columns, moveCards } = useKanbanStore();
  const { filters, selection, toggleSelected } = useKanbanUiStore();
  const [sort, setSort] = useState<{ asc: boolean; key: SortKey }>({
    asc: false,
    key: "updated",
  });

  const rows = useMemo(() => {
    const columnTitle = (id: string) =>
      columns.find((c) => c.id === id)?.title ?? "";
    const rank = (p?: string) =>
      p ? PRIORITIES.indexOf(p as never) : NO_PRIORITY_RANK;
    const value = (c: KanbanCard): number | string => {
      switch (sort.key) {
        case "priority":
          return rank(c.priority);
        case "status":
          return columnTitle(c.columnId);
        case "updated":
          return c.updatedAt ?? c.createdAt;
        default:
          return c.title.toLowerCase();
      }
    };
    const sorted = filterCards(cards, filters, () => false).sort((a, b) => {
      const [x, y] = [value(a), value(b)];
      return x < y ? -1 : x > y ? 1 : 0;
    });
    return sort.asc ? sorted : sorted.reverse();
  }, [cards, columns, filters, sort]);

  const header = (
    key: SortKey,
    label: string,
    align: "center" | "left" = "left",
    widthClass?: string
  ) => (
    <th
      className={cn(
        "px-3.5 py-3 font-semibold",
        align === "center" ? "text-center" : "text-left",
        widthClass
      )}
      scope="col"
    >
      <button
        className={cn(
          "inline-flex items-center transition-colors hover:text-foreground cursor-pointer select-none",
          align === "center" ? "relative mx-auto justify-center" : "gap-1"
        )}
        onClick={() =>
          setSort((s) => ({ asc: s.key === key ? !s.asc : true, key }))
        }
        type="button"
      >
        <span className="relative inline-flex items-center">
          <span>{label}</span>
          {sort.key === key && (
            <span
              className={cn(
                "inline-flex items-center text-muted-foreground",
                align === "center" ? "absolute left-full ml-1" : "ml-1"
              )}
            >
              {sort.asc ? (
                <ArrowUp className="size-3" />
              ) : (
                <ArrowDown className="size-3" />
              )}
            </span>
          )}
        </span>
      </button>
    </th>
  );

  return (
    <div className="flex-1 w-full min-w-0 overflow-y-auto overflow-x-auto pt-1 pb-4">
      <div className="min-w-[780px] w-full rounded-[12px] border border-[var(--tb-card-border)] bg-[var(--tb-card)] shadow-[var(--tb-card-shadow)] overflow-hidden text-[var(--tb-text)]">
        <table className="w-full table-fixed text-[13px]">
          <colgroup>
            <col className="w-12" />
            <col className="w-auto min-w-[200px]" />
            <col className="w-36" />
            <col className="w-40" />
            <col className="hidden md:table-column w-28" />
            <col className="w-20" />
          </colgroup>
          <thead className="bg-[var(--tb-column)] border-b border-[var(--tb-card-border)] text-[var(--tb-muted)] text-[11.5px] font-medium tracking-wide uppercase select-none">
            <tr>
              <th className="w-12 px-3 py-3 text-center" scope="col">
                <span className="sr-only">Select</span>
              </th>
              {header("title", "Task", "left", "px-3.5")}
              {header("priority", "Priority", "left", "px-3.5")}
              {header("status", "Status", "left", "px-3.5")}
              {header(
                "updated",
                "Updated",
                "left",
                "px-3.5 hidden md:table-cell"
              )}
              <th className="w-20 px-2 py-3 text-center" scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DDD9CE]/60 dark:divide-[#2C2C29]/60">
            {rows.map((card) => (
              <ListRow
                card={card}
                column={columns.find((c) => c.id === card.columnId)}
                columns={columns}
                key={card.id}
                onMove={(id, columnId) => moveCards([id], columnId)}
                onToggle={toggleSelected}
                selected={selection.includes(card.id)}
              />
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-xs font-medium text-[#6B6A63] dark:text-[#9A978C]">
              No tasks match the active filters
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
