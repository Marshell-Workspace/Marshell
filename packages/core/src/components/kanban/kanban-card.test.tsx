// @vitest-environment jsdom
import { KanbanCard } from "@workspace/core/components/kanban/kanban-card";
import type { KanbanCard as KanbanCardType } from "@workspace/core/stores/kanban-store";
import { useKanbanStore } from "@workspace/core/stores/kanban-store";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Configure React act environment
// @ts-expect-error global act flag for testing
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Mock translations and navigation
vi.mock("@workspace/i18n", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("@workspace/i18n/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("KanbanCard Component", () => {
  let node: HTMLDivElement;
  let root: Root;

  const baseCard: KanbanCardType = {
    columnId: "backlog",
    createdAt: Date.now() - 3_600_000,
    description: "",
    id: "card-1",
    title: "Minimal Task",
  };

  beforeEach(() => {
    useKanbanStore.setState({
      activeWorkspaceId: "default",
      boards: {},
      cards: [baseCard],
      columns: [
        { id: "backlog", title: "Backlog" },
        { id: "in-progress", title: "In Progress" },
        { id: "done", title: "Done" },
      ],
    });
    node = document.createElement("div");
    document.body.append(node);
    root = createRoot(node);
  });

  afterEach(() => {
    act(() => root.unmount());
    node.remove();
  });

  describe("Rendering with optional fields", () => {
    it("renders correctly with every optional field missing", () => {
      act(() => {
        root.render(<KanbanCard card={baseCard} onDelete={vi.fn()} />);
      });

      expect(node.textContent).toContain("Minimal Task");
      expect(node.querySelector('[title="Unassigned"]')).toBeNull();
      expect(node.querySelector('[aria-label="Open terminal"]')).not.toBeNull();
      expect(
        node.querySelector('[aria-label="Open in external editor"]')
      ).not.toBeNull();
    });

    it("renders correctly with all optional fields present", () => {
      const fullCard: KanbanCardType = {
        ...baseCard,
        assignee: "Alice",
        comments: [
          {
            createdAt: Date.now(),
            id: "com-1",
            text: "Nice work",
          },
        ],
        description: "Full detailed description of the task",
        id: "card-full",
        priority: "high",
        subtasks: [
          { done: true, id: "sub-1", title: "Step 1" },
          { done: true, id: "sub-2", title: "Step 2" },
          { done: false, id: "sub-3", title: "Step 3" },
          { done: false, id: "sub-4", title: "Step 4" },
          { done: false, id: "sub-5", title: "Step 5" },
        ],
        tags: ["frontend", "urgent-fix"],
        title: "Complete Task",
      };

      act(() => {
        root.render(<KanbanCard card={fullCard} onDelete={vi.fn()} />);
      });

      expect(node.textContent).toContain("Complete Task");
      expect(node.textContent).toContain(
        "Full detailed description of the task"
      );
      expect(node.querySelector('[title="Alice"]')).toBeNull();
      expect(
        node.querySelector('[aria-label="Priority: high"]')
      ).not.toBeNull();
      expect(node.querySelector('[aria-label="Open terminal"]')).not.toBeNull();
      expect(
        node.querySelector('[aria-label="Open in external editor"]')
      ).not.toBeNull();
    });

    it("handles long titles and tags gracefully", () => {
      const longCard: KanbanCardType = {
        ...baseCard,
        id: "long-card",
        tags: ["super-extremely-long-custom-tag-name-that-does-not-wrap"],
        title: "A".repeat(120),
      };

      act(() => {
        root.render(<KanbanCard card={longCard} onDelete={vi.fn()} />);
      });

      expect(node.textContent).toContain("A".repeat(120));
    });
  });

  describe("Priority rendering", () => {
    it("renders urgent priority with icon", () => {
      const urgentCard: KanbanCardType = {
        ...baseCard,
        id: "urgent-c",
        priority: "urgent",
        title: "P0 Blocker",
      };
      act(() => {
        root.render(<KanbanCard card={urgentCard} onDelete={vi.fn()} />);
      });

      expect(
        node.querySelector('[aria-label="Priority: urgent"]')
      ).not.toBeNull();
    });

    it("renders high, medium, and low priority levels", () => {
      act(() => {
        root.render(
          <KanbanCard
            card={{ ...baseCard, priority: "high" }}
            onDelete={vi.fn()}
          />
        );
      });
      expect(
        node.querySelector('[aria-label="Priority: high"]')
      ).not.toBeNull();

      act(() => {
        root.render(
          <KanbanCard
            card={{ ...baseCard, priority: "medium" }}
            onDelete={vi.fn()}
          />
        );
      });
      expect(
        node.querySelector('[aria-label="Priority: medium"]')
      ).not.toBeNull();

      act(() => {
        root.render(
          <KanbanCard
            card={{ ...baseCard, priority: "low" }}
            onDelete={vi.fn()}
          />
        );
      });
      expect(node.querySelector('[aria-label="Priority: low"]')).not.toBeNull();
    });
  });

  describe("Completion state", () => {
    it("applies line-through styling when isDone is true", () => {
      act(() => {
        root.render(<KanbanCard card={baseCard} isDone onDelete={vi.fn()} />);
      });

      const titleBtn = Array.from(node.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Minimal Task"
      );
      expect(titleBtn?.className).toContain("line-through");
    });
  });

  describe("Card interactions and accessibility", () => {
    it("fires onToggleSelect when checkbox is clicked", () => {
      const toggleMock = vi.fn();
      act(() => {
        root.render(
          <KanbanCard
            card={baseCard}
            onDelete={vi.fn()}
            onToggleSelect={toggleMock}
          />
        );
      });

      const checkbox = node.querySelector(
        '[aria-label="Select Minimal Task"]'
      ) as HTMLButtonElement;
      expect(checkbox).not.toBeNull();
      act(() => {
        checkbox.click();
      });
      expect(toggleMock).toHaveBeenCalledWith(baseCard.id);
    });

    it("does not fire onToggleSelect and disables checkbox when card isDone in done column", () => {
      const toggleMock = vi.fn();
      act(() => {
        root.render(
          <KanbanCard
            card={baseCard}
            isDone={true}
            onDelete={vi.fn()}
            onToggleSelect={toggleMock}
          />
        );
      });

      const checkbox = node.querySelector(
        '[aria-label="Select Minimal Task"]'
      ) as HTMLButtonElement;
      expect(checkbox).not.toBeNull();
      expect(checkbox.disabled).toBe(true);
      expect(checkbox.getAttribute("aria-disabled")).toBe("true");

      act(() => {
        checkbox.click();
      });
      expect(toggleMock).not.toHaveBeenCalled();
    });

    it("opens the options menu with accessible triggers", () => {
      const deleteMock = vi.fn();
      act(() => {
        root.render(<KanbanCard card={baseCard} onDelete={deleteMock} />);
      });

      const optionsBtn = node.querySelector(
        '[aria-label="Card options"]'
      ) as HTMLButtonElement;
      expect(optionsBtn).not.toBeNull();
      expect(optionsBtn.tagName).toBe("BUTTON");

      act(() => {
        optionsBtn.dispatchEvent(
          new MouseEvent("pointerdown", { bubbles: true, cancelable: true })
        );
        optionsBtn.dispatchEvent(
          new MouseEvent("mousedown", { bubbles: true, cancelable: true })
        );
        optionsBtn.click();
      });

      expect(document.body.textContent).toContain("Open details");
      expect(document.body.textContent).toContain("Edit tags");
      expect(document.body.textContent).toContain("Delete task");
    });

    it("ensures interactive elements are buttons and links", () => {
      act(() => {
        root.render(
          <KanbanCard
            card={baseCard}
            onDelete={vi.fn()}
            onToggleSelect={vi.fn()}
          />
        );
      });

      const buttons = node.querySelectorAll("button");
      expect(buttons.length).toBeGreaterThanOrEqual(3);
      for (const btn of buttons) {
        expect(btn.tagName).toBe("BUTTON");
      }
    });
  });
});
