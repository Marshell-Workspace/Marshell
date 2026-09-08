export interface HotkeyDefinition {
  category: "navigation" | "general";
  id: string;
  keys: string;
  translationKey: string;
}

export const hotkeys: HotkeyDefinition[] = [
  {
    id: "command-palette",
    keys: "mod+k",
    translationKey: "commandPalette",
    category: "general",
  },
  {
    id: "toggle-sidebar",
    keys: "mod+b",
    translationKey: "toggleSidebar",
    category: "general",
  },
  {
    id: "new-workspace",
    keys: "mod+n",
    translationKey: "newWorkspace",
    category: "general",
  },
  {
    id: "go-settings",
    keys: "g>s",
    translationKey: "goSettings",
    category: "navigation",
  },
  {
    id: "show-hotkeys",
    keys: "?",
    translationKey: "showHotkeys",
    category: "general",
  },
  {
    id: "terminal-1",
    keys: "mod+1",
    translationKey: "terminal1",
    category: "navigation",
  },
  {
    id: "terminal-2",
    keys: "mod+2",
    translationKey: "terminal2",
    category: "navigation",
  },
  {
    id: "terminal-3",
    keys: "mod+3",
    translationKey: "terminal3",
    category: "navigation",
  },
  {
    id: "terminal-4",
    keys: "mod+4",
    translationKey: "terminal4",
    category: "navigation",
  },
  {
    id: "terminal-5",
    keys: "mod+5",
    translationKey: "terminal5",
    category: "navigation",
  },
  {
    id: "terminal-6",
    keys: "mod+6",
    translationKey: "terminal6",
    category: "navigation",
  },
  {
    id: "terminal-7",
    keys: "mod+7",
    translationKey: "terminal7",
    category: "navigation",
  },
  {
    id: "terminal-8",
    keys: "mod+8",
    translationKey: "terminal8",
    category: "navigation",
  },
];
