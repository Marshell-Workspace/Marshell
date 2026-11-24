/**
 * Marshell UI Skeleton Composites
 *
 * One file of purpose-built skeleton shapes for every loading state in the
 * application.  Each component mirrors the exact dimensions and layout of the
 * real counterpart so there are zero layout shifts when content arrives.
 *
 * Rules followed:
 *  - No fake delays, no fake data, no spinners.
 *  - Shimmer via the shared `marshell-skeleton` class (1.5 s, black/gray only).
 *  - Real loading state only — each component is used only when data is absent.
 *  - No extra colors, gradients, or glow beyond what Skeleton already provides.
 */

import { Skeleton } from "@workspace/ui/components/skeleton";

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────────────────

/** Skeleton for a single workspace item row in the sidebar nav. */
export function WorkspaceItemSkeleton() {
  return (
    <div className="relative px-1.5">
      <div className="flex h-8.5 w-full items-center gap-2 px-1">
        <Skeleton className="size-4 shrink-0 rounded-sm" />
        <Skeleton className="h-3 flex-1 rounded-sm" />
        <Skeleton className="h-4 w-5 rounded-sm" />
      </div>
    </div>
  );
}

/** Skeleton for the sidebar workspace list (open state). */
export function SidebarWorkspacesSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="mt-1.5 space-y-1">
      {Array.from({ length: count }, (_, i) => (
        <WorkspaceItemSkeleton key={i} />
      ))}
    </div>
  );
}

