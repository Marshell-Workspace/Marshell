"use client";

import { Greet } from "@workspace/core/components/common/greet";
import {
  BoardModeIcon,
  SettingsIcon,
  TerminalWindowIcon,
} from "@workspace/core/components/icons/mode-icons";
import { deriveFirstName } from "@workspace/core/components/panels/account-panel";
import { useMounted } from "@workspace/core/hooks/use-mounted";
import { safeJsonParse } from "@workspace/core/lib/safe-json";
import { useAuthStore } from "@workspace/core/stores/auth-store";
import { useKanbanStore } from "@workspace/core/stores/kanban-store";
import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import { useTranslations } from "@workspace/i18n";
import { Link } from "@workspace/i18n/navigation";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { ArrowUpRight, Layers, Sparkles, Wand2 } from "lucide-react";
import { type ComponentType, useEffect, useState } from "react";

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return "Good morning";
  }
  if (hour >= 12 && hour < 17) {
    return "Good afternoon";
  }
  if (hour >= 17 && hour < 22) {
    return "Good evening";
  }
  return "Working late";
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

interface QuickAction {
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    title: "Workspaces",
    description: "Jump back into your project terminals.",
    href: "/workspace",
    icon: Layers,
  },
  {
    title: "Kanban Board",
    description: "Track work in progress across your team.",
    href: "/kanban",
    icon: BoardModeIcon,
  },
  {
    title: "Terminals",
    description: "Open a raw terminal session.",
    href: "/terminals",
    icon: TerminalWindowIcon,
  },
  {
    title: "Settings",
    description: "Tune appearance, performance and preferences.",
    href: "/settings",
    icon: SettingsIcon,
  },
];

function QuickActionCard({ action }: { action: QuickAction }) {
  const Icon = action.icon;

  return (
    <Link
      className="glass-panel group flex flex-col justify-between gap-6 rounded-2xl p-4 transition-ui motion-normal hover:border-glass-border-strong hover:bg-glass-surface-hover hover:shadow-lg active:scale-[0.98]"
      href={action.href}
    >
      <div className="flex items-center justify-between">
        <div className="flex size-9 items-center justify-center rounded-xl border border-glass-border-subtle bg-glass-surface-hover text-foreground">
          <Icon className="size-4.5" />
        </div>
        <ArrowUpRight className="size-4 text-muted-foreground/50 opacity-0 transition-ui motion-normal group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-medium font-display text-foreground text-sm">
          {action.title}
        </span>
        <span className="text-[11px] text-muted-foreground leading-relaxed">
          {action.description}
        </span>
      </div>
    </Link>
  );
}

export function HomePage() {
  const t = useTranslations("HomePage");
  const mounted = useMounted();
  const firstName = useUserFirstName();
  const [greeting, setGreeting] = useState("Welcome back");

  useEffect(() => {
    setGreeting(getTimeBasedGreeting());
  }, []);

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const cards = useKanbanStore((s) => s.cards);

  const terminalCount = workspaces.reduce((sum, w) => sum + w.panes.length, 0);
  const openTasks = cards.filter((c) => c.columnId !== "done").length;
  const doneTasks = cards.filter((c) => c.columnId === "done").length;

  const stats: Array<{
    hint: string;
    label: string;
    value: number;
  }> = [
    {
      label: "Workspaces",
      value: workspaces.length,
      hint: workspaces.length === 0 ? "None yet" : "Ready to resume",
    },
    {
      label: "Terminals",
      value: terminalCount,
      hint: terminalCount === 0 ? "No sessions" : "Across all workspaces",
    },
    {
      label: "Open Tasks",
      value: openTasks,
      hint: cards.length === 0 ? "Board is empty" : `${cards.length} total`,
    },
    {
      label: "Completed",
      value: doneTasks,
      hint: doneTasks === 0 ? "No completed tasks" : "Finished on board",
    },
  ];

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto p-6 sm:p-10">
      <h1 className="sr-only">{t("title")}</h1>

      <div className="flex w-full max-w-5xl flex-col gap-10">
        {/* Hero */}
        <div className="flex flex-col gap-3">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-glass-border-subtle bg-glass-surface px-3 py-1 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
            <Sparkles className="size-3" />
            Marshell
          </span>
          <h2 className="text-balance font-display text-3xl text-foreground tracking-tight sm:text-4xl">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h2>
          <p className="max-w-xl text-balance text-muted-foreground text-sm leading-relaxed sm:text-base">
            Here&apos;s where things stand across your workspaces, terminals,
            and tasks.
          </p>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {stats.map((stat) => (
            <div
              className="liquid-glass-refract glass-panel-elevated flex flex-col gap-2 rounded-2xl p-4 transition-colors sm:p-5"
              key={stat.label}
            >
              <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </span>
              {mounted ? (
                <span className="font-display text-2xl text-foreground tracking-tight sm:text-3xl">
                  {stat.value}
                </span>
              ) : (
                <Skeleton className="h-8 w-16 rounded-md" />
              )}
              <span className="text-[11px] text-muted-foreground/80">
                {stat.hint}
              </span>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="flex flex-col gap-3">
          <h3 className="font-display text-lg text-foreground tracking-tight">
            Quick actions
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_ACTIONS.map((action) => (
              <QuickActionCard action={action} key={action.href} />
            ))}
          </div>
        </div>

        {/* Connectivity check */}
        <details className="glass-panel group rounded-2xl p-4 open:pb-5">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-muted-foreground text-xs">
            <Wand2 className="size-3.5" />
            <span>Run a connectivity check</span>
            <span className="ml-auto text-[10px] text-muted-foreground/60 group-open:hidden">
              Expand
            </span>
          </summary>
          <div className="mt-3">
            <Greet />
          </div>
        </details>
      </div>
    </div>
  );
}
