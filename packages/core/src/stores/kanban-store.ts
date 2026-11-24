"use client";

import type { RunnerConfig } from "@workspace/core/lib/cli-catalog";
import type { Priority } from "@workspace/core/lib/kanban-filter";
import {
  type CardComment,
  type PrRef,
  type Relation,
  type RelationType,
  type Subtask,
  stripRelationsTo,
  withRelation,
} from "@workspace/core/lib/kanban-model";
import { safeStorage } from "@workspace/core/lib/safe-json";
import { safeUUID } from "@workspace/core/lib/uuid";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface KanbanCard {
  /** Who the task is for: a person, or an agent's name. */
  assignee?: string;
  columnId: string;
  comments?: CardComment[];
  createdAt: number;
  description: string;
  id: string;
  pr?: PrRef;
  priority?: Priority;
  /** Stored on the card that declares it; see `relationsOf` for both directions. */
  relations?: Relation[];
  runner?: RunnerConfig;
  subtasks?: Subtask[];
  tags?: string[];
  title: string;
  /** Last edit or move; older cards fall back to `createdAt`. */
  updatedAt?: number;
}

export type KanbanCardUpdates = Partial<
  Pick<
    KanbanCard,
    | "assignee"
    | "comments"
    | "description"
    | "pr"
    | "priority"
    | "relations"
    | "runner"
    | "subtasks"
    | "tags"
    | "title"
  >
>;

export interface KanbanColumn {
  id: string;
  title: string;
}

export interface BoardData {
  cards: KanbanCard[];
  columns: KanbanColumn[];
}

interface KanbanState {
  activeWorkspaceId: string;

  addCard: (
    columnId: string,
    title: string,
    description?: string,
    extra?: Pick<KanbanCard, "priority" | "tags">,
    afterCardId?: string,
    workspaceId?: string
  ) => KanbanCard;
  addColumn: (title: string) => KanbanColumn;
  addComment: (cardId: string, text: string, workspaceId?: string) => void;
  addRelation: (cardId: string, type: RelationType, otherId: string) => boolean;
  addSubtask: (cardId: string, title: string, workspaceId?: string) => void;
  boards: Record<string, BoardData>;
  cards: KanbanCard[];
  columns: KanbanColumn[];
  deleteCard: (id: string) => void;
  deleteCards: (ids: string[]) => void;
  deleteColumn: (id: string) => void;
  deleteWorkspaceBoard: (workspaceId: string) => void;
  getWorkspaceBoard: (workspaceId: string) => BoardData;
  moveCard: (cardId: string, toColumnId: string, toIndex: number) => void;
  moveCards: (ids: string[], toColumnId: string, workspaceId?: string) => void;
  removeComment: (cardId: string, commentId: string) => void;
  removeRelation: (cardId: string, type: RelationType, otherId: string) => void;
  removeSubtask: (cardId: string, subtaskId: string) => void;
  renameColumn: (id: string, title: string) => void;
  reorderCards: (columnId: string, cardIds: string[]) => void;
  reorderColumns: (startIndex: number, endIndex: number) => void;

  setActiveWorkspaceId: (workspaceId: string) => void;
  setCards: (cards: KanbanCard[]) => void;
  setColumns: (columns: KanbanColumn[]) => void;
  setPr: (cardId: string, pr: PrRef | undefined) => void;
  toggleSubtask: (cardId: string, subtaskId: string) => void;
  updateCard: (
    id: string,
    updates: KanbanCardUpdates,
    workspaceId?: string
  ) => void;
  updateCards: (
    ids: string[],
    updates: KanbanCardUpdates,
    workspaceId?: string
  ) => void;
}

function generateId(): string {
  return safeUUID();
}

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "backlog", title: "Backlog" },
  { id: "in-progress", title: "In Progress" },
  { id: "review", title: "Review" },
  { id: "done", title: "Done" },
];

