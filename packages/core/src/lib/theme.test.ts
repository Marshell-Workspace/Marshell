// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyTheme, getResolvedTheme } from "./theme";

describe("Theme resolution and application", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark", "theme-transition");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves explicit light and dark themes", () => {
    expect(getResolvedTheme("light")).toBe("light");
    expect(getResolvedTheme("dark")).toBe("dark");
  });

  it("resolves system theme based on prefers-color-scheme media query", () => {
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

    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(getResolvedTheme("system")).toBe("light");
  });

  it("applies light theme attributes to root element", () => {
    applyTheme("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("applies dark theme attributes to root element", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("applies smooth theme-transition class during theme switch", () => {
    applyTheme("dark");
    expect(
      document.documentElement.classList.contains("theme-transition")
    ).toBe(false);

    applyTheme("light");
    expect(
      document.documentElement.classList.contains("theme-transition")
    ).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("bypasses transition on initial load without existing theme", () => {
    applyTheme("dark");
    expect(
      document.documentElement.classList.contains("theme-transition")
    ).toBe(false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("bypasses transition when reduced motion is preferred", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    applyTheme("dark");
    applyTheme("light");
    expect(
      document.documentElement.classList.contains("theme-transition")
    ).toBe(false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
