"use client";

import { PreviewHealthIcon } from "@workspace/core/components/common/custom-icons";
import {
  type HealthItem,
  type HealthStatus,
  summarizeHealth,
} from "@workspace/core/lib/preview-qa";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { cn } from "@workspace/ui/lib/utils";
import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Play,
  Square,
  TriangleAlert,
} from "lucide-react";

export interface SweepResult {
  /** Pixels the page overflows horizontally, or null if the page never reported. */
  overflow: number | null;
  width: number;
}

export interface SweepState {
  onCancel: () => void;
  onRun: () => void;
  results: SweepResult[];
  running: boolean;
}

const STATUS_ICON: Record<HealthStatus, typeof CircleCheck> = {
  error: CircleAlert,
  ok: CircleCheck,
  pending: CircleDashed,
  warn: TriangleAlert,
};

const STATUS_COLOR: Record<HealthStatus, string> = {
  error: "text-destructive",
  ok: "text-emerald-500",
  pending: "text-muted-foreground",
  warn: "text-amber-500",
};

function HealthRow({ item }: { item: HealthItem }) {
  const Icon = STATUS_ICON[item.status];
  return (
    <li className="flex gap-2 py-1">
      <Icon
        aria-hidden="true"
        className={cn("mt-0.5 size-3.5 shrink-0", STATUS_COLOR[item.status])}
      />
      <div className="min-w-0">
        <p className="text-xs">
          <span className="font-medium text-foreground">{item.label}</span>
          <span className="sr-only">{`, ${item.status}`}</span>
          <span className="text-muted-foreground"> · {item.summary}</span>
        </p>
        {item.details.length > 0 && (
          <ul className="mt-0.5 space-y-0.5">
            {item.details.map((line) => (
              <li
                className="truncate font-mono text-[11px] text-muted-foreground"
                key={line}
                title={line}
              >
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/** Secondary diagnostics: kept behind one compact button so the normal UI stays clean. */
export function PreviewHealth({
  items,
  sweep,
}: {
  items: HealthItem[];
  sweep: SweepState;
}) {
  const { errors, warnings } = summarizeHealth(items);
  const problems = errors + warnings;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={
            problems > 0
              ? `Preview health: ${problems} ${problems === 1 ? "issue" : "issues"}`
              : "Preview health: no issues"
          }
          className="relative flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          type="button"
        >
          <PreviewHealthIcon
            className={cn(
              "size-3.5",
              errors > 0
                ? "text-destructive"
                : warnings > 0
                  ? "text-amber-500"
                  : "text-emerald-500"
            )}
          />
          {problems > 0 && (
            <span className="font-medium tabular-nums">{problems}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 sm:w-96 max-w-[calc(100vw-2rem)] p-3"
        collisionPadding={16}
      >
        <p className="mb-1 font-medium text-sm">Preview health</p>
        <ul className="divide-y divide-glass-border-subtle">
          {items.map((item) => (
            <HealthRow item={item} key={item.id} />
          ))}
        </ul>

        <div className="mt-3 border-border border-t pt-2">
          <div className="flex items-center justify-between">
            <p className="font-medium text-xs">Breakpoint sweep</p>
            <button
              className="flex h-6 cursor-pointer items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              onClick={sweep.running ? sweep.onCancel : sweep.onRun}
              type="button"
            >
              {sweep.running ? (
                <>
                  <Square className="size-3" /> Stop
                </>
              ) : (
                <>
                  <Play className="size-3" /> Run
                </>
              )}
            </button>
          </div>
          {sweep.results.length > 0 && (
            <ul className="mt-2 grid grid-cols-3 gap-1">
              {sweep.results.map((r) => (
                <li
                  className={cn(
                    "rounded border px-1.5 py-0.5 font-mono text-[11px]",
                    r.overflow === null
                      ? "border-border text-muted-foreground"
                      : r.overflow > 1
                        ? "border-destructive/50 text-destructive"
                        : "border-emerald-500/40 text-emerald-500"
                  )}
                  key={r.width}
                  title={
                    r.overflow === null
                      ? "No report"
                      : r.overflow > 1
                        ? `${r.overflow}px horizontal overflow`
                        : "No horizontal overflow"
                  }
                >
                  {r.width}px{" "}
                  {r.overflow === null ? "?" : r.overflow > 1 ? "✕" : "✓"}
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
