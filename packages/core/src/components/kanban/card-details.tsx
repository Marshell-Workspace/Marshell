"use client";

import { PriorityBars } from "@workspace/core/components/kanban/kanban-card";
import { PRIORITIES, type Priority } from "@workspace/core/lib/kanban-filter";
import { relationsOf, subtaskProgress } from "@workspace/core/lib/kanban-model";
import {
  type KanbanCard,
  useKanbanStore,
} from "@workspace/core/stores/kanban-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { cn } from "@workspace/ui/lib/utils";
import { Check, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

const FIELD =
  "h-9 rounded-[8px] border border-[var(--tb-chip-border)] bg-[var(--tb-field-bg)] px-3 text-[13px] text-[var(--tb-text)] outline-none focus:ring-1 focus:ring-[var(--tb-diff-add)]/40 transition-colors placeholder:text-[var(--tb-muted)]";

type RelChoice = "blocked-by" | "blocks" | "duplicates" | "related";

/** Detailed task fields: metadata, subtasks, dependencies, and comments. */
export function CardDetails({ card }: { card: KanbanCard }) {
  const id = useId();
  const store = useKanbanStore();
  const [comment, setComment] = useState("");
  const [subtask, setSubtask] = useState("");
  const [relType, setRelType] = useState<RelChoice>("blocks");
  const [relTarget, setRelTarget] = useState("");

  const others = store.cards.filter((c) => c.id !== card.id);
  const rel = relationsOf(card.id, store.cards);
  const title = (cid: string) =>
    store.cards.find((c) => c.id === cid)?.title ?? "(deleted)";
  const { done, total } = subtaskProgress(card.subtasks);

  const addRelation = () => {
    if (!relTarget) {
      return;
    }
    const ok =
      relType === "blocked-by"
        ? store.addRelation(relTarget, "blocks", card.id)
        : store.addRelation(card.id, relType, relTarget);
    if (ok) {
      setRelTarget("");
    } else {
      toast.error(
        "That link already exists or would make two cards block each other."
      );
    }
  };

  const relRow = (
    label: string,
    ids: string[],
    type: "blocks" | "duplicates" | "related",
    inverse = false
  ) =>
    ids.map((cid) => (
      <li
        className="flex items-center gap-2 text-[13px]"
        key={`${label}-${cid}`}
      >
        <span className="rounded-[5px] border border-[var(--tb-chip-border)] bg-[var(--tb-chip-bg)] px-2 py-0.5 text-[11px] text-[var(--tb-muted)] font-mono shrink-0">
          {label.toLowerCase()}
        </span>
        <span className="flex-1 truncate text-[var(--tb-text)]">
          {title(cid)}
        </span>
        <button
          aria-label={`Remove ${label} ${title(cid)}`}
          className="text-[var(--tb-icon)] hover:text-[var(--tb-diff-del)] transition-colors cursor-pointer p-0.5"
          onClick={() =>
            store.removeRelation(
              inverse ? cid : card.id,
              type,
              inverse ? card.id : cid
            )
          }
          type="button"
        >
          <Trash2 className="size-3.5 stroke-[1.8]" />
        </button>
      </li>
    ));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[var(--tb-text)]">
      {/* Left Column */}
      <div className="flex min-w-0 flex-col gap-4">
        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-[12px] font-normal text-[var(--tb-muted)]"
            htmlFor={`${id}-title`}
          >
            Title
          </label>
          <input
            className={FIELD}
            defaultValue={card.title}
            id={`${id}-title`}
            key={`t-${card.updatedAt}`}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== card.title) {
                store.updateCard(card.id, { title: v });
              }
            }}
          />
        </div>

        {/* Description (92px textarea) */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-[12px] font-normal text-[var(--tb-muted)]"
            htmlFor={`${id}-desc`}
          >
            Description
          </label>
          <textarea
            className="h-[92px] min-h-[92px] rounded-[8px] border border-[var(--tb-chip-border)] bg-[var(--tb-field-bg)] text-[13px] leading-[19px] p-3 text-[var(--tb-text)] outline-none resize-none focus:ring-1 focus:ring-[var(--tb-diff-add)]/40 transition-colors placeholder:text-[var(--tb-muted)]"
            defaultValue={card.description}
            id={`${id}-desc`}
            key={`d-${card.updatedAt}`}
            onBlur={(e) => {
              if (e.target.value !== card.description) {
                store.updateCard(card.id, { description: e.target.value });
              }
            }}
            placeholder="Add description..."
          />
        </div>

        {/* Status and Priority side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-normal text-[var(--tb-muted)]">
              Status
            </span>
            <Select
              onValueChange={(val) => store.moveCards([card.id], val)}
              value={card.columnId}
            >
              <SelectTrigger className="w-full h-9 rounded-[8px] border border-[var(--tb-chip-border)] bg-[var(--tb-field-bg)] text-[13px] text-[var(--tb-text)] px-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                align="start"
                className="rounded-[12px] border border-[var(--tb-popover-border)] bg-[var(--tb-popover-bg)] p-1 text-[var(--tb-text)] shadow-[var(--tb-popover-shadow)]"
              >
                {store.columns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-normal text-[var(--tb-muted)]">
              Priority
            </span>
            <Select
              onValueChange={(val) =>
                store.updateCard(card.id, {
                  priority: (val === "none" ? undefined : val) as
                    | Priority
                    | undefined,
                })
              }
              value={card.priority ?? "none"}
            >
              <SelectTrigger className="w-full h-9 rounded-[8px] border border-[var(--tb-chip-border)] bg-[var(--tb-field-bg)] text-[13px] text-[var(--tb-text)] px-3 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <PriorityBars priority={card.priority} showNone={true} />
                  <span className="capitalize truncate">
                    {card.priority || "None"}
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent
                align="start"
                className="rounded-[12px] border border-[var(--tb-popover-border)] bg-[var(--tb-popover-bg)] p-1 text-[var(--tb-text)] shadow-[var(--tb-popover-shadow)]"
              >
                <SelectItem value="none">
                  <div className="flex items-center gap-2">
                    <PriorityBars priority={null} showNone={true} />
                    <span>None</span>
                  </div>
                </SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    <div className="flex items-center gap-2">
                      <PriorityBars priority={p} />
                      <span className="capitalize">{p}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-[12px] font-normal text-[var(--tb-muted)]"
            htmlFor={`${id}-tags`}
          >
            Tags
          </label>
          <input
            className={FIELD}
            defaultValue={(card.tags ?? []).join(", ")}
            id={`${id}-tags`}
            key={`g-${card.updatedAt}`}
            onBlur={(e) =>
              store.updateCard(card.id, {
                tags: e.target.value
                  .split(",")
                  .map((t) =>
                    t
                      .trim()
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "")
                  )
                  .filter(Boolean),
              })
            }
            placeholder="backend, realtime"
          />
        </div>
      </div>

      {/* Right Column */}
      <div className="flex min-w-0 flex-col gap-6">
        {/* SUB-TASKS section */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--tb-muted)]">
              SUB-TASKS · {done}/{total}
            </span>
            {total > 0 && (
              <div className="w-[120px] h-1.5 rounded-full bg-[var(--tb-ring-track)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--tb-diff-add)] transition-[width] motion-normal"
                  style={{ width: `${(done / total) * 100}%` }}
                />
              </div>
            )}
          </div>

          <ul className="flex flex-col gap-1">
            {(card.subtasks ?? []).map((t) => (
              <li
                className="h-[34px] flex items-center gap-2.5 px-1 rounded-[6px] hover:bg-[var(--tb-field-bg)]/40 transition-colors"
                key={t.id}
              >
                <button
                  aria-label={t.title}
                  className={cn(
                    "size-4 rounded-[4px] border-[1.5px] flex items-center justify-center transition-colors cursor-pointer shrink-0",
                    t.done
                      ? "border-[var(--tb-diff-add)] bg-[var(--tb-diff-add)] text-foreground"
                      : "border-[var(--tb-checkbox-border)] bg-transparent hover:border-[var(--tb-text)]"
                  )}
                  onClick={() => store.toggleSubtask(card.id, t.id)}
                  type="button"
                >
                  {t.done && (
                    <Check className="size-3 stroke-[2.5] text-foreground" />
                  )}
                </button>
                <span
                  className={cn(
                    "flex-1 text-[13px] truncate",
                    t.done
                      ? "text-[var(--tb-muted)] line-through"
                      : "text-[var(--tb-text)]"
                  )}
                >
                  {t.title}
                </span>
                <button
                  aria-label={`Delete ${t.title}`}
                  className="text-[var(--tb-icon)] hover:text-[var(--tb-diff-del)] transition-colors cursor-pointer p-1"
                  onClick={() => store.removeSubtask(card.id, t.id)}
                  type="button"
                >
                  <Trash2 className="size-3.5 stroke-[1.8]" />
                </button>
              </li>
            ))}
          </ul>

          <form
            className="flex items-center gap-2 mt-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (subtask.trim()) {
                store.addSubtask(card.id, subtask.trim());
                setSubtask("");
              }
            }}
          >
            <input
              className="h-[34px] rounded-[8px] border border-[var(--tb-chip-border)] bg-[var(--tb-field-bg)] px-3 text-[13px] text-[var(--tb-text)] flex-1 outline-none focus:ring-1 focus:ring-[var(--tb-diff-add)]/40 transition-colors placeholder:text-[var(--tb-muted)]"
              onChange={(e) => setSubtask(e.target.value)}
              placeholder="Add a sub-task..."
              value={subtask}
            />
            <button
              className="h-[34px] rounded-[8px] border border-[var(--tb-control-border)] bg-[var(--tb-control-bg)] px-3.5 text-[13px] font-medium text-[var(--tb-text)] hover:bg-[var(--tb-chip-bg)] transition-colors cursor-pointer shrink-0"
              type="submit"
            >
              Add
            </button>
          </form>
        </div>

        {/* RELATIONSHIPS section */}
        <div className="flex flex-col gap-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--tb-muted)]">
            RELATIONSHIPS
          </span>

          <div className="flex items-center gap-2">
            <Select
              onValueChange={(val) => setRelType(val as RelChoice)}
              value={relType}
            >
              <SelectTrigger
                aria-label="Relationship type"
                className="w-28 h-9 rounded-[8px] border border-[var(--tb-chip-border)] bg-[var(--tb-field-bg)] text-[13px] text-[var(--tb-text)] px-2.5"
                id={`${id}-reltype`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                align="start"
                className="rounded-[12px] border border-[var(--tb-popover-border)] bg-[var(--tb-popover-bg)] p-1 text-[var(--tb-text)] shadow-[var(--tb-popover-shadow)]"
              >
                <SelectItem value="blocks">blocks</SelectItem>
                <SelectItem value="blocked-by">is blocked by</SelectItem>
                <SelectItem value="related">is related to</SelectItem>
                <SelectItem value="duplicates">duplicates</SelectItem>
              </SelectContent>
            </Select>

            <Select
              onValueChange={(val) => setRelTarget(val)}
              value={relTarget}
            >
              <SelectTrigger
                aria-label="Other card"
                className="h-9 min-w-0 flex-1 rounded-[8px] border border-[var(--tb-chip-border)] bg-[var(--tb-field-bg)] text-[13px] text-[var(--tb-text)] px-3"
                id={`${id}-reltarget`}
              >
                <SelectValue placeholder="Choose a card..." />
              </SelectTrigger>
              <SelectContent
                align="start"
                className="rounded-[12px] border border-[var(--tb-popover-border)] bg-[var(--tb-popover-bg)] p-1 text-[var(--tb-text)] shadow-[var(--tb-popover-shadow)]"
              >
                {others.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              className="h-9 rounded-[8px] border border-[var(--tb-control-border)] bg-[var(--tb-control-bg)] px-3.5 text-[13px] font-medium text-[var(--tb-text)] hover:bg-[var(--tb-chip-bg)] transition-colors cursor-pointer shrink-0 disabled:opacity-40"
              disabled={!relTarget}
              onClick={addRelation}
              type="button"
            >
              Link
            </button>
          </div>

          <ul className="flex flex-col gap-1.5 mt-1">
            {relRow("blocks", rel.blocks, "blocks")}
            {relRow("blocked by", rel.blockedBy, "blocks", true)}
            {relRow("related", rel.related, "related")}
            {relRow("duplicates", rel.duplicates, "duplicates")}
          </ul>
        </div>

        {/* COMMENTS section */}
        <div className="flex flex-col gap-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--tb-muted)]">
            COMMENTS · {card.comments?.length ?? 0}
          </span>

          <ul className="flex flex-col gap-2">
            {(card.comments ?? []).map((c) => (
              <li
                className="rounded-[8px] border border-[var(--tb-chip-border)] bg-[var(--tb-chip-bg)] p-3 text-[13px]"
                key={c.id}
              >
                <div className="flex items-center justify-between text-[11px] text-[var(--tb-muted)] font-normal">
                  <span>{new Date(c.createdAt).toLocaleString()}</span>
                  <button
                    aria-label="Delete comment"
                    className="text-[var(--tb-icon)] hover:text-[var(--tb-diff-del)] transition-colors cursor-pointer p-0.5"
                    onClick={() => store.removeComment(card.id, c.id)}
                    type="button"
                  >
                    <Trash2 className="size-3.5 stroke-[1.8]" />
                  </button>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--tb-text)] whitespace-pre-wrap">
                  {c.text}
                </p>
              </li>
            ))}
          </ul>

          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (comment.trim()) {
                store.addComment(card.id, comment);
                setComment("");
              }
            }}
          >
            <textarea
              className="h-[64px] min-h-[64px] rounded-[8px] border border-[var(--tb-chip-border)] bg-[var(--tb-field-bg)] text-[13px] p-2.5 text-[var(--tb-text)] outline-none resize-none focus:ring-1 focus:ring-[var(--tb-diff-add)]/40 transition-colors placeholder:text-[var(--tb-muted)]"
              id={`${id}-comment`}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Leave a comment..."
              value={comment}
            />
            <button
              className="h-8 rounded-[8px] border border-[var(--tb-control-border)] bg-[var(--tb-control-bg)] px-3.5 text-[13px] font-medium text-[var(--tb-text)] hover:bg-[var(--tb-chip-bg)] transition-colors cursor-pointer self-start disabled:opacity-40"
              disabled={!comment.trim()}
              type="submit"
            >
              Comment
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
