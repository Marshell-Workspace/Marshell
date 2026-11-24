export const themeInitScript = `
(function () {
  try {
    const storedTheme = window.localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = storedTheme ?? (systemPrefersDark ? "dark" : "light");

    const isDark = theme === "dark";
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";

    const storedAccent = window.localStorage.getItem("marshell-accent") || "blue";
    document.documentElement.setAttribute("data-accent", storedAccent);

    // Performance tier bootstrap
    let tier = "balanced";
    const storedTierRaw = window.localStorage.getItem("marshell_performance_tier");
    const rawTrimmed = storedTierRaw ? storedTierRaw.trim() : "";
    if (rawTrimmed && rawTrimmed !== "undefined" && rawTrimmed !== "null") {
      try {
        const parsed = JSON.parse(rawTrimmed);
        if (parsed?.state?.tier) {
          const raw = String(parsed.state.tier).toLowerCase();
          if (raw === "performance" || raw === "turbo" || raw === "full") tier = "performance";
          else if (raw === "eco") tier = "eco";
          else tier = "balanced";
        }
      } catch {}
    } else {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const cores = navigator.hardwareConcurrency || 8;
      // Turbo is never auto-picked; see detectOptimalTier in performance-store.
      if (prefersReducedMotion || cores <= 4) {
        tier = "eco";
      }
    }
    document.documentElement.setAttribute("data-performance-tier", tier);
  } catch (error) {
    console.warn("Theme/Tier initialization failed", error);
  }
})();
`;
