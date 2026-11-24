"use client";

import { ChecklistIcon } from "@workspace/core/components/common/custom-icons";
import { isBlocked, subtaskProgress } from "@workspace/core/lib/kanban-model";
import { openExternal } from "@workspace/core/lib/preview-client";
import {
  type KanbanCard,
  useKanbanStore,
} from "@workspace/core/stores/kanban-store";
import { cn } from "@workspace/ui/lib/utils";
import { GitPullRequest, MessageSquare, ShieldAlert, User } from "lucide-react";

const DONE = /done|complete|shipped|merged/i;
const PR_STYLE = {
  CLOSED: "text-rose-300",
  MERGED: "text-violet-300",
  OPEN: "text-emerald-300",
} as const;

/** Small at-a-glance facts on a card: sub-task progress, comments, blocked, PR and assignee. */
export function KanbanCardMeta({ card }: { card: KanbanCard }) {
  const cards = useKanbanStore((s) => s.cards);
  const columns = useKanbanStore((s) => s.columns);
  const { done, total } = subtaskProgress(card.subtasks);
  const blocked = isBlocked(card.id, cards, (c) =>
    DONE.test(columns.find((col) => col.id === c.columnId)?.title ?? "")
  );
  const comments = card.comments?.length ?? 0;
  if (!(total || comments || blocked || card.pr || card.assignee)) {
    return null;
  }
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
      {blocked && (
        <span className="flex items-center gap-0.5 rounded-full border border-rose-400/50 px-1.5 py-0.5 text-rose-300">
          <ShieldAlert className="size-2.5" />
          Blocked
        </span>
      )}
      {total > 0 && (
        <span className="flex items-center gap-0.5" title="Sub-tasks done">
          <ChecklistIcon className="size-3" />
          {done}/{total}
        </span>
      )}
      {comments > 0 && (
        <span className="flex items-center gap-0.5" title="Comments">
          <MessageSquare className="size-3" />
          {comments}
        </span>
      )}
      {card.pr && (
        <button
          className={cn(
            "flex items-center gap-0.5 hover:underline",
            PR_STYLE[card.pr.state]
          )}
          onClick={(e) => {
            e.stopPropagation();
            openExternal(card.pr?.url ?? "");
          }}
          title={card.pr.url}
          type="button"
        >
          <GitPullRequest className="size-3" />#{card.pr.number || "?"}{" "}
          {card.pr.state.toLowerCase()}
        </button>
      )}
      {card.assignee && (
        <span className="flex items-center gap-0.5">
          <User className="size-3" />
          {card.assignee}
        </span>
      )}
    </div>
  );
}
