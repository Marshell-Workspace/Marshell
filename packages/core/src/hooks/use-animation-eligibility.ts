import { usePerformanceStore } from "@workspace/core/stores/performance-store";
import { type RefObject, useEffect, useState } from "react";

/** Offscreen decorations must stop scheduling work, including non-rAF timers. */
export function useAnimationEligibility(
  ref: RefObject<Element | null>,
  enabled: boolean
): boolean {
  const [visible, setVisible] = useState(false);
  const isFocused = usePerformanceStore((state) => state.visibility.isFocused);
  useEffect(() => {
    if (!(enabled && isFocused)) {
      setVisible(false);
      return;
    }
    let intersecting = typeof IntersectionObserver === "undefined";
    const update = () => setVisible(!document.hidden && intersecting);
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            intersecting = entries.some((entry) => entry.isIntersecting);
            update();
          });
    if (ref.current) {
      observer?.observe(ref.current);
    }
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [enabled, isFocused, ref]);
  return enabled && isFocused && visible;
}
