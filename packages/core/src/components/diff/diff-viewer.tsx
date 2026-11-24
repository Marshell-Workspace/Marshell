"use client";

import { CommentWidgetLine } from "@workspace/core/components/diff/comment-widget-line";
import {
  type DiffLine,
  type FileDiff,
  toSplitRows,
} from "@workspace/core/lib/diff-parser";
import { cn } from "@workspace/ui/lib/utils";
import { Plus } from "lucide-react";
import { useState } from "react";

export type DiffMode = "split" | "unified";

/** Rows rendered per file before "Show more"; keeps huge diffs responsive. */
const ROW_PAGE = 600;

const BG: Record<DiffLine["type"], string> = {
  add: "bg-emerald-500/10",
  ctx: "",
  del: "bg-rose-500/10",
};
const MARK: Record<DiffLine["type"], string> = { add: "+", ctx: " ", del: "-" };

interface Row {
  key: string;
  left: DiffLine | null;
  right: DiffLine | null;
}

/** The selected file's path, where it moved from, and its change size. */
export function DiffViewer({ file, mode }: { file: FileDiff; mode: DiffMode }) {
  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-glass-border-subtle border-b bg-glass-surface-elevated px-2 py-1 font-mono text-xs">
        <span className="truncate" title={file.path}>
          {file.path}
        </span>
        {file.oldPath && (
          <span className="truncate text-muted-foreground">
            ← {file.oldPath}
          </span>
        )}
        <span className="ml-auto shrink-0 tabular-nums">
          <span className="text-emerald-400">+{file.additions}</span>{" "}
          <span className="text-rose-400">-{file.deletions}</span>
        </span>
      </div>
      <DiffBody file={file} mode={mode} />
    </div>
  );
}

function DiffBody({ file, mode }: { file: FileDiff; mode: DiffMode }) {
  const [limit, setLimit] = useState(ROW_PAGE);
  const [commenting, setCommenting] = useState<string | null>(null);

  if (file.binary) {
    return (
      <p className="p-4 text-muted-foreground text-sm">
        Binary file not shown.
      </p>
    );
  }
  if (file.hunks.length === 0) {
    return (
      <p className="p-4 text-muted-foreground text-sm">No textual changes.</p>
    );
  }

  const rows: Row[] = file.hunks.flatMap((hunk, h) => [
    { key: `h${h}`, left: null, right: null },
    ...(mode === "split"
      ? toSplitRows(hunk.lines)
      : hunk.lines.map((l) => ({ left: l, right: null }))
    ).map((r, i) => ({ ...r, key: `${h}:${i}` })),
  ]);
  const hunkHeaders = new Map(file.hunks.map((h, i) => [`h${i}`, h.header]));
  const visible = rows.slice(0, limit);

  const cell = (line: DiffLine | null, key: string) => {
    if (!line) {
      return <td className="bg-glass-surface/40" colSpan={2} />;
    }
    const no = line.type === "del" ? line.oldNo : line.newNo;
    return (
      <>
        <td
          className={cn(
            "group/n w-14 select-none pr-2 text-right text-muted-foreground/70",
            BG[line.type]
          )}
        >
          <button
            aria-label={`Comment on line ${no}`}
            className="mr-1 inline-flex size-3.5 items-center justify-center rounded border border-border bg-card text-foreground opacity-0 transition-opacity hover:bg-muted group-hover/n:opacity-100 focus-visible:opacity-100"
            onClick={() => setCommenting(key)}
            type="button"
          >
            <Plus className="size-3" />
          </button>
          {no}
        </td>
        <td className={cn("whitespace-pre-wrap break-all pr-2", BG[line.type])}>
          <span className="select-none text-muted-foreground/60">
            {MARK[line.type]}
          </span>
          {line.text}
        </td>
      </>
    );
  };

  return (
    <div className="overflow-auto font-mono text-xs">
      <table className="w-full table-fixed border-collapse">
        <tbody>
          {visible.map((row) => {
            const header = hunkHeaders.get(row.key);
            if (header) {
              return (
                <tr key={row.key}>
                  <td
                    className="bg-glass-surface-elevated px-2 py-0.5 text-muted-foreground"
                    colSpan={4}
                  >
                    {header}
                  </td>
                </tr>
              );
            }
            // Comments anchor to the new side when there is one, else the removed line.
            const anchor = row.right ?? row.left;
            const commentKey = `${row.key}`;
            return (
              <FragmentRows key={row.key}>
                <tr>
                  {mode === "split" ? (
                    <>
                      {cell(row.left, commentKey)}
                      {cell(row.right, commentKey)}
                    </>
                  ) : (
                    cell(row.left, commentKey)
                  )}
                </tr>
                {commenting === commentKey && anchor && (
                  <tr>
                    <td colSpan={4}>
                      <CommentWidgetLine
                        line={anchor}
                        onClose={() => setCommenting(null)}
                        path={file.path}
                      />
                    </td>
                  </tr>
                )}
              </FragmentRows>
            );
          })}
        </tbody>
      </table>
      {rows.length > limit && (
        <button
          className="w-full py-2 text-muted-foreground text-xs hover:underline"
          onClick={() => setLimit((l) => l + ROW_PAGE)}
          type="button"
        >
          Show more ({rows.length - limit} rows hidden)
        </button>
      )}
    </div>
  );
}

function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
