"use client";

import { DeleteTerminalDialog } from "@workspace/core/components/terminal/delete-terminal-dialog";
import { ResetTerminalDialog } from "@workspace/core/components/terminal/reset-terminal-dialog";
import { TerminalCliIcon } from "@workspace/core/components/terminal/terminal-cli-icon";
import { TerminalSessionActions } from "@workspace/core/components/terminal/terminal-session-actions";
import { useMounted } from "@workspace/core/hooks/use-mounted";
import { shouldTerminalHandleKeyboardEvent } from "@workspace/core/lib/app-shortcuts";
import {
  getSubmittedTerminalCliCommand,
  getTerminalCliLogoFromHistory,
  getTerminalCliLogoId,
  type TerminalCliLogoId,
} from "@workspace/core/lib/terminal-cli-logo";
import { useTerminalIdleStore } from "@workspace/core/lib/terminal-idle-store";
import { sendTerminalInput } from "@workspace/core/lib/terminal-input";
import {
  type TerminalResizeHandler,
  terminalLayoutManager,
} from "@workspace/core/lib/terminal-layout-manager";
import {
  isMacPlatform,
  macTerminalKeySequence,
} from "@workspace/core/lib/terminal-mac-keys";
import {
  createTerminalOutputBuffer,
  type TerminalOutputBuffer,
} from "@workspace/core/lib/terminal-output-buffer";
import {
  terminalScreenComposer,
  terminalScreenTail,
} from "@workspace/core/lib/terminal-screen";
import {
  clearScreenInput,
  getTerminalShellKind,
  parseTerminalShellKind,
  setTerminalShellKind,
  terminalShellLabel,
} from "@workspace/core/lib/terminal-shell";
import {
  takeTerminalBytes,
  terminalPayloadBytes,
} from "@workspace/core/lib/terminal-stream";
import { useGeneralSettingsStore } from "@workspace/core/stores/general-settings-store";
import { usePerformanceStore } from "@workspace/core/stores/performance-store";
import { useTerminalFocusStore } from "@workspace/core/stores/terminal-focus-store";
import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import { useTranslations } from "@workspace/i18n";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@workspace/ui/components/context-menu";
import { cn } from "@workspace/ui/lib/utils";
import "@xterm/xterm/css/xterm.css";
import {
  CheckSquare,
  ClipboardPaste,
  Copy,
  Maximize2,
  Minimize2,
  RotateCcw,
  SquareTerminal,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

const SUBMIT_REGEX = /[\r\n]/;

function safeUnlisten(fn?: () => void | Promise<void>) {
  if (!fn) {
    return;
  }
  try {
    const res = fn();
    if (res && typeof (res as Promise<void>).catch === "function") {
      (res as Promise<void>).catch(() => {});
    }
  } catch {}
}

interface TerminalPaneProps {
  autoCommand?: string;
  color?: string;
  cwd?: string;
  directory?: string;
  id: string;
  index?: number;
  isActiveWorkspace?: boolean;
  name?: string;
  title: string;
  workspaceId?: string;
}

interface TerminalEventPayload {
  bytes?: number[] | Uint8Array | string;
  data?: string;
  instance_id?: number;
  offset: number;
  onParsed?: () => void;
}

interface TerminalHistoryInfo {
  bytes?: number[] | string;
  history: string;
  instance_id?: number;
  startup_pending: boolean;
  total_read: number;
}

interface TerminalCreateResult {
  fell_back?: boolean;
  instance_id: number;
  is_new: boolean;
  shell?: string;
}

type TerminalInstance = any;
type FitAddonInstance = any;

// Module-level cache for xterm dynamic imports to optimize workspace switching
let xtermPromise: Promise<{
  Terminal: any;
  FitAddon: any;
  WebLinksAddon: any;
  Unicode11Addon: any;
}> | null = null;

function loadXterm() {
  if (!xtermPromise) {
    xtermPromise = Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
      import("@xterm/addon-web-links"),
      import("@xterm/addon-unicode11"),
    ]).then(([xterm, fit, webLinks, unicode11]) => ({
      Terminal: xterm.Terminal,
      FitAddon: fit.FitAddon,
      WebLinksAddon: webLinks.WebLinksAddon,
      Unicode11Addon: unicode11.Unicode11Addon,
    }));
  }
  return xtermPromise;
}

interface DisposableAddon {
  dispose: () => void;
}

/**
 * GPU renderer: xterm 6 only ships the DOM renderer otherwise, which drops
 * frames on fast output and cannot draw box characters seamlessly. Any failure
 * (no WebGL, lost context) silently leaves the DOM renderer in place.
 */
async function attachWebglRenderer(
  term: TerminalInstance,
  addonRef: React.MutableRefObject<DisposableAddon | null>,
  isCurrent: () => boolean
) {
  if (addonRef.current || typeof WebGLRenderingContext === "undefined") {
    return;
  }
  try {
    // Loaded on demand: the module probes WebGL as soon as it is evaluated.
    const { WebglAddon } = await import("@xterm/addon-webgl");
    if (addonRef.current || !isCurrent() || !term.element) {
      return;
    }
    const addon: DisposableAddon & {
      onContextLoss: (listener: () => void) => void;
    } = new WebglAddon(true);
    addon.onContextLoss(() => {
      try {
        addon.dispose();
      } catch {}
      if (addonRef.current === addon) {
        addonRef.current = null;
      }
      // Instantly fallback-refresh so DOM renderer immediately paints all visible rows
      try {
        term.refresh(0, Math.max(0, term.rows - 1));
      } catch {}
      scheduleWebglReattach(term, addonRef, isCurrent);
    });
    term.loadAddon(addon);
    addonRef.current = addon;
    // Ensure initial WebGL pass renders active buffer cells immediately
    try {
      term.refresh(0, Math.max(0, term.rows - 1));
    } catch {}
  } catch {
    addonRef.current = null;
    try {
      term.refresh(0, Math.max(0, term.rows - 1));
    } catch {}
  }
}

/** How long a hidden workspace keeps its GPU renderer before releasing it. */
const WEBGL_RELEASE_DELAY_MS = 8000;
const WEBGL_REATTACH_LIMIT = 4;
const WEBGL_REATTACH_WINDOW_MS = 120_000;
const webglReattachState = new WeakMap<
  object,
  { attempts: number; since: number }
>();

/**
 * After a long idle (sleep, screen lock, GPU driver reset) the webview drops
 * the GPU surface. Falling back to the DOM renderer once is not enough: bring
 * the GPU renderer back, bounded so a broken driver cannot cause a loop.
 */
function scheduleWebglReattach(
  term: TerminalInstance,
  addonRef: React.MutableRefObject<DisposableAddon | null>,
  isCurrent: () => boolean
) {
  const now = Date.now();
  const state = webglReattachState.get(term);
  const fresh =
    state && now - state.since < WEBGL_REATTACH_WINDOW_MS
      ? state
      : { attempts: 0, since: now };
  if (fresh.attempts >= WEBGL_REATTACH_LIMIT) {
    return;
  }
  fresh.attempts += 1;
  webglReattachState.set(term, fresh);
  setTimeout(() => {
    if (isCurrent() && !addonRef.current) {
      attachWebglRenderer(term, addonRef, isCurrent);
    }
  }, 400 * fresh.attempts);
}

/**
 * True when the GPU canvas exists but its context is gone. Chromium does not
 * always fire `webglcontextlost` for this (it does not when the GPU process
 * is recycled while the window is suspended), which leaves a blank terminal.
 */
function isWebglContextLost(term: TerminalInstance): boolean {
  const canvases = term.element?.querySelectorAll("canvas");
  if (!canvases) {
    return false;
  }
  for (const canvas of Array.from(canvases) as HTMLCanvasElement[]) {
    // Returns null for 2D canvases, so only the WebGL surface is inspected.
    const gl =
      canvas.getContext("webgl2") ??
      (canvas.getContext("webgl") as WebGLRenderingContext | null);
    if (gl?.isContextLost()) {
      return true;
    }
  }
  return false;
}

/** Heal a blank terminal: rebuild a lost GPU renderer and repaint everything. */
function recoverTerminalRenderer(
  term: TerminalInstance,
  addonRef: React.MutableRefObject<DisposableAddon | null>,
  isCurrent: () => boolean
) {
  if (!isCurrent()) {
    return;
  }
  if (isWebglContextLost(term)) {
    detachWebglRenderer(addonRef);
    webglReattachState.delete(term);
    attachWebglRenderer(term, addonRef, isCurrent);
  }
  try {
    // The glyph atlas can be wiped with the GPU surface; rebuild it.
    term.clearTextureAtlas?.();
  } catch {}
  try {
    term.refresh(0, Math.max(0, term.rows - 1));
  } catch {}
}

