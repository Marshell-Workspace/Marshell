"use client";

import { useMounted } from "@workspace/core/hooks/use-mounted";
import { formatTimeAgo } from "@workspace/core/lib/utils";
import { useKanbanStore } from "@workspace/core/stores/kanban-store";
import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import { useTranslations } from "@workspace/i18n";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/utils";
import { Folder, KanbanSquare, Layers, SquareTerminal } from "lucide-react";

const COLUMN_META: Record<string, { color: string; label: string }> = {
  backlog: { label: "Backlog", color: "bg-chart-5" },
  "in-progress": { label: "In Progress", color: "bg-chart-3" },
  review: { label: "Review", color: "bg-chart-2" },
  done: { label: "Done", color: "bg-chart-1" },
};

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  mounted,
}: {
  hint: string;
  icon: typeof Layers;
  label: string;
  mounted: boolean;
  value: number;
}) {
  return (
    <div className="liquid-glass-refract glass-panel-elevated flex flex-col gap-3 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <Icon className="size-3.5 text-muted-foreground/60" />
      </div>
      {mounted ? (
        <span className="font-display text-3xl text-foreground tracking-tight">
          {value}
        </span>
      ) : (
        <Skeleton className="h-9 w-14 rounded-md" />
      )}
      <span className="text-[11px] text-muted-foreground/80">{hint}</span>
    </div>
  );
}

export function OverviewPage() {
  const t = useTranslations("OverviewPage");
  const mounted = useMounted();

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const cards = useKanbanStore((s) => s.cards);
  const columns = useKanbanStore((s) => s.columns);

  const terminalCount = workspaces.reduce((sum, w) => sum + w.panes.length, 0);

  const columnCounts = columns.map((col) => ({
    ...col,
    count: cards.filter((c) => c.columnId === col.id).length,
  }));
  const maxColumnCount = Math.max(1, ...columnCounts.map((c) => c.count));

  const recentWorkspaces = [...workspaces]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6 sm:p-10">
      <h1 className="sr-only">{t("title")}</h1>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-2">
          <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
            Overview
          </span>
          <h2 className="text-balance font-display text-2xl text-foreground tracking-tight sm:text-3xl">
            Your workspace at a glance
          </h2>
          <p className="max-w-xl text-balance text-muted-foreground text-sm leading-relaxed">
            A snapshot of every workspace, terminal and task currently in
            motion.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile
            hint={workspaces.length === 0 ? "None yet" : "Across the app"}
            icon={Layers}
            label="Workspaces"
            mounted={mounted}
            value={workspaces.length}
          />
          <StatTile
            hint={terminalCount === 0 ? "No sessions" : "Live sessions"}
            icon={SquareTerminal}
            label="Terminals"
            mounted={mounted}
            value={terminalCount}
          />
          <StatTile
            hint={cards.length === 0 ? "Board is empty" : "On the board"}
            icon={KanbanSquare}
            label="Tasks"
            mounted={mounted}
            value={cards.length}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* Task breakdown */}
          <div className="liquid-glass-refract glass-panel-elevated col-span-1 flex flex-col gap-4 rounded-2xl p-5 lg:col-span-2">
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-sm text-foreground">
                Task breakdown
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Distribution across your kanban columns
              </p>
            </div>

            {mounted ? (
              cards.length === 0 ? (
                <p className="py-6 text-center text-[11px] text-muted-foreground">
                  No tasks yet — add one from the kanban board.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {columnCounts.map((col) => (
                    <div className="flex flex-col gap-1.5" key={col.id}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          {COLUMN_META[col.id]?.label ?? col.title}
                        </span>
                        <span className="font-medium text-foreground tabular-nums">
                          {col.count}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-glass-surface-hover">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            COLUMN_META[col.id]?.color ?? "bg-chart-4"
                          )}
                          style={{
                            width: `${Math.max(4, (col.count / maxColumnCount) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="flex flex-col gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton className="h-4 w-full rounded-full" key={i} />
                ))}
              </div>
            )}
          </div>

          {/* Recent workspaces */}
          <div className="liquid-glass-refract glass-panel-elevated col-span-1 flex flex-col gap-4 rounded-2xl p-5 lg:col-span-3">
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-sm text-foreground">
                Recent workspaces
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Your most recently created workspaces
              </p>
            </div>

            {mounted ? (
              recentWorkspaces.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Folder className="size-6 text-muted-foreground/50" />
                  <p className="text-[11px] text-muted-foreground">
                    No workspaces yet. Create one to see it here.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-glass-border-subtle">
                  {recentWorkspaces.map((ws) => (
                    <div
                      className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                      key={ws.id}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-glass-border-subtle bg-glass-surface-hover">
                          <Layers className="size-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-foreground text-xs">
                            {ws.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {ws.terminalCount}{" "}
                            {ws.terminalCount === 1 ? "terminal" : "terminals"}
                          </span>
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground/80">
                        {formatTimeAgo(ws.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton className="h-11 w-full rounded-xl" key={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
