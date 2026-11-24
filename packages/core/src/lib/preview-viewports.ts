export type DeviceCategory =
  | "phone"
  | "tablet"
  | "foldable"
  | "desktop"
  | "smart-display"
  | "responsive"
  | "custom";

export type Orientation = "portrait" | "landscape";

/** "fit" is a viewing mode; a number is a true scale (1 = 1 CSS px per screen px). */
export type ZoomLevel = "fit" | number;

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 3;

/** Manual zoom steps used by the +/- controls. */
export const ZOOM_STEPS: readonly number[] = [
  0.25, 0.5, 0.6, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3,
];

/** Custom viewport limits, in CSS pixels. */
export const CUSTOM_LIMITS = {
  maxHeight: 4320,
  maxWidth: 7680,
  minHeight: 120,
  minWidth: 200,
} as const;

export const CUSTOM_DEVICE_ID = "custom";
export const DEFAULT_CUSTOM_SIZE = { height: 768, width: 1024 } as const;

export interface HingeConfig {
  position?: number | "vertical" | "horizontal";
  width: number;
}

export interface SafeAreaConfig {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface Device {
  category: DeviceCategory;
  defaultOrientation?: Orientation;
  foldedHeight?: number;
  foldedWidth?: number;
  height: number; // Base CSS viewport height
  hinge?: HingeConfig;
  id: string;
  isFoldable?: boolean;
  name: string;
  pixelRatio?: number;
  safeArea?: SafeAreaConfig;
  subcategory?: string;
  unfoldedHeight?: number;
  unfoldedWidth?: number;
  width: number; // Base CSS viewport width (0 for fluid)
}

export const GENERIC_SUBCATEGORY = "Generic";

function genericPresets(
  category: "phone" | "tablet" | "desktop",
  defaultOrientation: Orientation,
  entries: [string, number, number][]
): Device[] {
  return entries.map(([name, width, height]) => ({
    category,
    defaultOrientation,
    height,
    id: `generic-${width}x${height}`,
    name,
    subcategory: GENERIC_SUBCATEGORY,
    width,
  }));
}

/**
 * Verified Centralized Device Registry
 * All dimensions represent realistic CSS Viewport dimensions (NOT physical resolutions).
 */
export const DEVICE_REGISTRY: Device[] = [
  // -------------------------------------------------------------
  // RESPONSIVE (FLUID)
  // -------------------------------------------------------------
  {
    category: "responsive",
    defaultOrientation: "portrait",
    height: 0,
    id: "responsive",
    name: "Responsive (Fluid)",
    subcategory: "Responsive",
    width: 0,
  },

  // -------------------------------------------------------------
  // PHONES: iPhone
  // -------------------------------------------------------------
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 667,
    id: "iphone-se",
    name: "iPhone SE",
    pixelRatio: 2,
    subcategory: "iPhone",
    width: 375,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 896,
    id: "iphone-xr",
    name: "iPhone XR",
    pixelRatio: 2,
    subcategory: "iPhone",
    width: 414,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 844,
    id: "iphone-12-pro",
    name: "iPhone 12 Pro",
    pixelRatio: 3,
    subcategory: "iPhone",
    width: 390,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 844,
    id: "iphone-14",
    name: "iPhone 14",
    pixelRatio: 3,
    subcategory: "iPhone",
    width: 390,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 926,
    id: "iphone-14-plus",
    name: "iPhone 14 Plus",
    pixelRatio: 3,
    subcategory: "iPhone",
    width: 428,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 852,
    id: "iphone-14-pro",
    name: "iPhone 14 Pro",
    pixelRatio: 3,
    subcategory: "iPhone",
    width: 393,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 932,
    id: "iphone-14-pro-max",
    name: "iPhone 14 Pro Max",
    pixelRatio: 3,
    subcategory: "iPhone",
    width: 430,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 852,
    id: "iphone-15",
    name: "iPhone 15",
    pixelRatio: 3,
    subcategory: "iPhone",
    width: 393,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 932,
    id: "iphone-15-plus",
    name: "iPhone 15 Plus",
    pixelRatio: 3,
    subcategory: "iPhone",
    width: 430,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 852,
    id: "iphone-15-pro",
    name: "iPhone 15 Pro",
    pixelRatio: 3,
    subcategory: "iPhone",
    width: 393,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 932,
    id: "iphone-15-pro-max",
    name: "iPhone 15 Pro Max",
    pixelRatio: 3,
    subcategory: "iPhone",
    width: 430,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 844,
    id: "iphone-16e",
    name: "iPhone 16e",
    pixelRatio: 3,
    subcategory: "iPhone",
    width: 390,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 852,
    id: "iphone-16",
    name: "iPhone 16",
    pixelRatio: 3,
    subcategory: "iPhone",
    width: 393,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 932,
    id: "iphone-16-plus",
    name: "iPhone 16 Plus",
    pixelRatio: 3,
    subcategory: "iPhone",
    width: 430,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 874,
    id: "iphone-16-pro",
    name: "iPhone 16 Pro",
    pixelRatio: 3,
    subcategory: "iPhone",
    width: 402,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 956,
    id: "iphone-16-pro-max",
    name: "iPhone 16 Pro Max",
    pixelRatio: 3,
    subcategory: "iPhone",
    width: 440,
  },

