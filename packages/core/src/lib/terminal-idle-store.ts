import { stripAnsi } from "@workspace/core/lib/strip-ansi";
import {
  type TerminalComposerState,
  terminalComposerState,
  terminalScreenIsWorking,
} from "@workspace/core/lib/terminal-screen";
import {
  appendTerminalStatusText,
  type TerminalStatusText,
  terminalStatusText,
} from "@workspace/core/lib/terminal-status-text";

import { create } from "zustand";

export const QUIET_WINDOW_MS = 2500;
const MAX_BUFFER_TAIL = 4000;
export function hasReadyTerminalPrompt(output: string): boolean {
  return terminalComposerState(output) === "ready";
}

export interface TerminalIdleData {
  bracketedPasteEnabled?: boolean;
  bufferTail: string;
  controlSequenceTail?: string;
  exitCode?: number;
  exitDetail?: string;
  inputStartedAt?: number;
  inputTextBuffer?: TerminalStatusText;
  instanceId?: number;
  isBusy: boolean;
  isIdle: boolean;
  lastOutputAt: number;
  outputSinceInput?: string;
  resumePending?: boolean;
  screenComposer?: TerminalComposerState;
  screenComposerSinceInput?: TerminalComposerState;
  screenSinceInput?: string;
  screenTail?: string;
  screenUpdatedAt?: number;
  sessionStartedAt?: number;
  startupError?: string;
  textBuffer?: TerminalStatusText;
}

/** Input reservation is not evidence that the CLI is executing a task. */
export function terminalActivity(
  data?: TerminalIdleData
): "working" | "ready" | "unsubmitted" | "unconfirmed" | "unobserved" {
  if (
    !data ||
    data.startupError ||
    data.exitCode !== undefined ||
    data.resumePending
  ) {
    return "unobserved";
  }
  const output = data.isBusy
    ? (data.screenSinceInput ?? data.outputSinceInput ?? "")
    : (data.screenTail ?? data.screenSinceInput ?? data.bufferTail);
  if (terminalScreenIsWorking(output)) {
    return "working";
  }
  const composer = terminalComposer(data);
  if (composer === "draft") {
    return "unsubmitted";
  }
  if (composer === "ready" && data.isIdle && !data.isBusy) {
    return "ready";
  }
  return data.isBusy ? "unconfirmed" : "unobserved";
}

export function terminalComposer(
  data: TerminalIdleData
): TerminalComposerState | undefined {
  return data.isBusy
    ? (data.screenComposerSinceInput ??
        terminalComposerState(
          data.screenSinceInput ?? data.outputSinceInput ?? ""
        ))
    : (data.screenComposer ??
        terminalComposerState(data.screenTail ?? data.bufferTail));
}

interface TerminalIdleState {
  /** Starts tracking a terminal that exists but has not printed anything yet, as idle. */
  ensure: (id: string, starting?: boolean) => void;
  ingest: (id: string, rawChunk: string) => void;
  invalidateAfterResume: () => void;
  markBusy: (id: string) => void;
  markExited: (id: string, code: number, detail?: string) => void;
  markIdle: (id: string) => void;
  prune: (id: string) => void;
  refreshIdleStatus: () => void;
  setStartupError: (id: string, error: string | null) => void;
  startSession: (id: string, instanceId: number) => void;
  terminals: Record<string, TerminalIdleData>;
  updateScreen: (
    id: string,
    screen: string,
    instanceId?: number,
    composer?: TerminalComposerState
  ) => void;
}