/** Skeleton for the sidebar footer (user row). */
export function SidebarFooterSkeleton() {
  return (
    <div className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2">
      <Skeleton className="size-7 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-2.5 w-24 rounded-sm" />
        <Skeleton className="h-2 w-32 rounded-sm" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

/** Skeleton for the breadcrumb workspace name in the header. */
export function HeaderBreadcrumbSkeleton() {
  return (
    <div className="flex items-center gap-1.5">
      <Skeleton className="h-3 w-16 rounded-sm" />
      <Skeleton className="size-3 rounded-sm opacity-40" />
      <Skeleton className="h-3 w-24 rounded-sm" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Kanban
// ─────────────────────────────────────────────────────────────────────────────

/** Skeleton for a single kanban card. */
export function KanbanCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-[#18181c] p-3 sm:p-3.5">
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-[80%] rounded-sm" />
        <Skeleton className="size-5 shrink-0 rounded-md" />
      </div>
      {/* Description lines */}
      <Skeleton className="h-3 w-full rounded-sm" />
      <Skeleton className="h-3 w-3/4 rounded-sm" />
      {/* Meta row */}
      <div className="flex items-center gap-1.5 pt-1">
        <Skeleton className="h-4 w-14 rounded-full" />
        <div className="ml-auto flex items-center gap-1">
          <Skeleton className="size-2.5 rounded-full" />
          <Skeleton className="h-3 w-10 rounded-sm" />
        </div>
      </div>
      {/* Control bar */}
      <div className="flex items-center justify-between gap-1.5 border-t border-border pt-2">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-12 rounded-md" />
      </div>
    </div>
  );
}

/** Skeleton for a single kanban column (header + a few cards). */
export function KanbanColumnSkeleton({
  cardCount = 2,
}: {
  cardCount?: number;
}) {
  return (
    <div className="relative flex flex-col self-stretch flex-1 min-w-[260px]">
      <div className="relative flex flex-col overflow-hidden rounded-xl border border-border bg-card h-full w-full min-w-[260px]">
        {/* Column accent edge */}
        <div className="absolute inset-x-0 top-0 h-0.5 bg-muted" />

        {/* Column header */}
        <div className="flex shrink-0 items-center justify-between gap-1.5 border-b border-border bg-[#18181c] px-2.5 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Skeleton className="size-1.5 rounded-full" />
            <Skeleton className="h-3 w-20 rounded-sm" />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Skeleton className="h-6 w-7 rounded-control" />
          </div>
        </div>

        {/* Cards */}
        <div className="flex flex-1 flex-col gap-2.5 px-2 pt-3 pb-2">
          {Array.from({ length: cardCount }, (_, i) => (
            <KanbanCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Full kanban board skeleton (4 columns). */
export function KanbanBoardSkeleton() {
  const cardCounts = [3, 2, 1, 2];
  return (
    <div className="relative flex flex-1 gap-2 sm:gap-2.5 overflow-x-auto p-1.5 sm:p-2">
      {cardCounts.map((count, i) => (
        <KanbanColumnSkeleton cardCount={count} key={i} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Terminal
// ─────────────────────────────────────────────────────────────────────────────

/** Skeleton for a single terminal pane (header + content lines). */
export function TerminalPaneSkeleton() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-[#08080a]">
      {/* Terminal header bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-3 py-1.5">
        <div className="flex items-center gap-2">
          {/* Traffic-light dots */}
          <div className="flex gap-1.5">
            <Skeleton className="size-2.5 rounded-full" />
            <Skeleton className="size-2.5 rounded-full" />
            <Skeleton className="size-2.5 rounded-full" />
          </div>
          <Skeleton className="h-3 w-28 rounded-sm" />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="size-5 rounded-md" />
          <Skeleton className="size-5 rounded-md" />
          <Skeleton className="size-5 rounded-md" />
        </div>
      </div>

      {/* Terminal content lines */}
      <div className="flex flex-1 flex-col gap-2.5 p-4 font-mono">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-32 rounded-sm opacity-60" />
          <Skeleton className="h-3 w-28 rounded-sm" />
        </div>
        <Skeleton className="h-3 w-[85%] rounded-sm opacity-40" />
        <Skeleton className="h-3 w-[70%] rounded-sm opacity-35" />
        <Skeleton className="h-3 w-[90%] rounded-sm opacity-30" />
        <Skeleton className="h-3 w-[55%] rounded-sm opacity-25" />
        <div className="mt-2 flex items-center gap-2">
          <Skeleton className="h-3 w-32 rounded-sm opacity-60" />
          <Skeleton className="h-3.5 w-1.5 rounded-sm opacity-70" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton for the terminal grid (1 or 2 panes side-by-side). */
export function TerminalGridSkeleton({
  paneCount = 1,
}: {
  paneCount?: number;
}) {
  const isMulti = paneCount > 1;
  return (
    <div
      className={
        isMulti
          ? "absolute inset-0 grid grid-cols-2 gap-1.5 sm:gap-2 overflow-hidden p-0"
          : "absolute inset-0 grid grid-cols-1 overflow-hidden p-0"
      }
    >
      {Array.from({ length: Math.min(paneCount, 4) }, (_, i) => (
        <TerminalPaneSkeleton key={i} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Process list
// ─────────────────────────────────────────────────────────────────────────────

/** Skeleton for a single process row. */
export function ProcessRowSkeleton() {
  return (
    <li className="flex flex-col gap-1 rounded-card border border-border bg-card p-2.5">
      <div className="flex items-center gap-2">
        <Skeleton className="size-2 shrink-0 rounded-full" />
        <Skeleton className="h-3 flex-1 max-w-[60%] rounded-sm" />
        <Skeleton className="h-3 w-12 rounded-sm" />
      </div>
      <div className="flex items-center gap-2 pl-4">
        <Skeleton className="h-2.5 flex-1 max-w-[40%] rounded-sm opacity-60" />
        <div className="ml-auto flex gap-1">
          <Skeleton className="h-5 w-8 rounded-control" />
          <Skeleton className="h-5 w-10 rounded-control" />
          <Skeleton className="h-5 w-12 rounded-control" />
        </div>
      </div>
    </li>
  );
}

/** Skeleton for the process list panel. */
export function ProcessListSkeleton({ rowCount = 3 }: { rowCount?: number }) {
  return (
    <ul className="flex flex-col gap-1.5 p-3">
      {Array.from({ length: rowCount }, (_, i) => (
        <ProcessRowSkeleton key={i} />
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent / Orchestrator cards
// ─────────────────────────────────────────────────────────────────────────────

/** Skeleton for a single agent profile card. */
export function AgentCardSkeleton() {
  return (
    <div className="rounded-none border-0 bg-transparent py-0 shadow-none">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          {/* Avatar + name/badges */}
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-6 shrink-0 rounded-md" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-28 rounded-sm" />
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-4 w-12 rounded-full" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
            </div>
          </div>
          {/* Action badge */}
          <Skeleton className="h-5 w-14 shrink-0 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton for the agents tab grid. */
export function AgentsTabSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-0 divide-y divide-[#232326] rounded-xl border border-border overflow-hidden">
      {Array.from({ length: count }, (_, i) => (
        <AgentCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Home / Dashboard stats
// ─────────────────────────────────────────────────────────────────────────────

/** Skeleton for a single stat card on the home dashboard. */
export function StatCardSkeleton() {
  return (
    <div className="glass-panel-elevated flex flex-col gap-2 rounded-2xl p-4 sm:p-5">
      <Skeleton className="h-2.5 w-20 rounded-sm opacity-70" />
      <Skeleton className="h-8 w-16 rounded-md" />
      <Skeleton className="h-2.5 w-28 rounded-sm opacity-50" />
    </div>
  );
}

/** Skeleton for the full stats strip (4 stat cards). */
export function StatStripSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {Array.from({ length: 4 }, (_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic list / table rows
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generic skeleton row that matches a typical 3-column list item
 * (icon · label · action).  Used in audit logs, integration lists, etc.
 */
export function ListRowSkeleton({
  cols = 3,
  className,
}: {
  cols?: 2 | 3 | 4;
  className?: string;
}) {
  const DEFAULT_WIDTHS = ["w-4", "w-1/2", "w-1/5"];
  const widths: Record<number, string[]> = {
    2: ["w-1/2", "w-1/4"],
    3: DEFAULT_WIDTHS,
    4: ["w-4", "w-1/3", "w-1/4", "w-1/6"],
  };
  const ws = widths[cols] ?? DEFAULT_WIDTHS;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 ${className ?? ""}`}
    >
      {ws.map((w, i) => (
        <Skeleton className={`h-3 shrink-0 rounded-sm ${w}`} key={i} />
      ))}
    </div>
  );
}

/** Multiple list rows skeleton. */
export function ListSkeleton({
  rowCount = 4,
  cols = 3,
}: {
  cols?: 2 | 3 | 4;
  rowCount?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5 p-3">
      {Array.from({ length: rowCount }, (_, i) => (
        <ListRowSkeleton cols={cols} key={i} />
      ))}
    </div>
  );
}