  // -------------------------------------------------------------
  // PHONES: Pixel
  // -------------------------------------------------------------
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 915,
    id: "pixel-7",
    name: "Pixel 7",
    pixelRatio: 2.625,
    subcategory: "Pixel",
    width: 412,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 915,
    id: "pixel-8",
    name: "Pixel 8",
    pixelRatio: 2.625,
    subcategory: "Pixel",
    width: 412,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 998,
    id: "pixel-8-pro",
    name: "Pixel 8 Pro",
    pixelRatio: 3,
    subcategory: "Pixel",
    width: 448,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 915,
    id: "pixel-8a",
    name: "Pixel 8a",
    pixelRatio: 2.625,
    subcategory: "Pixel",
    width: 412,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 915,
    id: "pixel-9",
    name: "Pixel 9",
    pixelRatio: 2.625,
    subcategory: "Pixel",
    width: 412,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 912,
    id: "pixel-9-pro",
    name: "Pixel 9 Pro",
    pixelRatio: 3,
    subcategory: "Pixel",
    width: 416,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 998,
    id: "pixel-9-pro-xl",
    name: "Pixel 9 Pro XL",
    pixelRatio: 3,
    subcategory: "Pixel",
    width: 448,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 915,
    id: "pixel-10",
    name: "Pixel 10",
    pixelRatio: 2.625,
    subcategory: "Pixel",
    width: 412,
  },

  // -------------------------------------------------------------
  // PHONES: Samsung
  // -------------------------------------------------------------
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 740,
    id: "galaxy-s8-plus",
    name: "Samsung Galaxy S8+",
    pixelRatio: 4,
    subcategory: "Samsung",
    width: 360,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 915,
    id: "galaxy-s20-ultra",
    name: "Samsung Galaxy S20 Ultra",
    pixelRatio: 3.5,
    subcategory: "Samsung",
    width: 412,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 854,
    id: "galaxy-a55",
    name: "Samsung Galaxy A55",
    pixelRatio: 2.75,
    subcategory: "Samsung",
    width: 384,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 914,
    id: "galaxy-a51-a71",
    name: "Samsung Galaxy A51 / A71",
    pixelRatio: 2.625,
    subcategory: "Samsung",
    width: 412,
  },

  // -------------------------------------------------------------
  // PHONES: Motorola
  // -------------------------------------------------------------
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 640,
    id: "moto-g4",
    name: "Moto G4",
    pixelRatio: 3,
    subcategory: "Motorola",
    width: 360,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 915,
    id: "moto-g-power",
    name: "Moto G Power",
    pixelRatio: 2.625,
    subcategory: "Motorola",
    width: 412,
  },

  // -------------------------------------------------------------
  // PHONES: Other
  // -------------------------------------------------------------
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 320,
    id: "jiophone-2",
    name: "JioPhone 2",
    pixelRatio: 1,
    subcategory: "Other",
    width: 240,
  },
  {
    category: "phone",
    defaultOrientation: "portrait",
    height: 800,
    id: "facebook-android",
    name: "Facebook on Android",
    pixelRatio: 2,
    subcategory: "Other",
    width: 360,
  },

  // -------------------------------------------------------------
  // FOLDABLES
  // -------------------------------------------------------------
  {
    category: "foldable",
    defaultOrientation: "portrait",
    foldedHeight: 720,
    foldedWidth: 540,
    height: 720,
    hinge: { position: "vertical", width: 28 },
    id: "surface-duo",
    isFoldable: true,
    name: "Surface Duo",
    pixelRatio: 2.5,
    subcategory: "Surface Duo",
    unfoldedHeight: 720,
    unfoldedWidth: 1114,
    width: 540,
  },
  {
    category: "foldable",
    defaultOrientation: "portrait",
    foldedHeight: 866,
    foldedWidth: 412,
    height: 866,
    id: "pixel-9-pro-fold",
    isFoldable: true,
    name: "Pixel 9 Pro Fold",
    pixelRatio: 3,
    subcategory: "Pixel Fold",
    unfoldedHeight: 1066,
    unfoldedWidth: 832,
    width: 412,
  },
  {
    category: "foldable",
    defaultOrientation: "portrait",
    foldedHeight: 902,
    foldedWidth: 344,
    height: 902,
    id: "galaxy-z-fold-5",
    isFoldable: true,
    name: "Galaxy Z Fold 5",
    pixelRatio: 3,
    subcategory: "Galaxy Z Fold",
    unfoldedHeight: 906,
    unfoldedWidth: 862,
    width: 344,
  },
  {
    category: "foldable",
    defaultOrientation: "portrait",
    foldedHeight: 861,
    foldedWidth: 348,
    height: 861,
    id: "galaxy-z-fold-6",
    isFoldable: true,
    name: "Galaxy Z Fold 6",
    pixelRatio: 3,
    subcategory: "Galaxy Z Fold",
    unfoldedHeight: 861,
    unfoldedWidth: 882,
    width: 348,
  },
  {
    category: "foldable",
    defaultOrientation: "portrait",
    foldedHeight: 640,
    foldedWidth: 1024,
    height: 1280,
    id: "asus-zenbook-fold",
    isFoldable: true,
    name: "Asus Zenbook Fold",
    pixelRatio: 2,
    subcategory: "Asus Zenbook Fold",
    unfoldedHeight: 1280,
    unfoldedWidth: 1024,
    width: 1024,
  },

  // -------------------------------------------------------------
  // TABLETS
  // -------------------------------------------------------------
  {
    category: "tablet",
    defaultOrientation: "portrait",
    height: 1024,
    id: "ipad-mini",
    name: "iPad Mini",
    pixelRatio: 2,
    subcategory: "iPad",
    width: 768,
  },
  {
    category: "tablet",
    defaultOrientation: "portrait",
    height: 1366,
    id: "ipad-pro-13",
    name: "iPad Pro 13",
    pixelRatio: 2,
    subcategory: "iPad",
    width: 1024,
  },
  {
    category: "tablet",
    defaultOrientation: "portrait",
    height: 1138,
    id: "galaxy-tab-s4",
    name: "Galaxy Tab S4",
    pixelRatio: 2.25,
    subcategory: "Galaxy Tab",
    width: 712,
  },
  {
    category: "tablet",
    defaultOrientation: "portrait",
    height: 1368,
    id: "surface-pro-7",
    name: "Surface Pro 7",
    pixelRatio: 2,
    subcategory: "Surface",
    width: 912,
  },
  {
    category: "tablet",
    defaultOrientation: "portrait",
    height: 1368,
    id: "surface-pro-10",
    name: "Surface Pro 10",
    pixelRatio: 2,
    subcategory: "Surface",
    width: 912,
  },

  // -------------------------------------------------------------
  // DESKTOPS
  // -------------------------------------------------------------
  {
    category: "desktop",
    defaultOrientation: "landscape",
    height: 768,
    id: "desktop-sm",
    name: "Small Desktop (1366×768)",
    subcategory: "Desktop",
    width: 1366,
  },
  {
    category: "desktop",
    defaultOrientation: "landscape",
    height: 900,
    id: "desktop",
    name: "Desktop (1440×900)",
    subcategory: "Desktop",
    width: 1440,
  },
  {
    category: "desktop",
    defaultOrientation: "landscape",
    height: 1080,
    id: "desktop-1080p",
    name: "Desktop 1080p (PC)",
    subcategory: "Desktop",
    width: 1920,
  },
  {
    category: "desktop",
    defaultOrientation: "landscape",
    height: 1440,
    id: "desktop-1440p",
    name: "Desktop 1440p (2K)",
    subcategory: "Desktop",
    width: 2560,
  },
  {
    category: "desktop",
    defaultOrientation: "landscape",
    height: 2160,
    id: "desktop-4k",
    name: "Desktop 4K",
    subcategory: "Desktop",
    width: 3840,
  },
  {
    category: "desktop",
    defaultOrientation: "landscape",
    height: 832,
    id: "macbook-air-13",
    name: 'MacBook Air 13"',
    subcategory: "Laptop",
    width: 1280,
  },
  {
    category: "desktop",
    defaultOrientation: "landscape",
    height: 982,
    id: "macbook-pro-14",
    name: 'MacBook Pro 14"',
    subcategory: "Laptop",
    width: 1512,
  },
  {
    category: "desktop",
    defaultOrientation: "landscape",
    height: 1117,
    id: "macbook-pro-16",
    name: 'MacBook Pro 16"',
    subcategory: "Laptop",
    width: 1728,
  },

  // -------------------------------------------------------------
  // SMART DISPLAYS
  // -------------------------------------------------------------
  {
    category: "smart-display",
    defaultOrientation: "landscape",
    height: 800,
    id: "nest-hub-max",
    name: "Nest Hub Max",
    pixelRatio: 1,
    subcategory: "Smart Display",
    width: 1280,
  },

  // -------------------------------------------------------------
  // GENERIC VIEWPORT CLASSES (not tied to a commercial model)
  // -------------------------------------------------------------
  ...genericPresets("phone", "portrait", [
    ["Small Phone", 320, 568],
    ["Compact Phone", 360, 800],
    ["Standard Phone", 375, 812],
    ["Standard Phone", 390, 844],
    ["Standard Phone", 393, 852],
    ["Large Phone", 414, 896],
    ["Large Modern Phone", 430, 932],
  ]),
  ...genericPresets("tablet", "portrait", [
    ["Small Tablet", 768, 1024],
    ["Standard Tablet", 810, 1080],
    ["Standard Tablet", 834, 1194],
    ["Large Tablet", 1024, 1366],
  ]),
  ...genericPresets("desktop", "landscape", [
    ["Laptop", 1280, 720],
    ["Laptop", 1536, 864],
    ["Desktop", 1600, 900],
  ]),
];

