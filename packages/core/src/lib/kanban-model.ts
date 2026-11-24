export interface Subtask {
  done: boolean;
  id: string;
  title: string;
}

export type RelationType = "blocks" | "duplicates" | "related";

export interface Relation {
  cardId: string;
  type: RelationType;
}

export interface CardComment {
  createdAt: number;
  id: string;
  text: string;
}

export type PrState = "CLOSED" | "MERGED" | "OPEN";

export interface PrRef {
  number: number;
  state: PrState;
  url: string;
}

interface WithRelations {
  id: string;
  relations?: Relation[];
}

export function subtaskProgress(subtasks: Subtask[] | undefined): {
  done: number;
  total: number;
} {
  const list = subtasks ?? [];
  return { done: list.filter((s) => s.done).length, total: list.length };
}

export interface CardRelations {
  blockedBy: string[];
  blocks: string[];
  duplicates: string[];
  related: string[];
}

/**
 * Relations are stored once, on the card that declares them. From either end this returns the
 * view that end should see: A "blocks" B means B is "blocked by" A, while "related" and
 * "duplicates" read the same both ways.
 */
export function relationsOf(
  cardId: string,
  cards: WithRelations[]
): CardRelations {
  const out: CardRelations = {
    blockedBy: [],
    blocks: [],
    duplicates: [],
    related: [],
  };
  const push = (list: string[], id: string) => {
    if (!list.includes(id)) {
      list.push(id);
    }
  };
  for (const card of cards) {
    for (const rel of card.relations ?? []) {
      if (card.id === cardId) {
        push(
          rel.type === "blocks"
            ? out.blocks
            : rel.type === "duplicates"
              ? out.duplicates
              : out.related,
          rel.cardId
        );
      } else if (rel.cardId === cardId) {
        push(
          rel.type === "blocks"
            ? out.blockedBy
            : rel.type === "duplicates"
              ? out.duplicates
              : out.related,
          card.id
        );
      }
    }
  }
  return out;
}

/** Blocked while any card that blocks it is not finished. */
export function isBlocked<T extends WithRelations>(
  cardId: string,
  cards: T[],
  isFinished: (card: T) => boolean
): boolean {
  return relationsOf(cardId, cards).blockedBy.some((id) => {
    const blocker = cards.find((c) => c.id === id);
    return blocker !== undefined && !isFinished(blocker);
  });
}

/** Adds a relation unless it is a self-link, a duplicate, or would make a card block itself. */
export function withRelation(
  cards: WithRelations[],
  cardId: string,
  type: RelationType,
  otherId: string
): Relation[] | null {
  if (cardId === otherId || !cards.some((c) => c.id === otherId)) {
    return null;
  }
  const mine = cards.find((c) => c.id === cardId)?.relations ?? [];
  const already = relationsOf(cardId, cards);
  const exists =
    (type === "blocks" && already.blocks.includes(otherId)) ||
    (type === "duplicates" && already.duplicates.includes(otherId)) ||
    (type === "related" && already.related.includes(otherId));
  // A blocks B while B already blocks A would deadlock both.
  if (exists || (type === "blocks" && already.blockedBy.includes(otherId))) {
    return null;
  }
  return [...mine, { cardId: otherId, type }];
}

/** Drops relations pointing at cards that no longer exist. */
export function stripRelationsTo<T extends WithRelations>(
  cards: T[],
  removed: Set<string>
): T[] {
  return cards.map((card) =>
    card.relations?.some((r) => removed.has(r.cardId))
      ? {
          ...card,
          relations: card.relations.filter((r) => !removed.has(r.cardId)),
        }
      : card
  );
}

const PR_NUMBER = /\/pull\/(\d+)/;

export function parsePrNumber(url: string): number {
  return Number(PR_NUMBER.exec(url)?.[1] ?? 0);
}
