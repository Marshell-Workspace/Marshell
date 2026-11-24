// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { getDesktopPlatform } from "./notification-service";

afterEach(() => {
  vi.unstubAllGlobals();
});

const cases = [
  {
    name: "windows",
    nav: {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/130.0",
      platform: "Win32",
    },
  },
  {
    name: "mac",
    nav: {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko)",
      platform: "MacIntel",
    },
  },
  {
    name: "linux",
    nav: {
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko)",
      platform: "Linux x86_64",
    },
  },
  {
    name: "other",
    nav: {
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36",
      platform: "Linux armv8l",
    },
  },
] as const;

it.each(cases)("detects $name from the webview user agent", ({ name, nav }) => {
  vi.stubGlobal("navigator", nav);
  expect(getDesktopPlatform()).toBe(name);
});