/** Map of device ID to Device object for O(1) lookups */
export const DEVICE_MAP = new Map<string, Device>(
  DEVICE_REGISTRY.map((d) => [d.id, d])
);

export interface Viewport {
  height: number;
  width: number;
}

/**
 * Calculates the exact simulated CSS viewport dimensions for any device,
 * orientation, and fold state.
 *
 * Guaranteed properties:
 * - Never returns physical pixel resolutions.
 * - Respects the device's native orientation and fold configuration.
 * - Responsive fluid devices with width=0 return { width: 0, height: 0 }.
 */
export function getViewportDimensions(
  device: Device,
  orientation: Orientation,
  foldState: "folded" | "unfolded" = "unfolded"
): Viewport {
  if (device.category === "responsive" && device.width === 0) {
    return { height: 0, width: 0 };
  }

  let baseW = device.width;
  let baseH = device.height;

  if (device.isFoldable) {
    if (foldState === "folded" && device.foldedWidth && device.foldedHeight) {
      baseW = device.foldedWidth;
      baseH = device.foldedHeight;
    } else if (device.unfoldedWidth && device.unfoldedHeight) {
      baseW = device.unfoldedWidth;
      baseH = device.unfoldedHeight;
    }
  }

  const isNaturallyLandscape =
    device.defaultOrientation === "landscape" ||
    device.category === "desktop" ||
    device.category === "smart-display";

  if (isNaturallyLandscape) {
    return orientation === "landscape"
      ? { height: baseH, width: baseW }
      : { height: baseW, width: baseH };
  }

  return orientation === "portrait"
    ? { height: baseH, width: baseW }
    : { height: baseW, width: baseH };
}

