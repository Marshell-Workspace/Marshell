import type { PrRef, PrState } from "@workspace/core/lib/kanban-model";
import type {
  KanbanCard,
  KanbanColumn,
} from "@workspace/core/stores/kanban-store";

const DONE_COLUMN = /done|complete|shipped|merged/i;

export interface PrMonitorDeps {
  cards: () => KanbanCard[];
  columns: () => KanbanColumn[];
  /** Where to run `gh` for a card: its worktree, else the repository. */
  cwdFor: (cardId: string) => string | undefined;
  fetchStatus: (
    cwd: string,
    url: string
  ) => Promise<{ number: number; state: string }>;
  move: (cardId: string, columnId: string) => void;
  notify: (title: string, body: string, kind: "info" | "success") => void;
  setPr: (cardId: string, pr: PrRef) => void;
}

const asState = (s: string): PrState | null => {
  const upper = s.toUpperCase();
  return upper === "OPEN" || upper === "MERGED" || upper === "CLOSED"
    ? upper
    : null;
};

/**
 * One pass over cards with an open pull request: records state changes, and when a PR is merged
 * moves its card to the Done column and says so.
 */
export async function checkPullRequests(deps: PrMonitorDeps): Promise<void> {
  for (const card of deps.cards()) {
    const pr = card.pr;
    const cwd = deps.cwdFor(card.id);
    if (!(pr && pr.state === "OPEN" && cwd)) {
      continue;
    }
    let status: { number: number; state: string };
    try {
      status = await deps.fetchStatus(cwd, pr.url);
    } catch {
      continue; // `gh` missing, offline, or signed out: try again next pass
    }
    const state = asState(status.state);
    if (!state || state === pr.state) {
      continue;
    }
    deps.setPr(card.id, { ...pr, number: status.number || pr.number, state });
    if (state === "MERGED") {
      const done = deps.columns().find((c) => DONE_COLUMN.test(c.title));
      if (done && card.columnId !== done.id) {
        deps.move(card.id, done.id);
      }
      deps.notify(
        `PR #${status.number || pr.number} merged`,
        `"${card.title}" was merged${done ? ` and moved to ${done.title}` : ""}.`,
        "success"
      );
    } else {
      deps.notify(
        `PR #${status.number || pr.number} closed`,
        `"${card.title}": closed without merging.`,
        "info"
      );
    }
  }
}
