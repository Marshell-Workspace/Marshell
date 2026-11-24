"use client";

import { safeStorage } from "@workspace/core/lib/safe-json";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Scripts and files that prepare (and tidy up) each task's worktree in one repository. */
export interface RepoSettings {
  /** Run after a worktree is deleted or merged. */
  cleanupScript: string;
  /** One path or glob per line, copied from the main checkout (e.g. `.env*`). */
  copyFiles: string;
  /** Started from a card to serve the task's app (picked up by the preview). */
  devServerScript: string;
  /** Run in the background while the agent starts, instead of before it. */
  parallelSetup: boolean;
  /** Run once in each new worktree, e.g. `pnpm install`. */
  setupScript: string;
}

export const DEFAULT_REPO_SETTINGS: RepoSettings = {
  cleanupScript: "",
  copyFiles: "",
  devServerScript: "",
  parallelSetup: false,
  setupScript: "",
};

/** Lines of the copy list, without blanks and `#` comments. */
export function parseCopyList(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

interface RepoSettingsState {
  byRepo: Record<string, RepoSettings>;
  set: (repoPath: string, patch: Partial<RepoSettings>) => void;
}

export const useRepoSettingsStore = create<RepoSettingsState>()(
  persist(
    (set) => ({
      byRepo: {},
      set: (repoPath, patch) =>
        set((s) => ({
          byRepo: {
            ...s.byRepo,
            [repoPath]: {
              ...DEFAULT_REPO_SETTINGS,
              ...s.byRepo[repoPath],
              ...patch,
            },
          },
        })),
    }),
    {
      name: "marshell-repo-settings-v1",
      storage: createJSONStorage(() => safeStorage),
    }
  )
);

export function getRepoSettings(repoPath: string): RepoSettings {
  return {
    ...DEFAULT_REPO_SETTINGS,
    ...useRepoSettingsStore.getState().byRepo[repoPath],
  };
}