// -----------------------------------------------------------------
// Custom viewport
// -----------------------------------------------------------------

const DIGITS_ONLY = /^\d{1,5}$/;

type Axis = "width" | "height";

const limitsFor = (axis: Axis) =>
  axis === "width"
    ? { max: CUSTOM_LIMITS.maxWidth, min: CUSTOM_LIMITS.minWidth }
    : { max: CUSTOM_LIMITS.maxHeight, min: CUSTOM_LIMITS.minHeight };

/** Clamps a custom dimension into range. Non-finite input falls back to `fallback`. */
export function clampDimension(
  value: number,
  axis: Axis,
  fallback: number
): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const { max, min } = limitsFor(axis);
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Parses text typed into a custom width/height field. Only plain positive integers are
 * accepted (no signs, decimals, exponents or units); anything else returns an error.
 */
export function parseDimensionInput(
  raw: string,
  axis: Axis
): { error?: string; value: number | null } {
  const text = raw.trim();
  if (text === "") {
    return { error: "Required", value: null };
  }
  if (!DIGITS_ONLY.test(text)) {
    return { error: "Digits only", value: null };
  }
  const n = Number(text);
  const { max, min } = limitsFor(axis);
  if (n < min || n > max) {
    return { error: `${min}–${max}`, value: null };
  }
  return { value: n };
}

