"use client";

import {
  CUSTOM_DEVICE_ID,
  clampDimension,
  DEFAULT_CUSTOM_SIZE,
  DEVICE_MAP,
  type Orientation,
  type ZoomLevel,
} from "@workspace/core/lib/preview-viewports";
import { safeStorage } from "@workspace/core/lib/safe-json";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface PreviewState {
  customHeight: number;
  customWidth: number;
  deviceId: string;
  foldState: "folded" | "unfolded";
  isFullscreen: boolean;
  orientation: Orientation;
  requested: Record<string, string | undefined>;
  /** Asks the preview to open an address (not persisted); the preview consumes it. */
  requestOpen: (workspaceId: string, url: string) => void;
  /** Selects the Custom device at an exact size (clamped to the allowed range). */
  setCustomSize: (width: number, height: number) => void;
  /** Switches device: resets to the device's natural orientation, unfolded, and Fit. */
  setDevice: (id: string) => void;
  setFoldState: (s: "folded" | "unfolded") => void;
  setOrientation: (o: Orientation) => void;
  /** Last previewed address per workspace, so switching back restores it. */
  setUrl: (workspaceId: string, url: string) => void;
  setZoom: (z: ZoomLevel) => void;
  takeRequest: (workspaceId: string) => string | undefined;
  toggleFullscreen: () => void;
  urls: Record<string, string>;
  zoom: ZoomLevel;
}

export const usePreviewStore = create<PreviewState>()(
  persist(
    (set, get) => ({
      customHeight: DEFAULT_CUSTOM_SIZE.height,
      customWidth: DEFAULT_CUSTOM_SIZE.width,
      deviceId: "iphone-15",
      foldState: "unfolded",
      isFullscreen: false,
      orientation: "portrait",
      requested: {},
      requestOpen: (workspaceId, url) =>
        set((s) => ({ requested: { ...s.requested, [workspaceId]: url } })),
      setCustomSize: (width, height) =>
        set({
          customHeight: clampDimension(
            height,
            "height",
            DEFAULT_CUSTOM_SIZE.height
          ),
          customWidth: clampDimension(
            width,
            "width",
            DEFAULT_CUSTOM_SIZE.width
          ),
          deviceId: CUSTOM_DEVICE_ID,
        }),
      setDevice: (id) => {
        const known = id === CUSTOM_DEVICE_ID || DEVICE_MAP.has(id);
        if (!known) {
          return;
        }
        set((s) => ({
          deviceId: id,
          foldState: "unfolded",
          orientation: DEVICE_MAP.get(id)?.defaultOrientation ?? s.orientation,
          zoom: "fit",
        }));
      },
      setFoldState: (s) => set({ foldState: s }),
      setOrientation: (o) => set({ orientation: o }),
      setUrl: (workspaceId, url) =>
        set((s) => ({ urls: { ...s.urls, [workspaceId]: url } })),
      setZoom: (z) => set({ zoom: z }),
      takeRequest: (workspaceId) => {
        const url = get().requested[workspaceId];
        if (url !== undefined) {
          set((s) => ({
            requested: { ...s.requested, [workspaceId]: undefined },
          }));
        }
        return url;
      },
      toggleFullscreen: () => set((s) => ({ isFullscreen: !s.isFullscreen })),
      urls: {},
      zoom: "fit",
    }),
    {
      name: "marshell.preview.v3",
      // Zoom is deliberately not persisted: the preview always opens in Fit.
      partialize: (state) => ({
        customHeight: state.customHeight,
        customWidth: state.customWidth,
        deviceId: state.deviceId,
        foldState: state.foldState,
        orientation: state.orientation,
        urls: state.urls,
      }),
      storage: createJSONStorage(() => safeStorage),
    }
  )
);
