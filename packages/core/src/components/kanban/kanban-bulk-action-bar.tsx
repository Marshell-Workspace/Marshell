"use client";

import { deleteCardsSafely } from "@workspace/core/lib/kanban-actions";
import { PRIORITIES, type Priority } from "@workspace/core/lib/kanban-filter";
import { useKanbanStore } from "@workspace/core/stores/kanban-store";
import { useKanbanUiStore } from "@workspace/core/stores/kanban-ui-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SELECT =
  "h-7 rounded-md border border-glass-border-subtle bg-glass-surface-elevated px-1 text-xs";
const TAG_PATTERN = /[^a-z0-9-]/g;

export function KanbanBulkActionBar() {
  const { clearSelection, selection: rawSelection } = useKanbanUiStore();
  const columns = useKanbanStore((s) => s.columns);
  const cardIds = useKanbanStore((s) => s.cards);
  // Ignore ids of cards that were deleted elsewhere.
  const selection = rawSelection.filter((id) =>
    cardIds.some((c) => c.id === id)
  );
  const { moveCards, updateCards } = useKanbanStore.getState();
  const [tag, setTag] = useState("");

  if (selection.length === 0) {
    return null;
  }

  const addTag = () => {
    const clean = tag.trim().toLowerCase().replace(TAG_PATTERN, "");
    if (!clean) {
      return;
    }
    const cards = useKanbanStore.getState().cards;
    for (const id of selection) {
      const existing = cards.find((c) => c.id === id)?.tags ?? [];
      if (!existing.includes(clean)) {
        updateCards([id], { tags: [...existing, clean] });
      }
    }
    setTag("");
  };

  const remove = async () => {
    const { blocked, deleted } = await deleteCardsSafely(selection);
    useKanbanUiStore.setState({ selection: blocked.map((b) => b.id) });
    if (blocked.length > 0) {
      toast.error(
        `Deleted ${deleted.length}; kept ${blocked.length} with uncommitted worktree changes`
      );
    }
  };

  return (
    <div className="glass-panel -translate-x-1/2 fixed bottom-6 left-1/2 z-40 flex items-center gap-2 rounded-xl px-3 py-2 shadow-lg">
      <span className="font-medium text-sm tabular-nums">
        {selection.length} selected
      </span>
      <Select
        onValueChange={(val) => {
          if (val) {
            moveCards(selection, val);
          }
        }}
        value=""
      >
        <SelectTrigger
          aria-label="Move to column"
          className="h-7 rounded-md border-glass-border-subtle bg-glass-surface-elevated text-xs"
        >
          <SelectValue placeholder="Move to…" />
        </SelectTrigger>
        <SelectContent align="start">
          {columns.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        onValueChange={(val) => {
          if (val) {
            updateCards(selection, { priority: val as Priority });
          }
        }}
        value=""
      >
        <SelectTrigger
          aria-label="Set priority"
          className="h-7 rounded-md border-glass-border-subtle bg-glass-surface-elevated text-xs"
        >
          <SelectValue placeholder="Priority…" />
        </SelectTrigger>
        <SelectContent align="start">
          {PRIORITIES.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input
        aria-label="Add tag"
        className={`${SELECT} w-24`}
        onChange={(e) => setTag(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && addTag()}
        placeholder="+ tag ↵"
        value={tag}
      />
      <button
        aria-label="Delete selected"
        className="rounded p-1 text-muted-foreground hover:text-destructive"
        onClick={remove}
        type="button"
      >
        <Trash2 className="size-4" />
      </button>
      <button
        aria-label="Clear selection"
        className="rounded p-1 text-muted-foreground hover:text-foreground"
        onClick={clearSelection}
        type="button"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