export function makeCustomDevice(width: number, height: number): Device {
  const w = clampDimension(width, "width", DEFAULT_CUSTOM_SIZE.width);
  const h = clampDimension(height, "height", DEFAULT_CUSTOM_SIZE.height);
  return {
    category: "custom",
    defaultOrientation: w > h ? "landscape" : "portrait",
    height: h,
    id: CUSTOM_DEVICE_ID,
    name: "Custom",
    subcategory: "Custom",
    width: w,
  };
}

export function isFluidDevice(device: Device): boolean {
  return device.category === "responsive" && device.width === 0;
}

export interface ResolvedViewport {
  device: Device;
  /** Fluid viewports have no fixed size: they fill the canvas at 1:1. */
  fluid: boolean;
  /** The CSS-pixel viewport the page sees (0×0 while fluid). */
  viewport: Viewport;
}

/**
 * Single source of truth for "what viewport is being simulated". Custom sizes are the
 * exact width × height entered; rotating a custom size swaps them (see `rotateCustom`).
 */
export function resolveViewport(
  deviceId: string,
  orientation: Orientation,
  foldState: "folded" | "unfolded",
  custom: Viewport
): ResolvedViewport {
  if (deviceId === CUSTOM_DEVICE_ID) {
    const device = makeCustomDevice(custom.width, custom.height);
    return {
      device,
      fluid: false,
      viewport: { height: device.height, width: device.width },
    };
  }
  const device = DEVICE_MAP.get(deviceId) ?? DEVICE_REGISTRY[0];
  if (!device) {
    throw new Error("Device registry is empty");
  }
  return {
    device,
    fluid: isFluidDevice(device),
    viewport: getViewportDimensions(device, orientation, foldState),
  };
}

