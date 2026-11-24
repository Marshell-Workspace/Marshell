// @vitest-environment jsdom
import { KanbanListView } from "@workspace/core/components/kanban/kanban-list-view";
import type { KanbanCard as KanbanCardType } from "@workspace/core/stores/kanban-store";
import { useKanbanStore } from "@workspace/core/stores/kanban-store";
import { useKanbanUiStore } from "@workspace/core/stores/kanban-ui-store";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Configure React act environment
// @ts-expect-error global act flag for testing
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Mock translations and navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@workspace/i18n/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@workspace/i18n", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("KanbanListView Component", () => {
  let node: HTMLDivElement;
  let root: Root;

  const card1: KanbanCardType = {
    columnId: "in-progress",
    createdAt: Date.now() - 3_600_000,
    description: "Task 1 description",
    id: "card-1",
    priority: "high",
    title: "Task One",
  };

  const cardDone: KanbanCardType = {
    columnId: "done",
    createdAt: Date.now() - 1_800_000,
    description: "Done task description",
    id: "card-done",
    priority: "low",
    title: "Completed Task",
  };

  beforeEach(() => {
    useKanbanStore.setState({
      activeWorkspaceId: "default",
      boards: {},
      cards: [card1, cardDone],
      columns: [
        { id: "backlog", title: "Backlog" },
        { id: "in-progress", title: "In Progress" },
        { id: "done", title: "Done" },
      ],
    });
    useKanbanUiStore.setState({
      filters: {
        priorities: [],
        query: "",
        tags: [],
        worktree: "all",
      },
      selection: [],
    });
    node = document.createElement("div");
    document.body.append(node);
    root = createRoot(node);
  });

  afterEach(() => {
    act(() => root.unmount());
    node.remove();
  });

  it("renders table with all columns and task rows", () => {
    act(() => {
      root.render(<KanbanListView />);
    });

    expect(node.textContent).toContain("Task One");
    expect(node.textContent).toContain("Completed Task");
    expect(node.textContent).toContain("Task");
    expect(node.textContent).toContain("Priority");
    expect(node.textContent).toContain("Status");
    expect(node.textContent).toContain("Actions");
  });

  it("disables checkbox for completed tasks in done column", () => {
    act(() => {
      root.render(<KanbanListView />);
    });

    const doneCheckbox = node.querySelector(
      'button[aria-label="Select Completed Task"]'
    ) as HTMLButtonElement | null;
    expect(doneCheckbox).not.toBeNull();
    expect(doneCheckbox?.disabled).toBe(true);
    expect(doneCheckbox?.getAttribute("aria-disabled")).toBe("true");

    const activeCheckbox = node.querySelector(
      'button[aria-label="Select Task One"]'
    ) as HTMLButtonElement | null;
    expect(activeCheckbox).not.toBeNull();
    expect(activeCheckbox?.disabled).toBe(false);
  });

  it("renders priority select with readable labels", () => {
    act(() => {
      root.render(<KanbanListView />);
    });

    const highPriorityBtn = node.querySelector(
      'button[aria-label="Priority: high"]'
    );
    expect(highPriorityBtn).not.toBeNull();
    expect(highPriorityBtn?.textContent).toContain("high");

    const lowPriorityBtn = node.querySelector(
      'button[aria-label="Priority: low"]'
    );
    expect(lowPriorityBtn).not.toBeNull();
    expect(lowPriorityBtn?.textContent).toContain("low");
  });

  it("renders delete button in Actions column", () => {
    act(() => {
      root.render(<KanbanListView />);
    });

    const deleteBtn = node.querySelector(
      'button[aria-label="Delete Task One"]'
    );
    expect(deleteBtn).not.toBeNull();
  });
});
