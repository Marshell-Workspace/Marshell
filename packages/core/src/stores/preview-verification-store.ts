import type { PreviewSnapshot } from "@workspace/core/lib/preview-bridge";
import { create } from "zustand";

export interface RuntimeCheckError {
  col?: number;
  fromConsole?: boolean;
  line?: number;
  message: string;
  source?: string;
  stack?: string;
}

export type RuntimeCheckStatus = "pending" | "loaded" | "timeout";

export interface RuntimeCheckState {
  errors: RuntimeCheckError[];
  loadedAt: number | null;
  nonce: string;
  path: string;
  port: number;
  snapshot?: PreviewSnapshot;
  status: RuntimeCheckStatus;
  url: string | null;
}

interface PreviewVerificationState {
  addError: (
    workspaceId: string,
    nonce: string,
    error: RuntimeCheckError
  ) => void;
  checks: Record<string, RuntimeCheckState>;
  clear: (workspaceId: string, nonce: string) => void;
  markLoaded: (workspaceId: string, nonce: string, url: string) => void;
  markTimedOut: (workspaceId: string, nonce: string) => void;
  requestCheck: (
    workspaceId: string,
    nonce: string,
    port: number,
    path: string
  ) => void;
  setSnapshot: (
    workspaceId: string,
    nonce: string,
    snapshot: PreviewSnapshot
  ) => void;
}

export const usePreviewVerificationStore = create<PreviewVerificationState>(
  (set) => ({
    checks: {},

    setSnapshot: (workspaceId, nonce, snapshot) => {
      set((state) => {
        const current = state.checks[workspaceId];
        if (current?.nonce !== nonce) {
          return state;
        }
        return {
          checks: { ...state.checks, [workspaceId]: { ...current, snapshot } },
        };
      });
    },

    requestCheck: (workspaceId, nonce, port, path) => {
      set((s) => ({
        checks: {
          ...s.checks,
          [workspaceId]: {
            errors: [],
            loadedAt: null,
            nonce,
            path,
            port,
            status: "pending",
            url: null,
          },
        },
      }));
    },

    markLoaded: (workspaceId, nonce, url) => {
      set((s) => {
        const current = s.checks[workspaceId];
        if (!current || current.nonce !== nonce) {
          return s;
        }
        return {
          checks: {
            ...s.checks,
            [workspaceId]: {
              ...current,
              loadedAt: Date.now(),
              status: "loaded",
              url,
            },
          },
        };
      });
    },

    addError: (workspaceId, nonce, error) => {
      set((s) => {
        const current = s.checks[workspaceId];
        if (!current || current.nonce !== nonce) {
          return s;
        }
        return {
          checks: {
            ...s.checks,
            [workspaceId]: { ...current, errors: [...current.errors, error] },
          },
        };
      });
    },

    markTimedOut: (workspaceId, nonce) => {
      set((s) => {
        const current = s.checks[workspaceId];
        if (
          !current ||
          current.nonce !== nonce ||
          current.status === "loaded"
        ) {
          return s;
        }
        return {
          checks: {
            ...s.checks,
            [workspaceId]: { ...current, status: "timeout" },
          },
        };
      });
    },

    clear: (workspaceId, nonce) => {
      set((s) => {
        const current = s.checks[workspaceId];
        if (!current || current.nonce !== nonce) {
          return s;
        }
        const next = { ...s.checks };
        delete next[workspaceId];
        return { checks: next };
      });
    },
  })
);
