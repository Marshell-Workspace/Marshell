"use client";

import { checkIsNativeApp } from "@workspace/core/lib/notification-service";
import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { RefreshCcw, Server, Terminal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SettingRow, SettingsSectionHeading } from "./setting-row";

type CheckState = "ok" | "bad" | "warn" | "unknown";

const STATE_DOT: Record<CheckState, string> = {
  ok: "bg-emerald-500",
  bad: "bg-destructive",
  warn: "bg-amber-500",
  unknown: "bg-muted-foreground/40",
};

function StatusBadge({ label, state }: { label: string; state: CheckState }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        state === "bad" ? "text-destructive" : "text-foreground"
      )}
    >
      <span className={cn("size-1.5 rounded-full", STATE_DOT[state])} />
      {label}
    </span>
  );
}

const COOLDOWN_SECONDS = 10;

export function SystemHealthCard() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const [native, setNative] = useState(false);
  const [checkedOnce, setCheckedOnce] = useState(false);
  const [backendOk, setBackendOk] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const inFlight = useRef(false);

  useEffect(() => {
    setNative(checkIsNativeApp());
  }, []);

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return;
    }
    const id = setTimeout(() => setCooldownSeconds((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldownSeconds]);

  const checkAllHealth = useCallback(async () => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setCheckingHealth(true);

    const isNative = checkIsNativeApp();
    let ok = false;

    if (isNative) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("greet", { name: "HealthCheck" });
        ok = true;
      } catch (err: unknown) {
        console.warn("Backend IPC check failed:", err);
      }
    }

    setBackendOk(ok);
    inFlight.current = false;
    setCheckingHealth(false);
    setCheckedOnce(true);
    setCooldownSeconds(COOLDOWN_SECONDS);

    if (isNative && !ok) {
      toast.error("System health: native backend IPC check failed");
    }
  }, []);

  useEffect(() => {
    checkAllHealth();
  }, [checkAllHealth]);

  const backendState: CheckState = native
    ? checkedOnce
      ? backendOk
        ? "ok"
        : "bad"
      : "unknown"
    : "unknown";

  const summary = native
    ? checkedOnce
      ? backendOk
        ? "All systems operational"
        : "Subsystem issues detected"
      : "Checking…"
    : "Running in web mode";

  const summaryState: CheckState = native
    ? checkedOnce
      ? backendOk
        ? "ok"
        : "bad"
      : "unknown"
    : "ok";

  const paneCount = activeWorkspace?.panes.length ?? 0;

  const rows = [
    {
      icon: Server,
      title: "Native backend",
      detail: native
        ? "Shell process manager, windowing and file system access."
        : "Only available in the desktop app.",
      state: backendState,
      label: native
        ? {
            ok: "Ready",
            bad: "Offline",
            warn: "Degraded",
            unknown: "Checking",
          }[backendState]
        : "Desktop only",
    },
    {
      icon: Terminal,
      title: "Workspace terminals",
      detail: activeWorkspace
        ? `${activeWorkspace.name} · ${paneCount} terminal${paneCount === 1 ? "" : "s"}`
        : "No workspace open",
      state: (paneCount > 0 ? "ok" : "unknown") as CheckState,
      label: paneCount > 0 ? `${paneCount} open` : "None open",
    },
  ];

  let runLabel = "Run diagnostics";
  if (checkingHealth) {
    runLabel = "Checking…";
  } else if (cooldownSeconds > 0) {
    runLabel = `Wait ${cooldownSeconds}s`;
  }

  return (
    <div className="w-full space-y-8 text-foreground">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="font-semibold text-xl tracking-tight">
            System health
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Live status of local Marshell services.
          </p>
        </div>
        <Button
          className="h-8 cursor-pointer gap-1.5 px-2 text-muted-foreground text-xs hover:bg-accent hover:text-foreground"
          disabled={checkingHealth || cooldownSeconds > 0}
          onClick={checkAllHealth}
          size="sm"
          type="button"
          variant="ghost"
        >
          <RefreshCcw
            className={cn("size-3.5", checkingHealth && "animate-spin")}
          />
          {runLabel}
        </Button>
      </div>

      <section>
        <SettingsSectionHeading>Status</SettingsSectionHeading>
        <div className="mt-1 border-border border-b py-3.5" role="status">
          <StatusBadge label={summary} state={summaryState} />
        </div>
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <SettingRow
              description={row.detail}
              id={`health-${row.title}`}
              key={row.title}
              label={row.title}
            >
              <span className="flex items-center gap-3">
                <Icon className="size-4 text-muted-foreground" />
                <StatusBadge label={row.label} state={row.state} />
              </span>
            </SettingRow>
          );
        })}
      </section>
    </div>
  );
}
