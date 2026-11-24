import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GENERAL_SETTINGS,
  useGeneralSettingsStore,
} from "../stores/general-settings-store";
import {
  computePopoverPlacement,
  contrastRatio,
  DARK_PANEL_BG,
  ensureDarkContrast,
  getAutoForeground,
  LIGHT_PANEL_BG,
  PRESET_ACCENTS,
  PRESET_MAP,
  parseHexColor,
} from "./accent-colors";
import {
  type AccentOption,
  applyAccent,
  applyTheme,
  getResolvedTheme,
  type ThemeMode,
} from "./theme";

describe("Theme and Accent System", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-accent");
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "";
    document.documentElement.style.removeProperty("--accent-fill");
    document.documentElement.style.removeProperty("--accent-ink");
    document.documentElement.style.removeProperty("--accent-rgb");
    document.documentElement.style.removeProperty("--accent-on");
    useGeneralSettingsStore.setState(DEFAULT_GENERAL_SETTINGS);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("Theme switching and application", () => {
    it("sets data-theme and dark class for dark mode", () => {
      applyTheme("dark");
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.style.colorScheme).toBe("dark");
    });

    it("sets data-theme and removes dark class for light mode", () => {
      document.documentElement.classList.add("dark");
      applyTheme("light");
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(document.documentElement.style.colorScheme).toBe("light");
    });

    it("resolves system mode from media query matches", () => {
      vi.stubGlobal("matchMedia", (query: string) => ({
        matches: query.includes("dark"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(getResolvedTheme("system")).toBe("dark");
      applyTheme("system");
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("persists theme choice to storage and updates store", () => {
      useGeneralSettingsStore.getState().setTheme("dark");
      expect(useGeneralSettingsStore.getState().theme).toBe("dark");
      expect(localStorage.getItem("marshell-theme")).toBe("dark");
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });

    it("handles invalid stored theme gracefully by falling back without throwing", () => {
      expect(() => {
        applyTheme("invalid" as unknown as ThemeMode);
      }).not.toThrow();

      expect(document.documentElement.getAttribute("data-theme")).toBe(
        "invalid"
      );
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });

  describe("Accent color choices & Backward compatibility", () => {
    const originalSix: { id: AccentOption; expectedHex: string }[] = [
      { id: "mint", expectedHex: "#53e2a6" },
      { id: "cyan", expectedHex: "#50d9ef" },
      { id: "sky", expectedHex: "#68b3fe" },
      { id: "violet", expectedHex: "#c28efb" },
      { id: "rose", expectedHex: "#fa7fb3" },
      { id: "amber", expectedHex: "#fac547" },
    ];

    it("keeps exact IDs and dark-theme hex values for the curated colors", () => {
      for (const item of originalSix) {
        const found = PRESET_MAP.get(item.id);
        expect(found).toBeDefined();
        expect(found?.hex.toLowerCase()).toBe(item.expectedHex.toLowerCase());
      }
    });

    it.each(
      originalSix.map((o) => o.id)
    )("sets data-accent for curated %s", (accent) => {
      applyAccent(accent);
      expect(document.documentElement.getAttribute("data-accent")).toBe(accent);
    });

    it("contains exactly 10 preset colors", () => {
      expect(PRESET_ACCENTS).toHaveLength(10);
      const uniqueIds = new Set(PRESET_ACCENTS.map((p) => p.id));
      expect(uniqueIds.size).toBe(10);
    });

    it("sets data-accent for all 10 presets", () => {
      for (const preset of PRESET_ACCENTS) {
        applyAccent(preset.id as AccentOption);
        expect(document.documentElement.getAttribute("data-accent")).toBe(
          preset.id
        );
      }
    });

    it("persists accent choice in general-settings store and localStorage", () => {
      useGeneralSettingsStore.getState().setAccent("violet");
      expect(useGeneralSettingsStore.getState().accent).toBe("violet");
      expect(localStorage.getItem("marshell-accent")).toBe("violet");
      expect(document.documentElement.getAttribute("data-accent")).toBe(
        "violet"
      );
    });

    it("falls back to mint when resetting to defaults", () => {
      useGeneralSettingsStore.getState().setAccent("cyan");
      expect(document.documentElement.getAttribute("data-accent")).toBe("cyan");

      useGeneralSettingsStore.getState().resetToDefaults();
      expect(useGeneralSettingsStore.getState().accent).toBe("mint");
      expect(document.documentElement.getAttribute("data-accent")).toBe("mint");
    });

    it("handles invalid stored accent gracefully by falling back to mint", () => {
      applyAccent("nonexistent-color" as AccentOption);
      expect(document.documentElement.getAttribute("data-accent")).toBe("mint");

      useGeneralSettingsStore.getState().setAccent("corrupted" as AccentOption);
      expect(useGeneralSettingsStore.getState().accent).toBe("mint");
      expect(document.documentElement.getAttribute("data-accent")).toBe("mint");
    });
  });

  describe("Custom color support and live preview", () => {
    it("applies custom accent with inline styles and data-accent='custom'", () => {
      useGeneralSettingsStore.getState().setCustomAccent("#e11d48");
      expect(useGeneralSettingsStore.getState().accent).toBe("custom");
      expect(useGeneralSettingsStore.getState().customAccentHex).toBe(
        "#e11d48"
      );
      expect(document.documentElement.getAttribute("data-accent")).toBe(
        "custom"
      );
      expect(
        document.documentElement.style.getPropertyValue("--accent-fill")
      ).toBe("#e11d48");
      expect(
        document.documentElement.style.getPropertyValue("--accent-rgb")
      ).toBe("225, 29, 72");
    });

    it("removes inline CSS variable overrides when switching back to a preset", () => {
      useGeneralSettingsStore.getState().setCustomAccent("#e11d48");
      expect(
        document.documentElement.style.getPropertyValue("--accent-fill")
      ).toBe("#e11d48");

      useGeneralSettingsStore.getState().setAccent("sky");
      expect(document.documentElement.getAttribute("data-accent")).toBe("sky");
      expect(
        document.documentElement.style.getPropertyValue("--accent-fill")
      ).toBe("");
      expect(
        document.documentElement.style.getPropertyValue("--accent-ink")
      ).toBe("");
    });

    it("accumulates recent custom colors up to 8 deduplicated items", () => {
      const store = useGeneralSettingsStore.getState();
      store.setCustomAccent("#112233");
      store.setCustomAccent("#223344");
      store.setCustomAccent("#112233"); // duplicate should move to front

      const recents = useGeneralSettingsStore.getState().recentCustomAccents;
      expect(recents.length).toBeLessThanOrEqual(8);
      expect(recents[0]?.toLowerCase()).toBe(
        ensureDarkContrast("#112233").hex.toLowerCase()
      );
    });
  });

  describe("Color math, contrast and validation helpers", () => {
    it("parses valid hex strings in 3 and 6 digit formats, with or without hash", () => {
      expect(parseHexColor("#fff")).toBe("#ffffff");
      expect(parseHexColor("fff")).toBe("#ffffff");
      expect(parseHexColor("#123456")).toBe("#123456");
      expect(parseHexColor("A1B2C3")).toBe("#a1b2c3");
    });

    it("rejects invalid hex strings safely", () => {
      expect(parseHexColor("")).toBeNull();
      expect(parseHexColor("not-a-color")).toBeNull();
      expect(parseHexColor("#12")).toBeNull();
      expect(parseHexColor("#1234567")).toBeNull();
      expect(parseHexColor(null)).toBeNull();
      expect(parseHexColor(undefined)).toBeNull();
    });

    it("auto-selects dark text on high-luminance fills and white text on dark fills", () => {
      expect(getAutoForeground("#3ddc97")).toBe("#0b130e"); // Mint
      expect(getAutoForeground("#f0b35a")).toBe("#0b130e"); // Amber
      expect(getAutoForeground("#4fd1e6")).toBe("#0b130e"); // Cyan
      expect(getAutoForeground("#e5484d")).toBe("#0b130e"); // Crimson (4.82:1 with dark text vs 3.91:1 with white)
      expect(getAutoForeground("#2563eb")).toBe("#ffffff"); // Blue
      expect(getAutoForeground("#6366f1")).toBe("#ffffff"); // Indigo
    });

    it("auto-lightens colors that fail the 3:1 contrast against dark background", () => {
      const veryDark = "#030812";
      const { hex, isAdjusted } = ensureDarkContrast(veryDark);
      expect(isAdjusted).toBe(true);
      expect(contrastRatio(hex, DARK_PANEL_BG)).toBeGreaterThanOrEqual(3.0);
    });

    it("does not adjust colors that already meet 3:1 contrast", () => {
      const vibrant = "#38bdf8";
      const { hex, isAdjusted } = ensureDarkContrast(vibrant);
      expect(isAdjusted).toBe(false);
      expect(hex).toBe(vibrant);
    });
  });

  describe("Token specification and WCAG contrast across all 10 presets", () => {
    it("verifies all 10 presets meet at least 3:1 contrast against dark background", () => {
      for (const preset of PRESET_ACCENTS) {
        const ratio = contrastRatio(preset.hex, DARK_PANEL_BG);
        expect(
          ratio,
          `Preset ${preset.name} (${preset.hex}) contrast on dark panel is ${ratio.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(3.0);
      }
    });

    it("verifies all preset lightInk values meet 4.5:1 contrast on the light panel background", () => {
      for (const preset of PRESET_ACCENTS) {
        const ink = preset.lightInk || preset.hex;
        const ratio = contrastRatio(ink, LIGHT_PANEL_BG);
        expect(
          ratio,
          `Light theme ${preset.name} ink (${ink}) contrast on the light panel is ${ratio.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("verifies light-theme fills keep 4.5:1 with their foreground", () => {
      for (const preset of PRESET_ACCENTS) {
        const ratio = contrastRatio(preset.lightHex, preset.onLight);
        expect(
          ratio,
          `Light ${preset.name} (${preset.lightHex}) vs ${preset.onLight} is ${ratio.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("keeps globals.css accent blocks in sync with the preset table", () => {
      const css = readFileSync(
        resolve(import.meta.dirname, "../../../ui/src/styles/globals.css"),
        "utf8"
      ).replace(/\r\n/g, "\n");
      for (const preset of PRESET_ACCENTS) {
        const dark = new RegExp(
          `\\n:root\\[data-accent="${preset.id}"\\],\\n\\[data-accent="${preset.id}"\\] \\{([^}]*)\\}`
        ).exec(css);
        expect(dark, `dark block for ${preset.id}`).not.toBeNull();
        expect(dark?.[1]).toContain(`--accent-fill: ${preset.hex}`);
        const light = new RegExp(
          `\\[data-theme="light"\\] \\[data-accent="${preset.id}"\\] \\{([^}]*)\\}`
        ).exec(css);
        expect(light, `light block for ${preset.id}`).not.toBeNull();
        expect(light?.[1]).toContain(`--accent-fill: ${preset.lightHex}`);
        expect(light?.[1]).toContain(`--accent-ink: ${preset.lightInk}`);
      }
    });

    it("verifies on-accent text contrast meets at least 4.5:1", () => {
      for (const preset of PRESET_ACCENTS) {
        const onColor = preset.onDark || getAutoForeground(preset.hex);
        const ratio = contrastRatio(preset.hex, onColor);
        expect(
          ratio,
          `Preset ${preset.name} (${preset.hex}) vs text (${onColor}) contrast is ${ratio.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(4.0);
      }
    });
  });

  describe("computePopoverPlacement positioning & collision detection", () => {
    it("places popover right-start beside grid by default when there is sufficient room", () => {
      const anchorRect = {
        top: 100,
        bottom: 240,
        left: 100,
        right: 520,
        width: 420,
        height: 140,
      };
      const placement = computePopoverPlacement(anchorRect, 360, {
        width: 1200,
        height: 800,
      });
      expect(placement.placement).toBe("right-start");
      expect(placement.left).toBe(520 + 16); // 536
      expect(placement.top).toBe(100);
      expect(placement.maxHeight).toBeGreaterThanOrEqual(320);
    });

    it("falls back to left-start when right side does not fit but left fits", () => {
      const anchorRect = {
        top: 100,
        bottom: 240,
        left: 450,
        right: 870,
        width: 420,
        height: 140,
      };
      // right (870) + 16 + 360 = 1246 > 1000 - 12 (988)
      // left (450) - 16 - 360 = 74 >= 12
      const placement = computePopoverPlacement(anchorRect, 360, {
        width: 1000,
        height: 800,
      });
      expect(placement.placement).toBe("left-start");
      expect(placement.left).toBe(450 - 16 - 360); // 74
      expect(placement.top).toBe(100);
    });

    it("falls back to below when neither side fits", () => {
      const anchorRect = {
        top: 100,
        bottom: 240,
        left: 20,
        right: 440,
        width: 420,
        height: 140,
      };
      // boundary width 500: right side 440 + 16 + 360 = 816 > 488; left side 20 - 16 - 360 = -356 < 12
      const placement = computePopoverPlacement(anchorRect, 360, {
        width: 500,
        height: 800,
      });
      expect(placement.placement).toBe("below");
      expect(placement.top).toBe(240 + 16); // 256
      expect(placement.left).toBeGreaterThanOrEqual(12);
    });

    it("shifts up when popover would overflow bottom edge", () => {
      const anchorRect = {
        top: 600,
        bottom: 740,
        left: 100,
        right: 520,
        width: 420,
        height: 140,
      };
      // 600 + 360 = 960 > 800 - 12 (788)
      const placement = computePopoverPlacement(
        anchorRect,
        360,
        { width: 1200, height: 800 },
        360
      );
      expect(placement.placement).toBe("right-start");
      expect(placement.top).toBe(800 - 12 - 360); // 428
      expect(placement.top + 360).toBeLessThanOrEqual(800 - 12);
    });

    it("falls back to center in a tiny window", () => {
      const smallViewport = { width: 380, height: 350 };
      const anchorRect = {
        top: 50,
        bottom: 250,
        left: 10,
        right: 370,
        width: 360,
        height: 200,
      };
      const placement = computePopoverPlacement(
        anchorRect,
        360,
        smallViewport,
        360
      );
      expect(placement.placement).toBe("center");
      expect(placement.left).toBeGreaterThanOrEqual(10);
      expect(placement.top).toBeGreaterThanOrEqual(10);
    });
  });
});
