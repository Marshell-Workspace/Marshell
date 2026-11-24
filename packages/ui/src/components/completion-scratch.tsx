"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

export const COMPLETION_SCRATCH_DURATION_MS = 1400;

// Keep the scribble compact so the session title remains readable.
function scratchPattern(width: number, fontSize: number, seed: string) {
  const height = fontSize * 1.1;
  const points: string[] = [];
  const sections: { x: number; width: number }[] = [];
  let state = 2_166_136_261;
  for (const character of seed) {
    state = Math.imul(state ^ character.charCodeAt(0), 16_777_619) >>> 0;
  }
  // Seeded randomness keeps the pen marks stable on rerenders and reopening.
  const random = () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
  for (let x = 0; x < width; ) {
    const span = Math.min(width - x, fontSize * (0.9 + random() * 0.65));
    const top = height * (0.05 + random() * 0.18);
    const bottom = height * (0.77 + random() * 0.2);
    sections.push({ x, width: span });
    points.push(
      `${x === 0 ? "M" : "L"} ${x} ${height * 0.58}`,
      `L ${x + span} ${top}`,
      `L ${x + span * (0.12 + random() * 0.16)} ${bottom}`,
      `L ${x + span} ${height * (0.4 + random() * 0.16)}`
    );
    x += span + fontSize * (0.16 + random() * 0.18);
  }
  return { path: points.join(" "), sections };
}

export function CompletionScratch({
  completed,
  children,
  seed = children,
}: {
  completed: boolean;
  children: string;
  seed?: string;
}) {
  const clipId = useId();
  const reducedMotion = useReducedMotion();
  const textRef = useRef<HTMLSpanElement>(null);
  const previous = useRef(completed);
  const offset = useMotionValue(completed ? 0 : 1);
  const inkOpacity = useTransform(offset, (value) =>
    Math.abs(value) >= 0.9999 ? 0 : 1
  );
  const [size, setSize] = useState({ width: 0, fontSize: 12 });
  const pattern = scratchPattern(size.width, size.fontSize, seed);

  useLayoutEffect(() => {
    const text = textRef.current;
    if (!text) {
      return;
    }
    const measure = () => {
      const width = text.getBoundingClientRect().width;
      const fontSize = Number.parseFloat(getComputedStyle(text).fontSize) || 12;
      setSize((current) =>
        current.width === width && current.fontSize === fontSize
          ? current
          : { width, fontSize }
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(text);
    return () => observer.disconnect();
  }, [children]);

  useEffect(() => {
    if (previous.current === completed) {
      return;
    }
    previous.current = completed;
    if (reducedMotion) {
      offset.set(completed ? 0 : -1);
      return;
    }
    // A fully erased stroke starts at its left end on the next completion.
    if (completed && offset.get() <= -0.999) {
      offset.set(1);
    }
    const animation = animate(offset, completed ? 0 : -1, {
      duration: COMPLETION_SCRATCH_DURATION_MS / 1000,
      ease: [0.32, 0, 0.2, 1],
    });
    return () => animation.stop();
  }, [completed, offset, reducedMotion]);

  return (
    <span className="completion-scratch" data-completed={completed}>
      <span className="completion-scratch-text" ref={textRef}>
        {children}
      </span>
      {size.width > 0 && (
        <svg
          aria-hidden="true"
          className="completion-scratch-overlay"
          height={size.fontSize * 1.1}
          viewBox={`0 0 ${size.width} ${size.fontSize * 1.1}`}
          width={size.width}
        >
          <defs>
            <clipPath id={clipId}>
              {pattern.sections.map((section) => (
                <rect
                  height={size.fontSize * 1.1}
                  key={section.x}
                  width={section.width}
                  x={section.x}
                  y={0}
                />
              ))}
            </clipPath>
          </defs>
          <motion.path
            clipPath={`url(#${clipId})`}
            d={pattern.path}
            fill="none"
            pathLength={1}
            stroke="currentColor"
            strokeDasharray="1 1"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={size.fontSize * 0.06}
            style={{ opacity: inkOpacity, strokeDashoffset: offset }}
          />
        </svg>
      )}
    </span>
  );
}
