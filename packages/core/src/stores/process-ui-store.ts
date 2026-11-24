import { create } from "zustand";

interface ProcessUiState {
  open: boolean;
  select: (processId: string | null) => void;
  selected: string | null;
  setOpen: (open: boolean) => void;
  /** Opens the processes drawer on a given process (e.g. a task's agent run). */
  show: (processId: string) => void;
}

export const useProcessUiStore = create<ProcessUiState>((set) => ({
  open: false,
  select: (selected) => set({ selected }),
  selected: null,
  setOpen: (open) => set({ open }),
  show: (processId) => set({ open: true, selected: processId }),
}));
