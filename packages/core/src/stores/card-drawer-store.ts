import { create } from "zustand";

export type CardDrawerTab = "details";

interface CardDrawerState {
  cardId: string | null;
  close: () => void;
  open: (cardId: string, tab?: CardDrawerTab) => void;
  setTab: (tab: CardDrawerTab) => void;
  tab: CardDrawerTab;
}

/** Which card's detail drawer is open, and on which tab. */
export const useCardDrawerStore = create<CardDrawerState>((set) => ({
  cardId: null,
  close: () => set({ cardId: null }),
  open: (cardId, tab = "details") => set({ cardId, tab }),
  setTab: (tab) => set({ tab }),
  tab: "details",
}));
