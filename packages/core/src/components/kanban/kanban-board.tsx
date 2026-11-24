"use client";

import type {
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensorProps,
} from "@dnd-kit/core";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
} from "@dnd-kit/sortable";
import { KanbanBoardSkeleton } from "@workspace/core/components/common/skeleton-composites";
import { PriorityBars } from "@workspace/core/components/kanban/kanban-card";
import { KanbanColumn } from "@workspace/core/components/kanban/kanban-column";
import {
  type KanbanCard,
  type KanbanColumn as KanbanColumnType,
  useKanbanStore,
} from "@workspace/core/stores/kanban-store";
import { useKanbanUiStore } from "@workspace/core/stores/kanban-ui-store";
import { Badge } from "@workspace/ui/components/badge";
import { Clock, Play } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

class WindowBlurPointerSensor extends PointerSensor {
  constructor(props: PointerSensorProps) {
    super(props);
    if (typeof window === "undefined") {
      return;
    }
    const target = props.event.target as Element | null;
    const doc =
      target?.ownerDocument ??
      (typeof document === "undefined" ? null : document);
    const win =
      doc?.defaultView ?? (typeof window === "undefined" ? null : window);

    const onBlur = () => {
      const dispatchTarget =
        target && typeof target.dispatchEvent === "function"
          ? target
          : (doc?.body ?? doc);
      dispatchTarget?.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          code: "Escape",
          key: "Escape",
        })
      );
    };

    win?.addEventListener("blur", onBlur, { once: true });
  }
}

