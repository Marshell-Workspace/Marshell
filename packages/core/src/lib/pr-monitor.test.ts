import {
  checkPullRequests,
  type PrMonitorDeps,
} from "@workspace/core/lib/pr-monitor";
import type { KanbanCard } from "@workspace/core/stores/kanban-store";
import { describe, expect, it, vi } from "vitest";

const card = (
  id: string,
  state: "CLOSED" | "MERGED" | "OPEN" | null,
  columnId = "review"
): KanbanCard => ({
  columnId,
  createdAt: 0,
  description: "",
  id,
  title: `Task ${id}`,
  pr: state
    ? { number: 7, state, url: `https://github.com/o/r/pull/${id}` }
    : undefined,
});
const columns = [
  { id: "review", title: "Review" },
  { id: "done", title: "Done" },
];

function setup(cards: KanbanCard[], fetchStatus: PrMonitorDeps["fetchStatus"]) {
  const calls = { move: vi.fn(), notify: vi.fn(), setPr: vi.fn() };
  const deps: PrMonitorDeps = {
    cards: () => cards,
    columns: () => columns,
    cwdFor: () => "/repo",
    fetchStatus,
    ...calls,
  };
  return { calls, deps };
}

describe("checkPullRequests", () => {
  it("moves a merged PR's card to Done and says so", async () => {
    const { calls, deps } = setup([card("a", "OPEN")], async () => ({
      number: 7,
      state: "MERGED",
    }));
    await checkPullRequests(deps);
    expect(calls.setPr).toHaveBeenCalledWith(
      "a",
      expect.objectContaining({ state: "MERGED" })
    );
    expect(calls.move).toHaveBeenCalledWith("a", "done");
    expect(calls.notify).toHaveBeenCalledWith(
      "PR #7 merged",
      expect.stringContaining("moved to Done"),
      "success"
    );
  });

  it("does not move a card already in Done, and reports closed PRs without moving", async () => {
    const merged = setup([card("a", "OPEN", "done")], async () => ({
      number: 7,
      state: "MERGED",
    }));
    await checkPullRequests(merged.deps);
    expect(merged.calls.move).not.toHaveBeenCalled();

    const closed = setup([card("b", "OPEN")], async () => ({
      number: 7,
      state: "closed",
    }));
    await checkPullRequests(closed.deps);
    expect(closed.calls.setPr).toHaveBeenCalledWith(
      "b",
      expect.objectContaining({ state: "CLOSED" })
    );
    expect(closed.calls.move).not.toHaveBeenCalled();
    expect(closed.calls.notify).toHaveBeenCalledWith(
      "PR #7 closed",
      expect.anything(),
      "info"
    );
  });

  it("ignores unchanged, unknown-state, finished and PR-less cards, and survives lookup errors", async () => {
    const fetchStatus = vi.fn(async (_cwd: string, url: string) => {
      if (url.endsWith("/err")) {
        throw new Error("gh not installed");
      }
      return { number: 7, state: url.endsWith("/weird") ? "DRAFTY" : "OPEN" };
    });
    const { calls, deps } = setup(
      [
        card("same", "OPEN"),
        card("weird", "OPEN"),
        card("err", "OPEN"),
        card("m", "MERGED"),
        card("none", null),
      ],
      fetchStatus
    );
    await checkPullRequests(deps);
    expect(fetchStatus).toHaveBeenCalledTimes(3);
    expect(calls.setPr).not.toHaveBeenCalled();
    expect(calls.notify).not.toHaveBeenCalled();
  });
});
