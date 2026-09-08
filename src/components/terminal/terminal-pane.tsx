"use client";

import { DeleteTerminalDialog } from "@/components/terminal/delete-terminal-dialog";
import { ResetTerminalDialog } from "@/components/terminal/reset-terminal-dialog";
import { useMounted } from "@/hooks/use-mounted";
import { isApplicationShortcut } from "@/lib/app-shortcuts";
import { terminalLayoutManager } from "@/lib/terminal-layout-manager";
import { cn } from "@/lib/utils";
import { useTerminalFocusStore } from "@/stores/terminal-focus-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import "@xterm/xterm/css/xterm.css";
import { Maximize2, Minimize2, RotateCcw, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

interface TerminalPaneProps {
  autoCommand?: string;
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
  data: string;
  instance_id?: number;
  offset: number;
}

interface TerminalHistoryInfo {
  history: string;
  instance_id?: number;
  total_read: number;
}

interface TerminalCreateResult {
  instance_id: number;
  is_new: boolean;
}

type TerminalInstance = any;
type FitAddonInstance = any;

let xtermPromise: Promise<{
  Terminal: any;
  FitAddon: any;
  WebLinksAddon: any;
}> | null = null;

function loadXterm() {
  if (!xtermPromise) {
    xtermPromise = Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
      import("@xterm/addon-web-links"),
    ]).then(([xterm, fit, webLinks]) => ({
      Terminal: xterm.Terminal,
      FitAddon: fit.FitAddon,
      WebLinksAddon: webLinks.WebLinksAddon,
    }));
  }
  return xtermPromise;
}

function handleSingleEvent(
  term: TerminalInstance,
  payload: TerminalEventPayload,
  currentOffsetRef: React.MutableRefObject<number>
) {
  const offset = payload.offset;
  const data = payload.data;
  const currentOffset = currentOffsetRef.current;

  if (offset + data.length <= currentOffset) {
    return;
  }
  if (offset < currentOffset) {
    const overlap = currentOffset - offset;
    term.write(data.slice(overlap));
    currentOffsetRef.current = offset + data.length;
  } else {
    term.write(data);
    currentOffsetRef.current = offset + data.length;
  }
}

function processPendingEvents(
  term: TerminalInstance,
  events: TerminalEventPayload[],
  currentOffsetRef: React.MutableRefObject<number>
) {
  const sortedEvents = [...events].sort((a, b) => a.offset - b.offset);
  for (const payload of sortedEvents) {
    handleSingleEvent(term, payload, currentOffsetRef);
  }
}

function executeTauriAutoCommand(
  id: string,
  autoCommand: string | undefined,
  isNew: boolean | undefined,
  disposed: boolean,
  index?: number
) {
  if (isNew && autoCommand) {
    const lineEnding = navigator.userAgent.includes("Windows") ? "\r" : "\r\n";
    const delay = 400 + (index ?? 0) * 150;
    setTimeout(async () => {
      if (!disposed) {
        const { invoke } = await import("@tauri-apps/api/core");
        invoke("write_terminal", {
          id,
          data: `${autoCommand}${lineEnding}`,
        }).catch(() => {
          /* ignore */
        });
      }
    }, delay);
  }
}

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
    term.write("\x1b[1;32mhyperion-demo@web:~$\x1b[0m ");
  }
}

function TerminalPlaceholder({ shellType }: { shellType: string }) {
  const isWin =
    shellType.toLowerCase().includes("cmd") ||
    shellType.toLowerCase().includes("prompt") ||
    shellType.toLowerCase().includes("command");
  const prompt = isWin ? "C:\\Users\\hyperion> " : "hyperion@dev:~$ ";
  const promptColor = isWin ? "text-blue-500/30" : "text-emerald-500/30";

  return (
    <div className="terminal-shimmer-sweep pointer-events-none absolute inset-0 z-10 flex select-none flex-col gap-3 border border-border/10 bg-[#08080a] p-5 font-mono text-xs">
      <div className="flex items-center gap-2 opacity-35">
        <span className="size-2.5 rounded-full bg-red-500/30" />
        <span className="size-2.5 rounded-full bg-yellow-500/30" />
        <span className="size-2.5 rounded-full bg-green-500/30" />
      </div>
      <div className="mt-2 flex animate-pulse items-center gap-2 opacity-50">
        <span className={`${promptColor} font-bold`}>{prompt}</span>
        <div className="h-4 w-32 rounded bg-muted-foreground/10" />
      </div>
      <div className="mt-1 space-y-2 opacity-30">
        <div className="h-3.5 w-[90%] animate-pulse rounded bg-muted-foreground/5 [animation-delay:100ms]" />
        <div className="h-3.5 w-[75%] animate-pulse rounded bg-muted-foreground/5 [animation-delay:200ms]" />
        <div className="h-3.5 w-[80%] animate-pulse rounded bg-muted-foreground/5 [animation-delay:300ms]" />
        <div className="h-3.5 w-[45%] animate-pulse rounded bg-muted-foreground/5 [animation-delay:400ms]" />
      </div>
      <div className="mt-3 flex animate-pulse items-center gap-2 opacity-45 [animation-delay:500ms]">
        <span className={`${promptColor} font-bold`}>{prompt}</span>
        <span className="h-4 w-1.5 animate-pulse bg-muted-foreground/30" />
      </div>
    </div>
  );
}

