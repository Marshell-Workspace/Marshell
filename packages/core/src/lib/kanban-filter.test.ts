import {
  EMPTY_FILTERS,
  filterCards,
  promoteDraft,
} from "@workspace/core/lib/kanban-filter";
import { describe, expect, it } from "vitest";

const cards = [
  {
    description: "login breaks",
    id: "a",
    priority: "high" as const,
    tags: ["bug"],
    title: "Fix auth",
  },
  {
    description: "",
    id: "b",
    priority: "low" as const,
    tags: ["docs"],
    title: "Write README",
  },
  { description: "Auth again", id: "c", title: "Untagged" },
];
const withTree = (id: string) => id === "a";
const ids = (f: Partial<typeof EMPTY_FILTERS>) =>
  filterCards(cards, { ...EMPTY_FILTERS, ...f }, withTree).map((c) => c.id);

describe("filterCards", () => {
  it("returns everything with empty filters", () => {
    expect(ids({})).toEqual(["a", "b", "c"]);
  });
  it("matches title and description case-insensitively", () => {
    expect(ids({ query: "AUTH" })).toEqual(["a", "c"]);
  });
  it("ORs within priorities and tags, ANDs across filters", () => {
    expect(ids({ priorities: ["high", "low"] })).toEqual(["a", "b"]);
    expect(ids({ priorities: ["high", "low"], tags: ["docs"] })).toEqual(["b"]);
  });
  it("filters by worktree presence", () => {
    expect(ids({ worktree: "has" })).toEqual(["a"]);
    expect(ids({ worktree: "none" })).toEqual(["b", "c"]);
  });

  it("filters by urgent priority", () => {
    const urgentCards = [
      ...cards,
      {
        description: "production down",
        id: "d",
        priority: "urgent" as const,
        tags: ["p0"],
        title: "Database failure",
      },
    ];
    const filtered = filterCards(
      urgentCards,
      { ...EMPTY_FILTERS, priorities: ["urgent"] },
      () => false
    );
    expect(filtered.map((c) => c.id)).toEqual(["d"]);
  });

  it("combines search query, priority, worktree and tags together", () => {
    // Both query 'auth', priority 'high', tags 'bug', worktree 'has'
    expect(
      ids({
        priorities: ["high"],
        query: "login",
        tags: ["bug"],
        worktree: "has",
      })
    ).toEqual(["a"]);

    // Conflicting filter yields empty array
    expect(
      ids({
        priorities: ["low"],
        query: "login",
        tags: ["bug"],
        worktree: "has",
      })
    ).toEqual([]);
  });

  it("handles non-matching query gracefully returning empty array", () => {
    expect(ids({ query: "nonexistent text 12345" })).toEqual([]);
  });
});

describe("promoteDraft", () => {
  it("splits title and body and collects hashtags and keyword tags", () => {
    const draft = promoteDraft("Fix login crash #auth\nStack trace in prod");
    expect(draft.title).toBe("Fix login crash");
    expect(draft.description).toBe("Stack trace in prod");
    expect(draft.tags).toEqual(expect.arrayContaining(["auth", "bug"]));
  });
  it("falls back for empty text and caps long titles", () => {
    expect(promoteDraft("  ").title).toBe("Untitled task");
    expect(promoteDraft("x".repeat(200)).title).toHaveLength(80);
  });
});
