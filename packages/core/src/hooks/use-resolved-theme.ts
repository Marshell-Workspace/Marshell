"use client";

import { getResolvedTheme } from "@workspace/core/lib/theme";
import { useGeneralSettingsStore } from "@workspace/core/stores/general-settings-store";
import { useEffect, useState } from "react";

export function useResolvedTheme(): "light" | "dark" {
  const themeMode = useGeneralSettingsStore((s) => s.theme);

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
    if (typeof document !== "undefined") {
      const dataTheme = document.documentElement.getAttribute("data-theme");
      if (dataTheme === "light" || dataTheme === "dark") {
        return dataTheme;
      }
      if (document.documentElement.classList.contains("dark")) {
        return "dark";
      }
    }
    return getResolvedTheme(themeMode);
  });

  useEffect(() => {
    const update = () => {
      if (typeof document !== "undefined") {
        const dataTheme = document.documentElement.getAttribute("data-theme");
        if (dataTheme === "light" || dataTheme === "dark") {
          setResolvedTheme(dataTheme);
          return;
        }
        if (document.documentElement.classList.contains("dark")) {
          setResolvedTheme("dark");
          return;
        }
      }
      setResolvedTheme(getResolvedTheme(themeMode));
    };

    update();

    if (typeof window === "undefined") {
      return;
    }

    const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
    const handleMql = () => {
      if (useGeneralSettingsStore.getState().theme === "system") {
        update();
      }
    };
    mql?.addEventListener?.("change", handleMql);

    let observer: MutationObserver | null = null;
    if (typeof document !== "undefined" && document.documentElement) {
      observer = new MutationObserver(() => update());
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "class"],
      });
    }

    return () => {
      mql?.removeEventListener?.("change", handleMql);
      observer?.disconnect();
    };
  }, [themeMode]);

  return resolvedTheme;
}
