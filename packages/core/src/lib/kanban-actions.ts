import { useKanbanStore } from "@workspace/core/stores/kanban-store";

/**
 * Deletes the selected Kanban cards.
 */
export async function deleteCardsSafely(ids: string[]): Promise<{
  blocked: Array<{ id: string; reason: string }>;
  deleted: string[];
}> {
  useKanbanStore.getState().deleteCards(ids);
  return { blocked: [], deleted: ids };
}