export function KanbanBoard() {
  const {
    cards,
    columns,
    deleteColumn,
    moveCard,
    reorderColumns,
    setCards,
    setColumns,
  } = useKanbanStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const initialCardsRef = useRef<KanbanCard[] | null>(null);
  const initialColumnsRef = useRef<KanbanColumnType[] | null>(null);
  const lastDeltaXRef = useRef(0);
  const tiltTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);
  const prevCountRef = useRef<number>(columns.length);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevCountRef.current = columns.length;
      return;
    }

    if (columns.length > prevCountRef.current) {
      let animId2: number;
      const animId1 = requestAnimationFrame(() => {
        // Double rAF ensures the browser has completed the layout pass for the newly mounted node
        animId2 = requestAnimationFrame(() => {
          if (boardRef.current) {
            const el = boardRef.current;
            const targetLeft = el.scrollWidth - el.clientWidth;

            el.scrollTo({
              left: targetLeft,
              behavior: "smooth",
            });
          }
        });
      });

      prevCountRef.current = columns.length;
      return () => {
        cancelAnimationFrame(animId1);
        if (animId2) {
          cancelAnimationFrame(animId2);
        }
      };
    }

    prevCountRef.current = columns.length;
  }, [columns.length]);

  // Touchpad & wheel horizontal scrolling helper without vertical scroll interference
  useEffect(() => {
    const el = boardRef.current;
    if (!el) {
      return;
    }

    const onWheel = (e: WheelEvent) => {
      // If user is primarily scrolling horizontally (touchpad swipe) or holding shift, and board is scrollable
      if (
        (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) &&
        el.scrollWidth > el.clientWidth
      ) {
        el.scrollLeft += e.deltaX === 0 ? e.deltaY : e.deltaX;
        e.preventDefault();
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  const collapsedColumnIds = useKanbanUiStore((s) => s.collapsedColumnIds);
  const uncollapsedColumnsCount = columns.filter(
    (c) => !collapsedColumnIds.includes(c.id)
  ).length;
  const isFlex = uncollapsedColumnsCount <= 4;

  const sensors = useSensors(
    useSensor(WindowBlurPointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    if (overlayRef.current) {
      overlayRef.current.style.setProperty("--drag-tilt", "0deg");
    }
    if (tiltTimerRef.current) {
      clearTimeout(tiltTimerRef.current);
    }
    if (initialCardsRef.current) {
      setCards(initialCardsRef.current);
      initialCardsRef.current = null;
    }
    if (initialColumnsRef.current) {
      setColumns(initialColumnsRef.current);
      initialColumnsRef.current = null;
    }
  }, [setCards, setColumns]);

  // Cancel drag and restore initial positions when window loses focus (Alt+Tab, window switch)
  useEffect(() => {
    if (!activeId) {
      return;
    }

    const cancelDrag = () => {
      // 1. Dispatch Escape keydown so dnd-kit sensor cancels internally
      const escapeEvent = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "Escape",
        key: "Escape",
        keyCode: 27,
        which: 27,
      });
      document.dispatchEvent(escapeEvent);
      window.dispatchEvent(escapeEvent);

      // 2. Dispatch pointercancel
      const pointerCancelEvent = new PointerEvent("pointercancel", {
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(pointerCancelEvent);
      window.dispatchEvent(pointerCancelEvent);

      // 3. Immediately reset local activeId and revert cards/columns to pre-drag state
      handleDragCancel();
    };

    const handlePointerMove = (e: PointerEvent) => {
      // If pointer moves and no button is pressed, drag was lost outside the window
      if (e.buttons === 0) {
        cancelDrag();
      }
    };

    window.addEventListener("blur", cancelDrag);
    window.addEventListener("focus", cancelDrag);
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    document.addEventListener("visibilitychange", cancelDrag);
    window.addEventListener("pointercancel", cancelDrag);

    return () => {
      window.removeEventListener("blur", cancelDrag);
      window.removeEventListener("focus", cancelDrag);
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("visibilitychange", cancelDrag);
      window.removeEventListener("pointercancel", cancelDrag);
    };
  }, [activeId, handleDragCancel]);

  const handleDragStart = (event: DragStartEvent) => {
    initialCardsRef.current = [...cards];
    initialColumnsRef.current = [...columns];
    lastDeltaXRef.current = 0;
    if (overlayRef.current) {
      overlayRef.current.style.setProperty("--drag-tilt", "0deg");
    }
    setActiveId(String(event.active.id));
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const currentDeltaX = event.delta.x;
    const diff = currentDeltaX - lastDeltaXRef.current;
    lastDeltaXRef.current = currentDeltaX;

    let target = 0;
    // When moving right -> tilt gently right (+1.5deg to +3.2deg)
    // When moving left -> tilt gently left (-1.5deg to -3.2deg)
    if (diff > 1) {
      target = Math.min(3.2, 1.2 + diff * 0.12);
    } else if (diff < -1) {
      target = Math.max(-3.2, -1.2 + diff * 0.12);
    } else if (currentDeltaX > 8) {
      target = 1.6;
    } else if (currentDeltaX < -8) {
      target = -1.6;
    }

    if (overlayRef.current) {
      overlayRef.current.style.setProperty("--drag-tilt", `${target}deg`);
    }

    if (tiltTimerRef.current) {
      clearTimeout(tiltTimerRef.current);
    }
    tiltTimerRef.current = setTimeout(() => {
      if (overlayRef.current) {
        overlayRef.current.style.setProperty("--drag-tilt", "0deg");
      }
    }, 120);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      return;
    }

    const activeCard = cards.find((c) => c.id === String(active.id));
    if (!activeCard) {
      return;
    }

    const overColumn = columns.find((col) => col.id === String(over.id));
    const overCard = cards.find((c) => c.id === String(over.id));

    if (overColumn) {
      if (activeCard.columnId !== overColumn.id) {
        const columnCards = cards.filter((c) => c.columnId === overColumn.id);
        moveCard(activeCard.id, overColumn.id, columnCards.length);
      }
    } else if (overCard && activeCard.columnId !== overCard.columnId) {
      const columnCards = cards.filter((c) => c.columnId === overCard.columnId);
      const overIndex = columnCards.findIndex((c) => c.id === overCard.id);
      moveCard(activeCard.id, overCard.columnId, overIndex);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    initialCardsRef.current = null;
    initialColumnsRef.current = null;
    if (overlayRef.current) {
      overlayRef.current.style.setProperty("--drag-tilt", "0deg");
    }
    if (tiltTimerRef.current) {
      clearTimeout(tiltTimerRef.current);
    }
    const { active, over } = event;
    setActiveId(null);

    if (!over) {
      return;
    }

    const activeColumn = columns.find((c) => c.id === String(active.id));
    if (activeColumn) {
      let overColumnId = String(over.id);
      const overCard = cards.find((c) => c.id === overColumnId);
      if (overCard) {
        overColumnId = overCard.columnId;
      }
      const overColumn = columns.find((c) => c.id === overColumnId);

      if (overColumn && activeColumn.id !== overColumn.id) {
        const oldIndex = columns.findIndex((c) => c.id === activeColumn.id);
        const newIndex = columns.findIndex((c) => c.id === overColumn.id);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          reorderColumns(oldIndex, newIndex);
        }
      }
      return;
    }

    const activeCard = cards.find((c) => c.id === String(active.id));
    const overCard = cards.find((c) => c.id === String(over.id));

    if (activeCard && overCard && activeCard.columnId === overCard.columnId) {
      const columnCards = cards.filter(
        (c) => c.columnId === activeCard.columnId
      );
      const oldIndex = columnCards.findIndex((c) => c.id === activeCard.id);
      const newIndex = columnCards.findIndex((c) => c.id === overCard.id);

      if (oldIndex !== newIndex) {
        moveCard(activeCard.id, activeCard.columnId, newIndex);
      }
    }
  };

  const activeColumn = activeId ? columns.find((c) => c.id === activeId) : null;
  const activeCard = activeId ? cards.find((c) => c.id === activeId) : null;

  if (!mounted) {
    return <KanbanBoardSkeleton />;
  }

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <SortableContext
        items={columns.map((c) => c.id)}
        strategy={horizontalListSortingStrategy}
      >
        <motion.div
          className="subtle-scrollbar-x relative flex flex-1 h-full gap-2 sm:gap-2.5 overflow-x-auto overflow-y-hidden p-1.5 w-full min-w-0 overscroll-x-contain"
          layoutScroll
          ref={boardRef}
        >
          <AnimatePresence mode="popLayout">
            {columns.map((column) => (
              <KanbanColumn
                column={column}
                isFlex={isFlex}
                key={column.id}
                onDeleteColumn={deleteColumn}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      </SortableContext>

      {mounted && typeof document !== "undefined"
        ? createPortal(
            <DragOverlay
              dropAnimation={{
                duration: 180,
                easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              {activeColumn ? (
                <div
                  className="pointer-events-none w-[280px] cursor-grabbing rounded-xl border border-[#232326] bg-[#18181c] p-3.5 shadow-2xl backdrop-blur-2xl will-change-transform"
                  ref={overlayRef}
                  style={{
                    transform:
                      "rotate(calc(var(--drag-tilt, 0deg) * 0.6)) scale(1.02)",
                    transition: "transform 140ms cubic-bezier(0.25, 1, 0.5, 1)",
                  }}
                >
                  <div className="mb-2.5 flex items-center justify-between border-b border-border/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">
                        {activeColumn.title}
                      </span>
                    </div>
                    <Badge
                      className="font-mono text-[10px]"
                      variant="secondary"
                    >
                      {
                        cards.filter((c) => c.columnId === activeColumn.id)
                          .length
                      }
                    </Badge>
                  </div>
                  <div className="flex flex-col items-center justify-center rounded-lg border border-border/40 border-dashed py-6 text-muted-foreground text-xs">
                    <span>Moving Column...</span>
                  </div>
                </div>
              ) : activeCard ? (
                <div
                  className="pointer-events-none w-[360px] max-w-full cursor-grabbing rounded-2xl border border-[var(--tb-drag-card-border)] bg-[var(--tb-card)] p-3.5 shadow-[var(--tb-drag-card-shadow)] text-[var(--tb-text)] rotate-[-2deg] will-change-transform flex flex-col gap-2"
                  ref={overlayRef}
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="size-4 rounded-[5px] border-[1.5px] border-[var(--tb-checkbox-border)] shrink-0" />
                      <span className="truncate text-sm font-semibold tracking-tight text-[var(--tb-text)]">
                        {activeCard.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-[var(--tb-muted)] shrink-0">
                      <Clock className="size-3 stroke-[1.8]" />
                      <span>just now</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 min-w-0">
                    <PriorityBars priority={activeCard.priority} />
                    <span className="text-xs font-normal capitalize text-[var(--tb-muted)]">
                      {activeCard.priority || "No priority"}
                    </span>
                  </div>

                  <div className="h-px w-full bg-[var(--tb-dashed-divider)] my-0.5" />

                  <div className="flex items-center justify-between gap-2 min-w-0 pt-0.5">
                    <div className="flex items-center gap-1.5 text-xs text-[var(--tb-muted)]">
                      <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-[var(--tb-control-border)] px-2 py-0.5 text-[11px]">
                        + Branch
                      </span>
                    </div>
                    <div className="flex size-7 items-center justify-center rounded-lg border border-[var(--tb-control-border)] bg-[var(--tb-control-bg)] text-[var(--tb-text)] shadow-xs">
                      <Play className="size-3 fill-current" />
                    </div>
                  </div>
                </div>
              ) : null}
            </DragOverlay>,
            document.body
          )
        : null}
    </DndContext>
  );
}