export const TerminalPane = memo(function TerminalPane({
  id,
  name,
  title,
  isActiveWorkspace = true,
  cwd,
  autoCommand,
  directory,
  index = 0,
  workspaceId,
}: TerminalPaneProps) {
  const mounted = useMounted();
  const registerTerminalFocus = useTerminalFocusStore(
    (s) => s.registerTerminal
  );
  const focusedTerminalId = useTerminalFocusStore((s) => s.focusedTerminalId);
  const setFocusedTerminalId = useTerminalFocusStore(
    (s) => s.setFocusedTerminalId
  );
  const deleteTerminal = useWorkspaceStore((s) => s.deleteTerminal);
  const replaceTerminal = useWorkspaceStore((s) => s.replaceTerminal);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const isFocused = focusedTerminalId === id;

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<TerminalInstance>(null);
  const fitAddonRef = useRef<FitAddonInstance>(null);
  const [shellType, setShellType] = useState("Local Shell");
  const [isTauriEnv, setIsTauriEnv] = useState(false);
  const [isTerminalReady, setIsTerminalReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const indexRef = useRef(index);
  indexRef.current = index;

  const handleDeleteConfirm = useCallback(() => {
    if (isFullscreen) {
      setIsFullscreen(false);
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

  useEffect(() => {
    const unregister = registerTerminalFocus(id, () => {
      if (termRef.current) {
        termRef.current.focus();
      } else if (containerRef.current) {
        containerRef.current.focus();
      }
    });
    return () => {
      unregister();
    };
  }, [id, registerTerminalFocus]);

  const inputBufferRef = useRef("");
  const pendingEventsRef = useRef<TerminalEventPayload[]>([]);
  const currentOffsetRef = useRef<number>(0);
  const isInitializedRef = useRef<boolean>(false);
  const currentInstanceIdRef = useRef<number>(0);
  const isResettingRef = useRef<boolean>(false);

  useEffect(() => {
    const checkEnvironment = async () => {
      try {
        const { isTauri } = await import("@tauri-apps/api/core");
        if (isTauri()) {
          setIsTauriEnv(true);
          if (navigator.userAgent.includes("Windows")) {
            setShellType("Command Prompt");
          } else {
            setShellType("Bash Shell");
          }
        } else {
          setShellType("Mock Shell (Web)");
        }
      } catch {
        setShellType("Mock Shell (Web)");
      }
    };
    checkEnvironment();
  }, []);

  const handleMockCommand = useCallback(
    (cmd: string, term: TerminalInstance) => {
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
            "   \x1b[1;35m/\\_/\\[0m      \x1b[1;36mhyperion-demo@web\x1b[0m"
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
          term.writeln(`hyperion-shell: command not found: ${name}`);
      }
    },
    []
  );

  const setupMockShell = useCallback(
    (term: TerminalInstance) => {
      term.writeln("\x1b[1;35mHyperion Web Shell Terminal\x1b[0m");
      term.writeln(
        "Interactive mock sandbox active. Try: \x1b[1;36mneofetch\x1b[0m, \x1b[1;36mhelp\x1b[0m, \x1b[1;36mclear\x1b[0m.\r\n"
      );
      term.write("\x1b[1;32mhyperion-demo@web:~$\x1b[0m ");

      term.onData((data: string) => {
        if (!termRef.current) {
          return;
        }

        for (const char of data) {
          if (char === "\r") {
            const cmd = inputBufferRef.current.trim();
            term.write("\r\n");
            handleMockCommand(cmd, term);
            inputBufferRef.current = "";
            term.write("\x1b[1;32mhyperion-demo@web:~$\x1b[0m ");
          } else if (char === "\u007f") {
            if (inputBufferRef.current.length > 0) {
              inputBufferRef.current = inputBufferRef.current.slice(0, -1);
              term.write("\b \b");
            }
          } else {
            inputBufferRef.current += char;
            term.write(char);
          }
        }
      });
    },
    [handleMockCommand]
  );

  useEffect(() => {
    if (!(mounted && containerRef.current)) {
      return;
    }

    let disposed = false;
    let observer: ResizeObserver | undefined;
    let unlistenStdout: (() => void) | undefined;
    let unregisterFit: (() => void) | undefined;

    async function setupTauri(term: TerminalInstance) {
      const { isTauri, invoke } = await import("@tauri-apps/api/core");
      const { listen } = await import("@tauri-apps/api/event");

      if (!isTauri() || disposed) {
        return { isTauriActive: false };
      }

      unlistenStdout = await listen<TerminalEventPayload>(
        `terminal-stdout-${id}`,
        async (event) => {
          if (disposed) {
            return;
          }
          const payload = event.payload;

          if (
            payload.instance_id &&
            currentInstanceIdRef.current !== 0 &&
            payload.instance_id !== currentInstanceIdRef.current
          ) {
            return;
          }

          if (isInitializedRef.current && !isResettingRef.current) {
            handleSingleEvent(term, payload, currentOffsetRef);
          } else if (
            !isResettingRef.current &&
            (!payload.instance_id ||
              payload.instance_id === currentInstanceIdRef.current)
          ) {
            pendingEventsRef.current.push(payload);
          }
        }
      );

      term.onData((data: string) => {
        if (isResettingRef.current || !isInitializedRef.current) {
          return;
        }
        invoke("write_terminal", { id, data }).catch((err) => {
          if (!isResettingRef.current && isInitializedRef.current) {
            term.writeln(
              `\r\n\x1b[31mError writing to terminal: ${err}\x1b[0m`
            );
          }
        });
      });

      const cols = term.cols > 0 ? term.cols : 80;
      const rows = term.rows > 0 ? term.rows : 24;
      const createRes = await invoke<TerminalCreateResult>("create_terminal", {
        id,
        cols,
        rows,
        cwd,
      });
      if (createRes?.instance_id) {
        currentInstanceIdRef.current = createRes.instance_id;
      }

      const historyInfo = await invoke<TerminalHistoryInfo>(
        "get_terminal_history",
        { id }
      );
      if (!disposed && historyInfo) {
        term.write(historyInfo.history);
        currentOffsetRef.current = historyInfo.total_read;

        processPendingEvents(term, pendingEventsRef.current, currentOffsetRef);
        pendingEventsRef.current = [];
        isInitializedRef.current = true;
      }

      return { isTauriActive: true, isNew: createRes?.is_new };
    }

    async function runTauriSetupWithRetries(
      term: TerminalInstance
    ): Promise<{ isTauriActive: boolean; isNew?: boolean }> {
      let retries = 3;
      while (retries > 0 && !disposed) {
        try {
          const res = await setupTauri(term);
          if (res.isTauriActive) {
            return res;
          }
          return { isTauriActive: false };
        } catch {
          retries--;
          if (retries > 0 && !disposed) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }
      return { isTauriActive: false };
    }

    async function initializeShell(term: TerminalInstance) {
      let res: { isTauriActive: boolean; isNew?: boolean } = {
        isTauriActive: false,
      };
      try {
        res = await runTauriSetupWithRetries(term);
      } catch {
        // ignore
      }

      if (res.isTauriActive) {
        executeTauriAutoCommand(
          id,
          autoCommand,
          res.isNew,
          disposed,
          indexRef.current
        );
      } else if (!disposed) {
        setupMockShell(term);
        executeMockAutoCommand(term, autoCommand, directory, handleMockCommand);
      }

      if (!disposed) {
        setIsTerminalReady(true);
      }
    }

    async function init() {
      const { Terminal, FitAddon, WebLinksAddon } = await loadXterm();

      if (disposed || !containerRef.current) {
        return;
      }

      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: "block",
        fontSize: 13,
        lineHeight: 1.25,
        fontFamily:
          "Geist Mono, JetBrains Mono, Fira Code, Cascadia Code, Consolas, monospace",
        theme: {
          background: "#08080a",
          cursor: "#a1a1aa",
          cursorAccent: "#08080a",
          foreground: "#e4e4e7",
          selectionBackground: "#3f3f46",
          black: "#18181b",
          red: "#f43f5e",
          green: "#10b981",
          yellow: "#f59e0b",
          blue: "#3b82f6",
          magenta: "#a855f7",
          cyan: "#06b6d4",
          white: "#f4f4f5",
        },
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);
      term.open(containerRef.current);

      termRef.current = term;
      fitAddonRef.current = fitAddon;

      term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
        if (isApplicationShortcut(event)) {
          return false;
        }
        return true;
      });

      term.textarea?.addEventListener("focus", () => {
        setFocusedTerminalId(id);
      });

      let lastPtyCols = 0;
      let lastPtyRows = 0;

      async function resizePty(cols: number, rows: number) {
        if (
          isResettingRef.current ||
          !isInitializedRef.current ||
          cols <= 0 ||
          rows <= 0 ||
          (cols === lastPtyCols && rows === lastPtyRows)
        ) {
          return;
        }

        lastPtyCols = cols;
        lastPtyRows = rows;
        try {
          const { isTauri, invoke } = await import("@tauri-apps/api/core");
          if (isTauri() && !disposed) {
            await invoke("resize_terminal", { id, cols, rows });
          }
        } catch {
          // ignore
        }
      }

      function performFit() {
        if (
          disposed ||
          !fitAddonRef.current ||
          !termRef.current ||
          !containerRef.current ||
          containerRef.current.clientWidth === 0 ||
          containerRef.current.clientHeight === 0
        ) {
          return;
        }
        const dims = fitAddonRef.current.proposeDimensions();
        if (
          dims &&
          dims.cols > 0 &&
          dims.rows > 0 &&
          (dims.cols !== termRef.current.cols ||
            dims.rows !== termRef.current.rows)
        ) {
          fitAddonRef.current.fit();
          resizePty(dims.cols, dims.rows);
        }
      }

      unregisterFit = terminalLayoutManager.register(id, performFit);

      requestAnimationFrame(() => {
        performFit();
      });

      observer = new ResizeObserver(() => {
        if (
          !containerRef.current ||
          containerRef.current.clientWidth === 0 ||
          containerRef.current.clientHeight === 0
        ) {
          return;
        }
        terminalLayoutManager.notifyContainerResize();
      });

      if (containerRef.current) {
        observer.observe(containerRef.current);
      }

      await initializeShell(term);
    }

    init();

    return () => {
      disposed = true;
      unregisterFit?.();
      observer?.disconnect();
      termRef.current?.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      if (unlistenStdout) {
        unlistenStdout();
      }
    };
  }, [
    id,
    mounted,
    setupMockShell,
    cwd,
    autoCommand,
    directory,
    handleMockCommand,
  ]);

  useEffect(() => {
    if (isActiveWorkspace) {
      terminalLayoutManager.scheduleBatchFit();
    }
  }, [isActiveWorkspace]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
    terminalLayoutManager.startTransition(350);
  }, []);

  useEffect(() => {
    terminalLayoutManager.startTransition(350);
    const timers = [
      setTimeout(() => {
        if (fitAddonRef.current && containerRef.current) {
          fitAddonRef.current.fit();
          termRef.current?.focus();
        }
      }, 30),
      setTimeout(() => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
        }
      }, 150),
      setTimeout(() => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
        }
      }, 350),
    ];

    return () => timers.forEach(clearTimeout);
  }, [isFullscreen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F11" || e.code === "F11") {
        if (isFocused || isFullscreen) {
          e.preventDefault();
          e.stopPropagation();
          toggleFullscreen();
        }
        return;
      }

      if (e.key === "Escape" && isFullscreen) {
        e.preventDefault();
        e.stopPropagation();
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }, [isFocused, isFullscreen, toggleFullscreen]);

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

  const getBadgeColor = (shell: string) => {
    const s = shell.toLowerCase();
    if (s.includes("powershell")) {
      return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    }
    if (s.includes("prompt") || s.includes("cmd")) {
      return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
    }
    if (s.includes("bash") || s.includes("zsh")) {
      return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
    }
    return "bg-muted/40 text-muted-foreground/60 border border-border/40";
  };

  if (!mounted) {
    return (
      <div className="terminal-scrollbar flex h-full flex-col overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface-elevated)] backdrop-blur-[var(--glass-blur-sm)] shadow-md">
        <div className="flex h-7 shrink-0 items-center justify-between border-b border-[var(--glass-border)] bg-[var(--glass-surface)]/80 px-3">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-[10px] text-muted-foreground/50 tracking-tight">
              {title}
            </span>
          </div>
        </div>
        <div className="relative flex-1 overflow-hidden bg-[#08080a]">
          <TerminalPlaceholder shellType="Local Shell" />
        </div>
      </div>
    );
  }

  return (
    <>
      {isFullscreen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[var(--glass-blur-sm)]"
          onClick={() => setIsFullscreen(false)}
        />
      )}

      <div
        className={
          isFullscreen
            ? "terminal-scrollbar fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#08080a] shadow-2xl p-0"
            : cn(
                "terminal-scrollbar flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-[border-color,box-shadow,background-color] duration-150",
                isFocused
                  ? "border-primary/60 ring-1 ring-primary/30 shadow-lg shadow-primary/10"
                  : "border-border/80 hover:border-border hover:shadow-md"
              )
        }
        onMouseDown={() => {
          setFocusedTerminalId(id);
        }}
      >
        <div
          className={cn(
            "flex h-7 shrink-0 items-center justify-between border-b border-border/60 px-3 transition-colors duration-200",
            isFocused ? "bg-primary/[0.12]" : "bg-[#131316]"
          )}
        >
          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
            <span
              className={cn(
                "truncate font-mono font-semibold text-[10px] tracking-tight transition-colors",
                isFocused
                  ? "font-bold text-primary"
                  : "text-muted-foreground/90"
              )}
            >
              {name ? (
                <>
                  {name}{" "}
                  <span className="font-normal text-muted-foreground/50">
                    · {title}
                  </span>
                </>
              ) : (
                title
              )}
            </span>
            <span
              className={`shrink-0 scale-90 rounded px-1.5 py-0.5 font-bold font-mono text-[8px] uppercase tracking-normal ${getBadgeColor(shellType)}`}
            >
              {shellType}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              className="flex size-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[#e50914]/20 hover:text-[#ff2e4d]"
              onClick={() => setDeleteDialogOpen(true)}
              title="Delete Terminal"
              type="button"
            >
              <Trash2 className="size-3" />
            </button>
            <button
              className="flex size-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={handleReset}
              title="Reset Shell Session (Creates a fresh terminal session)"
              type="button"
            >
              <RotateCcw className="size-3" />
            </button>
            {isFullscreen ? (
              <button
                className="flex size-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={toggleFullscreen}
                title="Exit Fullscreen (F11 / Esc)"
                type="button"
              >
                <Minimize2 className="size-3" />
              </button>
            ) : (
              <button
                className="flex size-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={toggleFullscreen}
                title="Fullscreen Terminal (F11)"
                type="button"
              >
                <Maximize2 className="size-3" />
              </button>
            )}
          </div>
        </div>

        <div
          className="relative flex-1 overflow-hidden bg-[#08080a]"
          onPaste={isFullscreen ? handleImagePaste : undefined}
          style={{ minHeight: 0 }}
        >
          <AnimatePresence initial={false}>
            {!isTerminalReady && (
              <motion.div
                className="absolute inset-0 z-10"
                exit={{
                  opacity: 0,
                }}
                initial={{ opacity: 1 }}
                key="placeholder"
                transition={{
                  duration: 0.15,
                }}
              >
                <TerminalPlaceholder shellType={shellType} />
              </motion.div>
            )}
          </AnimatePresence>
          <div
            className={cn(
              "h-full w-full overflow-hidden transition-opacity duration-150",
              isTerminalReady ? "opacity-100" : "opacity-0"
            )}
          >
            {/* biome-ignore lint/a11y/useSemanticElements: xterm.js container is non-semantic */}
            <div
              aria-label={`${title} terminal`}
              className="h-full w-full overflow-hidden p-1 focus:outline-none terminal-scrollbar"
              ref={containerRef}
              role="textbox"
              tabIndex={0}
            />
          </div>
        </div>
      </div>

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
