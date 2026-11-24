"use client";

import {
  createJellyRenderer,
  type JellyRenderer,
} from "@workspace/ui/lib/jelly-renderer";
import type { DragOffset } from "@workspace/ui/lib/popup-motion";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useCallback, useEffect, useRef } from "react";

const SVG_NS = "http://www.w3.org/2000/svg";
const INTERACTIVE =
  "button,input,textarea,select,a,[role=button],[role=option],[data-no-jelly-drag]";
let nextFilter = 0;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** One spring body follows the grabbed point. Substeps keep damping stable at low frame rates. */
export function stepJelly(
  body: number,
  velocity: number,
  target: number,
  seconds: number
) {
  let position = body;
  let speed = velocity;
  const elapsed = clamp(seconds, 0, 0.064);
  const steps = Math.max(1, Math.ceil(elapsed / (1 / 120)));
  const dt = elapsed / steps;
  for (let step = 0; step < steps; step++) {
    speed += ((target - position) * 190 - speed * 15) * dt;
    position += speed * dt;
  }
  return { position, velocity: speed };
}

/** Map neutral red (128/255) to zero motion and full red to the requested lag. */
export function jellyDisplacementMatrix(x: number, y: number): string {
  const gainX = (x * 255) / (140 * 127);
  const gainY = (y * 255) / (140 * 127);
  return `${gainX} 0 0 0 ${0.5 - (gainX * 128) / 255} ${gainY} 0 0 0 ${0.5 - (gainY * 128) / 255} 0 0 0 0 0.5 0 0 0 1 0`;
}