/** Orientation a viewport is currently in, judged by its own dimensions. */
export function orientationOf(viewport: Viewport): Orientation {
  return viewport.width > viewport.height ? "landscape" : "portrait";
}

// -----------------------------------------------------------------
// Zoom
// -----------------------------------------------------------------

const EPSILON = 0.005;

export function clampZoom(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

/** Next manual zoom above `scale`. From Fit, pass the current fit scale. */
export function zoomInFrom(scale: number): number {
  return ZOOM_STEPS.find((z) => z > scale + EPSILON) ?? MAX_ZOOM;
}

/** Next manual zoom below `scale`. */
export function zoomOutFrom(scale: number): number {
  for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
    const z = ZOOM_STEPS[i];
    if (z !== undefined && z < scale - EPSILON) {
      return z;
    }
  }
  return MIN_ZOOM;
}

export const canZoomIn = (scale: number): boolean => scale < MAX_ZOOM - EPSILON;

export const canZoomOut = (scale: number): boolean =>
  scale > MIN_ZOOM + EPSILON;

/** "Fit" for fit mode, otherwise the manual percentage, e.g. "125%". */
export function formatZoom(zoom: ZoomLevel): string {
  return zoom === "fit" ? "Fit" : `${Math.round(zoom * 100)}%`;
}

/** Breathing room kept between the preview and the canvas edge when fitting. */
export const FIT_MARGIN = 16;

/**
 * Largest scale at which the viewport fits inside the canvas while keeping its
 * aspect ratio. `canvasW/H` are the scroll container's client size (excluding
 * scrollbars); `margin` is kept free on every side. Never upscales past 1:1: a
 * viewport that already fits is shown at true size.
 */
export function computeFitScale(
  viewportW: number,
  viewportH: number,
  canvasW: number,
  canvasH: number,
  margin = FIT_MARGIN
): number {
  if (viewportW <= 0 || viewportH <= 0 || canvasW <= 0 || canvasH <= 0) {
    return 1;
  }
  const availW = Math.max(1, canvasW - margin * 2);
  const availH = Math.max(1, canvasH - margin * 2);
  return Math.min(availW / viewportW, availH / viewportH, 1);
}

// -----------------------------------------------------------------
// Backward Compatibility Layer
// -----------------------------------------------------------------
export type ViewportId = string;

export interface ViewportPreset {
  height: number | null;
  id: ViewportId;
  label: string;
  width: number | null;
}

export const VIEWPORTS: ViewportPreset[] = DEVICE_REGISTRY.map((d) => ({
  height: d.height > 0 ? d.height : null,
  id: d.id,
  label: `${d.name}${d.width > 0 ? ` (${d.width}×${d.height})` : ""}`,
  width: d.width > 0 ? d.width : null,
}));

export function naturalOrientationFor(preset: ViewportPreset): Orientation {
  const device = DEVICE_MAP.get(preset.id);
  if (device?.defaultOrientation) {
    return device.defaultOrientation;
  }
  if (preset.width === null || preset.height === null) {
    return "portrait";
  }
  return preset.width > preset.height ? "landscape" : "portrait";
}

export interface FrameLayout {
  innerHeight: string;
  innerWidth: string;
  outerHeight: string;
  outerWidth: string;
  scale: number;
}

export function frameLayout(
  preset: ViewportPreset,
  orientation: Orientation,
  scale: number
): FrameLayout {
  const inner = `${100 / scale}%`;
  const device = DEVICE_MAP.get(preset.id);
  if (!device || (preset.width === null && preset.height === null)) {
    return {
      innerHeight: inner,
      innerWidth: inner,
      outerHeight: "100%",
      outerWidth: "100%",
      scale,
    };
  }

  const dims = getViewportDimensions(device, orientation);
  return {
    innerHeight: inner,
    innerWidth: inner,
    outerHeight: `${Math.round(dims.height * scale)}px`,
    outerWidth: `${Math.round(dims.width * scale)}px`,
    scale,
  };
}
