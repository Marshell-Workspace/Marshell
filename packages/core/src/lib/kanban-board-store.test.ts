import {
  type KanbanCard,
  useKanbanStore,
} from "@workspace/core/stores/kanban-store";
import { useKanbanUiStore } from "@workspace/core/stores/kanban-ui-store";
import { beforeEach, describe, expect, it } from "vitest";

describe("Kanban board store and stats", () => {
  beforeEach(() => {
    useKanbanStore.setState({
      activeWorkspaceId: "test-ws",
      boards: {},
      cards: [],
      columns: [
        { id: "backlog", title: "Backlog" },
        { id: "in-progress", title: "In Progress" },
        { id: "review", title: "Review" },
        { id: "done", title: "Done" },
      ],
    });
    useKanbanUiStore.setState({
      collapsedColumnIds: [],
      hiddenColumnIds: [],
      selection: [],
    });
  });

  describe("Card movement and reordering", () => {
    it("moves a card between columns at a specified index", () => {
      const card1 = useKanbanStore
        .getState()
        .addCard("backlog", "Card 1", "Desc 1");
      const card2 = useKanbanStore
        .getState()
        .addCard("in-progress", "Card 2", "Desc 2");

      useKanbanStore.getState().moveCard(card1.id, "in-progress", 0);

      const cards = useKanbanStore.getState().cards;
      const inProgressCards = cards.filter((c) => c.columnId === "in-progress");

      expect(inProgressCards).toHaveLength(2);
      expect(inProgressCards[0]?.id).toBe(card1.id);
      expect(inProgressCards[1]?.id).toBe(card2.id);
    });

    it("reorders cards within the same column", () => {
      const c1 = useKanbanStore.getState().addCard("backlog", "First");
      const c2 = useKanbanStore.getState().addCard("backlog", "Second");
      const c3 = useKanbanStore.getState().addCard("backlog", "Third");

      // Move first card to the end
      useKanbanStore.getState().moveCard(c1.id, "backlog", 2);

      const backlogCards = useKanbanStore
        .getState()
        .cards.filter((c) => c.columnId === "backlog");
      expect(backlogCards.map((c) => c.id)).toEqual([c2.id, c3.id, c1.id]);

      // Move last card to the beginning
      useKanbanStore.getState().moveCard(c1.id, "backlog", 0);
      const reordered = useKanbanStore
        .getState()
        .cards.filter((c) => c.columnId === "backlog");
      expect(reordered.map((c) => c.id)).toEqual([c1.id, c2.id, c3.id]);
    });
  });

  describe("Column lifecycle and empty columns", () => {
    it("handles adding and querying an empty column", () => {
      const newCol = useKanbanStore.getState().addColumn("QA Testing");
      expect(newCol.title).toBe("QA Testing");

      const colCards = useKanbanStore
        .getState()
        .cards.filter((c) => c.columnId === newCol.id);
      expect(colCards).toEqual([]);
    });

    it("deletes a column and removes its cards and relationships", () => {
      const c1 = useKanbanStore.getState().addCard("backlog", "Task 1");
      const c2 = useKanbanStore.getState().addCard("review", "Task 2");
      useKanbanStore.getState().addRelation(c2.id, "blocks", c1.id);

      useKanbanStore.getState().deleteColumn("review");

      const store = useKanbanStore.getState();
      expect(store.columns.some((col) => col.id === "review")).toBe(false);
      expect(store.cards.some((c) => c.id === c2.id)).toBe(false);

      // Remaining card in backlog has its relations stripped
      const remainingCard = store.cards.find((c) => c.id === c1.id);
      expect(remainingCard).toBeDefined();
      expect(remainingCard?.relations ?? []).toEqual([]);
    });

    it("renames an existing column", () => {
      useKanbanStore.getState().renameColumn("backlog", "Ready for Dev");
      const renamed = useKanbanStore
        .getState()
        .columns.find((c) => c.id === "backlog");
      expect(renamed?.title).toBe("Ready for Dev");
    });
  });

  describe("Board statistics (counts, completed and percentage)", () => {
    function computeStats(cards: KanbanCard[], doneColId = "done") {
      const total = cards.length;
      const completed = cards.filter((c) => c.columnId === doneColId).length;
      const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
      return { completed, percent, total };
    }

    it("handles 0 tasks without divide-by-zero or NaN", () => {
      const stats = computeStats([]);
      expect(stats.total).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.percent).toBe(0);
      expect(Number.isNaN(stats.percent)).toBe(false);
    });

    it("computes partial completion accurately", () => {
      useKanbanStore.getState().addCard("backlog", "Task 1");
      useKanbanStore.getState().addCard("in-progress", "Task 2");
      useKanbanStore.getState().addCard("done", "Task 3");
      useKanbanStore.getState().addCard("backlog", "Task 4");

      const stats = computeStats(useKanbanStore.getState().cards);
      expect(stats.total).toBe(4);
      expect(stats.completed).toBe(1);
      expect(stats.percent).toBe(25);
    });

    it("computes 100% completion when all tasks are in done column", () => {
      useKanbanStore.getState().addCard("done", "Task 1");
      useKanbanStore.getState().addCard("done", "Task 2");

      const stats = computeStats(useKanbanStore.getState().cards);
      expect(stats.total).toBe(2);
      expect(stats.completed).toBe(2);
      expect(stats.percent).toBe(100);
    });
  });

  describe("UI state (column collapsing and card selection)", () => {
    it("toggles column collapsing", () => {
      useKanbanUiStore.getState().toggleCollapseColumn("backlog");
      expect(useKanbanUiStore.getState().collapsedColumnIds).toContain(
        "backlog"
      );

      useKanbanUiStore.getState().toggleCollapseColumn("backlog");
      expect(useKanbanUiStore.getState().collapsedColumnIds).not.toContain(
        "backlog"
      );
    });

    it("toggles card selection and clears selection", () => {
      useKanbanUiStore.getState().toggleSelected("card-1");
      useKanbanUiStore.getState().toggleSelected("card-2");
      expect(useKanbanUiStore.getState().selection).toEqual([
        "card-1",
        "card-2",
      ]);

      useKanbanUiStore.getState().clearSelection();
      expect(useKanbanUiStore.getState().selection).toEqual([]);
    });
  });
});
