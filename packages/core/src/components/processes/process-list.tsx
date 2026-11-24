"use client";

import { ProcessesIcon } from "@workspace/core/components/common/custom-icons";
import { ProcessLogViewer } from "@workspace/core/components/processes/process-log-viewer";
import {
  type ProcessInfo,
  type ProcessStatus,
  processClient,
} from "@workspace/core/lib/process-client";
import { splitCommandLine } from "@workspace/core/lib/process-utils";
import {
  refreshProcesses,
  useProcessLive,
} from "@workspace/core/stores/process-live-store";
import { useProcessUiStore } from "@workspace/core/stores/process-ui-store";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { cn } from "@workspace/ui/lib/utils";

import { useId, useRef, useState } from "react";
import { toast } from "sonner";

const LIGHT: Record<ProcessStatus, string> = {
  crashed: "bg-rose-500",
  exited: "bg-muted-foreground",
  running: "bg-emerald-400",
  stopped: "bg-amber-400",
};

/** A stopped process is a normal outcome, not an error — only crashes are red. */
const STATUS_TEXT: Record<ProcessStatus, string> = {
  crashed: "text-rose-400",
  exited: "text-muted-foreground",
  running: "text-emerald-400",
  stopped: "text-amber-400",
};

const ACTION =
  "rounded-control px-2 py-0.5 text-xs text-muted-foreground transition-colors duration-[var(--visual-duration-fast)] hover:bg-glass-surface-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function statusLabel(p: ProcessInfo): string {
  if (p.restartPending) {
    return "restarting…";
  }
  const code =
    p.exitCode !== null && p.status !== "running" ? ` (${p.exitCode})` : "";
  return `${p.status}${code}`;
}

function usageLabel(p: ProcessInfo): string | null {
  if (p.status !== "running" || p.memoryMb === null) {
    return null;
  }
  const cpu = p.cpuPercent === null ? "" : `${Math.round(p.cpuPercent)}% · `;
  return `${cpu}${p.memoryMb} MB`;
}

/** One background process: command, status, live usage and its controls. */
function ProcessRow({
  isSelected,
  onAct,
  onOpenPort,
  onSelect,
  process: p,
}: {
  isSelected: boolean;
  onAct: (work: () => Promise<unknown>) => void;
  onOpenPort?: (port: number) => void;
  onSelect: (id: string | null) => void;
  process: ProcessInfo;
}) {
  return (
    <li
      className={cn(
        "flex flex-col gap-1 rounded-card border p-2.5 transition-colors duration-[var(--visual-duration-fast)]",
        isSelected
          ? "border-glass-border-strong bg-glass-surface-elevated"
          : "border-glass-border-subtle bg-glass-surface hover:border-glass-border"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            "size-2 shrink-0 rounded-chip",
            LIGHT[p.status],
            p.restartPending && "animate-pulse"
          )}
        />
        <button
          className="min-w-0 flex-1 truncate text-left font-mono text-foreground text-xs"
          onClick={() => onSelect(isSelected ? null : p.id)}
          title={p.cwd}
          type="button"
        >
          {p.command}
        </button>
        {p.ports.map((port) =>
          onOpenPort ? (
            <button
              className="shrink-0 rounded-chip border border-emerald-400/50 px-1.5 font-mono text-emerald-400 text-xs hover:bg-emerald-400/10"
              key={port}
              onClick={() => onOpenPort(port)}
              title="Open in the app preview"
              type="button"
            >
              :{port}
            </button>
          ) : (
            <span
              className="shrink-0 rounded-chip border border-emerald-400/50 px-1.5 font-mono text-emerald-400 text-xs"
              key={port}
            >
              :{port}
            </span>
          )
        )}
        <span className={cn("shrink-0 text-xs", STATUS_TEXT[p.status])}>
          {statusLabel(p)}
          {p.restarts > 0 && ` · ↻${p.restarts}`}
        </span>
      </div>

      <div className="flex items-center gap-2 pl-4">
        {/* The working directory is what tells two identical commands apart. */}
        <span
          className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground"
          title={p.cwd}
        >
          {p.cwd}
        </span>
        {usageLabel(p) && (
          <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
            {usageLabel(p)}
          </span>
        )}
        <button
          className={ACTION}
          disabled={p.status !== "running" && !p.restartPending}
          onClick={() => onAct(() => processClient.stop(p.id))}
          type="button"
        >
          Stop
        </button>
        <button
          className={ACTION}
          onClick={() => onAct(() => processClient.restart(p.id))}
          type="button"
        >
          Restart
        </button>
        <button
          className={ACTION}
          disabled={p.status === "running"}
          onClick={() => {
            if (isSelected) {
              onSelect(null);
            }
            onAct(() => processClient.remove(p.id));
          }}
          type="button"
        >
          Remove
        </button>
      </div>

      {p.hint && (
        <p className="pl-4 text-amber-400 text-xs" role="status">
          {p.hint}
        </p>
      )}
    </li>
  );
}

