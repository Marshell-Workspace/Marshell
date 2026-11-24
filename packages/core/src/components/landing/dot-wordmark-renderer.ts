import { wordmarkIllumination } from "./dot-wordmark-motion";

const WIDTH = 420;
const HEIGHT = 112;
const FIELD_LEFT = 64;
const FIELD_WIDTH = WIDTH - FIELD_LEFT;
const FONT = '78px "Geist Pixel Square"';
const GRID_X = 4;
const GRID_Y = 8;
const GRID_SPACING = 3;
const DOT_RADIUS = 0.85;

interface Dot {
  column: number;
  x: number;
  y: number;
}

/** Sample the real font once. No font measurement or pixel reads in the loop. */
function createDots(): Dot[] {
  const mask = document.createElement("canvas");
  mask.width = FIELD_WIDTH;
  mask.height = HEIGHT;
  const ctx = mask.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return [];
  }
  ctx.font = FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "white";
  ctx.fillText("Marshell", FIELD_WIDTH / 2, HEIGHT / 2);
  const pixels = ctx.getImageData(0, 0, FIELD_WIDTH, HEIGHT).data;
  const dots: Dot[] = [];
  for (let y = GRID_Y; y < HEIGHT - GRID_Y; y += GRID_SPACING) {
    for (let x = GRID_X; x < FIELD_WIDTH - GRID_X; x += GRID_SPACING) {
      if ((pixels[(y * FIELD_WIDTH + x) * 4 + 3] ?? 0) < 120) {
        continue;
      }
      dots.push({
        x: FIELD_LEFT + x,
        y,
        column: x / FIELD_WIDTH,
      });
    }
  }
  return dots;
}

export function createDotWordmark(canvas: HTMLCanvasElement): {
  destroy: () => void;
  ready: Promise<void>;
} {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { destroy: () => {}, ready: Promise.resolve() };
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const field = document.createElement("canvas");
  field.width = WIDTH;
  field.height = HEIGHT;
  const fieldCtx = field.getContext("2d");
  if (fieldCtx) {
    fieldCtx.fillStyle = "#c1c1c1";
    for (let y = GRID_Y; y < HEIGHT - GRID_Y; y += GRID_SPACING) {
      const vertical = Math.sin(
        ((y - GRID_Y) / (HEIGHT - 2 * GRID_Y)) * Math.PI
      );
      fieldCtx.globalAlpha = vertical * vertical * 0.18;
      for (let x = GRID_X; x < FIELD_WIDTH - GRID_X; x += GRID_SPACING) {
        fieldCtx.beginPath();
        fieldCtx.arc(FIELD_LEFT + x, y, DOT_RADIUS, 0, Math.PI * 2);
        fieldCtx.fill();
      }
    }
  }

  let dots: Dot[] = [];
  let elapsed = 0;
  let previousTime: number | null = null;
  let raf = 0;
  let disposed = false;
  let inView = true;
  let prepared = false;
  let width = 0;
  let height = 0;
  let dpr = 1;

  const paint = () => {
    if (!(width && height)) {
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const scale = Math.min(width / WIDTH, height / HEIGHT);
    ctx.translate(0, (height - HEIGHT * scale) / 2);
    ctx.scale(scale, scale);
    ctx.globalAlpha = 1;
    // The unlit field is invisible; a wide, feathered bank of dots passes over it.
    if (!reducedMotion.matches) {
      for (let x = GRID_X; x < FIELD_WIDTH - GRID_X; x += GRID_SPACING) {
        const { wave } = wordmarkIllumination(elapsed, x / FIELD_WIDTH);
        if (wave < 0.01) {
          continue;
        }
        const sourceX = FIELD_LEFT + x - GRID_SPACING / 2;
        ctx.globalAlpha = wave;
        ctx.drawImage(
          field,
          sourceX,
          0,
          GRID_SPACING,
          HEIGHT,
          sourceX,
          0,
          GRID_SPACING,
          HEIGHT
        );
      }
    }
    for (const dot of dots) {
      const level = reducedMotion.matches
        ? 1
        : wordmarkIllumination(elapsed, dot.column).level;
      if (level < 0.001) {
        continue;
      }
      ctx.globalAlpha = level * 0.9;
      ctx.fillStyle = "#d6d6d6";
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  const frame = (now: number) => {
    raf = 0;
    if (disposed || document.hidden || !inView || reducedMotion.matches) {
      previousTime = null;
      return;
    }
    if (previousTime !== null) {
      elapsed += Math.min((now - previousTime) / 1000, 0.1);
    }
    previousTime = now;
    paint();
    raf = requestAnimationFrame(frame);
  };

  const syncPlayback = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    previousTime = null;
    if (disposed) {
      return;
    }
    paint();
    if (prepared && !(reducedMotion.matches || document.hidden || !inView)) {
      raf = requestAnimationFrame(frame);
    }
  };

  const resize = () => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    paint();
  };
  const observer = new ResizeObserver(resize);
  const intersection = new IntersectionObserver(([entry]) => {
    inView = entry?.isIntersecting ?? false;
    syncPlayback();
  });
  observer.observe(canvas);
  intersection.observe(canvas);
  document.addEventListener("visibilitychange", syncPlayback);
  reducedMotion.addEventListener("change", syncPlayback);
  resize();

  const prepare = async () => {
    try {
      await document.fonts.load(FONT);
    } catch {
      // Keep the decorative word readable using the webview's canvas fallback.
    }
    if (disposed) {
      return;
    }
    dots = createDots();
    prepared = true;
    syncPlayback();
  };

  return {
    ready: prepare(),
    destroy: () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", syncPlayback);
      reducedMotion.removeEventListener("change", syncPlayback);
    },
  };
}
