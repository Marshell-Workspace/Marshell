"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface AIProviderState {
  apiKey: string;
  availableModels: string[];
  baseUrl: string;
  clearProviderConfig: () => void;
  health: {
    backend: boolean;
    provider: boolean;
    planner: boolean;
  };
  provider: string;
  selectedModel: string;
  setApiKey: (key: string) => void;
  setAvailableModels: (models: string[]) => void;
  setBaseUrl: (url: string) => void;
  setHealth: (key: keyof AIProviderState["health"], status: boolean) => void;
  setProvider: (provider: string) => void;
  setSelectedModel: (model: string) => void;
}

export const useAgentStore = create<AIProviderState>()(
  persist(
    (set) => ({
      apiKey: "",
      availableModels: [],
      baseUrl: "https://opencode.ai/zen/v1",
      provider: "opencode",
      selectedModel: "",
      setApiKey: (key) => set({ apiKey: key }),
      setAvailableModels: (models) => set({ availableModels: models }),
      setBaseUrl: (url) => set({ baseUrl: url }),
      setProvider: (provider) => set({ provider }),
      setSelectedModel: (model) => set({ selectedModel: model }),
      clearProviderConfig: () =>
        set(() => ({
          apiKey: "",
          baseUrl: "https://opencode.ai/zen/v1",
          provider: "opencode",
          selectedModel: "",
          availableModels: [],
        })),
      health: {
        backend: true,
        provider: true,
        planner: true,
      },
      setHealth: (key, status) =>
        set((prev) => ({
          health: {
            ...prev.health,
            [key]: status,
          },
        })),
    }),
    {
      name: "hyperion-ai-provider-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        apiKey: state.apiKey,
        baseUrl: state.baseUrl,
        provider: state.provider,
        selectedModel: state.selectedModel,
        availableModels: state.availableModels,
      }),
    }
  )
);