function updateWorkspaceBoard(
  state: KanbanState,
  workspaceId: string | undefined,
  updater: (current: BoardData) => BoardData
): Partial<KanbanState> {
  const wsId = workspaceId || state.activeWorkspaceId || "default";
  const board = state.boards[wsId];
  const currentBoard: BoardData =
    wsId === state.activeWorkspaceId
      ? {
          cards:
            board && board.cards === state.cards
              ? board.cards
              : (state.cards ?? board?.cards ?? []),
          columns:
            board && board.columns === state.columns
              ? board.columns
              : state.columns?.length
                ? state.columns
                : (board?.columns ?? DEFAULT_COLUMNS),
        }
      : (board ?? { cards: [], columns: DEFAULT_COLUMNS });
  const updatedBoard = updater(currentBoard);
  return {
    boards: {
      ...state.boards,
      [wsId]: updatedBoard,
    },
    ...(wsId === state.activeWorkspaceId
      ? { cards: updatedBoard.cards, columns: updatedBoard.columns }
      : {}),
  };
}

function updateActiveBoard(
  state: KanbanState,
  updater: (current: BoardData) => BoardData
): Partial<KanbanState> {
  return updateWorkspaceBoard(state, undefined, updater);
}

export const useKanbanStore = create<KanbanState>()(
  persist(
    (set, get) => ({
      activeWorkspaceId: "default",
      boards: {},
      cards: [],
      columns: DEFAULT_COLUMNS,
      getWorkspaceBoard: (workspaceId) => {
        const state = get();
        return workspaceId === state.activeWorkspaceId
          ? { cards: state.cards, columns: state.columns }
          : (state.boards[workspaceId] ?? {
              cards: [],
              columns: DEFAULT_COLUMNS,
            });
      },

      setActiveWorkspaceId: (workspaceId: string) => {
        const wsId = workspaceId || "default";
        set((state) => {
          if (state.activeWorkspaceId === wsId && state.boards[wsId]) {
            return {};
          }
          const existingBoard = state.boards[wsId];
          if (existingBoard) {
            return {
              activeWorkspaceId: wsId,
              cards: existingBoard.cards,
              columns: existingBoard.columns,
            };
          }

          // Migration / initial workspace setup check
          const defaultBoard = state.boards.default ?? {
            cards: state.cards ?? [],
            columns: state.columns?.length ? state.columns : DEFAULT_COLUMNS,
          };

          const nonDefaultKeys = Object.keys(state.boards).filter(
            (k) => k !== "default"
          );
          const hasOnlyDefault = nonDefaultKeys.length === 0;

          if (
            hasOnlyDefault &&
            (defaultBoard.cards.length > 0 || state.cards.length > 0)
          ) {
            const currentCards =
              state.cards.length > 0 ? state.cards : defaultBoard.cards;
            const currentColumns =
              state.columns.length > 0 ? state.columns : defaultBoard.columns;
            const newBoard: BoardData = {
              cards: currentCards,
              columns: currentColumns,
            };
            return {
              activeWorkspaceId: wsId,
              boards: {
                ...state.boards,
                [wsId]: newBoard,
              },
              cards: newBoard.cards,
              columns: newBoard.columns,
            };
          }

          const newBoard: BoardData = {
            cards: [],
            columns: DEFAULT_COLUMNS,
          };
          return {
            activeWorkspaceId: wsId,
            boards: {
              ...state.boards,
              [wsId]: newBoard,
            },
            cards: newBoard.cards,
            columns: newBoard.columns,
          };
        });
      },

      deleteWorkspaceBoard: (workspaceId: string) => {
        if (!workspaceId) {
          return;
        }
        set((state) => {
          const nextBoards = { ...state.boards };
          delete nextBoards[workspaceId];
          return { boards: nextBoards };
        });
      },

      addCard: (
        columnId: string,
        title: string,
        description = "",
        extra?: Pick<KanbanCard, "priority" | "tags">,
        afterCardId?: string,
        workspaceId?: string
      ) => {
        const card: KanbanCard = {
          ...extra,
          columnId,
          createdAt: Date.now(),
          description,
          id: generateId(),
          title,
          updatedAt: Date.now(),
        };
        set((state) =>
          updateWorkspaceBoard(state, workspaceId, (board) => {
            if (afterCardId) {
              const idx = board.cards.findIndex((c) => c.id === afterCardId);
              if (idx !== -1) {
                const nextCards = [...board.cards];
                nextCards.splice(idx + 1, 0, card);
                return { ...board, cards: nextCards };
              }
            }
            return {
              ...board,
              cards: [...board.cards, card],
            };
          })
        );
        return card;
      },
      addColumn: (title: string) => {
        const column: KanbanColumn = {
          id: generateId(),
          title,
        };
        set((state) =>
          updateActiveBoard(state, (board) => ({
            ...board,
            columns: [...board.columns, column],
          }))
        );
        return column;
      },
      deleteCard: (id: string) => {
        set((state) =>
          updateActiveBoard(state, (board) => ({
            ...board,
            cards: stripRelationsTo(
              board.cards.filter((c) => c.id !== id),
              new Set([id])
            ),
          }))
        );
      },
      deleteCards: (ids: string[]) => {
        const doomed = new Set(ids);
        set((state) =>
          updateActiveBoard(state, (board) => ({
            ...board,
            cards: stripRelationsTo(
              board.cards.filter((c) => !doomed.has(c.id)),
              doomed
            ),
          }))
        );
      },
      deleteColumn: (id: string) => {
        set((state) =>
          updateActiveBoard(state, (board) => ({
            cards: board.cards.filter((c) => c.columnId !== id),
            columns: board.columns.filter((col) => col.id !== id),
          }))
        );
      },
      renameColumn: (id: string, title: string) => {
        const clean = title.trim();
        if (!clean) {
          return;
        }
        set((state) =>
          updateActiveBoard(state, (board) => ({
            ...board,
            columns: board.columns.map((c) =>
              c.id === id ? { ...c, title: clean } : c
            ),
          }))
        );
      },
      reorderColumns: (startIndex: number, endIndex: number) => {
        set((state) =>
          updateActiveBoard(state, (board) => {
            const columns = [...board.columns];
            const [moved] = columns.splice(startIndex, 1);
            if (moved) {
              columns.splice(endIndex, 0, moved);
            }
            return { ...board, columns };
          })
        );
      },
      setCards: (cards: KanbanCard[]) => {
        set((state) =>
          updateActiveBoard(state, (board) => ({
            ...board,
            cards,
          }))
        );
      },
      setColumns: (columns: KanbanColumn[]) => {
        set((state) =>
          updateActiveBoard(state, (board) => ({
            ...board,
            columns,
          }))
        );
      },
      moveCard: (cardId: string, toColumnId: string, toIndex: number) => {
        set((state) =>
          updateActiveBoard(state, (board) => {
            const cards = [...board.cards];
            const cardIndex = cards.findIndex((c) => c.id === cardId);
            if (cardIndex === -1) {
              return board;
            }

            const card = cards[cardIndex] as KanbanCard;
            cards.splice(cardIndex, 1);
            cards.splice(toIndex, 0, {
              ...card,
              columnId: toColumnId,
              updatedAt: Date.now(),
            });

            return { ...board, cards };
          })
        );
      },
      moveCards: (ids: string[], toColumnId: string, workspaceId?: string) => {
        const moving = new Set(ids);
        set((state) =>
          updateWorkspaceBoard(state, workspaceId, (board) => ({
            ...board,
            cards: board.cards.map((c) =>
              moving.has(c.id)
                ? { ...c, columnId: toColumnId, updatedAt: Date.now() }
                : c
            ),
          }))
        );
      },
      reorderCards: (columnId: string, cardIds: string[]) => {
        set((state) =>
          updateActiveBoard(state, (board) => {
            const otherCards = board.cards.filter(
              (c) => c.columnId !== columnId
            );
            const columnCards = cardIds
              .map((id) => board.cards.find((c) => c.id === id))
              .filter(Boolean) as KanbanCard[];
            return { ...board, cards: [...otherCards, ...columnCards] };
          })
        );
      },
      addComment: (cardId, text, workspaceId) => {
        const clean = text.trim();
        if (!clean) {
          return;
        }
        const card = get()
          .getWorkspaceBoard(workspaceId ?? get().activeWorkspaceId)
          .cards.find((c) => c.id === cardId);
        get().updateCards(
          [cardId],
          {
            comments: [
              ...(card?.comments ?? []),
              { createdAt: Date.now(), id: generateId(), text: clean },
            ],
          },
          workspaceId
        );
      },
      removeComment: (cardId, commentId) => {
        const card = get().cards.find((c) => c.id === cardId);
        get().updateCards([cardId], {
          comments: (card?.comments ?? []).filter((c) => c.id !== commentId),
        });
      },
      addSubtask: (cardId, title, workspaceId) => {
        const clean = title.trim();
        if (!clean) {
          return;
        }
        const card = get()
          .getWorkspaceBoard(workspaceId ?? get().activeWorkspaceId)
          .cards.find((c) => c.id === cardId);
        get().updateCards(
          [cardId],
          {
            subtasks: [
              ...(card?.subtasks ?? []),
              { done: false, id: generateId(), title: clean },
            ],
          },
          workspaceId
        );
      },
      toggleSubtask: (cardId, subtaskId) => {
        const card = get().cards.find((c) => c.id === cardId);
        get().updateCards([cardId], {
          subtasks: (card?.subtasks ?? []).map((t) =>
            t.id === subtaskId ? { ...t, done: !t.done } : t
          ),
        });
      },
      removeSubtask: (cardId, subtaskId) => {
        const card = get().cards.find((c) => c.id === cardId);
        get().updateCards([cardId], {
          subtasks: (card?.subtasks ?? []).filter((t) => t.id !== subtaskId),
        });
      },
      addRelation: (cardId, type, otherId) => {
        const next = withRelation(get().cards, cardId, type, otherId);
        if (!next) {
          return false;
        }
        get().updateCards([cardId], { relations: next });
        return true;
      },
      removeRelation: (cardId, type, otherId) => {
        for (const [holder, target] of [
          [cardId, otherId],
          [otherId, cardId],
        ] as const) {
          const card = get().cards.find((c) => c.id === holder);
          if (
            card?.relations?.some((r) => r.type === type && r.cardId === target)
          ) {
            get().updateCards([holder], {
              relations: card.relations.filter(
                (r) => !(r.type === type && r.cardId === target)
              ),
            });
          }
        }
      },
      setPr: (cardId, pr) => get().updateCards([cardId], { pr }),
      updateCard: (
        id: string,
        updates: KanbanCardUpdates,
        workspaceId?: string
      ) => {
        get().updateCards([id], updates, workspaceId);
      },
      updateCards: (
        ids: string[],
        updates: KanbanCardUpdates,
        workspaceId?: string
      ) => {
        const targets = new Set(ids);
        set((state) =>
          updateWorkspaceBoard(state, workspaceId, (board) => ({
            ...board,
            cards: board.cards.map((c) =>
              targets.has(c.id)
                ? { ...c, ...updates, updatedAt: Date.now() }
                : c
            ),
          }))
        );
      },
    }),
    {
      name: "marshell-kanban-v1",
      storage: createJSONStorage(() => safeStorage),
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return;
        }
        const wsId = state.activeWorkspaceId || "default";
        if (!state.boards || Object.keys(state.boards).length === 0) {
          state.boards = {
            [wsId]: {
              cards: state.cards ?? [],
              columns: state.columns?.length ? state.columns : DEFAULT_COLUMNS,
            },
          };
        } else if (state.boards[wsId]) {
          const current = state.boards[wsId];
          if (current) {
            state.cards = current.cards ?? [];
            state.columns = current.columns?.length
              ? current.columns
              : DEFAULT_COLUMNS;
          }
        } else {
          state.boards[wsId] = {
            cards: [],
            columns: DEFAULT_COLUMNS,
          };
          state.cards = [];
          state.columns = DEFAULT_COLUMNS;
        }
      },
    }
  )
);
