"use client";

import { CometBackground } from "@workspace/core/components/common/comet-background";
import { NoWorkspacesHero } from "@workspace/core/components/common/no-workspaces-hero";
import { deriveFirstName } from "@workspace/core/components/panels/account-panel";
import { safeJsonParse } from "@workspace/core/lib/safe-json";
import { useAuthStore } from "@workspace/core/stores/auth-store";
import { Button } from "@workspace/ui/components/button";
import { LayoutGrid, Plus, Terminal as TerminalIcon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

export type WorkspaceEmptyStateMode =
  | "no-workspaces"
  | "no-terminals"
  | "none-selected";

interface WorkspaceEmptyStateProps {
  maxTerminalsReached?: boolean;
  mode: WorkspaceEmptyStateMode;
  onAddTerminal?: () => void;
  onCreateWorkspace?: () => void;
}

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return "Good morning";
  }
  if (hour >= 12 && hour < 17) {
    return "Good afternoon";
  }
  return "Good evening";
}

function useUserFirstName(): string {
  const session = useAuthStore((s) => s.session);

  let rawName = session?.name || "";
  let rawEmail = session?.email || "";

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("marshell_account_profile");
      const parsed = safeJsonParse<{ displayName?: string; email?: string }>(
        raw
      );
      if (parsed?.displayName) {
        rawName = parsed.displayName;
      }
      if (parsed?.email) {
        rawEmail = parsed.email;
      }
    } catch {
      // Ignore parse error
    }
  }

  return deriveFirstName(rawName, rawEmail);
}

export function WorkspaceEmptyState({
  mode,
  onCreateWorkspace,
  onAddTerminal,
  maxTerminalsReached = false,
}: WorkspaceEmptyStateProps) {
  const firstName = useUserFirstName();
  const [greeting, setGreeting] = useState("Good evening");
  const [isMac, setIsMac] = useState(false);
  useReducedMotion();
  useEffect(() => {
    setGreeting(getTimeBasedGreeting());
    if (typeof navigator !== "undefined") {
      setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (mode === "no-workspaces" || mode === "none-selected") &&
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "n"
      ) {
        e.preventDefault();
        onCreateWorkspace?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, onCreateWorkspace]);

  const shortcutKey = isMac ? "⌘ N" : "Ctrl + N";

  if (mode === "none-selected") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-background p-6">
        <div className="flex max-w-md flex-col items-center gap-5 text-center">
          <div className="liquid-glass-refract flex size-14 items-center justify-center rounded-2xl border border-border/40 bg-muted/60 shadow-sm">
            <LayoutGrid className="size-6 text-muted-foreground/80" />
          </div>
          <div className="space-y-2">
            <h2 className="font-bold font-heading text-foreground text-xl tracking-tight">
              Select a Workspace
            </h2>
            <p className="max-w-sm text-muted-foreground text-sm leading-relaxed">
              Choose an active workspace from the left sidebar or create a new
              one to start working.
            </p>
          </div>
          {onCreateWorkspace && (
            <Button
              className="px-5 shadow-lg shadow-primary/10 transition-ui hover:scale-[1.02] active:scale-[0.98]"
              onClick={onCreateWorkspace}
            >
              <Plus className="mr-1.5 size-4" />
              Create Workspace
              <kbd className="ml-2 rounded bg-primary-foreground/20 px-1.5 py-0.5 font-mono text-[10px] text-primary-foreground">
                {shortcutKey}
              </kbd>
            </Button>
          )}
        </div>
      </div>
    );
  }

  // When inside an active workspace with no terminals yet
  if (mode === "no-terminals") {
    return (
      <CometBackground
        className="flex h-full w-full flex-col items-center justify-center p-6 text-center"
        showOrbitalArcs={false}
      >
        <div className="relative z-10 flex max-w-md w-full flex-col items-center justify-center text-center">
          <div className="mb-6 flex items-center justify-center">
            <img
              alt="Marshell"
              className="size-20 object-contain drop-shadow-md marshell-logo-dark"
              src="/main_logo_256.webp"
            />
            <img
              alt="Marshell"
              className="size-20 object-contain drop-shadow-md marshell-logo-light"
              src="/main_logo_light_256.webp"
            />
          </div>
          <h1 className="mb-2 font-display font-semibold text-2xl text-foreground sm:text-3xl tracking-tight leading-tight">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mb-7 font-sans text-muted-foreground text-sm sm:text-base leading-relaxed max-w-xs sm:max-w-sm">
            This workspace is ready for its first terminal.
          </p>
          <div className="flex items-center justify-center w-full">
            <Button
              className="h-10 px-5 font-sans font-medium text-sm bg-primary hover:bg-primary/85 text-primary-foreground shadow-sm transition-colors active:scale-[0.98] cursor-pointer inline-flex items-center justify-center rounded-xl"
              disabled={maxTerminalsReached}
              onClick={onAddTerminal}
            >
              <TerminalIcon className="mr-2 size-4 shrink-0" />
              <span>Add Terminal</span>
            </Button>
          </div>
        </div>
      </CometBackground>
    );
  }

  // Default mode: "no-workspaces": an interactive hero (see NoWorkspacesHero).
  return (
    <NoWorkspacesHero
      greeting={greeting}
      name={firstName}
      onCreateWorkspace={onCreateWorkspace}
    />
  );
}
