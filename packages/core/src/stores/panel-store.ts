import { create } from "zustand";

export type PanelType = "account" | "settings" | null;

export type SettingsTab =
  | "account"
  | "appearance"
  | "workspace"
  | "notifications"
  | "tutorials"
  | "general"
  | "performance"
  | "system";

interface PanelState {
  activePanel: PanelType;
  closePanel: () => void;
  closeSettings: () => void;
  isSettingsOpen: boolean;
  openPanel: (panel: PanelType, tab?: SettingsTab) => void;
  openSettings: (tab?: SettingsTab) => void;
  setSettingsTab: (tab: SettingsTab) => void;
  settingsTab: SettingsTab;
}

export const usePanelStore = create<PanelState>((set) => ({
  activePanel: null,
  settingsTab: "account",
  isSettingsOpen: false,
  openSettings: (tab = "account") =>
    set({
      isSettingsOpen: true,
      settingsTab: tab,
      activePanel: "settings",
    }),
  closeSettings: () =>
    set({
      isSettingsOpen: false,
      activePanel: null,
    }),
  setSettingsTab: (tab) =>
    set({
      settingsTab: tab,
    }),
  openPanel: (panel, tab) => {
    if (panel === "account") {
      set({
        isSettingsOpen: true,
        settingsTab: "account",
        activePanel: "settings",
      });
    } else if (panel === "settings") {
      set({
        isSettingsOpen: true,
        settingsTab: tab || "account",
        activePanel: "settings",
      });
    } else {
      set({ activePanel: panel });
    }
  },
  closePanel: () =>
    set({
      activePanel: null,
      isSettingsOpen: false,
    }),
}));

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).usePanelStore = usePanelStore;
}
