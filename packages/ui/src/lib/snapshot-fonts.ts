"use client";

const FONT_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/g;
const FAMILY_QUOTES = /["']/g;
const fontData = new Map<string, Promise<string>>();
let isWarmupScheduled = false;

function readFont(url: string): Promise<string> {
  const cached = fontData.get(url);
  if (cached) {
    return cached;
  }
  const pending = (async () => {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) {
      throw new Error("Snapshot font could not be loaded");
    }
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () =>
        reject(new Error("Snapshot font could not be read"));
      reader.readAsDataURL(blob);
    });
  })();
  fontData.set(url, pending);
  return pending;
}

/** Prewarms stylesheet fonts in idle time so initial popup opening has 0ms raster delay */
export function preloadSnapshotFonts(): void {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    isWarmupScheduled
  ) {
    return;
  }
  isWarmupScheduled = true;
  const warmup = () => {
    try {
      for (const sheet of document.styleSheets) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of rules) {
          if (rule instanceof CSSFontFaceRule) {
            for (const match of rule.cssText.matchAll(FONT_URL)) {
              const src = match[1] ?? match[2] ?? match[3];
              if (src && !src.startsWith("data:")) {
                const url = new URL(src.trim(), sheet.href ?? document.baseURI)
                  .href;
                readFont(url).catch(() => {});
              }
            }
          }
        }
      }
    } catch {
      // Non-critical warmup failure
    }
  };

  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(warmup, { timeout: 2000 });
  } else {
    setTimeout(warmup, 500);
  }
}

if (typeof window !== "undefined") {
  preloadSnapshotFonts();
}

async function embedFace(rule: CSSFontFaceRule, base: string): Promise<string> {
  let css = rule.cssText;
  for (const match of css.matchAll(FONT_URL)) {
    const source = match[1] ?? match[2] ?? match[3];
    if (!source || source.startsWith("data:")) {
      continue;
    }
    const url = new URL(source.trim(), base).href;
    const data = await readFont(url);
    css = css.replace(match[0], `url("${data}")`);
  }
  return css;
}

/** SVG images have an isolated font set; computed font-family alone is insufficient. */
export async function snapshotFontStyles(
  families: Set<string>
): Promise<string> {
  const faces: Promise<string>[] = [];
  const visit = (rules: CSSRuleList, base: string) => {
    for (const rule of rules) {
      if (rule instanceof CSSFontFaceRule) {
        const family = rule.style
          .getPropertyValue("font-family")
          .replace(FAMILY_QUOTES, "")
          .trim();
        if (families.has(family)) {
          faces.push(embedFace(rule, base));
        }
      } else if (rule instanceof CSSGroupingRule) {
        visit(rule.cssRules, base);
      }
    }
  };
  for (const sheet of document.styleSheets) {
    // App fonts are served by Next from readable same-origin stylesheets.
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    visit(rules, sheet.href ?? document.baseURI);
  }
  return (await Promise.all(faces)).join("\n");
}

export function collectFontFamilies(
  value: string,
  families: Set<string>
): void {
  for (const family of value.split(",")) {
    families.add(family.replace(FAMILY_QUOTES, "").trim());
  }
}
