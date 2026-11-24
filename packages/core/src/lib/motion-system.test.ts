import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MOTION_SCALES } from "./motion-profile";

const REPO = new URL("../../../../", import.meta.url);
const GLOBALS = fileURLToPath(
  new URL("packages/ui/src/styles/globals.css", REPO)
);
const css = readFileSync(GLOBALS, "utf8");

/** Every component source in the monorepo. */
function sourceFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".")) {
        continue;
      }
      const full = `${dir}/${entry}`;
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (full.endsWith(".tsx")) {
        found.push(full);
      }
    }
  };
  walk(fileURLToPath(new URL("packages", REPO)));
  return found;
}

const FILES = sourceFiles().map((path) => ({
  path: path.slice(path.indexOf("packages")).replaceAll("\\", "/"),
  text: readFileSync(path, "utf8"),
}));

/**
 * `transition-all` animates width, height, padding and margin, which is the
 * main source of layout jank. It is correct only where a size change is the
 * point — the chart bars, which animate their own width/height.
 */
const SIZE_ANIMATION_ALLOWED = new Set([
  "packages/core/src/pages/subpages/analytics-page.tsx",
  "packages/core/src/pages/subpages/overview-page.tsx",
]);

/**
 * Durations that are deliberately outside the motion scale, with the reason.
 * Anything else belongs on a motion-* utility so it follows the performance
 * profile.
 */
const FIXED_DURATION_ALLOWED: Record<string, string> = {
  "packages/ui/src/components/button.tsx": "duration-75",
  "packages/core/src/pages/subpages/analytics-page.tsx": "duration-500",
  "packages/core/src/pages/subpages/overview-page.tsx": "duration-500",
  "packages/core/src/components/agent/agent-sprite-player.tsx": "duration-0",
};

describe("motion tokens", () => {
  it("defines the four easing curves", () => {
    for (const name of [
      "--ease-standard",
      "--ease-emphasized",
      "--ease-enter",
      "--ease-exit",
    ]) {
      expect(css, name).toContain(`${name}:`);
    }
  });

  it("routes Tailwind's transition defaults through the motion engine", () => {
    // This is the single lever that makes a bare `transition-colors` anywhere
    // in the app profile-aware. If it regresses, motion silently decouples
    // from Eco/Balanced/Turbo everywhere at once.
    expect(css).toContain(
      "--default-transition-duration: var(--visual-duration-fast)"
    );
    expect(css).toContain(
      "--default-transition-timing-function: var(--ease-standard)"
    );
  });

  it("exposes the motion utilities components are expected to use", () => {
    for (const name of [
      "transition-ui",
      "motion-fast",
      "motion-normal",
      "motion-slow",
      "motion-exit",
    ]) {
      expect(css, name).toContain(`@utility ${name} {`);
    }
  });

  it("keeps transition-ui free of layout properties", () => {
    const block = css.slice(
      css.indexOf("@utility transition-ui {"),
      css.indexOf("@utility motion-fast {")
    );
    for (const layoutProp of ["width", "height", "margin", "padding", " all"]) {
      expect(block, layoutProp).not.toContain(layoutProp);
    }
  });

  it("dismisses faster than it arrives", () => {
    expect(css).toContain(
      "--visual-duration-exit: calc(var(--visual-duration-fast) * 0.7)"
    );
  });
});

describe("JS and CSS motion scales agree", () => {
  // motion-profile.ts mirrors the CSS scale numbers because motion/react
  // cannot read custom properties. Nothing but this test keeps them in step.
  const tierSelector: Record<keyof typeof MOTION_SCALES, string> = {
    eco: '[data-performance-tier="eco"]',
    balanced: '[data-performance-tier="balanced"]',
    performance: '[data-performance-tier="performance"]',
  };

  for (const [tier, scale] of Object.entries(MOTION_SCALES)) {
    it(`${tier} matches globals.css`, () => {
      const start = css.indexOf(
        tierSelector[tier as keyof typeof MOTION_SCALES]
      );
      expect(start, "tier selector missing").toBeGreaterThan(-1);
      const block = css.slice(start, css.indexOf("}", start));
      expect(block).toContain(`--motion-intensity: ${scale.intensity}`);
      expect(block).toContain(`--motion-micro: ${scale.micro}`);
      expect(block).toContain(`--motion-transition: ${scale.transition}`);
      expect(block).toContain(`--motion-decorative: ${scale.decorative}`);
    });
  }
});

describe("components stay on the motion system", () => {
  it("does not reintroduce transition-all", () => {
    const offenders = FILES.filter(
      (f) =>
        /\btransition-all\b/.test(f.text) && !SIZE_ANIMATION_ALLOWED.has(f.path)
    ).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("does not hardcode transition durations", () => {
    const offenders = FILES.flatMap((f) => {
      const hits = f.text.match(/\bduration-\d+\b/g) ?? [];
      const allowed = FIXED_DURATION_ALLOWED[f.path];
      return hits
        .filter((hit) => hit !== allowed)
        .map((hit) => `${f.path}: ${hit}`);
    });
    expect([...new Set(offenders)]).toEqual([]);
  });
});
