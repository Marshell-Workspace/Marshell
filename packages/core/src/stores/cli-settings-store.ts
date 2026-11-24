import {
  type BuiltCliCommand,
  buildCliInvocation,
  type CliUserRuntimeConfig,
  getDefaultCliRuntimeConfig,
} from "@workspace/core/lib/cli-config-catalog";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface CliSettingsState {
  configs: Record<string, CliUserRuntimeConfig>;
  getBuiltCommand: (cliId: string) => BuiltCliCommand;
  getConfig: (cliId: string) => CliUserRuntimeConfig;
  resetConfig: (cliId: string) => void;
  saveConfig: (cliId: string, config: CliUserRuntimeConfig) => void;
  updateConfig: (cliId: string, partial: Partial<CliUserRuntimeConfig>) => void;
}

export const useCliSettingsStore = create<CliSettingsState>()(
  persist(
    (set, get) => ({
      configs: {},

      getConfig: (cliId: string): CliUserRuntimeConfig => {
        const stored =
          get().configs[cliId] || get().configs[cliId.toLowerCase()];
        if (stored) {
          return stored;
        }
        return getDefaultCliRuntimeConfig(cliId);
      },

      saveConfig: (cliId: string, config: CliUserRuntimeConfig) => {
        set((state) => ({
          configs: {
            ...state.configs,
            [cliId]: { ...config },
            ...(cliId === "antigravity" ? { agy: { ...config } } : {}),
            ...(cliId === "agy" ? { antigravity: { ...config } } : {}),
            ...(cliId === "gemini-cli" ? { gemini: { ...config } } : {}),
            ...(cliId === "gemini" ? { "gemini-cli": { ...config } } : {}),
            ...(cliId === "github-copilot" ? { copilot: { ...config } } : {}),
            ...(cliId === "copilot" ? { "github-copilot": { ...config } } : {}),
          },
        }));
      },

      updateConfig: (cliId: string, partial: Partial<CliUserRuntimeConfig>) => {
        const current = get().getConfig(cliId);
        const updated = { ...current, ...partial };
        get().saveConfig(cliId, updated);
      },

      resetConfig: (cliId: string) => {
        const keysToRemove = new Set([
          cliId,
          cliId === "antigravity" ? "agy" : "",
          cliId === "agy" ? "antigravity" : "",
          cliId === "gemini-cli" ? "gemini" : "",
          cliId === "gemini" ? "gemini-cli" : "",
          cliId === "github-copilot" ? "copilot" : "",
          cliId === "copilot" ? "github-copilot" : "",
        ]);

        set((state) => {
          const next: Record<string, CliUserRuntimeConfig> = {};
          for (const [key, value] of Object.entries(state.configs)) {
            if (!keysToRemove.has(key)) {
              next[key] = value;
            }
          }
          return { configs: next };
        });
      },

      getBuiltCommand: (cliId: string): BuiltCliCommand => {
        const config = get().getConfig(cliId);
        return buildCliInvocation(cliId, config);
      },
    }),
    {
      name: "marshell-cli-runtime-settings",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
