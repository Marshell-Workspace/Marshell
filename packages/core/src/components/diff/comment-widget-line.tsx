"use client";

import {
  type DiffLine,
  formatReviewComment,
} from "@workspace/core/lib/diff-parser";
import { useState } from "react";
import { toast } from "sonner";

/** Inline review box under a diff line; copies file, line, snippet and comment to clipboard. */
export function CommentWidgetLine({
  line,
  onClose,
  path,
}: {
  line: DiffLine;
  onClose: () => void;
  path: string;
}) {
  const [comment, setComment] = useState("");

  const copyComment = async () => {
    if (!comment.trim()) {
      return;
    }
    try {
      await navigator.clipboard.writeText(
        formatReviewComment({ comment, line, path })
      );
      toast.success("Copied review comment");
    } catch {
      toast.error("Could not copy review comment");
    }
    onClose();
  };

  return (
    <div className="flex flex-col gap-1.5 border-glass-border border-y bg-glass-surface p-2">
      <textarea
        aria-label="Review comment"
        autoFocus
        className="min-h-16 rounded-md border border-border bg-secondary p-2 text-sm text-foreground hover:border-white/[0.14] outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus:border-primary/60 focus-visible:shadow-[0_0_0_1px_rgba(255,255,255,0.12)] transition-colors"
        onChange={(e) => setComment(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onClose();
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            copyComment();
          }
        }}
        placeholder="Review comment… (Ctrl+Enter to copy)"
        value={comment}
      />
      <div className="flex gap-2 text-xs">
        <button
          className="rounded-md bg-primary px-2 py-1 text-primary-foreground disabled:opacity-50"
          disabled={!comment.trim()}
          onClick={copyComment}
          type="button"
        >
          Copy comment
        </button>
        <button
          className="text-muted-foreground"
          onClick={onClose}
          type="button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
