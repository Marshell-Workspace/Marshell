"use client";

import { useMounted } from "@workspace/core/hooks/use-mounted";
import { useKanbanStore } from "@workspace/core/stores/kanban-store";
import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import { useTranslations } from "@workspace/i18n";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/utils";
import { BarChart3, CheckCircle2, TrendingUp } from "lucide-react";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const CHART_BAR_COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

function buildLast7Days(createdAt: number[]): {
  count: number;
  dow: number;
  key: string;
}[] {
  const days: { count: number; dow: number; key: string }[] = [];
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  for (let i = 6; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    const startOfDay = new Date(day);
    startOfDay.setHours(0, 0, 0, 0);
    const key = startOfDay.toDateString();
    const count = createdAt.filter((ts) => {
      const d = new Date(ts);
      return d.toDateString() === key;
    }).length;
    days.push({ key, count, dow: startOfDay.getDay() });
  }
  return days;
}

export function AnalyticsPage() {
  const t = useTranslations("AnalyticsPage");
  const mounted = useMounted();

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const cards = useKanbanStore((s) => s.cards);

  const last7Days = buildLast7Days(cards.map((c) => c.createdAt));
  const maxDayCount = Math.max(1, ...last7Days.map((d) => d.count));
  const createdThisWeek = last7Days.reduce((sum, d) => sum + d.count, 0);

  const doneCount = cards.filter((c) => c.columnId === "done").length;
  const completionRate =
    cards.length === 0 ? 0 : Math.round((doneCount / cards.length) * 100);

  const busiestWorkspaces = [...workspaces]
    .sort((a, b) => b.panes.length - a.panes.length)
    .slice(0, 5);
  const maxPaneCount = Math.max(
    1,
    ...busiestWorkspaces.map((w) => w.panes.length)
  );

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6 sm:p-10">
      <h1 className="sr-only">{t("title")}</h1>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-2">
          <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
            Analytics
          </span>
          <h2 className="text-balance font-display text-2xl text-foreground tracking-tight sm:text-3xl">
            Activity trends
          </h2>
          <p className="max-w-xl text-balance text-muted-foreground text-sm leading-relaxed">
            How work has moved through your board and workspaces recently.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* 7-day task creation */}
          <div className="liquid-glass-refract glass-panel-elevated col-span-1 flex flex-col gap-5 rounded-2xl p-5 lg:col-span-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h3 className="font-display text-sm text-foreground">
                  Tasks created
                </h3>
                <p className="text-[11px] text-muted-foreground">Last 7 days</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-glass-border-subtle bg-glass-surface-hover px-2.5 py-1">
                <TrendingUp className="size-3 text-muted-foreground" />
                <span className="font-medium text-foreground text-xs tabular-nums">
                  {createdThisWeek}
                </span>
              </div>
            </div>

            {mounted ? (
              <div className="flex h-32 items-end justify-between gap-2 sm:gap-3">
                {last7Days.map((day, i) => (
                  <div
                    className="flex flex-1 flex-col items-center gap-2"
                    key={day.key}
                  >
                    <div className="flex h-24 w-full items-end justify-center">
                      <div
                        className={cn(
                          "w-full max-w-6 rounded-t-md transition-all duration-500",
                          day.count > 0
                            ? CHART_BAR_COLORS[i % CHART_BAR_COLORS.length]
                            : "bg-glass-surface-hover"
                        )}
                        style={{
                          height: `${Math.max(6, (day.count / maxDayCount) * 100)}%`,
                        }}
                        title={`${day.count} task${day.count === 1 ? "" : "s"}`}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {DAY_LABELS[day.dow]}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Skeleton className="h-32 w-full rounded-xl" />
            )}
          </div>

          {/* Completion rate */}
          <div className="liquid-glass-refract glass-panel-elevated col-span-1 flex flex-col gap-4 rounded-2xl p-5 lg:col-span-2">
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-sm text-foreground">
                Completion rate
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Tasks moved to Done
              </p>
            </div>

            {mounted ? (
              cards.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-4 text-center">
                  <CheckCircle2 className="size-6 text-muted-foreground/50" />
                  <p className="text-[11px] text-muted-foreground">
                    No tasks tracked yet.
                  </p>
                </div>
              ) : (
                <div className="flex flex-1 flex-col justify-center gap-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-4xl text-foreground tracking-tight">
                      {completionRate}%
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {doneCount} of {cards.length} done
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-glass-surface-hover">
                    <div
                      className="h-full rounded-full bg-chart-1 transition-all duration-500"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>
              )
            ) : (
              <Skeleton className="h-24 w-full rounded-xl" />
            )}
          </div>
        </div>

        {/* Busiest workspaces */}
        <div className="liquid-glass-refract glass-panel-elevated flex flex-col gap-4 rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-3.5 text-muted-foreground" />
            <h3 className="font-display text-sm text-foreground">
              Busiest workspaces
            </h3>
          </div>

          {mounted ? (
            busiestWorkspaces.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-muted-foreground">
                Create a workspace with terminals to see it ranked here.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {busiestWorkspaces.map((ws, i) => (
                  <div className="flex items-center gap-3" key={ws.id}>
                    <span className="w-28 shrink-0 truncate text-foreground text-xs">
                      {ws.name}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-glass-surface-hover">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          CHART_BAR_COLORS[i % CHART_BAR_COLORS.length]
                        )}
                        style={{
                          width: `${Math.max(4, (ws.panes.length / maxPaneCount) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                      {ws.panes.length} term.
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton className="h-5 w-full rounded-md" key={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
