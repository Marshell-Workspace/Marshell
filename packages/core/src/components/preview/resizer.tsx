"use client";

import { useCallback, useRef, useState } from "react";

export type DragEdge = "r" | "b" | "br";

interface ResizeOptions {
  height: number;
  onResize: (width: number, height: number) => void;
  /** Current visual scale: pointer movement is in screen px, the viewport in CSS px. */
  scale: number;
  width: number;
}

const CURSORS: Record<DragEdge, string> = {
  b: "ns-resize",
  br: "nwse-resize",
  r: "ew-resize",
};

/**
 * Drag-resizes a custom viewport. Deltas are divided by the zoom scale so the edge
 * follows the pointer at any zoom level. Callers clamp the size.
 */
export function useViewportResize(options: ResizeOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const latest = useRef(options);
  latest.current = options;

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>, edge: DragEdge) => {
      e.preventDefault();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      setIsDragging(true);

      const startX = e.clientX;
      const startY = e.clientY;
      const start = latest.current;

      const onMove = (move: PointerEvent) => {
        const { scale, onResize } = latest.current;
        const dx = (move.clientX - startX) / scale;
        const dy = (move.clientY - startY) / scale;
        onResize(
          edge === "b" ? start.width : start.width + dx,
          edge === "r" ? start.height : start.height + dy
        );
      };

      const onUp = (up: PointerEvent) => {
        try {
          target.releasePointerCapture(up.pointerId);
        } catch {
          // Already released.
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        document.body.style.cursor = "";
        setIsDragging(false);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      document.body.style.cursor = CURSORS[edge];
    },
    []
  );

  return { isDragging, onPointerDown };
}

const GRIP = "rounded-full bg-foreground/50 transition-colors";

export function ResizeHandles({
  onPointerDown,
}: {
  onPointerDown: (e: React.PointerEvent<HTMLElement>, edge: DragEdge) => void;
}) {
  return (
    <>
      <div
        aria-hidden="true"
        className="group absolute top-3 -right-2 bottom-3 z-20 flex w-4 cursor-ew-resize touch-none items-center justify-center"
        onPointerDown={(e) => onPointerDown(e, "r")}
        title="Resize width"
      >
        <div className={`${GRIP} h-8 w-1 group-hover:bg-foreground`} />
      </div>
      <div
        aria-hidden="true"
        className="group absolute right-3 -bottom-2 left-3 z-20 flex h-4 cursor-ns-resize touch-none items-center justify-center"
        onPointerDown={(e) => onPointerDown(e, "b")}
        title="Resize height"
      >
        <div className={`${GRIP} h-1 w-8 group-hover:bg-foreground`} />
      </div>
      <div
        aria-hidden="true"
        className="group absolute -right-2 -bottom-2 z-30 flex size-4 cursor-nwse-resize touch-none items-center justify-center"
        onPointerDown={(e) => onPointerDown(e, "br")}
        title="Resize"
      >
        <div className={`${GRIP} size-2 group-hover:bg-foreground`} />
      </div>
    </>
  );
}
