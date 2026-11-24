"use client";

import type { SweepState } from "@workspace/core/components/preview/preview-health";
import type { QaReport } from "@workspace/core/lib/preview-bridge";
import { QA_BREAKPOINTS } from "@workspace/core/lib/preview-qa";
import {
  CUSTOM_DEVICE_ID,
  type Orientation,
  type ZoomLevel,
} from "@workspace/core/lib/preview-viewports";
import { usePreviewStore } from "@workspace/core/stores/preview-store";
import { useCallback, useEffect, useRef, useState } from "react";

/** How long to wait for the page to report at a width before recording "no report". */
const REPORT_TIMEOUT_MS = 3000;

interface Snapshot {
  customHeight: number;
  customWidth: number;
  deviceId: string;
  foldState: "folded" | "unfolded";
  height: number;
  orientation: Orientation;
  zoom: ZoomLevel;
}

interface Run {
  index: number;
  results: SweepState["results"];
  snapshot: Snapshot;
}

/**
 * Steps the preview through the QA breakpoint widths (as a Custom viewport), records
 * whether the page scrolls sideways at each, then restores the previous viewport.
 */
export function usePreviewSweep(
  report: QaReport | null,
  currentHeight: number
): SweepState {
  const [run, setRun] = useState<Run | null>(null);
  const [lastResults, setLastResults] = useState<SweepState["results"]>([]);
  const heightRef = useRef(currentHeight);
  heightRef.current = currentHeight;

  const finish = useCallback((snapshot: Snapshot) => {
    const store = usePreviewStore.getState();
    if (snapshot.deviceId === CUSTOM_DEVICE_ID) {
      store.setCustomSize(snapshot.customWidth, snapshot.customHeight);
    } else {
      store.setDevice(snapshot.deviceId);
      store.setOrientation(snapshot.orientation);
      store.setFoldState(snapshot.foldState);
    }
    store.setZoom(snapshot.zoom);
    setRun(null);
  }, []);

  const onRun = useCallback(() => {
    const s = usePreviewStore.getState();
    setLastResults([]);
    setRun({
      index: 0,
      results: [],
      snapshot: {
        customHeight: s.customHeight,
        customWidth: s.customWidth,
        deviceId: s.deviceId,
        foldState: s.foldState,
        height: heightRef.current,
        orientation: s.orientation,
        zoom: s.zoom,
      },
    });
  }, []);

  const onCancel = useCallback(() => {
    if (run) {
      setLastResults(run.results);
      finish(run.snapshot);
    }
  }, [run, finish]);

  const index = run?.index;
  const width = index === undefined ? undefined : QA_BREAKPOINTS[index];

  // Move the viewport to the current breakpoint, or wrap up when all are done.
  useEffect(() => {
    if (!run) {
      return;
    }
    if (width === undefined) {
      setLastResults(run.results);
      finish(run.snapshot);
      return;
    }
    const store = usePreviewStore.getState();
    store.setZoom("fit");
    store.setCustomSize(width, run.snapshot.height);
  }, [run?.index, width]);

  const record = useCallback((overflow: number | null) => {
    setRun((current) => {
      const w = current ? QA_BREAKPOINTS[current.index] : undefined;
      if (!current || w === undefined) {
        return current;
      }
      return {
        ...current,
        index: current.index + 1,
        results: [...current.results, { overflow, width: w }],
      };
    });
  }, []);

  // Record the result once the page reports at the target width.
  useEffect(() => {
    if (width === undefined || !report || report.viewportWidth !== width) {
      return;
    }
    record(Math.max(0, report.documentWidth - report.viewportWidth));
  }, [report, width, record]);

  // Don't hang on pages that never report (crashed, blank, still loading).
  useEffect(() => {
    if (width === undefined) {
      return;
    }
    const timer = setTimeout(() => record(null), REPORT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [width, index, record]);

  return {
    onCancel,
    onRun,
    results: run ? run.results : lastResults,
    running: run !== null,
  };
}
