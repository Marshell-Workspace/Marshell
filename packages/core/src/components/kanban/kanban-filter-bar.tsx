"use client";

import {
  HighPriorityIcon,
  LowPriorityIcon,
  MediumPriorityIcon,
  UrgentPriorityIcon,
} from "@workspace/core/components/common/custom-icons";
import { PRIORITIES, type Priority } from "@workspace/core/lib/kanban-filter";
import { useKanbanStore } from "@workspace/core/stores/kanban-store";
import { useKanbanUiStore } from "@workspace/core/stores/kanban-ui-store";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { Switch } from "@workspace/ui/components/switch";
import { cn } from "@workspace/ui/lib/utils";
import {
  Check,
  ChevronDown,
  Columns3,
  GitBranch,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react";
import { useMemo } from "react";

export const PRIORITY_CONFIG: Record<
  Priority,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeStyle: string;
    pillActiveStyle: string;
    pillInactiveStyle: string;
  }
> = {
  urgent: {
    label: "Urgent",
    icon: UrgentPriorityIcon,
    badgeStyle:
      "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    pillActiveStyle:
      "border-rose-500/60 bg-rose-500/15 text-rose-700 dark:text-rose-300",
    pillInactiveStyle:
      "border-border text-muted-foreground hover:border-rose-500/40 hover:text-rose-600 dark:hover:text-rose-400",
  },
  high: {
    label: "High",
    icon: HighPriorityIcon,
    badgeStyle:
      "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    pillActiveStyle:
      "border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-300",
    pillInactiveStyle:
      "border-border text-muted-foreground hover:border-amber-500/40 hover:text-amber-600 dark:hover:text-amber-400",
  },
  medium: {
    label: "Medium",
    icon: MediumPriorityIcon,
    badgeStyle:
      "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    pillActiveStyle:
      "border-sky-500/60 bg-sky-500/15 text-sky-700 dark:text-sky-300",
    pillInactiveStyle:
      "border-border text-muted-foreground hover:border-sky-500/40 hover:text-sky-600 dark:hover:text-sky-400",
  },
  low: {
    label: "Low",
    icon: LowPriorityIcon,
    badgeStyle: "border-border bg-muted/60 text-muted-foreground",
    pillActiveStyle: "border-border bg-muted text-foreground",
    pillInactiveStyle:
      "border-border text-muted-foreground hover:border-border-hover hover:text-foreground",
  },
};

const toggle = <T,>(list: T[], item: T) =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

interface KanbanFilterBarProps {
  onOpenSettings?: () => void;
}