/** A smooth distance field pins the grab point and bends the remote edges. */
function createWarp(grabX: number, grabY: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  const pixels = context.createImageData(128, 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const distance = Math.hypot(
        ((x / 127) * 1.4 - 0.2 - grabX) * 0.8,
        (y / 127) * 1.4 - 0.2 - grabY
      );
      const weight = 1 - Math.exp(-3 * distance * distance);
      const index = (y * 128 + x) * 4;
      pixels.data[index] = Math.round(128 + 127 * weight);
      pixels.data[index + 1] = 128;
      pixels.data[index + 2] = 128;
      pixels.data[index + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  svg.dataset.jellyFilter = "";
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.id = `jelly-${nextFilter++}`;
  for (const [name, value] of Object.entries({
    x: "-20%",
    y: "-20%",
    width: "140%",
    height: "140%",
    "color-interpolation-filters": "sRGB",
  })) {
    filter.setAttribute(name, value);
  }
  const map = document.createElementNS(SVG_NS, "feImage");
  for (const [name, value] of Object.entries({
    href: canvas.toDataURL(),
    x: "-20%",
    y: "-20%",
    width: "140%",
    height: "140%",
    preserveAspectRatio: "none",
    result: "distance",
  })) {
    map.setAttribute(name, value);
  }
  // Encode both displacement axes in one map. A color matrix on the static
  // distance field is cheaper than filtering the entire live popup twice.
  const direction = document.createElementNS(SVG_NS, "feColorMatrix");
  direction.setAttribute("in", "distance");
  direction.setAttribute("type", "matrix");
  direction.setAttribute("result", "vector");
  direction.setAttribute("values", jellyDisplacementMatrix(0, 0));
  const displacement = document.createElementNS(SVG_NS, "feDisplacementMap");
  for (const [name, value] of Object.entries({
    in: "SourceGraphic",
    in2: "vector",
    xChannelSelector: "R",
    yChannelSelector: "G",
    scale: "140",
  })) {
    displacement.setAttribute(name, value);
  }
  filter.append(map, direction, displacement);
  svg.append(filter);
  document.body.append(svg);
  return {
    svg,
    direction,
    url: `url(#${filter.id})`,
    lastX: Number.NaN,
    lastY: Number.NaN,
  };
}

interface JellyOptions {
  contentRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  intensity?: number;
  isClosing: boolean;
  open: boolean;
}

export function useJellyDrag({
  contentRef,
  enabled,
  intensity = 0.45,
  isClosing,
  open,
}: JellyOptions) {
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;
  const dragOffsetRef = useRef<DragOffset>({ x: 0, y: 0 });
  const state = useRef({
    pointer: null as number | null,
    frame: 0,
    time: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    width: 0,
    height: 0,
    selection: "",
    reduced: false,
  });
  const warp = useRef<ReturnType<typeof createWarp>>(null);
  const renderer = useRef<JellyRenderer | null>(null);
  const generation = useRef(0);

  const cancelActiveJelly = useCallback(() => {
    const s = state.current;
    generation.current++;
    renderer.current?.dispose();
    renderer.current = null;
    cancelAnimationFrame(s.frame);
    s.frame = 0;
    s.time = 0;
    if (s.pointer !== null) {
      document.body.style.userSelect = s.selection;
    }
    s.pointer = null;
    warp.current?.svg.remove();
    warp.current = null;
    if (contentRef.current) {
      contentRef.current.style.filter = "";
      contentRef.current.style.willChange = "";
    }
  }, [contentRef]);

  const resetDragOffset = useCallback(() => {
    cancelActiveJelly();
    dragOffsetRef.current = { x: 0, y: 0 };
    if (contentRef.current) {
      contentRef.current.style.transform = "";
    }
  }, [cancelActiveJelly, contentRef]);

  const animate = useCallback(() => {
    const s = state.current;
    if (s.frame) {
      return;
    }
    const jellyTick = (time: number) => {
      const el = contentRef.current;
      if (!el) {
        cancelActiveJelly();
        return;
      }
      const dt = s.time ? Math.min((time - s.time) / 1000, 0.064) : 1 / 60;
      s.time = time;
      const target = dragOffsetRef.current;
      const x = stepJelly(s.x, s.vx, target.x, dt);
      const y = stepJelly(s.y, s.vy, target.y, dt);
      s.x = x.position;
      s.vx = x.velocity;
      s.y = y.position;
      s.vy = y.velocity;
      const factor = clamp(intensityRef.current, 0, 1);
      const rawLagX = target.x - s.x;
      const rawLagY = target.y - s.y;
      const maxLagX = 70 * factor;
      const maxLagY = 55 * factor;
      const lagX = s.reduced ? 0 : clamp(rawLagX * factor, -maxLagX, maxLagX);
      const lagY = s.reduced ? 0 : clamp(rawLagY * factor, -maxLagY, maxLagY);
      el.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
      if (renderer.current?.paint(target.x, target.y, lagX, lagY)) {
        el.style.filter = "";
      } else if (warp.current) {
        const activeWarp = warp.current;
        if (el.style.filter !== activeWarp.url) {
          el.style.filter = activeWarp.url;
        }
        // Subpixel quantization avoids invalidating the filter for imperceptible changes.
        const bendX = Math.round(lagX * 4) / 4;
        const bendY = Math.round(lagY * 4) / 4;
        if (bendX !== activeWarp.lastX || bendY !== activeWarp.lastY) {
          activeWarp.direction.setAttribute(
            "values",
            jellyDisplacementMatrix(bendX, bendY)
          );
          activeWarp.lastX = bendX;
          activeWarp.lastY = bendY;
        }
      }
      if (
        s.reduced ||
        (Math.abs(lagX) + Math.abs(lagY) < 0.15 &&
          Math.abs(s.vx) + Math.abs(s.vy) < 1)
      ) {
        if (s.pointer === null) {
          cancelActiveJelly();
        } else {
          // A stationary held pointer needs no animation frames or filter passes.
          el.style.filter = "";
          renderer.current?.rest();
          s.frame = 0;
          s.time = 0;
          s.x = target.x;
          s.y = target.y;
          s.vx = 0;
          s.vy = 0;
        }
        return;
      }
      s.frame = requestAnimationFrame(jellyTick);
    };
    s.frame = requestAnimationFrame(jellyTick);
  }, [cancelActiveJelly, contentRef]);

  useEffect(() => {
    if (!(enabled && open) || isClosing) {
      cancelActiveJelly();
      return;
    }
    const move = (event: PointerEvent) => {
      const s = state.current;
      if (event.pointerId !== s.pointer) {
        return;
      }
      const maxX = Math.max(0, (innerWidth - s.width) / 2 - 12);
      const maxY = Math.max(0, (innerHeight - s.height) / 2 - 12);
      dragOffsetRef.current = {
        x: clamp(s.offsetX + event.clientX - s.startX, -maxX, maxX),
        y: clamp(s.offsetY + event.clientY - s.startY, -maxY, maxY),
      };
      animate();
    };
    const release = (event: PointerEvent) => {
      const s = state.current;
      if (event.pointerId !== s.pointer) {
        return;
      }
      s.pointer = null;
      document.body.style.userSelect = s.selection;
      animate();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", cancelActiveJelly);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", cancelActiveJelly);
      cancelActiveJelly();
    };
  }, [animate, cancelActiveJelly, enabled, isClosing, open]);

  const handlePointerDown = useCallback(
    async (event: ReactPointerEvent<HTMLElement>) => {
      const el = contentRef.current;
      const target = event.target;
      if (
        !(enabled && open && el) ||
        isClosing ||
        event.button !== 0 ||
        el?.style.clipPath ||
        !(target instanceof Element) ||
        target.closest(INTERACTIVE) ||
        !target.closest("[data-jelly-handle]")
      ) {
        return;
      }
      // A new grab starts from the rendered resting position, without a centering jump.
      cancelActiveJelly();
      const rect = el.getBoundingClientRect();
      const s = state.current;
      Object.assign(s, {
        pointer: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: dragOffsetRef.current.x,
        offsetY: dragOffsetRef.current.y,
        x: dragOffsetRef.current.x,
        y: dragOffsetRef.current.y,
        vx: 0,
        vy: 0,
        width: rect.width,
        height: rect.height,
        selection: document.body.style.userSelect,
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
      });
      let pendingRenderer: Promise<void> | undefined;
      if (!s.reduced) {
        const currentGeneration = generation.current;
        const prepare = async () => {
          const prepared = await createJellyRenderer(
            el,
            rect,
            (event.clientX - rect.left) / rect.width,
            (event.clientY - rect.top) / rect.height,
            s.offsetX,
            s.offsetY
          );
          if (currentGeneration !== generation.current) {
            prepared?.dispose();
            return;
          }
          renderer.current = prepared;
          if (prepared) {
            warp.current?.svg.remove();
            warp.current = null;
            el.style.filter = "";
          }
        };
        // Start capture now; await after scheduling immediate pointer feedback.
        pendingRenderer = prepare();
        warp.current = createWarp(
          (event.clientX - rect.left) / rect.width,
          (event.clientY - rect.top) / rect.height
        );
      }
      document.body.style.userSelect = "none";
      el.style.willChange = "transform, filter";
      event.preventDefault();
      animate();
      await pendingRenderer;
    },
    [animate, cancelActiveJelly, contentRef, enabled, isClosing, open]
  );

  return {
    dragOffsetRef,
    handlePointerDown,
    resetDragOffset,
    cancelActiveJelly,
  };
}
