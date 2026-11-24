"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  type CSSProperties,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export interface StrokeTextProps {
  className?: string;
  drawDuration?: number;
  ease?: string;
  fillColor?: string;
  fillDelay?: number;
  fillMode?: "fade" | "wipe" | "none";
  fontSize?: number | string;
  fontWeight?: number | string;
  letterSpacing?: number | string;
  reverse?: boolean;
  shineColor?: string;
  shineSpeed?: number;
  stagger?: number;
  strokeColor?: string;
  strokeWidth?: number;
  style?: CSSProperties;
  text?: string;
  trigger?: "mount" | "hover" | "scroll" | "loop";
}

interface BBox {
  height: number;
  width: number;
  x: number;
  y: number;
}

export function StrokeText({
  text = "Draw Attention",
  // Defaults now reference the app's own tokens (platinum/muted-foreground)
  // instead of an unrelated placeholder violet/off-white — any consumer that
  // doesn't override colors gets an on-brand result automatically.
  strokeColor = "var(--muted-foreground, #8e8e93)",
  fillColor = "var(--foreground, #f4f4f5)",
  strokeWidth = 1.4,
  drawDuration = 1.6,
  fillDelay = 0.2,
  stagger = 0.05,
  // power3 settles a touch crisper/snappier than power2 — reads more
  // "premium" for a short UI reveal rather than a decorative hero draw-in.
  ease = "power3.out",
  trigger = "mount",
  fillMode = "wipe",
  fontSize = 128,
  fontWeight = 800,
  letterSpacing = -4,
  reverse = false,
  shineColor,
  shineSpeed = 1.15,
  className = "",
  style = {},
}: StrokeTextProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const strokeTextRef = useRef<SVGTextElement>(null);
  const wipeRectRef = useRef<SVGRectElement>(null);
  const shineGradientRef = useRef<SVGLinearGradientElement>(null);

  const [box, setBox] = useState<BBox | null>(null);

  const rawId = useId();
  const wipeId = `stroke-text-wipe-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const shineId = `stroke-text-shine-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const characters = useMemo(() => Array.from(String(text ?? "")), [text]);

  const numFontSize =
    typeof fontSize === "number"
      ? fontSize
      : Number.parseFloat(fontSize) || 128;
  const dash = Math.max(numFontSize * 7, 200);

  const fontStyle = useMemo(
    () => ({
      fontSize: `${fontSize}px`,
      fontWeight,
      letterSpacing: `${letterSpacing}px`,
    }),
    [fontSize, fontWeight, letterSpacing]
  );

  useLayoutEffect(() => {
    const node = strokeTextRef.current;
    if (!node) {
      return;
    }

    let cancelled = false;

    const measure = () => {
      if (cancelled || !strokeTextRef.current) {
        return;
      }
      let bbox: SVGRect;
      try {
        bbox = strokeTextRef.current.getBBox();
      } catch {
        return;
      }
      if (!bbox?.width) {
        return;
      }

      const pad = Math.max(Number(strokeWidth) || 1, numFontSize * 0.1);
      const next: BBox = {
        x: bbox.x - pad,
        y: bbox.y - pad,
        width: bbox.width + pad * 2,
        height: bbox.height + pad * 2,
      };

      setBox((prev) =>
        prev &&
        Math.abs(prev.x - next.x) < 0.5 &&
        Math.abs(prev.width - next.width) < 0.5 &&
        Math.abs(prev.y - next.y) < 0.5
          ? prev
          : next
      );
    };

    measure();
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [
    characters,
    fontSize,
    fontWeight,
    letterSpacing,
    strokeWidth,
    numFontSize,
  ]);

  useEffect(() => {
    const root = rootRef.current;
    if (typeof window === "undefined" || !root || !box) {
      return;
    }

    const strokes = gsap.utils.toArray(
      root.querySelectorAll("[data-stroke-char]")
    );
    const fills = gsap.utils.toArray(root.querySelectorAll("[data-fill-char]"));
    const wipe = wipeRectRef.current;
    const shineGradient = shineGradientRef.current;
    if (!strokes.length) {
      return;
    }

    const fillEnabled = fillMode !== "none";
    const useWipe = fillEnabled && fillMode === "wipe";
    const fillDuration = Math.max(0.4, drawDuration * 0.5);
    const staggerConfig = reverse
      ? { each: stagger, from: "end" as const }
      : stagger;
    const targets = [...strokes, ...fills, wipe, shineGradient].filter(Boolean);

    const setStart = () => {
      gsap.killTweensOf(targets);
      gsap.set(strokes, { strokeDasharray: dash, strokeDashoffset: dash });
      gsap.set(fills, { opacity: useWipe ? 1 : 0 });
      if (wipe) {
        gsap.set(wipe, { attr: { width: 0 } });
      }
      if (shineGradient) {
        gsap.set(shineGradient, { attr: { x1: box.x - box.width, x2: box.x } });
      }
    };

    const setEnd = () => {
      gsap.killTweensOf(targets);
      gsap.set(strokes, { strokeDasharray: dash, strokeDashoffset: 0 });
      gsap.set(fills, { opacity: fillEnabled ? 1 : 0 });
      if (wipe) {
        gsap.set(wipe, { attr: { width: fillEnabled ? box.width : 0 } });
      }
      if (shineGradient) {
        gsap.set(shineGradient, {
          attr: { x1: box.x - box.width, x2: box.x },
        });
      }
    };

    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) {
      setEnd();
      return () => {
        gsap.killTweensOf(targets);
      };
    }

    const build = () => {
      setStart();
      const tl = gsap.timeline({
        paused: true,
        repeat: trigger === "loop" ? -1 : 0,
        repeatDelay: trigger === "loop" ? 0.9 : 0,
        defaults: { overwrite: "auto" },
      });

      tl.to(
        strokes,
        {
          strokeDashoffset: 0,
          duration: drawDuration,
          ease,
          stagger: staggerConfig,
        },
        0
      );

      if (useWipe && wipe) {
        tl.to(
          wipe,
          {
            attr: { width: box.width },
            duration: fillDuration,
            ease: "power2.inOut",
          },
          drawDuration + fillDelay
        );
      } else if (fillEnabled) {
        tl.to(
          fills,
          {
            opacity: 1,
            duration: fillDuration,
            ease: "power2.out",
            stagger: staggerConfig,
          },
          drawDuration + fillDelay
        );
      }

      if (shineGradient) {
        tl.to(
          shineGradient,
          {
            attr: { x1: box.x + box.width, x2: box.x + box.width * 3 },
            duration: Math.max(shineSpeed, 0.1),
            ease: "none",
            repeat: -1,
            repeatDelay: 0.2,
          },
          drawDuration + fillDelay
        );
      }

      return tl;
    };

    let timeline: gsap.core.Timeline | null = null;
    let scrollTrigger: ScrollTrigger | null = null;
    let removeHover: (() => void) | null = null;

    if (trigger === "hover") {
      setEnd();
      const play = () => {
        timeline?.kill();
        timeline = build();
        timeline.play(0);
      };
      root.addEventListener("pointerenter", play);
      removeHover = () => root.removeEventListener("pointerenter", play);
    } else {
      timeline = build();
      if (trigger === "scroll") {
        scrollTrigger = ScrollTrigger.create({
          trigger: root,
          start: "top 82%",
          once: true,
          onEnter: () => timeline?.play(0),
        });
      } else {
        timeline.play(0);
      }
    }

    return () => {
      removeHover?.();
      scrollTrigger?.kill();
      timeline?.kill();
      gsap.killTweensOf(targets);
    };
  }, [
    box,
    dash,
    drawDuration,
    fillDelay,
    stagger,
    ease,
    trigger,
    fillMode,
    reverse,
    shineColor,
    shineSpeed,
  ]);

  const viewBox = box
    ? `${box.x} ${box.y} ${box.width} ${box.height}`
    : `0 ${-numFontSize} 600 ${numFontSize * 1.3}`;

  return (
    <span
      aria-label={String(text ?? "")}
      className={`stroke-text ${trigger === "hover" ? "stroke-text--hover" : ""} ${className}`.trim()}
      ref={rootRef}
      role="img"
      style={
        {
          ...style,
          "--stroke-text-height": `${Math.round(numFontSize * 1.3)}px`,
        } as CSSProperties
      }
    >
      <svg
        aria-hidden="true"
        className="stroke-text__svg"
        preserveAspectRatio="xMidYMid meet"
        viewBox={viewBox}
      >
        {(fillMode === "wipe" && box) || shineColor ? (
          <defs>
            {fillMode === "wipe" && box ? (
              <clipPath clipPathUnits="userSpaceOnUse" id={wipeId}>
                <rect
                  height={box.height}
                  ref={wipeRectRef}
                  width="0"
                  x={box.x}
                  y={box.y}
                />
              </clipPath>
            ) : null}
            {shineColor && box ? (
              <linearGradient
                gradientUnits="userSpaceOnUse"
                id={shineId}
                ref={shineGradientRef}
                x1={box.x - box.width}
                x2={box.x}
                y1="0"
                y2="0"
              >
                <stop offset="0%" stopColor={fillColor} />
                <stop offset="35%" stopColor={fillColor} />
                <stop offset="50%" stopColor={shineColor} />
                <stop offset="65%" stopColor={fillColor} />
                <stop offset="100%" stopColor={fillColor} />
              </linearGradient>
            ) : null}
          </defs>
        ) : null}

        <text
          className="stroke-text__stroke"
          fill="none"
          ref={strokeTextRef}
          stroke={strokeColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          style={fontStyle}
          x="0"
          y="0"
        >
          {characters.map((char, index) => (
            <tspan data-stroke-char key={`s-${index}-${char}`}>
              {char}
            </tspan>
          ))}
        </text>

        <text
          className="stroke-text__fill"
          clipPath={fillMode === "wipe" && box ? `url(#${wipeId})` : undefined}
          fill={shineColor && box ? `url(#${shineId})` : fillColor}
          stroke="none"
          style={fontStyle}
          x="0"
          y="0"
        >
          {characters.map((char, index) => (
            <tspan data-fill-char key={`f-${index}-${char}`}>
              {char}
            </tspan>
          ))}
        </text>
      </svg>
    </span>
  );
}

export default StrokeText;