function detachWebglRenderer(
  addonRef: React.MutableRefObject<DisposableAddon | null>
) {
  const addon = addonRef.current;
  addonRef.current = null;
  try {
    addon?.dispose();
  } catch {}
}

/**
 * ConPTY needs xterm's Windows workarounds (line-wrap heuristics, and no reflow
 * before build 21376). Only meaningful on Windows hosts.
 */
async function readWindowsPtyOptions(): Promise<
  { backend: "conpty"; buildNumber: number } | undefined
> {
  if (
    typeof navigator === "undefined" ||
    !navigator.userAgent.includes("Windows")
  ) {
    return;
  }
  try {
    const { isTauri, invoke } = await import("@tauri-apps/api/core");
    if (!isTauri()) {
      return;
    }
    const buildNumber = await invoke<number | null>("get_windows_build_number");
    return buildNumber ? { backend: "conpty", buildNumber } : undefined;
  } catch {
    return;
  }
}

function getAccentFill(): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "#3ddc97";
  }
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--accent-fill")
      .trim() || "#3ddc97"
  );
}

function isLightDocument(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  const root = document.documentElement;
  return (
    root.getAttribute("data-theme") === "light" ||
    !(root.classList.contains("dark") || root.getAttribute("data-theme"))
  );
}

const DARK_ANSI = {
  yellow: "#f59e0b",
  blue: "#38bdf8",
  magenta: "#a855f7",
  cyan: "#38bdf8",
  white: "#f4f4f5",
  brightWhite: "#ffffff",
  brightBlue: "#38bdf8",
  brightCyan: "#38bdf8",
  selection: "rgba(56, 189, 248, 0.25)",
} as const;

// Dark ink on the light terminal surface: the dark palette's white/yellow
// would be unreadable on a paper-toned background.
const LIGHT_ANSI = {
  yellow: "#8a5a00",
  blue: "#2b5fb4",
  magenta: "#8b3fa8",
  cyan: "#0e7490",
  white: "#4a4740",
  brightWhite: "#25231f",
  brightBlue: "#1d4ed8",
  brightCyan: "#0b6a85",
  selection: "rgba(43, 95, 180, 0.2)",
} as const;

function buildTerminalTheme(comp: CSSStyleDeclaration) {
  const read = (name: string, fallback: string) =>
    comp.getPropertyValue(name).trim() || fallback;
  const ansi = isLightDocument() ? LIGHT_ANSI : DARK_ANSI;
  const bg = read("--terminal-bg", "#0a0a0a");
  const success = read("--terminal-success", "#4ADE80");
  const comment = read("--terminal-comment", "#64748B");
  return {
    background: bg,
    cursor: read("--terminal-cursor", getAccentFill()),
    cursorAccent: bg,
    foreground: read("--terminal-fg", "#d4d4d8"),
    selectionBackground: ansi.selection,
    scrollbarSliderBackground: "rgba(100, 116, 139, 0.3)",
    scrollbarSliderHoverBackground: "rgba(100, 116, 139, 0.5)",
    scrollbarSliderActiveBackground: "rgba(100, 116, 139, 0.75)",
    black: bg,
    red: read("--terminal-error", "#f43f5e"),
    green: success,
    yellow: ansi.yellow,
    blue: ansi.blue,
    magenta: ansi.magenta,
    cyan: ansi.cyan,
    white: ansi.white,
    brightBlack: comment,
    brightGreen: success,
    brightBlue: ansi.brightBlue,
    brightCyan: ansi.brightCyan,
    brightWhite: ansi.brightWhite,
  };
}

// Helper to process a single stdout event with deduplication and frame-coalescing logic
function handleSingleEvent(
  term: TerminalInstance,
  payload: TerminalEventPayload,
  currentOffsetRef: React.MutableRefObject<number>,
  writeQueueRef?: React.MutableRefObject<TerminalOutputBuffer | null>,
  batchMs = 8
) {
  const chunk = takeTerminalBytes(payload, currentOffsetRef.current);
  currentOffsetRef.current = chunk.nextOffset;
  if (chunk.data.length === 0) {
    return;
  }
  // Output is written verbatim: the shell's own prompt colours are untouched.
  const chunkToWrite = chunk.data;

  if (!writeQueueRef) {
    term.write(chunkToWrite, payload.onParsed);
    return;
  }
  writeQueueRef.current ??= createTerminalOutputBuffer((data, parsed) =>
    term.write(data, parsed)
  );
  writeQueueRef.current.push(chunkToWrite, batchMs, payload.onParsed);
}

// Helper to process and deduplicate a sequence of buffered events
function processPendingEvents(
  term: TerminalInstance,
  events: TerminalEventPayload[],
  currentOffsetRef: React.MutableRefObject<number>,
  writeQueueRef?: React.MutableRefObject<TerminalOutputBuffer | null>,
  batchMs = 8
) {
  const sortedEvents = [...events].sort((a, b) => a.offset - b.offset);
  for (const payload of sortedEvents) {
    handleSingleEvent(term, payload, currentOffsetRef, writeQueueRef, batchMs);
  }
}

// Helper to execute startup autoCommand on Mock environment
function executeMockAutoCommand(
  term: TerminalInstance,
  autoCommand: string | undefined,
  directory: string | undefined,
  handleMockCommand: (cmd: string, term: TerminalInstance) => void
) {
  if (autoCommand) {
    if (directory) {
      term.write(`cd "${directory}"\r\n`);
    }
    term.write(`${autoCommand}\r\n`);
    handleMockCommand(autoCommand, term);
    term.write("\x1b[1;32mmarshell-demo@web:~$\x1b[0m ");
  }
}

function TerminalPlaceholder({
  shellType,
  isMinimal = false,
}: {
  shellType: string;
  isMinimal?: boolean;
}) {
  const isWin =
    shellType.toLowerCase().includes("cmd") ||
    shellType.toLowerCase().includes("prompt") ||
    shellType.toLowerCase().includes("command");
  const prompt = isWin ? "C:\\Users\\marshell> " : "marshell@dev:~$ ";
  const promptColor = "text-[var(--accent-ink)]/50";

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-10 flex select-none flex-col gap-3 border border-border/10 bg-[var(--terminal-bg)] p-5 font-mono text-xs",
        !isMinimal && "terminal-shimmer-sweep"
      )}
    >
      <div className="flex items-center gap-2 opacity-35">
        <span className="size-2.5 rounded-full bg-red-500/30" />
        <span className="size-2.5 rounded-full bg-yellow-500/30" />
        <span className="size-2.5 rounded-full bg-green-500/30" />
      </div>
      <div
        className={cn(
          "mt-2 flex items-center gap-2 opacity-50",
          !isMinimal && "animate-pulse"
        )}
      >
        <span className={`${promptColor} font-bold`}>{prompt}</span>
        <div className="h-4 w-32 rounded bg-muted-foreground/10" />
      </div>
      <div className="mt-1 space-y-2 opacity-30">
        <div
          className={cn(
            "h-3.5 w-[90%] rounded bg-muted-foreground/5",
            !isMinimal && "animate-pulse [animation-delay:100ms]"
          )}
        />
        <div
          className={cn(
            "h-3.5 w-[75%] rounded bg-muted-foreground/5",
            !isMinimal && "animate-pulse [animation-delay:200ms]"
          )}
        />
        <div
          className={cn(
            "h-3.5 w-[80%] rounded bg-muted-foreground/5",
            !isMinimal && "animate-pulse [animation-delay:300ms]"
          )}
        />
        <div
          className={cn(
            "h-3.5 w-[45%] rounded bg-muted-foreground/5",
            !isMinimal && "animate-pulse [animation-delay:400ms]"
          )}
        />
      </div>
      <div
        className={cn(
          "mt-3 flex items-center gap-2 opacity-45",
          !isMinimal && "animate-pulse [animation-delay:500ms]"
        )}
      >
        <span className={`${promptColor} font-bold`}>{prompt}</span>
        <span
          className={cn(
            "h-4 w-1.5 bg-muted-foreground/30",
            !isMinimal && "animate-pulse"
          )}
        />
      </div>
    </div>
  );
}