export const useTerminalIdleStore = create<TerminalIdleState>((set) => ({
  terminals: {},
  updateScreen: (id, screen, instanceId, composer) =>
    set((state) => {
      const data = state.terminals[id];
      // Cursor-only updates cannot make a pre-assignment prompt fresh evidence.
      if (
        !data ||
        data.instanceId !== instanceId ||
        (data.screenTail === screen.slice(-MAX_BUFFER_TAIL) &&
          data.screenComposer === composer &&
          !(
            data.outputSinceInput?.trim() && data.screenSinceInput === undefined
          ))
      ) {
        return state;
      }
      return {
        terminals: {
          ...state.terminals,
          [id]: {
            ...data,
            screenTail: screen.slice(-MAX_BUFFER_TAIL),
            screenComposer: composer,
            screenComposerSinceInput: data.outputSinceInput?.trim()
              ? composer
              : data.screenComposerSinceInput,
            screenSinceInput: data.outputSinceInput?.trim()
              ? screen.slice(-MAX_BUFFER_TAIL)
              : data.screenSinceInput,
            screenUpdatedAt: Date.now(),
          },
        },
      };
    }),
  invalidateAfterResume: () =>
    set((state) => ({
      terminals: Object.fromEntries(
        Object.entries(state.terminals).map(([id, data]) => [
          id,
          data.isBusy && data.exitCode === undefined && !data.startupError
            ? {
                ...data,
                resumePending: true,
                outputSinceInput: "",
                inputTextBuffer: undefined,
                screenSinceInput: undefined,
                screenComposerSinceInput: undefined,
                screenUpdatedAt: undefined,
              }
            : data,
        ])
      ),
    })),
  startSession: (id, instanceId) =>
    set((state) => {
      if (state.terminals[id]?.instanceId === instanceId) {
        return state;
      }
      return {
        terminals: {
          ...state.terminals,
          [id]: {
            instanceId,
            sessionStartedAt: Date.now(),
            isBusy: false,
            isIdle: true,
            lastOutputAt: Date.now(),
            bufferTail: "",
          },
        },
      };
    }),
  markExited: (id, code, detail) =>
    set((state) => ({
      terminals: {
        ...state.terminals,
        [id]: {
          ...(state.terminals[id] ?? {
            bufferTail: "",
            lastOutputAt: Date.now(),
          }),
          isBusy: false,
          isIdle: false,
          exitCode: code,
          exitDetail: detail,
        },
      },
    })),
  setStartupError: (id, error) => {
    set((state) => {
      const existing = state.terminals[id];
      if (!existing) {
        return state;
      }
      return {
        terminals: {
          ...state.terminals,
          [id]: {
            ...existing,
            startupError: error ?? undefined,
            ...(error ? { isBusy: false, isIdle: false } : {}),
          },
        },
      };
    });
  },

  ensure: (id: string, starting = false) => {
    set((state) => {
      if (state.terminals[id]) {
        return state;
      }
      return {
        terminals: {
          ...state.terminals,
          [id]: {
            isIdle: true,
            isBusy: false,
            lastOutputAt: Date.now(),
            bufferTail: "",
            ...(starting ? { sessionStartedAt: Date.now() } : {}),
          },
        },
      };
    });
  },

  markBusy: (id: string) => {
    set((state) => ({
      terminals: {
        ...state.terminals,
        [id]: {
          ...state.terminals[id],
          isIdle: false,
          isBusy: true,
          inputStartedAt: Date.now(),
          lastOutputAt: Date.now(),
          bufferTail: state.terminals[id]?.bufferTail || "",
          outputSinceInput: "",
          screenSinceInput: undefined,
          screenComposerSinceInput: undefined,
          screenUpdatedAt: undefined,
          resumePending: false,
          // Carry a partial escape sequence, but start a fresh text excerpt so
          // neither the old prompt nor its cursor offset can imply readiness.
          inputTextBuffer: state.terminals[id]?.textBuffer
            ? {
                ...state.terminals[id].textBuffer,
                lines: [],
                row: 0,
                column: 0,
                savedCursor: undefined,
              }
            : undefined,
        },
      },
    }));
  },

  markIdle: (id: string) => {
    set((state) => {
      const existing = state.terminals[id];
      if (!existing) {
        return state;
      }
      return {
        terminals: {
          ...state.terminals,
          [id]: {
            ...existing,
            isIdle: true,
            isBusy: false,
          },
        },
      };
    });
  },

  ingest: (id: string, rawChunk: string) => {
    const cleaned = stripAnsi(rawChunk);
    const now = Date.now();

    set((state) => {
      const existing = state.terminals[id] || {
        isIdle: true,
        isBusy: false,
        lastOutputAt: now,
        bufferTail: "",
      };

      const textBuffer = appendTerminalStatusText(
        existing.textBuffer,
        rawChunk
      );
      const inputTextBuffer = existing.isBusy
        ? appendTerminalStatusText(existing.inputTextBuffer, rawChunk)
        : undefined;
      const controls = (existing.controlSequenceTail ?? "") + rawChunk;
      let bracketedPasteEnabled = existing.bracketedPasteEnabled ?? false;
      for (const match of controls.matchAll(/\x1b\[\?2004([hl])/g)) {
        bracketedPasteEnabled = match[1] === "h";
      }

      return {
        terminals: {
          ...state.terminals,
          [id]: {
            ...existing,
            lastOutputAt: now,
            textBuffer,
            inputTextBuffer,
            bufferTail: terminalStatusText(textBuffer).slice(-MAX_BUFFER_TAIL),
            bracketedPasteEnabled,
            resumePending: cleaned.trim() ? false : existing.resumePending,
            controlSequenceTail: controls.slice(-12),
            outputSinceInput: inputTextBuffer
              ? terminalStatusText(inputTextBuffer).slice(-MAX_BUFFER_TAIL)
              : undefined,
            // When new output arrives, if it was busy, it remains busy (not idle yet)
            isIdle: !existing.isBusy,
          },
        },
      };
    });
  },

  prune: (id: string) => {
    set((state) => {
      const next = { ...state.terminals };
      delete next[id];
      return { terminals: next };
    });
  },

  // Interactive readiness requires a visible composer prompt; silence alone is insufficient.
  refreshIdleStatus: () => {
    const now = Date.now();
    set((state) => {
      let changed = false;
      const nextTerminals: Record<string, TerminalIdleData> = {};

      for (const [id, data] of Object.entries(state.terminals)) {
        if (
          data.isBusy &&
          now - (data.screenUpdatedAt ?? data.lastOutputAt) > QUIET_WINDOW_MS &&
          data.exitCode === undefined &&
          !data.startupError &&
          !terminalScreenIsWorking(
            data.screenSinceInput ?? data.outputSinceInput ?? ""
          ) &&
          terminalComposer(data) === "ready"
        ) {
          nextTerminals[id] = {
            ...data,
            isIdle: true,
            isBusy: false,
          };
          changed = true;
        } else {
          nextTerminals[id] = data;
        }
      }

      if (!changed) {
        return state;
      }
      return { terminals: nextTerminals };
    });
  },
}));
