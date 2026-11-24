export const PRIORITIES = ["urgent", "high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export type WorktreeFilter = "all" | "has" | "none";

export interface KanbanFilters {
  priorities: Priority[];
  query: string;
  tags: string[];
  worktree: WorktreeFilter;
}

export const EMPTY_FILTERS: KanbanFilters = {
  priorities: [],
  query: "",
  tags: [],
  worktree: "all",
};

interface Filterable {
  description: string;
  id: string;
  priority?: Priority;
  tags?: string[];
  title: string;
}

export function hasActiveFilters(f: KanbanFilters): boolean {
  return (
    f.query.trim() !== "" ||
    f.priorities.length > 0 ||
    f.tags.length > 0 ||
    f.worktree !== "all"
  );
}

/** Text is matched case-insensitively; priorities and tags are OR within, AND across. */
export function filterCards<T extends Filterable>(
  cards: T[],
  filters: KanbanFilters,
  hasWorktree: (cardId: string) => boolean
): T[] {
  const query = filters.query.trim().toLowerCase();
  return cards.filter((card) => {
    if (
      query &&
      !`${card.title}\n${card.description}`.toLowerCase().includes(query)
    ) {
      return false;
    }
    if (
      filters.priorities.length > 0 &&
      !(card.priority && filters.priorities.includes(card.priority))
    ) {
      return false;
    }
    if (
      filters.tags.length > 0 &&
      !filters.tags.some((t) => card.tags?.includes(t))
    ) {
      return false;
    }
    if (filters.worktree !== "all") {
      return hasWorktree(card.id) === (filters.worktree === "has");
    }
    return true;
  });
}

const MAX_TITLE_LENGTH = 80;
const HASHTAG = /(?:^|\s)#([a-z][\w-]{0,24})/gi;
const KEYWORD_TAGS: [RegExp, string][] = [
  [/\b(bug|fix|crash|broken|error)\b/i, "bug"],
  [/\b(feat|feature|add|implement)\b/i, "feature"],
  [/\b(refactor|cleanup|clean up)\b/i, "refactor"],
  [/\b(docs?|readme)\b/i, "docs"],
  [/\b(test|tests|spec)\b/i, "test"],
];

/** Turns raw scratchpad text into a card: first line is the title, the rest the body. */
export function promoteDraft(text: string): {
  description: string;
  tags: string[];
  title: string;
} {
  const lines = text.trim().split("\n");
  const first = (lines[0] ?? "").replace(HASHTAG, "").trim();
  const title = (first || "Untitled task").slice(0, MAX_TITLE_LENGTH);
  const tags = new Set<string>();
  for (const match of text.matchAll(HASHTAG)) {
    tags.add((match[1] as string).toLowerCase());
  }
  for (const [pattern, tag] of KEYWORD_TAGS) {
    if (pattern.test(text)) {
      tags.add(tag);
    }
  }
  return {
    description: lines.slice(1).join("\n").trim(),
    tags: [...tags],
    title,
  };
}