export const TerminalPane = memo(function TerminalPane({
  id,
  index,
  name,
  title,
  isActiveWorkspace = true,
  cwd,
  autoCommand,
  directory,
  workspaceId,
}: TerminalPaneProps) {
  const lifecycleText = useTranslations("TerminalLifecycle");
  const lifecycleTextRef = useRef(lifecycleText);
  lifecycleTextRef.current = lifecycleText;
  const releaseMenuFocusRef = useRef(false);
  const [launchedCliLogoId, setLaunchedCliLogoId] =
    useState<TerminalCliLogoId | null>(null);
  const cliLogoId = launchedCliLogoId ?? getTerminalCliLogoId(autoCommand);
  const observeSubmittedCommand = useCallback(
    (term: TerminalInstance, data: string) => {
      if (term.buffer.active.type !== "normal") {
        return;
      }
      const command = getSubmittedTerminalCliCommand(term.buffer.active, data);
      const logo = getTerminalCliLogoId(command ?? undefined);
      if (logo) {
        setLaunchedCliLogoId(logo);
        if (command) {
          useWorkspaceStore.getState().setTerminalCliCommand(id, command);
        }
      }
    },
    [id]
  );
  const mounted = useMounted();
  const registerTerminalFocus = useTerminalFocusStore(
    (s) => s.registerTerminal
  );
  const isFocused = useTerminalFocusStore((s) => s.focusedTerminalId === id);
  const setFocusedTerminalId = useTerminalFocusStore(
    (s) => s.setFocusedTerminalId
  );
  const fullscreenTerminalId = useTerminalFocusStore(
    (s) => s.fullscreenTerminalId
  );
  const isFullscreen = fullscreenTerminalId === id;
  const toggleTerminalFullscreen = useTerminalFocusStore(
    (s) => s.toggleTerminalFullscreen
  );
  const deleteTerminal = useWorkspaceStore((s) => s.deleteTerminal);
  const replaceTerminal = useWorkspaceStore((s) => s.replaceTerminal);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const idleData = useTerminalIdleStore((s) => s.terminals[id]);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<TerminalInstance>(null);

  const fitAddonRef = useRef<FitAddonInstance>(null);
  const writeQueueRef = useRef<TerminalOutputBuffer | null>(null);
  const [shellType, setShellType] = useState("Local Shell");
  const [isTauriEnv, setIsTauriEnv] = useState(false);
  const [isTerminalReady, setIsTerminalReady] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const webglAddonRef = useRef<DisposableAddon | null>(null);
  const isActiveWorkspaceRef = useRef(isActiveWorkspace);
  isActiveWorkspaceRef.current = isActiveWorkspace;
  const [termVersion, setTermVersion] = useState(0);

  const handleDeleteConfirm = useCallback(() => {
    if (isFullscreen) {
      toggleTerminalFullscreen(id);
    }
    const targetWorkspaceId = workspaceId || activeWorkspaceId;
    if (targetWorkspaceId) {
      deleteTerminal(targetWorkspaceId, id);
    }
  }, [workspaceId, activeWorkspaceId, deleteTerminal, id, isFullscreen]);

  const executeReset = useCallback(() => {
    const targetWorkspaceId = workspaceId || activeWorkspaceId;
    if (targetWorkspaceId) {
      replaceTerminal(targetWorkspaceId, id);
    }
  }, [workspaceId, activeWorkspaceId, replaceTerminal, id]);

  // Register focus handler for this terminal instance
  useEffect(() => {
    if (!isTerminalReady) {
      return;
    }
    const unregister = registerTerminalFocus(id, () => {
      const state = useWorkspaceStore.getState();
      if (
        !termRef.current ||
        (workspaceId &&
          (state.activeWorkspaceId !== workspaceId ||
            state.activeView !== "terminals"))
      ) {
        return false;
      }
      termRef.current.focus();
      return document.activeElement === termRef.current.textarea;
    });
    return () => {
      unregister();
    };
  }, [id, isTerminalReady, registerTerminalFocus, workspaceId]);

  // Buffer input for mock shell
  const inputBufferRef = useRef("");

  // Refs for offset-based terminal data deduplication and session lifecycle
  const pendingEventsRef = useRef<TerminalEventPayload[]>([]);
  const currentOffsetRef = useRef<number>(0);
  const isInitializedRef = useRef<boolean>(false);
  const currentInstanceIdRef = useRef<number>(0);
  const isResettingRef = useRef<boolean>(false);
  const disposedRef = useRef<boolean>(false);
  const ptyResizeStateRef = useRef<{
    currentPtyCols: number;
    currentPtyRows: number;
    inFlight: boolean;
    pendingTarget: { cols: number; rows: number } | null;
  }>({
    currentPtyCols: 0,
    currentPtyRows: 0,
    inFlight: false,
    pendingTarget: null,
  });

  const sendPtyResize = useCallback(
    (cols: number, rows: number) => {
      if (
        isResettingRef.current ||
        !isInitializedRef.current ||
        disposedRef.current ||
        cols <= 0 ||
        rows <= 0 ||
        !Number.isFinite(cols) ||
        !Number.isFinite(rows)
      ) {
        return;
      }

      const state = ptyResizeStateRef.current;
      if (
        !(state.inFlight || state.pendingTarget) &&
        cols === state.currentPtyCols &&
        rows === state.currentPtyRows
      ) {
        return;
      }

      state.pendingTarget = { cols, rows };

      if (state.inFlight) {
        return;
      }

      const processNext = async () => {
        const next = state.pendingTarget;
        if (!next || disposedRef.current) {
          state.inFlight = false;
          return;
        }

        state.inFlight = true;
        state.pendingTarget = null;

        try {
          const { isTauri, invoke } = await import("@tauri-apps/api/core");
          if (isTauri() && !disposedRef.current) {
            await invoke("resize_terminal", {
              id,
              cols: next.cols,
              rows: next.rows,
            });
            state.currentPtyCols = next.cols;
            state.currentPtyRows = next.rows;
          } else {
            state.currentPtyCols = next.cols;
            state.currentPtyRows = next.rows;
          }
        } catch {
          // Leave currentPtyCols as-is so subsequent attempts can synchronize
        } finally {
          state.inFlight = false;
          const pending = state.pendingTarget as {
            cols: number;
            rows: number;
          } | null;
          if (
            pending &&
            (pending.cols !== state.currentPtyCols ||
              pending.rows !== state.currentPtyRows)
          ) {
            processNext();
          }
        }
      };

      processNext();
    },
    [id]
  );

  const syncVisualOnly = useCallback(() => {
    // Avoid redrawing full xterm buffer on every intermediate sliding frame to eliminate flicker and GPU lag.
    // Authoritative buffer fitting and repaint occurs cleanly upon motion completion.
  }, []);

  const syncTerminalSize = useCallback(
    (force = false): boolean => {
      if (
        disposedRef.current ||
        !fitAddonRef.current ||
        !termRef.current ||
        !containerRef.current ||
        !isActiveWorkspace
      ) {
        return false;
      }

      const el = containerRef.current;
      const width = el.clientWidth;
      const height = el.clientHeight;

      // Do NOT fit at zero or invalid dimensions
      if (width <= 0 || height <= 0) {
        return false;
      }

      const fitAddon = fitAddonRef.current;
      const term = termRef.current;

      const dims = fitAddon.proposeDimensions();
      if (!dims || dims.cols <= 0 || dims.rows <= 0) {
        return false;
      }

      const targetCols = Math.max(1, Math.floor(dims.cols));
      const targetRows = Math.max(1, Math.floor(dims.rows));
      if (!(Number.isFinite(targetCols) && Number.isFinite(targetRows))) {
        return false;
      }

      const colsChanged = targetCols !== term.cols;
      const rowsChanged = targetRows !== term.rows;

      if (colsChanged || rowsChanged) {
        fitAddon.fit();

        // Authoritative dimensions after xterm fit
        const actualCols = Math.max(1, term.cols);
        const actualRows = Math.max(1, term.rows);

        sendPtyResize(actualCols, actualRows);
        return true;
      }

      if (force) {
        try {
          term.refresh(0, Math.max(0, term.rows - 1));
        } catch {}
        return true;
      }

      // Ensure PTY agrees with xterm even if xterm dimensions didn't change
      const ptyState = ptyResizeStateRef.current;
      if (
        term.cols !== ptyState.currentPtyCols ||
        term.rows !== ptyState.currentPtyRows
      ) {
        sendPtyResize(term.cols, term.rows);
        try {
          term.refresh(0, Math.max(0, term.rows - 1));
        } catch {}
        return true;
      }

      return false;
    },
    [isActiveWorkspace, sendPtyResize]
  );

  useEffect(() => {
    const checkEnvironment = async () => {
      try {
        const { isTauri } = await import("@tauri-apps/api/core");
        if (isTauri()) {
          setIsTauriEnv(true);
          const currentShell = useGeneralSettingsStore.getState().defaultShell;
          if (currentShell === "powershell") {
            setShellType("PowerShell");
          } else if (currentShell === "cmd") {
            setShellType("Command Prompt");
          } else if (currentShell === "bash") {
            setShellType("Bash Shell");
          } else if (currentShell === "zsh") {
            setShellType("Zsh");
          } else if (currentShell === "gitbash") {
            setShellType("Git Bash");
          } else {
            // Replaced by the real shell once the PTY reports it.
            setShellType("Shell");
          }
        } else {
          const currentShell = useGeneralSettingsStore.getState().defaultShell;
          if (currentShell === "default") {
            setShellType("Mock Shell (Web)");
          } else {
            setShellType(`Mock (${currentShell})`);
          }
        }
      } catch {
        setShellType("Mock Shell (Web)");
      }
    };
    checkEnvironment();
  }, []);

  const handleMockCommand = useCallback(
    (cmd: string, term: TerminalInstance) => {
      const logo = getTerminalCliLogoId(cmd);
      if (logo) {
        setLaunchedCliLogoId(logo);
        useWorkspaceStore.getState().setTerminalCliCommand(id, cmd);
      }
      const parts = cmd.split(" ");
      const name = parts[0]?.toLowerCase();

      switch (name) {
        case "":
          break;
        case "help":
          term.writeln("Available mock commands:");
          term.writeln(
            "  \x1b[1;34mhelp\x1b[0m     Display help documentation"
          );
          term.writeln(
            "  \x1b[1;34mneofetch\x1b[0m Show mock OS and ecosystem details"
          );
          term.writeln("  \x1b[1;34mclear\x1b[0m    Clear the terminal screen");
          term.writeln(
            "  \x1b[1;34mecho\x1b[0m     Print arguments to standard output"
          );
          term.writeln("  \x1b[1;34mdate\x1b[0m     Display system local time");
          break;
        case "neofetch":
          term.writeln(
            "   \x1b[1;35m/\\_/\\\x1b[0m      \x1b[1;36mmarshell-demo@web\x1b[0m"
          );
          term.writeln(
            "  \x1b[1;35m( o.o )\x1b[0m     \x1b[0m-----------------\x1b[0m"
          );
          term.writeln(
            "   \x1b[1;35m> ^ <\x1b[0m      \x1b[1;33mOS\x1b[0m: Google Gemini Sandbox (WASM)"
          );
          term.writeln(
            "  \x1b[1;35m/     \\\x1b[0m     \x1b[1;33mKernel\x1b[0m: Next.js v16.2 Client Runtime"
          );
          term.writeln(
            " \x1b[1;35m(|  |  |)\x1b[0m    \x1b[1;33mShell\x1b[0m: TypeScript xterm.js mock-shell"
          );
          term.writeln(
            "  \x1b[1;35m(____|)\x1b[0m     \x1b[1;33mTerminal\x1b[0m: xterm.js Canvas Grid"
          );
          term.writeln(
            "              \x1b[1;33mMemory\x1b[0m: 16.0 GB Virtual RAM"
          );
          break;
        case "clear":
          term.clear();
          break;
        case "echo":
          term.writeln(parts.slice(1).join(" "));
          break;
        case "date":
          term.writeln(new Date().toString());
          break;
        default:
          term.writeln(`marshell-shell: command not found: ${name}`);
      }
    },
    [id]
  );

  const setupMockShell = useCallback(
    (term: TerminalInstance) => {
      term.writeln("\x1b[1;35mMarshell Web Shell Terminal\x1b[0m");
      term.writeln(
        "Interactive mock sandbox active. Try: \x1b[1;36mneofetch\x1b[0m, \x1b[1;36mhelp\x1b[0m, \x1b[1;36mclear\x1b[0m.\r\n"
      );
      term.write("\x1b[1;32mmarshell-demo@web:~$\x1b[0m ");

      term.onData((data: string) => {
        writeQueueRef.current?.flush();
        if (!termRef.current) {
          return;
        }

        for (const char of data) {
          if (char === "\r") {
            const cmd = inputBufferRef.current.trim();
            term.write("\r\n");
            handleMockCommand(cmd, term);
            inputBufferRef.current = "";
            term.write("\x1b[1;32mmarshell-demo@web:~$\x1b[0m ");
          } else if (char === "\u007f") {
            if (inputBufferRef.current.length > 0) {
              inputBufferRef.current = inputBufferRef.current.slice(0, -1);
              term.write("\b \b");
            }
            inputBufferRef.current += char;
            term.write(char);
          }
        }
      });
    },
    [handleMockCommand]
  );

  const copySelection = useCallback(() => {
    const term = termRef.current;
    if (!term) {
      return false;
    }
    const selection = term.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection).catch(() => {});
      term.clearSelection();
      setHasSelection(false);
      return true;
    }
    return false;
  }, []);

  const pasteClipboard = useCallback(async () => {
    const term = termRef.current;
    if (!term) {
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        return;
      }
      if (isTauriEnv) {
        if (
          disposedRef.current ||
          isResettingRef.current ||
          !isInitializedRef.current
        ) {
          return;
        }
        // xterm's own paste wraps the text in bracketed-paste markers when the
        // program enabled them, converts \n to \r, and emits it through onData
        // so it shares the ordered input path with typed keys.
        term.paste(text);
      } else {
        for (const char of text) {
          if (char === "\r" || char === "\n") {
            const cmd = inputBufferRef.current.trim();
            term.write("\r\n");
            handleMockCommand(cmd, term);
            inputBufferRef.current = "";
            term.write("\x1b[1;32mmarshell-demo@web:~$\x1b[0m ");
          } else {
            inputBufferRef.current += char;
            term.write(char);
          }
        }
      }
    } catch {
      // Best-effort: clipboard read permission denied or no text available
    }
  }, [isTauriEnv, handleMockCommand]);

  const clearTerminal = useCallback(async () => {
    const term = termRef.current;
    if (!term) {
      return;
    }
    term.clear();
    if (isTauriEnv) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        // Never type into a running program (an editor, a CLI agent): only
        // clear the shell's own screen when the shell is at its prompt.
        const busy = await invoke<boolean>("has_active_process", { id }).catch(
          () => true
        );
        if (!busy) {
          await sendTerminalInput(
            id,
            clearScreenInput(getTerminalShellKind(id))
          );
        }
      } catch {
        // ignore
      }
    }
  }, [id, isTauriEnv]);

  const selectAll = useCallback(() => {
    termRef.current?.selectAll();
  }, []);

  const copySelectionRef = useRef(copySelection);
  copySelectionRef.current = copySelection;

  const selectAllRef = useRef(selectAll);
  selectAllRef.current = selectAll;

  // Set up PTY terminal
  useEffect(() => {
    if (!(mounted && containerRef.current)) {
      return;
    }

    let disposed = false;
    let unlistenStdout: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;
    let outputLease: { instanceId: number; lease: number } | undefined;
    let ackTimer: ReturnType<typeof setTimeout> | undefined;
    let parsedOffset = 0;
    let statusDecoder = new TextDecoder();
    const acknowledge = (offset: number) => {
      if (disposed || !outputLease) {
        return;
      }
      parsedOffset = Math.max(parsedOffset, offset);
      if (ackTimer !== undefined) {
        return;
      }
      ackTimer = setTimeout(() => {
        ackTimer = undefined;
        const lease = outputLease;
        if (disposed || !lease) {
          return;
        }
        import("@tauri-apps/api/core")
          .then(({ invoke }) =>
            invoke("acknowledge_terminal_output", {
              id,
              instanceId: lease.instanceId,
              lease: lease.lease,
              offset: parsedOffset,
            })
          )
          .catch(() => {});
      }, 16);
    };
    disposedRef.current = false;
    isInitializedRef.current = false;
    currentInstanceIdRef.current = 0;
    currentOffsetRef.current = 0;
    pendingEventsRef.current = [];

    async function setupTauri(term: TerminalInstance) {
      const { isTauri, invoke } = await import("@tauri-apps/api/core");
      const { listen } = await import("@tauri-apps/api/event");

      if (!isTauri() || disposed) {
        return { isTauriActive: false };
      }

      const stopExit = await listen<{
        instance_id: number;
        code: number | null;
        error?: string;
        detail?: string;
        program?: string;
        output_incomplete?: boolean;
      }>(`terminal-exit-${id}`, (event) => {
        if (
          !disposed &&
          event.payload.instance_id === currentInstanceIdRef.current
        ) {
          if (event.payload.code === null) {
            useTerminalIdleStore
              .getState()
              .setStartupError(
                id,
                event.payload.error ?? "Could not read terminal exit status"
              );
          } else {
            useTerminalIdleStore
              .getState()
              .markExited(id, event.payload.code, event.payload.detail);
            term.writeln(
              `\r\n${lifecycleTextRef.current("exited", {
                program: event.payload.program ?? "PTY",
                status: event.payload.detail ?? String(event.payload.code),
              })}\r\n`
            );
            if (event.payload.output_incomplete) {
              const reason = lifecycleTextRef.current("incompleteOutput");
              useTerminalIdleStore.getState().setStartupError(id, reason);
              term.writeln(reason);
            }
          }
        }
      });
      if (disposed) {
        safeUnlisten(stopExit);
        return { isTauriActive: false };
      }
      unlistenExit = stopExit;
      // 1. Listen for stdout events first to avoid race conditions and lost bytes
      const unlisten = await listen<TerminalEventPayload>(
        `terminal-stdout-${id}`,
        async (event) => {
          if (disposed) {
            return;
          }
          const payload = event.payload;
          // Decode the wire format once; every later step reuses these bytes.
          const payloadBytes = terminalPayloadBytes(payload);
          payload.bytes = payloadBytes;
          const offsetEnd = payload.offset + payloadBytes.length;
          const leaseAtReceipt = outputLease;
          payload.onParsed = () => {
            if (leaseAtReceipt === outputLease) {
              useTerminalIdleStore
                .getState()
                .updateScreen(
                  id,
                  terminalScreenTail(term.buffer.active),
                  payload.instance_id,
                  terminalScreenComposer(term.buffer.active)
                );
              acknowledge(offsetEnd);
            }
          };

          // Discard events from previous/stale backend session instances
          if (
            payload.instance_id &&
            currentInstanceIdRef.current !== 0 &&
            payload.instance_id !== currentInstanceIdRef.current
          ) {
            return;
          }

          const text = statusDecoder.decode(payloadBytes, { stream: true });
          useTerminalIdleStore.getState().ingest(id, text);

          if (isInitializedRef.current && !isResettingRef.current) {
            const batchMs =
              usePerformanceStore.getState().policy.features
                .terminalWriteBatchMs;
            handleSingleEvent(
              term,
              payload,
              currentOffsetRef,
              writeQueueRef,
              batchMs
            );
          } else if (
            !isResettingRef.current &&
            (!payload.instance_id ||
              payload.instance_id === currentInstanceIdRef.current)
          ) {
            // Buffer events received while history is loading for current session
            pendingEventsRef.current.push(payload);
          }
        }
      );

      if (disposed) {
        safeUnlisten(unlisten);
        return { isTauriActive: false };
      }
      unlistenStdout = unlisten;

      // 2. Setup user input key event forwarding (guarded against teardown / uninitialized state)
      const inputSubscription = term.onData((data: string) => {
        writeQueueRef.current?.flush();
        if (isResettingRef.current || !isInitializedRef.current) {
          return;
        }
        // Only a submitted line needs the rendered buffer (to read the command
        // before the shell clears it). Everything else, notably Ctrl+C, is sent
        // immediately instead of waiting behind a backlog of unparsed output.
        // sendTerminalInput keeps every chunk in order, so typing still cannot
        // overtake a pending Enter.
        const submitsLine = SUBMIT_REGEX.test(data);
        const readSubmittedCommand = submitsLine
          ? () =>
              new Promise<void>((resolve) => {
                term.write("", () => {
                  if (
                    !(disposed || isResettingRef.current) &&
                    isInitializedRef.current
                  ) {
                    observeSubmittedCommand(term, data);
                  }
                  resolve();
                });
              })
          : undefined;
        sendTerminalInput(
          id,
          data,
          currentInstanceIdRef.current,
          readSubmittedCommand
        ).catch((err) => {
          if (
            !isResettingRef.current &&
            isInitializedRef.current &&
            !disposed
          ) {
            term.writeln(
              `\r\n\x1b[31mError writing to terminal: ${err}\x1b[0m`
            );
          }
        });
      });

      // 3. Spawns/attaches backend session
      const cols = term.cols > 0 ? term.cols : 80;
      const rows = term.rows > 0 ? term.rows : 24;
      const configuredShell = useGeneralSettingsStore.getState().defaultShell;
      let createRes: TerminalCreateResult;
      let restoreTerminalMetadata = false;
      try {
        createRes = await invoke<TerminalCreateResult>("create_terminal", {
          id,
          cols,
          rows,
          cwd,
          shell: configuredShell === "default" ? undefined : configuredShell,
        });
        if (disposed) {
          inputSubscription.dispose();
          return { isTauriActive: false };
        }
        const effectiveShell = parseTerminalShellKind(createRes?.shell);
        setTerminalShellKind(id, effectiveShell);
        if (effectiveShell) {
          setShellType(terminalShellLabel(effectiveShell));
          if (createRes.is_new && createRes.fell_back) {
            term.writeln(
              `\x1b[33mShell "${configuredShell}" is not available on this system; using ${terminalShellLabel(effectiveShell)} instead.\x1b[0m`
            );
          }
        }
        if (createRes?.instance_id) {
          currentInstanceIdRef.current = createRes.instance_id;
          statusDecoder = new TextDecoder();
          restoreTerminalMetadata =
            useTerminalIdleStore.getState().terminals[id]?.instanceId !==
            createRes.instance_id;
          useTerminalIdleStore
            .getState()
            .startSession(id, createRes.instance_id);
          const lease = await invoke<number>("attach_terminal_output", {
            id,
            instanceId: createRes.instance_id,
          });
          if (disposed) {
            await invoke("detach_terminal_output", {
              id,
              instanceId: createRes.instance_id,
              lease,
            });
            return { isTauriActive: false };
          }
          if (typeof lease === "number") {
            outputLease = { instanceId: createRes.instance_id, lease };
          }
        }

        // 4. Retrieve history and current total bytes read from backend
        const historyInfo = await invoke<TerminalHistoryInfo>(
          "get_terminal_history",
          { id }
        );
        if (disposed) {
          inputSubscription.dispose();
          return { isTauriActive: false };
        }
        if (!disposed && historyInfo) {
          // Restore negotiated input modes too: a retained CLI may have enabled
          // bracketed paste before this view attached its stdout listener.
          if (restoreTerminalMetadata) {
            useTerminalIdleStore.getState().ingest(id, historyInfo.history);
          }
          const restoredLogo = getTerminalCliLogoFromHistory(
            historyInfo.history
          );
          if (restoredLogo) {
            setLaunchedCliLogoId(restoredLogo);
          }
          const historyInstance = currentInstanceIdRef.current;
          term.write(
            historyInfo.bytes
              ? terminalPayloadBytes({ bytes: historyInfo.bytes })
              : historyInfo.history,
            () => {
              if (
                !disposed &&
                historyInstance === currentInstanceIdRef.current
              ) {
                useTerminalIdleStore
                  .getState()
                  .updateScreen(
                    id,
                    terminalScreenTail(term.buffer.active),
                    historyInstance,
                    terminalScreenComposer(term.buffer.active)
                  );
              }
              acknowledge(historyInfo.total_read);
            }
          );
          currentOffsetRef.current = historyInfo.total_read;

          // Process buffered pending events in order
          const batchMs =
            usePerformanceStore.getState().policy.features.terminalWriteBatchMs;
          processPendingEvents(
            term,
            pendingEventsRef.current,
            currentOffsetRef,
            writeQueueRef,
            batchMs
          );

          pendingEventsRef.current = [];
          // The first animation-frame fit can run while create_terminal is in
          // flight. Acknowledge the actual grid before launching a CLI TUI.
          const fit = fitAddonRef.current;
          if (
            fit &&
            containerRef.current &&
            containerRef.current.clientWidth > 0 &&
            containerRef.current.clientHeight > 0
          ) {
            fit.fit();
          }
          let size = { cols: term.cols, rows: term.rows };
          for (;;) {
            await invoke("resize_terminal", { id, ...size });
            if (disposed) {
              inputSubscription.dispose();
              return { isTauriActive: false };
            }
            ptyResizeStateRef.current.currentPtyCols = size.cols;
            ptyResizeStateRef.current.currentPtyRows = size.rows;
            if (size.cols === term.cols && size.rows === term.rows) {
              break;
            }
            size = { cols: term.cols, rows: term.rows };
          }
          processPendingEvents(
            term,
            pendingEventsRef.current,
            currentOffsetRef,
            writeQueueRef,
            batchMs
          );
          pendingEventsRef.current = [];
          isInitializedRef.current = true;
        }

        return {
          isTauriActive: true,
          startupPending: historyInfo.startup_pending,
          instanceId: createRes.instance_id,
        };
      } catch (error) {
        inputSubscription.dispose();
        throw error;
      }
    }

    async function runTauriSetupWithRetries(term: TerminalInstance): Promise<{
      isTauriActive: boolean;
      startupPending?: boolean;
      instanceId?: number;
    }> {
      let retries = 3;
      while (retries > 0 && !disposed) {
        try {
          const res = await setupTauri(term);
          if (res.isTauriActive) {
            return res;
          }
          return { isTauriActive: false };
        } catch (error) {
          if (unlistenStdout) {
            safeUnlisten(unlistenStdout);
            unlistenStdout = undefined;
          }
          retries--;
          if (retries === 0 && !disposed) {
            throw error;
          }
          if (retries > 0 && !disposed) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }
      return { isTauriActive: false };
    }

    async function initializeShell(term: TerminalInstance) {
      const startupCommand = useWorkspaceStore
        .getState()
        .getTerminalStartupCommand(id, autoCommand);
      let res: {
        isTauriActive: boolean;
        startupPending?: boolean;
        instanceId?: number;
      } = {
        isTauriActive: false,
      };
      try {
        res = await runTauriSetupWithRetries(term);
      } catch (error) {
        if (!disposed) {
          term.writeln(
            `\r\nTerminal initialization failed: ${error instanceof Error ? error.message : String(error)}\r\nRestart this terminal to retry.\r\n`
          );
        }
        return;
      }

      if (disposed) {
        return;
      }

      if (res.isTauriActive) {
        if (res.startupPending) {
          setLaunchedCliLogoId(getTerminalCliLogoId(startupCommand));
        }
        if (
          res.startupPending &&
          startupCommand &&
          res.instanceId &&
          !disposed
        ) {
          try {
            const { invoke } = await import("@tauri-apps/api/core");
            useTerminalIdleStore.getState().setStartupError(id, null);
            await invoke("launch_terminal_command", {
              id,
              instanceId: res.instanceId,
              command: startupCommand,
            });
          } catch (error) {
            if (!disposed) {
              useTerminalIdleStore
                .getState()
                .setStartupError(
                  id,
                  `Terminal launch failed: ${error instanceof Error ? error.message : String(error)}`
                );
              term.writeln(
                `\r\nTerminal launch failed: ${error instanceof Error ? error.message : String(error)}\r\n`
              );
            }
          }
        }
      } else if (!disposed) {
        setupMockShell(term);
        executeMockAutoCommand(
          term,
          startupCommand,
          directory,
          handleMockCommand
        );
      }

      if (!disposed) {
        setIsTerminalReady(true);
      }
    }

    let themeObserver: MutationObserver | null = null;

    async function init() {
      const { Terminal, FitAddon, WebLinksAddon, Unicode11Addon } =
        await loadXterm();
      await document.fonts?.ready;
      const windowsPty = await readWindowsPtyOptions();

      if (disposed || !containerRef.current) {
        return;
      }

      if (termRef.current) {
        termRef.current.dispose();
        termRef.current = null;
      }
      containerRef.current.innerHTML = "";

      const computed = getComputedStyle(document.documentElement);

      const terminalSettings = useGeneralSettingsStore.getState();
      const term = new Terminal({
        allowProposedApi: true,
        windowsPty,
        cursorBlink: terminalSettings.terminalCursorBlink,
        cursorStyle: terminalSettings.terminalCursorStyle,
        fontSize: terminalSettings.terminalFontSize,
        lineHeight: 1,
        letterSpacing: 0,
        fontFamily:
          'ui-monospace, SFMono-Regular, "Cascadia Code", "Cascadia Mono", Menlo, Consolas, monospace',
        scrollback: terminalSettings.terminalScrollback,
        theme: buildTerminalTheme(computed),
      });

      const updateTerminalTheme = () => {
        if (disposed || !termRef.current) {
          return;
        }
        const comp = getComputedStyle(document.documentElement);
        termRef.current.options.theme = buildTerminalTheme(comp);
      };

      themeObserver =
        typeof MutationObserver !== "undefined" &&
        typeof document !== "undefined"
          ? new MutationObserver(() => updateTerminalTheme())
          : null;

      themeObserver?.observe(document.documentElement, {
        attributes: true,
        attributeFilter: [
          "data-theme",
          "class",
          "data-accent",
          "data-contrast",
        ],
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);
      // Unicode 11 widths (emoji, CJK) match modern shells and ConPTY; xterm's
      // default table is older and drifts the cursor on wide characters.
      term.loadAddon(new Unicode11Addon());
      term.unicode.activeVersion = "11";
      term.open(containerRef.current);

      termRef.current = term;
      fitAddonRef.current = fitAddon;
      setTermVersion((version) => version + 1);
      // Webfonts may change cell metrics after xterm opens. Fit against the
      // loaded font instead of starting the CLI in a temporary fallback grid.
      await document.fonts?.ready;
      if (disposed) {
        return;
      }
      if (
        containerRef.current &&
        containerRef.current.clientWidth > 0 &&
        containerRef.current.clientHeight > 0
      ) {
        fitAddon.fit();
      }

      // Intercept and handle clipboard / global shortcuts with proper terminal semantics
      term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
        if (!shouldTerminalHandleKeyboardEvent(event)) {
          return false;
        }

        const macSequence = macTerminalKeySequence(event, isMacPlatform());
        if (macSequence) {
          event.preventDefault();
          term.input(macSequence, true);
          return false;
        }

        const isCtrlOrCmd = event.ctrlKey || event.metaKey;

        // 1. Copy handling: Ctrl+C / Ctrl+Shift+C / Cmd+C
        if (
          isCtrlOrCmd &&
          (event.key === "c" || event.key === "C" || event.code === "KeyC")
        ) {
          // If Shift is pressed (Ctrl+Shift+C), copy selection
          if (event.shiftKey) {
            if (event.type === "keydown") {
              copySelectionRef.current();
            }
            return false;
          }

          // If text is selected in xterm, Ctrl+C copies selection without sending SIGINT (\x03)
          if (term.hasSelection()) {
            if (event.type === "keydown") {
              copySelectionRef.current();
            }
            return false;
          }

          // If NO text is selected, allow Ctrl+C to pass through to PTY to send \x03 (SIGINT)
          return true;
        }

        // 2. Paste handling: Ctrl+V / Ctrl+Shift+V / Cmd+V
        if (
          isCtrlOrCmd &&
          (event.key === "v" || event.key === "V" || event.code === "KeyV")
        ) {
          // Do not read the clipboard here: returning false lets the browser's
          // native paste event reach xterm, which pastes exactly once with
          // bracketed-paste handling. Reading it too would paste twice.
          return false;
        }

        // 3. Select All handling: Ctrl+Shift+A
        if (
          isCtrlOrCmd &&
          event.shiftKey &&
          (event.key === "a" || event.key === "A" || event.code === "KeyA")
        ) {
          if (event.type === "keydown") {
            selectAllRef.current();
          }
          return false;
        }

        return true;
      });

      // Track active selection changes to update context menu states
      term.onSelectionChange(() => {
        const has = Boolean(term.hasSelection());
        setHasSelection((prev) => (prev === has ? prev : has));
      });

      // Update focus state when terminal is focused
      term.textarea?.addEventListener("focus", () => {
        setFocusedTerminalId(id);
      });
      term.textarea?.addEventListener("blur", () => {
        if (useTerminalFocusStore.getState().focusedTerminalId === id) {
          setFocusedTerminalId(null);
        }
      });

      // Initial fit on mount
      requestAnimationFrame(() => {
        syncTerminalSize(true);
      });

      await initializeShell(term);
    }

    init().catch((error) => {
      if (!disposed) {
        termRef.current?.writeln(
          `\r\nTerminal initialization failed: ${error instanceof Error ? error.message : String(error)}\r\n`
        );
      }
    });

    return () => {
      disposed = true;
      clearTimeout(ackTimer);
      const lease = outputLease;
      outputLease = undefined;
      if (lease) {
        import("@tauri-apps/api/core")
          .then(({ invoke }) =>
            invoke("detach_terminal_output", {
              id,
              instanceId: lease.instanceId,
              lease: lease.lease,
            })
          )
          .catch(() => {});
      }
      disposedRef.current = true;
      themeObserver?.disconnect();
      terminalLayoutManager.cancelScheduledFit(id);
      terminalLayoutManager.unregister(id);
      writeQueueRef.current?.dispose();
      writeQueueRef.current = null;
      webglAddonRef.current = null;
      termRef.current?.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      if (unlistenStdout) {
        safeUnlisten(unlistenStdout);
      }
      safeUnlisten(unlistenExit);
    };
  }, [
    id,
    mounted,
    setupMockShell,
    cwd,
    autoCommand,
    directory,
    handleMockCommand,
    observeSubmittedCommand,
  ]);

  // One WebGL context per visible terminal. Browsers cap live contexts, and
  // hidden workspaces stay mounted, so the GPU renderer is released from
  // hidden workspaces. The release is delayed: flipping back and forth between
  // two workspaces (the common case) then never tears the renderer down, so
  // there is no blank/flash while it is rebuilt. Attaching is staggered per
  // pane so a switch does not create every GL context in the same frame.
  useEffect(() => {
    const term = termRef.current;
    if (!(term && termVersion > 0)) {
      return;
    }
    const isCurrent = () =>
      termRef.current === term &&
      !disposedRef.current &&
      isActiveWorkspaceRef.current;
    if (isActiveWorkspace) {
      const timer = window.setTimeout(
        () => attachWebglRenderer(term, webglAddonRef, isCurrent),
        Math.min(index ?? 0, 7) * 45
      );
      return () => window.clearTimeout(timer);
    }
    const release = window.setTimeout(
      () => detachWebglRenderer(webglAddonRef),
      WEBGL_RELEASE_DELAY_MS
    );
    return () => window.clearTimeout(release);
  }, [isActiveWorkspace, termVersion, index]);

  useEffect(
    () => () => {
      detachWebglRenderer(webglAddonRef);
    },
    []
  );

  // Terminal appearance settings apply to open terminals immediately.
  const terminalFontSize = useGeneralSettingsStore((s) => s.terminalFontSize);
  const terminalCursorStyle = useGeneralSettingsStore(
    (s) => s.terminalCursorStyle
  );
  const terminalCursorBlink = useGeneralSettingsStore(
    (s) => s.terminalCursorBlink
  );
  const terminalScrollback = useGeneralSettingsStore(
    (s) => s.terminalScrollback
  );
  useEffect(() => {
    const term = termRef.current;
    if (!(term && termVersion > 0)) {
      return;
    }
    const fontChanged = term.options.fontSize !== terminalFontSize;
    term.options.cursorStyle = terminalCursorStyle;
    term.options.cursorBlink = terminalCursorBlink;
    term.options.scrollback = terminalScrollback;
    if (fontChanged) {
      term.options.fontSize = terminalFontSize;
      // Cell metrics changed: refit and tell the PTY about the new grid.
      syncTerminalSize(true);
    }
  }, [
    termVersion,
    terminalFontSize,
    terminalCursorStyle,
    terminalCursorBlink,
    terminalScrollback,
    syncTerminalSize,
  ]);

  // Long-idle recovery: when the window comes back (or the GPU surface is lost
  // while it sits idle) repaint the terminal instead of leaving it blank.
  useEffect(() => {
    const term = termRef.current;
    if (!(term && termVersion > 0 && isActiveWorkspace)) {
      return;
    }
    const isCurrent = () => termRef.current === term && !disposedRef.current;
    const recover = () => {
      if (document.hidden) {
        return;
      }
      recoverTerminalRenderer(term, webglAddonRef, isCurrent);
    };
    const watchdog = window.setInterval(() => {
      if (!document.hidden && isCurrent() && isWebglContextLost(term)) {
        recover();
      }
    }, 10_000);
    document.addEventListener("visibilitychange", recover);
    window.addEventListener("focus", recover);
    window.addEventListener("pageshow", recover);
    return () => {
      window.clearInterval(watchdog);
      document.removeEventListener("visibilitychange", recover);
      window.removeEventListener("focus", recover);
      window.removeEventListener("pageshow", recover);
    };
  }, [isActiveWorkspace, termVersion]);

  // Dedicated coalesced ResizeObserver for this terminal container
  useEffect(() => {
    const el = containerRef.current;
    if (!(el && isActiveWorkspace)) {
      return;
    }

    let lastObservedW = Math.round(el.clientWidth);
    let lastObservedH = Math.round(el.clientHeight);

    const observer = new ResizeObserver((entries) => {
      if (disposedRef.current || terminalLayoutManager.isTransitioning()) {
        return;
      }
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const roundW = Math.round(width);
        const roundH = Math.round(height);
        if (roundW <= 0 || roundH <= 0) {
          continue;
        }
        if (
          Math.abs(roundW - lastObservedW) >= 4 ||
          Math.abs(roundH - lastObservedH) >= 4
        ) {
          lastObservedW = roundW;
          lastObservedH = roundH;
          terminalLayoutManager.scheduleFit(id, false);
        }
      }
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
      terminalLayoutManager.cancelScheduledFit(id);
    };
  }, [id, isActiveWorkspace]);

  // Register with central terminalLayoutManager using full TerminalResizeHandler
  useEffect(() => {
    const handler: TerminalResizeHandler = {
      getContainer: () => containerRef.current,
      getTerminal: () => termRef.current,
      getFitAddon: () => fitAddonRef.current,
      isDisposed: () => disposedRef.current,
      isActive: () => Boolean(isActiveWorkspace && !isResettingRef.current),
      syncVisualOnly,
      syncSize: syncTerminalSize,
    };
    const unregister = terminalLayoutManager.register(id, handler);
    return unregister;
  }, [id, isActiveWorkspace, syncVisualOnly, syncTerminalSize]);

  // Synchronize when workspace becomes active
  useEffect(() => {
    if (isActiveWorkspace) {
      terminalLayoutManager.scheduleFit(id, true);
    }
  }, [id, isActiveWorkspace]);

  // Immediate and transition-aware synchronization when entering or exiting fullscreen / maximize
  useEffect(() => {
    terminalLayoutManager.notifyFullscreenTransition(id);
    if (isFullscreen) {
      termRef.current?.focus();
    }
  }, [id, isFullscreen]);

  const handleReset = async () => {
    const targetWorkspaceId = workspaceId || activeWorkspaceId;
    if (!targetWorkspaceId) {
      return;
    }

    if (!isTauriEnv) {
      executeReset();
      return;
    }

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const hasActive = await invoke<boolean>("has_active_process", {
        id,
      }).catch(() => false);

      if (hasActive) {
        setResetDialogOpen(true);
      } else {
        executeReset();
      }
    } catch {
      executeReset();
    }
  };

  const releaseFocus = () => {
    releaseMenuFocusRef.current = true;
    termRef.current?.blur();
    useTerminalFocusStore.getState().releaseTerminalFocus(id);
  };

  const handleMenuCloseAutoFocus = (event: Event) => {
    if (releaseMenuFocusRef.current) {
      event.preventDefault();
      releaseMenuFocusRef.current = false;
    }
  };

  const sendControlByte = async (data: "\x1b" | "\x03") => {
    if (!isTerminalReady || disposedRef.current || isResettingRef.current) {
      return;
    }
    try {
      if (isTauriEnv) {
        await sendTerminalInput(id, data);
      } else {
        termRef.current?.input(data);
      }
    } catch (error) {
      termRef.current?.writeln(
        `\r\n\x1b[31mError writing to terminal: ${error}\x1b[0m`
      );
    }
  };

  // ─── Image paste handler for fullscreen mode ───
  const handleImagePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) {
      return;
    }
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) {
          continue;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const term = termRef.current;
          if (term) {
            term.writeln(
              `\r\n\x1b[1;36m[Image pasted: ${file.name} | ${(file.size / 1024).toFixed(1)} KB]\x1b[0m`
            );
          }
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  }, []);

  if (!mounted) {
    return (
      <div className="terminal-scrollbar flex h-full flex-col overflow-hidden rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-bg)] shadow-xs">
        {/* Title Bar / Header Skeleton */}
        <div className="flex h-8 shrink-0 items-center justify-between border-b border-[var(--terminal-border)] bg-[var(--terminal-header)] px-3.5 rounded-t-xl">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-[10px] text-subtle tracking-tight">
              {title}
            </span>
          </div>
        </div>
        <div className="relative flex-1 overflow-hidden rounded-b-xl bg-[var(--terminal-bg)]">
          <TerminalPlaceholder shellType="Local Shell" />
        </div>
      </div>
    );
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              "terminal-scrollbar flex flex-col overflow-hidden bg-[var(--terminal-bg)] [contain:paint_layout] transform-gpu transition-[border-color,box-shadow,background-color]",
              fullscreenTerminalId &&
                !isFullscreen &&
                "invisible pointer-events-none",
              isFullscreen
                ? "fixed inset-1.5 sm:inset-2 z-50 rounded-2xl border border-border shadow-2xl motion-normal"
                : "relative h-full min-h-0 min-w-0 rounded-xl border border-[var(--terminal-border)] shadow-xs motion-fast",
              isFocused && !isFullscreen
                ? "border-ring"
                : isFullscreen
                  ? ""
                  : "hover:border-[var(--terminal-border)]/90 hover:shadow-sm"
            )}
            data-terminal-id={id}
          >
            {/* Title Bar / Header */}
            <div
              className={cn(
                "glass-highlight-top flex h-8 shrink-0 items-center justify-between border-b border-[var(--terminal-border)] px-3.5 transition-colors motion-normal",
                isFullscreen ? "rounded-t-2xl" : "rounded-t-xl",
                isFocused ? "bg-secondary" : "bg-[var(--terminal-header)]"
              )}
            >
              <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                <span
                  className="flex size-4 shrink-0 items-center justify-center"
                  title={
                    idleData?.isBusy
                      ? "CLI Agent busy"
                      : idleData
                        ? "CLI Agent idle"
                        : "Terminal ready"
                  }
                >
                  {cliLogoId ? (
                    <TerminalCliIcon className="size-4" id={cliLogoId} />
                  ) : (
                    <SquareTerminal
                      aria-hidden="true"
                      className="size-3.5 text-[var(--terminal-header-fg,#a1a1aa)]"
                    />
                  )}
                </span>
                <span
                  className={cn(
                    "truncate font-heading font-semibold text-[10px] tracking-tight transition-colors",
                    isFocused
                      ? "font-bold text-foreground"
                      : "text-[var(--terminal-header-fg,#a1a1aa)]"
                  )}
                >
                  {name ? (
                    <>
                      {name}{" "}
                      <span className="font-normal text-[var(--terminal-muted,#8e8e93)]">
                        · {title}
                      </span>
                    </>
                  ) : (
                    title
                  )}
                </span>
                <span
                  className={
                    "shrink-0 scale-90 rounded px-1.5 py-0.5 font-bold font-mono text-[8px] uppercase tracking-normal bg-[var(--terminal-chip-bg,rgba(255,255,255,0.08))] text-[var(--terminal-chip-fg,#d4d4d8)] border border-[var(--terminal-chip-border,rgba(255,255,255,0.1))]"
                  }
                >
                  {shellType}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  className="flex size-5.5 items-center justify-center rounded-md text-[var(--terminal-header-fg,#a1a1aa)] transition-colors hover:bg-destructive/15 hover:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  title="Delete Terminal"
                  type="button"
                >
                  <Trash2 className="size-3" />
                </button>
                <button
                  className="flex size-5.5 items-center justify-center rounded-md text-[var(--terminal-header-fg,#a1a1aa)] transition-colors hover:bg-[var(--terminal-chip-bg)] hover:text-foreground"
                  onClick={handleReset}
                  title="Reset Shell Session (Creates a fresh terminal session)"
                  type="button"
                >
                  <RotateCcw className="size-3" />
                </button>
                {isFullscreen ? (
                  <button
                    className="flex size-5.5 items-center justify-center rounded-md text-[var(--terminal-header-fg,#a1a1aa)] transition-colors hover:bg-[var(--terminal-chip-bg)] hover:text-foreground"
                    onClick={() => toggleTerminalFullscreen(id)}
                    title="Exit Fullscreen (F11)"
                    type="button"
                  >
                    <Minimize2 className="size-3" />
                  </button>
                ) : (
                  <button
                    className="flex size-5.5 items-center justify-center rounded-md text-[var(--terminal-header-fg,#a1a1aa)] transition-colors hover:bg-[var(--terminal-chip-bg)] hover:text-foreground"
                    onClick={() => toggleTerminalFullscreen(id)}
                    title="Fullscreen Terminal (F11)"
                    type="button"
                  >
                    <Maximize2 className="size-3" />
                  </button>
                )}
              </div>
            </div>

            {/* xterm.js Container */}
            <div
              className={cn(
                "relative flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--terminal-bg,#08080a)]",
                isFullscreen ? "rounded-b-2xl" : "rounded-b-xl"
              )}
              onPaste={isFullscreen ? handleImagePaste : undefined}
              style={{ minHeight: 0 }}
            >
              <AnimatePresence initial={false}>
                {!isTerminalReady && (
                  <motion.div
                    className="pointer-events-none absolute inset-0 z-10"
                    exit={{
                      opacity: 0,
                    }}
                    initial={{ opacity: 1 }}
                    key="placeholder"
                    transition={{
                      duration: 0.15,
                    }}
                  >
                    <TerminalPlaceholder
                      isMinimal={false}
                      shellType={shellType}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              <div
                className={cn(
                  "h-full w-full min-h-0 min-w-0 overflow-hidden transition-opacity motion-fast",
                  isTerminalReady ? "opacity-100" : "opacity-0"
                )}
              >
                {/* biome-ignore lint/a11y/useSemanticElements: xterm.js container is non-semantic */}
                <div
                  aria-label={`${title} terminal`}
                  className="h-full w-full min-h-0 min-w-0 overflow-hidden p-2 focus:outline-none terminal-scrollbar"
                  ref={containerRef}
                  role="group"
                />
              </div>
            </div>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent
          className="w-52"
          onCloseAutoFocus={handleMenuCloseAutoFocus}
        >
          <ContextMenuItem
            disabled={!hasSelection}
            onClick={() => copySelection()}
          >
            <Copy className="size-3.5" />
            <span>Copy</span>
            <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => pasteClipboard()}>
            <ClipboardPaste className="size-3.5" />
            <span>Paste</span>
            <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={selectAll}>
            <CheckSquare className="size-3.5" />
            <span>Select All</span>
            <ContextMenuShortcut>Ctrl+Shift+A</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <TerminalSessionActions
            disabled={!isTerminalReady}
            kind="context"
            onClear={clearTerminal}
            onReleaseFocus={releaseFocus}
            onRestart={handleReset}
            onSendEscape={() => sendControlByte("\x1b")}
            onSendInterrupt={() => sendControlByte("\x03")}
          />
          <ContextMenuItem onClick={() => toggleTerminalFullscreen(id)}>
            {isFullscreen ? (
              <>
                <Minimize2 className="size-3.5" />
                <span>Exit Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize2 className="size-3.5" />
                <span>Fullscreen</span>
              </>
            )}
            <ContextMenuShortcut>F11</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => setDeleteDialogOpen(true)}
            variant="destructive"
          >
            <Trash2 className="size-3.5" />
            <span>Delete Terminal</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <DeleteTerminalDialog
        name={name}
        onConfirm={handleDeleteConfirm}
        onOpenChange={setDeleteDialogOpen}
        open={deleteDialogOpen}
        title={title}
      />

      <ResetTerminalDialog
        name={name}
        onConfirm={executeReset}
        onOpenChange={setResetDialogOpen}
        open={resetDialogOpen}
        title={title}
      />
    </>
  );
});
