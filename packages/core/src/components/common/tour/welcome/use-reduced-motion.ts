"use client";

import { useEffect, useState } from "react";

/**
 * Returns true if the user prefers reduced motion.
 * Accepts an optional forced value from props (parent's reducedMotion prop).
 */
export function useReducedMotion(forcedValue?: boolean): boolean {
  const [prefersReduced, setPrefersReduced] = useState<boolean>(() => {
    if (forcedValue !== undefined) {
      return forcedValue;
    }
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (forcedValue !== undefined) {
      setPrefersReduced(forcedValue);
      return;
    }
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [forcedValue]);

  return prefersReduced;
}