export function KanbanFilterBar({ onOpenSettings }: KanbanFilterBarProps) {
  const {
    compactCards,
    filters,
    setCompactCards,
    setFilters,
    viewMode,
    setViewMode,
  } = useKanbanUiStore();
  const cards = useKanbanStore((s) => s.cards);
  const addColumn = useKanbanStore((s) => s.addColumn);

  const allTags = useMemo(
    () => [...new Set(cards.flatMap((c) => c.tags ?? []))].sort(),
    [cards]
  );

  const priorityCounts = useMemo(() => {
    const counts: Record<string, number> = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const c of cards) {
      if (c.priority && c.priority in counts) {
        counts[c.priority] = (counts[c.priority] ?? 0) + 1;
      }
    }
    return counts;
  }, [cards]);

  const selectedPriorityCount = filters.priorities.length;

  return (
    <div className="@container flex items-center justify-between gap-2.5 sm:gap-3.5 w-full select-none min-w-0 py-0.5">
      {/* Left controls: View mode toggles & Search */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 min-w-0">
        {/* Board / List Toggle */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            aria-label="Board view"
            aria-pressed={viewMode === "board"}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-[8px] px-2.5 sm:px-3 text-[13px] font-medium cursor-pointer transition-colors shrink-0",
              viewMode === "board"
                ? "border border-[var(--tb-control-border)] bg-[var(--tb-control-bg)] text-[var(--tb-text)] shadow-xs"
                : "border border-transparent bg-transparent text-[var(--tb-muted)] hover:text-[var(--tb-text)]"
            )}
            onClick={() => setViewMode("board")}
            type="button"
          >
            <Columns3 className="size-4 stroke-[1.8] text-[var(--tb-icon)] shrink-0" />
            <span className="hidden @[460px]:inline">Board</span>
          </button>
          <button
            aria-label="List view"
            aria-pressed={viewMode === "list"}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-[8px] px-2.5 sm:px-3 text-[13px] font-medium cursor-pointer transition-colors shrink-0",
              viewMode === "list"
                ? "border border-[var(--tb-control-border)] bg-[var(--tb-control-bg)] text-[var(--tb-text)] shadow-xs"
                : "border border-transparent bg-transparent text-[var(--tb-muted)] hover:text-[var(--tb-text)]"
            )}
            onClick={() => setViewMode("list")}
            type="button"
          >
            <List className="size-4 stroke-[1.8] text-[var(--tb-icon)] shrink-0" />
            <span className="hidden @[460px]:inline">List</span>
          </button>
        </div>

        {/* Responsive Search Input */}
        <div className="relative w-[130px] sm:w-[170px] @[780px]:w-[210px] shrink-0">
          <Search className="pointer-events-none absolute left-2.5 sm:left-3 top-2.5 size-4 stroke-[1.8] text-[var(--tb-muted)] shrink-0" />
          <input
            aria-label="Search tasks"
            className="h-9 w-full rounded-[8px] border-0 bg-[var(--tb-search-bg)] pr-7 sm:pr-8 pl-8 sm:pl-9 text-[13px] text-[var(--tb-text)] placeholder:text-[var(--tb-muted)] outline-none transition-colors focus:ring-1 focus:ring-[var(--tb-chip-border)]"
            onChange={(e) => setFilters({ query: e.target.value })}
            placeholder="Search tasks..."
            value={filters.query}
          />
          {filters.query && (
            <button
              aria-label="Clear search"
              className="absolute right-2 sm:right-2.5 top-2.5 text-[var(--tb-muted)] hover:text-[var(--tb-text)] cursor-pointer"
              onClick={() => setFilters({ query: "" })}
              type="button"
            >
              <X className="size-3.5 stroke-[1.8]" />
            </button>
          )}
        </div>
      </div>

      {/* Center controls: Filter dropdowns aligned center in the top */}
      <div className="flex flex-1 items-center justify-center gap-2 sm:gap-2.5 min-w-0 px-1 overflow-x-auto no-scrollbar">
        {/* Priority Filter with medium bars icon */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              aria-label="Filter by priority"
              className={cn(
                "flex h-9 items-center gap-2 sm:gap-2.5 rounded-[8px] border border-[var(--tb-control-border)] bg-[var(--tb-control-bg)] px-3 sm:px-3.5 text-[13px] font-medium text-[var(--tb-text)] shadow-xs hover:border-[var(--tb-chip-border)] transition-colors cursor-pointer shrink-0",
                selectedPriorityCount > 0 && "border-[var(--tb-chip-border)]"
              )}
              type="button"
            >
              {/* Medium bars icon */}
              <div className="inline-flex items-end gap-[1.5px] h-3.5 shrink-0">
                <span className="w-[2.5px] h-[5px] rounded-[1px] bg-[#f5b83d]" />
                <span className="w-[2.5px] h-[9px] rounded-[1px] bg-[#f5b83d]" />
                <span className="w-[2.5px] h-[13px] rounded-[1px] bg-[var(--tb-inactive-priority-bar)]" />
              </div>
              <span className="hidden @[660px]:inline">Priority</span>
              {selectedPriorityCount > 0 && (
                <span className="flex size-4 items-center justify-center rounded-full bg-[var(--tb-count-badge)] font-semibold text-[10px] text-[var(--tb-text)]">
                  {selectedPriorityCount}
                </span>
              )}
              <ChevronDown className="size-3.5 stroke-[1.8] text-[var(--tb-muted)] shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[240px] rounded-[12px] border border-[var(--tb-popover-border)] bg-[var(--tb-popover-bg)] p-2 shadow-[var(--tb-popover-shadow)] text-[var(--tb-text)]"
            sideOffset={6}
          >
            <div className="flex items-center justify-between border-b border-[var(--tb-dashed-divider)] pb-2 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tb-muted)]">
                Priority
              </span>
              <div className="flex items-center gap-2 text-xs">
                <button
                  className="text-xs text-[var(--tb-muted)] hover:text-[var(--tb-text)] cursor-pointer transition-colors"
                  onClick={() => setFilters({ priorities: [...PRIORITIES] })}
                  type="button"
                >
                  All
                </button>
                <button
                  className="text-xs text-[var(--tb-muted)] hover:text-[var(--tb-text)] disabled:opacity-40 cursor-pointer transition-colors"
                  disabled={selectedPriorityCount === 0}
                  onClick={() => setFilters({ priorities: [] })}
                  type="button"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              {PRIORITIES.map((priority) => {
                const cfg = PRIORITY_CONFIG[priority];
                const isChecked = filters.priorities.includes(priority);
                const count = priorityCounts[priority] ?? 0;
                return (
                  <label
                    className="flex items-center justify-between rounded-[7px] px-2 py-1.5 text-[13px] text-[var(--tb-text)] hover:bg-[var(--tb-popover-hover)] cursor-pointer transition-colors"
                    key={priority}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        checked={isChecked}
                        className="size-3.5 rounded border-[var(--tb-checkbox-border)] text-[#16a34a] focus:ring-0 cursor-pointer"
                        onChange={() =>
                          setFilters({
                            priorities: toggle(filters.priorities, priority),
                          })
                        }
                        type="checkbox"
                      />
                      <span>{cfg.label}</span>
                    </div>
                    <span className="text-[11px] text-[var(--tb-muted)] tabular-nums">
                      {count}
                    </span>
                  </label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* Any branch / worktree Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              aria-label="Filter by branch or worktree"
              className={cn(
                "flex h-9 items-center gap-2 sm:gap-2.5 rounded-[8px] border border-[var(--tb-control-border)] bg-[var(--tb-control-bg)] px-3 sm:px-3.5 text-[13px] font-medium text-[var(--tb-text)] shadow-xs hover:border-[var(--tb-chip-border)] transition-colors cursor-pointer shrink-0",
                filters.worktree !== "all" && "border-[var(--tb-chip-border)]"
              )}
              type="button"
            >
              <GitBranch className="size-4 stroke-[1.8] text-[var(--tb-icon)] shrink-0" />
              {filters.worktree === "has" ? (
                <>
                  <span className="hidden @[660px]:inline">Has worktree</span>
                  <span className="hidden @[540px]:inline @[660px]:hidden">
                    Worktree
                  </span>
                </>
              ) : filters.worktree === "none" ? (
                <>
                  <span className="hidden @[660px]:inline">No worktree</span>
                  <span className="hidden @[540px]:inline @[660px]:hidden">
                    None
                  </span>
                </>
              ) : (
                <>
                  <span className="hidden @[880px]:inline">
                    Any branch / worktree
                  </span>
                  <span className="hidden @[540px]:inline @[880px]:hidden">
                    Branch
                  </span>
                </>
              )}
              <ChevronDown className="size-3.5 stroke-[1.8] text-[var(--tb-muted)] shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[200px] rounded-[12px] border border-[var(--tb-popover-border)] bg-[var(--tb-popover-bg)] p-1.5 shadow-[var(--tb-popover-shadow)] text-[var(--tb-text)]"
            sideOffset={6}
          >
            <button
              className="flex w-full items-center justify-between rounded-[7px] px-2.5 py-1.5 text-[13px] text-[var(--tb-text)] hover:bg-[var(--tb-popover-hover)] cursor-pointer transition-colors"
              onClick={() => setFilters({ worktree: "all" })}
              type="button"
            >
              <span>Any branch / worktree</span>
              {filters.worktree === "all" && (
                <Check className="size-3.5 stroke-[1.8] text-[var(--tb-diff-add)]" />
              )}
            </button>
            <button
              className="flex w-full items-center justify-between rounded-[7px] px-2.5 py-1.5 text-[13px] text-[var(--tb-text)] hover:bg-[var(--tb-popover-hover)] cursor-pointer transition-colors"
              onClick={() => setFilters({ worktree: "has" })}
              type="button"
            >
              <span>Has worktree</span>
              {filters.worktree === "has" && (
                <Check className="size-3.5 stroke-[1.8] text-[var(--tb-diff-add)]" />
              )}
            </button>
            <button
              className="flex w-full items-center justify-between rounded-[7px] px-2.5 py-1.5 text-[13px] text-[var(--tb-text)] hover:bg-[var(--tb-popover-hover)] cursor-pointer transition-colors"
              onClick={() => setFilters({ worktree: "none" })}
              type="button"
            >
              <span>No worktree</span>
              {filters.worktree === "none" && (
                <Check className="size-3.5 stroke-[1.8] text-[var(--tb-diff-add)]" />
              )}
            </button>
          </PopoverContent>
        </Popover>

        {/* Tags Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              aria-label="Filter by tags"
              className={cn(
                "flex h-9 items-center gap-2 sm:gap-2.5 rounded-[8px] border border-[var(--tb-control-border)] bg-[var(--tb-control-bg)] px-3 sm:px-3.5 text-[13px] font-medium text-[var(--tb-text)] shadow-xs hover:border-[var(--tb-chip-border)] transition-colors cursor-pointer shrink-0",
                filters.tags.length > 0 && "border-[var(--tb-chip-border)]"
              )}
              type="button"
            >
              <Tag className="size-4 stroke-[1.8] text-[var(--tb-icon)] shrink-0" />
              <span className="hidden @[660px]:inline">Tags</span>
              {filters.tags.length > 0 && (
                <span className="flex size-4 items-center justify-center rounded-full bg-[var(--tb-count-badge)] font-semibold text-[10px] text-[var(--tb-text)]">
                  {filters.tags.length}
                </span>
              )}
              <ChevronDown className="size-3.5 stroke-[1.8] text-[var(--tb-muted)] shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[220px] rounded-[12px] border border-[var(--tb-popover-border)] bg-[var(--tb-popover-bg)] p-2 shadow-[var(--tb-popover-shadow)] text-[var(--tb-text)]"
            sideOffset={6}
          >
            <div className="flex items-center justify-between border-b border-[var(--tb-dashed-divider)] pb-2 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tb-muted)]">
                Filter Tags
              </span>
              {filters.tags.length > 0 && (
                <button
                  className="text-xs text-[var(--tb-muted)] hover:text-[var(--tb-text)] cursor-pointer transition-colors"
                  onClick={() => setFilters({ tags: [] })}
                  type="button"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {allTags.length === 0 ? (
                <span className="text-xs text-[var(--tb-muted)] p-1">
                  No tags available
                </span>
              ) : (
                allTags.map((tag) => {
                  const isChecked = filters.tags.includes(tag);
                  return (
                    <label
                      className="flex items-center gap-2 rounded-[7px] px-2 py-1.5 text-[13px] text-[var(--tb-text)] hover:bg-[var(--tb-popover-hover)] cursor-pointer transition-colors"
                      key={tag}
                    >
                      <input
                        checked={isChecked}
                        className="size-3.5 rounded border-[var(--tb-checkbox-border)] text-[#16a34a] focus:ring-0 cursor-pointer"
                        onChange={() =>
                          setFilters({ tags: toggle(filters.tags, tag) })
                        }
                        type="checkbox"
                      />
                      <span>#{tag}</span>
                    </label>
                  );
                })
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Right-aligned Display Settings and Add Column buttons */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto sm:ml-2">
        <Popover>
          <PopoverTrigger asChild>
            <button
              aria-label="Display and settings"
              className="flex size-9 items-center justify-center rounded-[8px] border border-[var(--tb-control-border)] bg-[var(--tb-control-bg)] text-[var(--tb-icon)] shadow-xs hover:text-[var(--tb-text)] transition-colors cursor-pointer shrink-0"
              type="button"
            >
              <SlidersHorizontal className="size-4 stroke-[1.8] shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[230px] rounded-[12px] border border-[var(--tb-popover-border)] bg-[var(--tb-popover-bg)] p-3 shadow-[var(--tb-popover-shadow)] text-[var(--tb-text)]"
            sideOffset={6}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tb-muted)] mb-2.5">
              Display
            </div>
            <div className="flex flex-col gap-2.5 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[var(--tb-text)]">
                  Compact cards
                </span>
                <Switch
                  checked={compactCards}
                  onCheckedChange={setCompactCards}
                  size="sm"
                />
              </div>
              {onOpenSettings && (
                <>
                  <div className="h-px bg-[var(--tb-dashed-divider)] my-1" />
                  <button
                    className="flex items-center justify-between rounded-[7px] px-2 py-1.5 text-[13px] font-medium text-[var(--tb-text)] hover:bg-[var(--tb-popover-hover)] cursor-pointer transition-colors"
                    onClick={onOpenSettings}
                    type="button"
                  >
                    <span>Settings</span>
                    <ChevronDown className="size-3.5 -rotate-90 stroke-[1.8]" />
                  </button>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Primary "+ Add column" button */}
        <button
          aria-label="Add column"
          className="flex h-9 items-center gap-1.5 rounded-[8px] bg-[var(--tb-btn-primary-bg)] px-2.5 sm:px-3.5 text-[13px] font-medium text-[var(--tb-btn-primary-text)] hover:opacity-90 active:scale-[0.98] tb-surface-transition cursor-pointer shrink-0 whitespace-nowrap"
          onClick={() => addColumn("New Column")}
          type="button"
        >
          <Plus className="size-4 stroke-[1.8] shrink-0" />
          <span className="hidden @[420px]:inline">Add column</span>
        </button>
      </div>
    </div>
  );
}
