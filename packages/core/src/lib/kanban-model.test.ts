import {
  isBlocked,
  parsePrNumber,
  relationsOf,
  stripRelationsTo,
  subtaskProgress,
  withRelation,
} from "@workspace/core/lib/kanban-model";
import { describe, expect, it } from "vitest";

const cards = [
  {
    id: "a",
    relations: [
      { cardId: "b", type: "blocks" as const },
      { cardId: "c", type: "related" as const },
    ],
  },
  { id: "b" },
  { id: "c" },
];

describe("relations", () => {
  it("reads one stored link from both ends", () => {
    expect(relationsOf("a", cards)).toMatchObject({
      blocks: ["b"],
      related: ["c"],
      blockedBy: [],
    });
    expect(relationsOf("b", cards)).toMatchObject({
      blockedBy: ["a"],
      blocks: [],
    });
    expect(relationsOf("c", cards)).toMatchObject({ related: ["a"] });
  });

  it("is blocked only while a blocker is unfinished", () => {
    expect(isBlocked("b", cards, () => false)).toBe(true);
    expect(isBlocked("b", cards, (c) => c.id === "a")).toBe(false);
    expect(isBlocked("a", cards, () => false)).toBe(false);
    expect(isBlocked("ghost", cards, () => false)).toBe(false);
  });

  it("refuses self-links, unknown cards, duplicates and mutual blocking", () => {
    expect(withRelation(cards, "a", "blocks", "a")).toBeNull();
    expect(withRelation(cards, "a", "blocks", "nope")).toBeNull();
    expect(withRelation(cards, "a", "blocks", "b")).toBeNull();
    expect(withRelation(cards, "b", "blocks", "a")).toBeNull();
    expect(withRelation(cards, "c", "related", "a")).toBeNull();
    expect(withRelation(cards, "b", "duplicates", "c")).toEqual([
      { cardId: "c", type: "duplicates" },
    ]);
  });

  it("removes links to deleted cards", () => {
    const out = stripRelationsTo(cards, new Set(["b"]));
    expect(out[0]?.relations).toEqual([{ cardId: "c", type: "related" }]);
    expect(out[1]).toBe(cards[1]);
  });
});

describe("helpers", () => {
  it("counts subtasks and reads PR numbers", () => {
    expect(
      subtaskProgress([
        { done: true, id: "1", title: "a" },
        { done: false, id: "2", title: "b" },
      ])
    ).toEqual({ done: 1, total: 2 });
    expect(subtaskProgress(undefined)).toEqual({ done: 0, total: 0 });
    expect(parsePrNumber("https://github.com/o/r/pull/123")).toBe(123);
    expect(parsePrNumber("https://x")).toBe(0);
  });
});
