"use client";

import {
  EMPTY_FILTERS,
  type KanbanFilters,
} from "@workspace/core/lib/kanban-filter";
import { safeStorage } from "@workspace/core/lib/safe-json";
import { safeUUID } from "@workspace/core/lib/uuid";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface ScratchDraft {
  createdAt: number;
  id: string;
  text: string;
}

interface KanbanUiState {
  addDraft: (text: string) => void;
  clearSelection: () => void;
  collapsedColumnIds: string[];
  compactCards: boolean;
  drafts: ScratchDraft[];
  filters: KanbanFilters;
  hiddenColumnIds: string[];
  removeDraft: (id: string) => void;
  selection: string[];
  setCompactCards: (compact: boolean) => void;
  setFilters: (patch: Partial<KanbanFilters>) => void;
  setViewMode: (mode: "board" | "list") => void;
  toggleCollapseColumn: (columnId: string) => void;
  toggleColumnVisibility: (columnId: string) => void;
  toggleSelected: (id: string) => void;
  viewMode: "board" | "list";
}

export const useKanbanUiStore = create<KanbanUiState>()(
  persist(
    (set) => ({
      addDraft: (text) => {
        if (!text.trim()) {
          return;
        }
        set((s) => ({
          drafts: [
            { createdAt: Date.now(), id: safeUUID(), text },
            ...s.drafts,
          ],
        }));
      },
      clearSelection: () => set({ selection: [] }),
      collapsedColumnIds: [],
      compactCards: false,
      drafts: [],
      filters: EMPTY_FILTERS,
      hiddenColumnIds: [],
      removeDraft: (id) =>
        set((s) => ({ drafts: s.drafts.filter((d) => d.id !== id) })),
      selection: [],
      setCompactCards: (compactCards) => set({ compactCards }),
      setFilters: (patch) =>
        set((s) => ({ filters: { ...s.filters, ...patch } })),
      setViewMode: (viewMode) => set({ viewMode }),
      toggleCollapseColumn: (columnId) =>
        set((s) => ({
          collapsedColumnIds: s.collapsedColumnIds.includes(columnId)
            ? s.collapsedColumnIds.filter((id) => id !== columnId)
            : [...s.collapsedColumnIds, columnId],
        })),
      toggleColumnVisibility: (columnId) =>
        set((s) => ({
          hiddenColumnIds: s.hiddenColumnIds.includes(columnId)
            ? s.hiddenColumnIds.filter((id) => id !== columnId)
            : [...s.hiddenColumnIds, columnId],
        })),
      toggleSelected: (id) =>
        set((s) => ({
          selection: s.selection.includes(id)
            ? s.selection.filter((x) => x !== id)
            : [...s.selection, id],
        })),
      viewMode: "board",
    }),
    {
      name: "marshell-kanban-ui-v1",
      partialize: (s) => ({
        collapsedColumnIds: s.collapsedColumnIds,
        compactCards: s.compactCards,
        drafts: s.drafts,
        hiddenColumnIds: s.hiddenColumnIds,
        viewMode: s.viewMode,
      }),
      storage: createJSONStorage(() => safeStorage),
    }
  )
);
