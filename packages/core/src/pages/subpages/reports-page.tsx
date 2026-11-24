"use client";

import { useMounted } from "@workspace/core/hooks/use-mounted";
import { formatTimeAgo } from "@workspace/core/lib/utils";
import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import { useTranslations } from "@workspace/i18n";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { FileText, Pin, SquareTerminal } from "lucide-react";

export function ReportsPage() {
  const t = useTranslations("ReportsPage");
  const mounted = useMounted();

  const workspaces = useWorkspaceStore((s) => s.workspaces);

  const sortedWorkspaces = [...workspaces].sort(
    (a, b) => b.createdAt - a.createdAt
  );

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6 sm:p-10">
      <h1 className="sr-only">{t("title")}</h1>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
            Reports
          </span>
          <h2 className="text-balance font-display text-2xl text-foreground tracking-tight sm:text-3xl">
            Workspace report
          </h2>
          <p className="max-w-xl text-balance text-muted-foreground text-sm leading-relaxed">
            A point-in-time summary of every workspace you&apos;ve created,
            newest first.
          </p>
        </div>

        <div className="liquid-glass-refract glass-panel-elevated flex flex-col rounded-2xl">
          {/* Header row */}
          <div className="hidden grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-glass-border-subtle border-b px-5 py-3 sm:grid">
            <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
              Workspace
            </span>
            <span className="w-20 text-right font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
              Terminals
            </span>
            <span className="w-16 text-right font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
              Pinned
            </span>
            <span className="w-24 text-right font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
              Created
            </span>
          </div>

          {mounted ? (
            sortedWorkspaces.length === 0 ? (
              <Empty className="py-12">
                <EmptyMedia variant="icon">
                  <FileText className="size-6 text-muted-foreground/60" />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle className="text-sm">
                    Nothing to report yet
                  </EmptyTitle>
                  <EmptyDescription className="text-xs">
                    Create a workspace to start building your first report.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-col divide-y divide-glass-border-subtle">
                {sortedWorkspaces.map((ws) => (
                  <div
                    className="grid grid-cols-2 items-center gap-3 px-5 py-3 transition-colors hover:bg-glass-surface-hover sm:grid-cols-[1fr_auto_auto_auto] sm:gap-4"
                    key={ws.id}
                  >
                    <div className="col-span-2 flex min-w-0 items-center gap-2.5 sm:col-span-1">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-glass-border-subtle bg-glass-surface-hover">
                        <SquareTerminal className="size-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-foreground text-xs">
                          {ws.name}
                        </span>
                        {ws.directory && (
                          <span className="truncate font-mono text-[10px] text-muted-foreground">
                            {ws.directory}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="w-20 text-right text-foreground text-xs tabular-nums">
                      {ws.panes.length}
                    </span>

                    <span className="flex w-16 items-center justify-end">
                      {ws.isPinned ? (
                        <Pin className="size-3.5 fill-current text-amber-400" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground/50">
                          —
                        </span>
                      )}
                    </span>

                    <span className="w-24 text-right text-[11px] text-muted-foreground">
                      {formatTimeAgo(ws.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="flex flex-col gap-3 p-5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton className="h-8 w-full rounded-lg" key={i} />
              ))}
            </div>
          )}
        </div>

        {mounted && sortedWorkspaces.length > 0 && (
          <p className="text-[11px] text-muted-foreground/70">
            {sortedWorkspaces.length}{" "}
            {sortedWorkspaces.length === 1 ? "workspace" : "workspaces"}{" "}
            reported · generated {new Date().toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
