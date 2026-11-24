"use client";

import {
  buildTree,
  type FileDiff,
  type FileStatus,
  type TreeNode,
} from "@workspace/core/lib/diff-parser";
import { cn } from "@workspace/ui/lib/utils";
import { ChevronDown, ChevronRight, FileText, Folder } from "lucide-react";
import { useMemo, useState } from "react";

const STATUS: Record<FileStatus, { color: string; label: string }> = {
  added: { color: "text-emerald-400", label: "A" },
  deleted: { color: "text-rose-400", label: "D" },
  modified: { color: "text-amber-400", label: "M" },
  renamed: { color: "text-sky-400", label: "R" },
};

const Stats = ({
  additions,
  deletions,
}: {
  additions: number;
  deletions: number;
}) => (
  <span className="ml-auto shrink-0 pl-2 font-mono text-[10px] tabular-nums">
    <span className="text-emerald-400">+{additions}</span>{" "}
    <span className="text-rose-400">-{deletions}</span>
  </span>
);

export function ChangedFilesTree({
  files,
  onSelect,
  selected,
  view,
}: {
  files: FileDiff[];
  onSelect: (path: string) => void;
  selected: string | null;
  view: "flat" | "tree";
}) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const fileRow = (file: FileDiff, label: string, depth: number) => (
    <button
      className={cn(
        "flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left text-xs hover:bg-glass-surface-hover",
        selected === file.path && "bg-glass-surface-elevated"
      )}
      key={file.path}
      onClick={() => onSelect(file.path)}
      style={{ paddingLeft: 6 + depth * 12 }}
      type="button"
    >
      <span
        className={cn(
          "font-mono font-semibold text-[10px]",
          STATUS[file.status].color
        )}
      >
        {STATUS[file.status].label}
      </span>
      <FileText className="size-3 shrink-0 text-muted-foreground" />
      <span className="truncate">{label}</span>
      <Stats additions={file.additions} deletions={file.deletions} />
    </button>
  );

  const render = (nodes: TreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      if (node.file) {
        return fileRow(node.file, node.name, depth);
      }
      const isCollapsed = collapsed.has(node.path);
      return (
        <div key={node.path}>
          <button
            className="flex w-full items-center gap-1 px-1.5 py-0.5 text-left text-muted-foreground text-xs hover:text-foreground"
            onClick={() =>
              setCollapsed((prev) => {
                const next = new Set(prev);
                if (next.has(node.path)) {
                  next.delete(node.path);
                } else {
                  next.add(node.path);
                }
                return next;
              })
            }
            style={{ paddingLeft: 6 + depth * 12 }}
            type="button"
          >
            {isCollapsed ? (
              <ChevronRight className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )}
            <Folder className="size-3" />
            <span className="truncate">{node.name}</span>
            <Stats additions={node.additions} deletions={node.deletions} />
          </button>
          {!isCollapsed && render(node.children, depth + 1)}
        </div>
      );
    });

  return (
    <div className="flex flex-col gap-0.5 overflow-y-auto">
      {view === "tree"
        ? render(tree, 0)
        : files.map((f) => fileRow(f, f.path, 0))}
    </div>
  );
}
