"use client";

import { processClient } from "@workspace/core/lib/process-client";
import {
  appendLogs,
  filterLogLines,
  type LogLine,
} from "@workspace/core/lib/process-utils";
import { cn } from "@workspace/ui/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";

const ROW_HEIGHT = 18;
const OVERSCAN = 20;
const MAX_LINES = 5000;
const POLL_MS = 700;

const STREAM_COLOR: Record<LogLine["stream"], string> = {
  stderr: "text-rose-300",
  stdout: "",
  system: "text-sky-300",
};

/** Windowed log viewer: only the visible rows are in the DOM, so 5,000 lines stay smooth. */
export function ProcessLogViewer({ processId }: { processId: string }) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [query, setQuery] = useState("");
  const [regex, setRegex] = useState(false);
  const [follow, setFollow] = useState(true);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(300);
  const box = useRef<HTMLDivElement>(null);
  // Cleared with the lines, so a new process starts from sequence 0.
  const cursor = useRef(0);

  useEffect(() => {
    setLines([]);
    cursor.current = 0;
    let stopped = false;
    const poll = async () => {
      try {
        const batch = await processClient.logs(processId, cursor.current);
        if (stopped) {
          return;
        }
        cursor.current = batch.next;
        setLines((cur) => appendLogs(cur, batch.lines, MAX_LINES));
      } catch {
        // The process may have been removed; the list view handles that.
      }
    };
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [processId]);

  const { error, lines: shown } = useMemo(
    () => filterLogLines(lines, query, regex),
    [lines, query, regex]
  );

  useEffect(() => {
    const el = box.current;
    if (!el) {
      return;
    }
    setHeight(el.clientHeight);
    if (follow) {
      el.scrollTop = el.scrollHeight;
    }
  }, [shown.length, follow]);

  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(
    shown.length,
    Math.ceil((scrollTop + height) / ROW_HEIGHT) + OVERSCAN
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <input
          aria-label="Filter logs"
          className={cn(
            "h-7 w-56 rounded-md border bg-glass-surface-elevated px-2",
            error ? "border-destructive" : "border-glass-border-subtle"
          )}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter logs…"
          title={error ?? undefined}
          value={query}
        />
        <label className="flex items-center gap-1">
          <input
            checked={regex}
            onChange={(e) => setRegex(e.target.checked)}
            type="checkbox"
          />
          Regex
        </label>
        <label className="flex items-center gap-1">
          <input
            checked={follow}
            onChange={(e) => setFollow(e.target.checked)}
            type="checkbox"
          />
          Auto-scroll
        </label>
        <button
          className="text-muted-foreground hover:text-foreground"
          onClick={async () => {
            await navigator.clipboard.writeText(
              shown.map((l) => l.text).join("\n")
            );
          }}
          type="button"
        >
          Copy
        </button>
        <button
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setLines([])}
          type="button"
        >
          Clear
        </button>
        <span className="ml-auto text-muted-foreground tabular-nums">
          {shown.length}/{lines.length} lines
        </span>
      </div>
      <div
        className="min-h-0 flex-1 overflow-auto rounded-md border border-glass-border-subtle bg-background font-mono text-xs"
        onScroll={(e) => {
          const el = e.currentTarget;
          setScrollTop(el.scrollTop);
          const atBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight < ROW_HEIGHT * 2;
          setFollow(atBottom);
        }}
        ref={box}
      >
        <div
          style={{ height: shown.length * ROW_HEIGHT, position: "relative" }}
        >
          {shown.slice(first, last).map((l, i) => (
            <div
              className={cn(
                "absolute right-0 left-0 truncate whitespace-pre px-2",
                STREAM_COLOR[l.stream]
              )}
              key={l.seq}
              style={{
                height: ROW_HEIGHT,
                lineHeight: `${ROW_HEIGHT}px`,
                top: (first + i) * ROW_HEIGHT,
              }}
            >
              {l.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