/**
 * Background daemons (dev servers, watchers) run outside the interactive
 * terminals, managed from a centered dialog.
 *
 * The dialog is presentation only: processes are owned by the process store and
 * the Rust supervisor, so closing this never stops anything that is running.
 */
export function ProcessesDrawer({
  directory,
  onOpenPort,
  workspaceId,
}: {
  directory?: string;
  /** Lets a listening port be opened in the app preview. */
  onOpenPort?: (port: number) => void;
  workspaceId: string;
}) {
  const { open, selected, select: setSelected, setOpen } = useProcessUiStore();
  const processes = useProcessLive(workspaceId);
  const [commandLine, setCommandLine] = useState("");
  const [restartOnCrash, setRestartOnCrash] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const commandId = useId();
  const commandRef = useRef<HTMLInputElement>(null);

  const act = async (work: () => Promise<unknown>) => {
    try {
      await work();
    } catch (err) {
      toast.error(errorText(err));
    }
    refreshProcesses(workspaceId);
  };

  const start = async () => {
    const [program, ...args] = splitCommandLine(commandLine);
    if (!program) {
      return;
    }
    setIsStarting(true);
    try {
      if (!directory) {
        throw new Error("This workspace has no folder to run in.");
      }
      const id = await processClient.start(
        workspaceId,
        program,
        args,
        directory,
        { restartOnCrash }
      );
      setSelected(id);
      setCommandLine("");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setIsStarting(false);
      refreshProcesses(workspaceId);
    }
  };

  const running = processes.filter((p) => p.status === "running").length;

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogContent
        className="flex max-h-[85vh] w-[92vw] flex-col gap-0 overflow-hidden border border-border bg-card p-0 shadow-2xl backdrop-blur-xl focus:outline-none sm:max-w-[760px]"
        onOpenAutoFocus={(e) => {
          // Land on the command field rather than the close button.
          e.preventDefault();
          commandRef.current?.focus();
        }}
      >
        <DialogHeader className="flex-shrink-0 gap-3 border-border/60 border-b bg-muted/30 px-5 py-4">
          <div className="flex items-center gap-3 pr-10">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-panel border border-border bg-muted/50 text-muted-foreground shadow-xs">
              <ProcessesIcon className="size-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="select-none font-display font-semibold text-foreground text-lg tracking-tight">
                Background Processes
              </DialogTitle>
              <DialogDescription className="font-sans text-[11px] text-muted-foreground sm:text-xs">
                Run commands independently of the interactive terminals.
                {running > 0 && ` · ${running} running`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Command form — fixed, so it stays reachable however long the list gets. */}
        <form
          className="flex-shrink-0 border-border/60 border-b px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
        >
          <label
            className="mb-1.5 block select-none font-semibold text-[10px] text-muted-foreground uppercase tracking-wider"
            htmlFor={commandId}
          >
            Command
          </label>
          <div className="flex items-center gap-2">
            <Input
              autoComplete="off"
              className="h-9 flex-1 font-mono text-sm"
              id={commandId}
              onChange={(e) => setCommandLine(e.target.value)}
              placeholder="pnpm dev"
              ref={commandRef}
              spellCheck={false}
              value={commandLine}
            />
            <Button
              className="h-9 shrink-0 px-4 text-xs"
              disabled={!commandLine.trim() || isStarting}
              size="sm"
              type="submit"
            >
              {isStarting ? "Starting…" : "Start"}
            </Button>
          </div>
          <div className="mt-2.5 flex w-fit items-center gap-2">
            <Checkbox
              checked={restartOnCrash}
              id={`${commandId}-restart`}
              onCheckedChange={(v) => setRestartOnCrash(v === true)}
            />
            <label
              className="cursor-pointer text-muted-foreground text-xs"
              htmlFor={`${commandId}-restart`}
            >
              Restart if it crashes
            </label>
          </div>
        </form>

        {/* Only the list scrolls, so the header and form never leave the viewport. */}
        <div className="subtle-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {processes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <div className="flex size-10 items-center justify-center rounded-full border border-border bg-muted/50 text-muted-foreground">
                <ProcessesIcon className="size-5" />
              </div>
              <p className="font-medium text-foreground text-sm">
                No background processes
              </p>
              <p className="max-w-xs text-muted-foreground text-xs leading-relaxed">
                Start a command above and it will keep running independently in
                the background.
              </p>
            </div>
          ) : (
            <>
              <h3 className="mb-2 select-none font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
                Processes · {processes.length}
              </h3>
              <ul className="flex flex-col gap-2">
                {processes.map((p) => (
                  <ProcessRow
                    isSelected={selected === p.id}
                    key={p.id}
                    onAct={act}
                    onOpenPort={onOpenPort}
                    onSelect={setSelected}
                    process={p}
                  />
                ))}
              </ul>
              {selected && (
                <div className="mt-3">
                  <ProcessLogViewer key={selected} processId={selected} />
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
