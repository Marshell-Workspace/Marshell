"use client";

import type { NotificationType } from "@workspace/core/config/notifications";
import { PageVisibilityCoordinator } from "@workspace/core/lib/hardware/visibility-manager";
import { useGeneralSettingsStore } from "@workspace/core/stores/general-settings-store";
import { useNotificationStore } from "@workspace/core/stores/notification-store";
import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import { toast } from "sonner";

export interface MarshellNotificationOptions {
  avatar?: string;
  category?: string;
  dedupeKey?: string;
  description: string;
  forceToast?: boolean;
  iconName?: string;
  priority?: "low" | "normal" | "high" | "critical";
  skipNative?: boolean;
  skipToast?: boolean;
  targetSessionId?: string;
  targetWorkspaceId?: string;
  title: string;
  type?: NotificationType;
}

const recentDedupeKeys = new Map<string, number>();
const DEDUPE_WINDOW_MS = 8000;

export function checkIsNativeApp(): boolean {
  if (
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_IS_NATIVE === "true"
  ) {
    return true;
  }

  if (
    typeof window !== "undefined" &&
    ("__TAURI__" in window ||
      "__TAURI_INTERNALS__" in window ||
      "__TAURI_POST_MESSAGE__" in window)
  ) {
    return true;
  }

  return false;
}

export function checkIsUserInApp(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  // 1. Check HTML5 Page Visibility API (minimized window or hidden tab)
  if (document.hidden || document.visibilityState === "hidden") {
    return false;
  }

  // 2. Check window / document focus
  if (typeof document.hasFocus === "function" && !document.hasFocus()) {
    return false;
  }

  // 3. Check PageVisibilityCoordinator (tracks native desktop window focus events)
  try {
    const status = PageVisibilityCoordinator.getInstance().getStatus();
    if (!(status.isFocused && status.isVisible)) {
      return false;
    }
  } catch {
    // Fallback gracefully
  }

  return true;
}

export function formatNotificationPayload(
  options: MarshellNotificationOptions
): {
  title: string;
  description: string;
  type: NotificationType;
} {
  const type = options.type || "info";
  let title = (options.title || "Marshell").trim();
  let rawText = (options.description || "").trim();

  // Strip prefix "Task finished:" or "Task failed:" if present
  rawText = rawText.replace(
    /^(Task finished:\s*|Task failed:\s*|Task cancelled:\s*)/i,
    ""
  );

  // Strip leading and trailing quotes if wrapped
  if (
    (rawText.startsWith('"') && rawText.endsWith('"')) ||
    (rawText.startsWith("'") && rawText.endsWith("'"))
  ) {
    rawText = rawText.slice(1, -1).trim();
  }

  // Remove markdown headers
  rawText = rawText.replace(/^#{1,6}\s+/gm, "");

  // Remove bold/italic markdown (**text**, *text*, __text__)
  rawText = rawText.replace(/(\*\*|__)(.*?)\1/g, "$2");
  rawText = rawText.replace(/(\*|_)(.*?)\1/g, "$2");

  // Remove inline code blocks and code fences (`code` or ```code```)
  rawText = rawText.replace(/```[\s\S]*?```/g, "");
  rawText = rawText.replace(/`([^`]+)`/g, "$1");

  // Remove bullet points/list markers (- item, * item, 1. item)
  rawText = rawText.replace(/^\s*[-*+]\s+/gm, "");
  rawText = rawText.replace(/^\s*\d+\.\s+/gm, "");

  // Collapse multiple newlines/spaces into single spaces
  rawText = rawText.replace(/\s+/g, " ").trim();

  // Filter out internal technical/orchestration logs (like Task Classification, Terminals Used, etc.)
  const isTechnicalJargon =
    /^(task classification|classification type|terminals used|terminal execution|executing orchestration|iteration \d+|step \d+|`|\{|\[)/i.test(
      rawText
    ) ||
    rawText.includes("Task Classification Type") ||
    rawText.includes("Terminals Used");

  let formattedDescription = isTechnicalJargon ? "" : rawText;

  const lowerTitle = title.toLowerCase();
  const isWaiting =
    lowerTitle.includes("waiting") ||
    lowerTitle.includes("answer") ||
    lowerTitle.includes("input") ||
    lowerTitle.includes("question") ||
    options.category === "waiting";

  const isApproval =
    lowerTitle.includes("approval") || options.category === "approval";

  const isFailed =
    lowerTitle.includes("failed") ||
    lowerTitle.includes("error") ||
    type === "error";

  const isCompleted =
    lowerTitle.includes("completed") ||
    lowerTitle.includes("finished") ||
    lowerTitle.includes("done") ||
    type === "success";

  // Provide simple, clean, meaningful English wording for each scenario
  if (isWaiting) {
    title = "Response Needed";
    formattedDescription = "Marshell is waiting for your answer.";
  } else if (isApproval) {
    title = "Approval Required";
    formattedDescription = "Marshell needs your approval to proceed.";
  } else if (isFailed) {
    title = "Task Issue";
    formattedDescription =
      formattedDescription &&
      !formattedDescription.toLowerCase().includes("error")
        ? formattedDescription
        : "Marshell encountered an issue while working on your task.";
  } else if (isCompleted) {
    title = "Task Completed";
    formattedDescription =
      formattedDescription && formattedDescription.length > 5
        ? formattedDescription
        : "Marshell has finished your task successfully.";
  } else if (!formattedDescription) {
    title = "Marshell";
    formattedDescription = "Marshell has an update for you.";
  }

  if (formattedDescription.length > 90) {
    formattedDescription = `${formattedDescription.slice(0, 87).trim()}...`;
  }

  return {
    title,
    description: formattedDescription,
    type,
  };
}

interface ChimeNote {
  /** Seconds after the chime starts. */
  at: number;
  /** Peak gain (0..1) before the master level. */
  gain: number;
  hz: number;
  /** Ring-out length in seconds. */
  length: number;
}

const CHIMES: Record<"success" | "error" | "info", ChimeNote[]> = {
  // Two soft bell notes, a perfect fifth apart (E5 then B5).
  info: [
    { hz: 659.25, at: 0, length: 0.9, gain: 0.9 },
    { hz: 987.77, at: 0.11, length: 1.1, gain: 0.7 },
  ],
  // Bright rising major arpeggio (C5 E5 G5 C6).
  success: [
    { hz: 523.25, at: 0, length: 0.7, gain: 0.8 },
    { hz: 659.25, at: 0.08, length: 0.8, gain: 0.8 },
    { hz: 783.99, at: 0.16, length: 0.9, gain: 0.8 },
    { hz: 1046.5, at: 0.25, length: 1.3, gain: 0.7 },
  ],
  // Gentle falling minor third: attention without alarm (A4 then F#4).
  error: [
    { hz: 440, at: 0, length: 0.8, gain: 0.85 },
    { hz: 369.99, at: 0.14, length: 1.1, gain: 0.8 },
  ],
};

/** One bell-like note: sine fundamental + soft overtone, click-free envelope. */
function ringBell(
  ctx: AudioContext,
  destination: AudioNode,
  note: ChimeNote,
  start: number
) {
  const t0 = start + note.at;
  const partials: [number, number][] = [
    [1, 1],
    [2.01, 0.28],
    [3.97, 0.07],
  ];
  for (const [ratio, level] of partials) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(note.hz * ratio, t0);
    const peak = note.gain * level;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.008);
    // Higher partials die faster, like a real struck bell.
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      t0 + note.length / Math.max(1, ratio * 0.6)
    );
    osc.connect(gain);
    gain.connect(destination);
    osc.start(t0);
    osc.stop(t0 + note.length + 0.05);
  }
}

export function playNotificationSound(
  type: "success" | "error" | "info" = "info"
): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) {
      return;
    }
    const ctx = new AudioCtx();
    const now = ctx.currentTime + 0.02;

    // Master: soft level, gentle low-pass, light compression so it never bites.
    const master = ctx.createGain();
    master.gain.value = 0.16;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 5200;
    const limiter = ctx.createDynamicsCompressor();
    master.connect(tone);
    tone.connect(limiter);
    limiter.connect(ctx.destination);

    // A short, quiet echo gives the chime some air.
    const echo = ctx.createDelay(0.5);
    echo.delayTime.value = 0.17;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.22;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    master.connect(echo);
    echo.connect(feedback);
    feedback.connect(echo);
    echo.connect(wet);
    wet.connect(tone);

    const chime = CHIMES[type] ?? CHIMES.info;
    let end = 0;
    for (const note of chime) {
      ringBell(ctx, master, note, now);
      end = Math.max(end, note.at + note.length);
    }
    if (typeof ctx.close === "function") {
      setTimeout(
        () => {
          ctx.close().catch(() => {});
        },
        (end + 1.2) * 1000
      );
    }
  } catch {
    // Ignore audio context errors
  }
}

export function isNativeNotificationsEnabled(): boolean {
  const settings = useGeneralSettingsStore.getState();
  return (
    settings.nativeBanners &&
    (!isMacNativeApp() || settings.macNativeNotificationConsent)
  );
}

export type DesktopPlatform = "windows" | "mac" | "linux" | "other";

/** Which desktop OS the webview runs on (drives native-notification wording and paths). */
export function getDesktopPlatform(): DesktopPlatform {
  if (typeof navigator === "undefined") {
    return "other";
  }
  const hints = [
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform,
    navigator.platform,
    navigator.userAgent,
  ].filter(Boolean) as string[];
  const any = (re: RegExp) => hints.some((hint) => re.test(hint));
  if (any(/windows|win32|win64/i)) {
    return "windows";
  }
  if (any(/macintosh|macintel|macppc|mac68k|macos|mac os/i)) {
    return "mac";
  }
  if (any(/linux|x11|cros/i) && !any(/android/i)) {
    return "linux";
  }
  return "other";
}

function isMacNativeApp(): boolean {
  return checkIsNativeApp() && getDesktopPlatform() === "mac";
}

export function setNativeNotificationsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  useGeneralSettingsStore.getState().setNativeBanners(enabled);
  localStorage.setItem(
    "marshell_native_notifications_enabled",
    enabled ? "true" : "false"
  );
}

function handleNotificationClick({
  targetWorkspaceId,
}: {
  targetWorkspaceId?: string;
  targetSessionId?: string;
}) {
  const workspaceState = useWorkspaceStore.getState();

  if (
    targetWorkspaceId &&
    targetWorkspaceId !== workspaceState.activeWorkspaceId
  ) {
    workspaceState.setActiveWorkspace(targetWorkspaceId);
  }
}

let isNotificationListenerInitialized = false;
let notificationPermissionFlight: Promise<boolean> | null = null;

/** Call from a user gesture in Settings, never from background task delivery. */
export async function requestNativeNotificationPermission(): Promise<boolean> {
  if (!checkIsNativeApp()) {
    return false;
  }
  if (notificationPermissionFlight) {
    return await notificationPermissionFlight;
  }
  notificationPermissionFlight = (async () => {
    const { isPermissionGranted, requestPermission } = await import(
      "@tauri-apps/plugin-notification"
    );
    const granted =
      (await isPermissionGranted()) ||
      (await requestPermission()) === "granted";
    // Desktop Tauri reports Granted even before macOS authorization is known.
    // An explicit Settings gesture must precede any Mac native send, which may
    // itself cause the first OS prompt. Never infer this opt-in at startup.
    if (isMacNativeApp()) {
      useGeneralSettingsStore
        .getState()
        .setMacNativeNotificationConsent(granted);
    }
    return granted;
  })();
  try {
    return await notificationPermissionFlight;
  } finally {
    notificationPermissionFlight = null;
  }
}

async function setupNativeNotificationListener() {
  if (isNotificationListenerInitialized || !checkIsNativeApp()) {
    return;
  }
  try {
    // `onAction` from @tauri-apps/plugin-notification calls
    // `addPluginListener('notification', 'actionPerformed', cb)` which invokes
    // `plugin:notification|registerListener` on the Rust backend.
    // This command is ONLY registered on Android/iOS by the notification plugin.
    // On Windows/macOS/Linux desktop, the command does not exist and always throws:
    //   notification.registerListener not allowed. Command not found
    //
    // Guard: only attempt this on mobile user agents. We use navigator.userAgent
    // rather than @tauri-apps/plugin-os to avoid adding a new dependency.
    const isMobile =
      /android/i.test(navigator.userAgent) ||
      /iphone|ipad|ipod/i.test(navigator.userAgent);

    if (isMobile) {
      const { onAction } = await import("@tauri-apps/plugin-notification");
      await onAction((notification) => {
        const extra = notification.extra as
          | { targetWorkspaceId?: string; targetSessionId?: string }
          | undefined;
        handleNotificationClick({
          targetWorkspaceId: extra?.targetWorkspaceId,
          targetSessionId: extra?.targetSessionId,
        });
      });
    }
    // Mark as initialized regardless — on desktop we intentionally skip registration
    // and don't want repeated attempts on every notification call.
    isNotificationListenerInitialized = true;
  } catch (error) {
    console.warn(
      "Failed to initialize native notification action listener:",
      error
    );
  }
}

export async function sendNativeNotification(
  options: MarshellNotificationOptions
): Promise<boolean> {
  if (!checkIsNativeApp()) {
    return false;
  }

  if (!isNativeNotificationsEnabled()) {
    return false;
  }

  try {
    await setupNativeNotificationListener();

    const formatted = formatNotificationPayload(options);

    // 1. Dispatch via native Marshell Rust notification handler.
    // This directly utilizes WinRT with the registered "com.marshell.app" identity
    // and the Marshell application icon, completely preventing the default
    // Tauri fallback that displays "Windows PowerShell".
    if (getDesktopPlatform() === "windows") {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("send_native_notification", {
          title: formatted.title,
          body: formatted.description,
        });
        return true;
      } catch (invokeError) {
        console.warn(
          "Direct Marshell native notification invoke failed, falling back to plugin:",
          invokeError
        );
      }
    }

    const { isPermissionGranted, sendNotification } = await import(
      "@tauri-apps/plugin-notification"
    );

    if (!(await isPermissionGranted())) {
      return false;
    }

    sendNotification({
      title: formatted.title,
      body: formatted.description,
      largeBody:
        formatted.description.length > 60 ? formatted.description : undefined,
      extra: {
        targetWorkspaceId: options.targetWorkspaceId,
        targetSessionId: options.targetSessionId,
      },
    });

    return true;
  } catch (error) {
    // Distinguish between different failure modes for better diagnostics
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("permission")) {
      console.warn(
        "Marshell notification: permission not available —",
        message
      );
    } else if (
      message.includes("not found") ||
      message.includes("not implemented")
    ) {
      console.warn(
        "Marshell notification: plugin not available on this platform —",
        message
      );
    } else {
      console.warn("Marshell notification: dispatch failed —", message);
    }

    return false;
  }
}

export function triggerNotification(
  options: MarshellNotificationOptions
): void {
  const formatted = formatNotificationPayload(options);

  const workspaceId =
    options.targetWorkspaceId ||
    useWorkspaceStore.getState().activeWorkspaceId ||
    "default";
  // When the user is actively inside Marshell, suppress popups so notifications
  // are delivered directly to the notification icon center in the top bar.
  const isUserInApp = checkIsUserInApp();

  const settings = useGeneralSettingsStore.getState();

  const isPermission =
    options.category === "permission" ||
    options.category === "approval" ||
    /permission|approval/i.test(options.title);
  if (isPermission && !settings.permissionRequests) {
    return;
  }

  const isScheduled =
    options.category === "cron" ||
    options.category === "schedule" ||
    options.category === "subagent" ||
    (!options.category && /scheduled|cron/i.test(options.title));
  if (isScheduled && !settings.scheduledTasks) {
    return;
  }

  const isCodeNotification =
    options.category === "code" ||
    options.category === "build" ||
    options.category === "test" ||
    options.category === "execution" ||
    (!options.category && /build|test|compile|execution/i.test(options.title));
  if (isCodeNotification && !settings.codeNotifications) {
    return;
  }

  const isTaskIssue =
    formatted.title.toLowerCase().includes("issue") ||
    formatted.title.toLowerCase().includes("failed") ||
    formatted.type === "error";
  const isTaskCompleted =
    formatted.title.toLowerCase().includes("completed") ||
    formatted.title.toLowerCase().includes("finished") ||
    formatted.type === "success";

  const isResponseCompletion =
    (isTaskCompleted || isTaskIssue || options.category === "agent") &&
    !isPermission &&
    !isScheduled &&
    !isCodeNotification;
  if (isResponseCompletion && !settings.responseCompletions) {
    return;
  }

  const dedupeKey =
    options.dedupeKey || `${formatted.title}:${formatted.description}`;
  const now = Date.now();

  const lastSeen = recentDedupeKeys.get(dedupeKey);
  if (lastSeen && now - lastSeen < DEDUPE_WINDOW_MS) {
    return;
  }
  recentDedupeKeys.set(dedupeKey, now);

  if (recentDedupeKeys.size > 100) {
    for (const [key, timestamp] of recentDedupeKeys.entries()) {
      if (now - timestamp > DEDUPE_WINDOW_MS) {
        recentDedupeKeys.delete(key);
      }
    }
  }

  if (settings.soundCues) {
    playNotificationSound(
      formatted.type === "error"
        ? "error"
        : formatted.type === "success"
          ? "success"
          : "info"
    );
  }

  const shouldSkipToast =
    options.skipToast || (!options.forceToast && isUserInApp);
  const shouldSkipNative =
    options.skipNative ||
    isUserInApp ||
    !settings.nativeBanners ||
    !isNativeNotificationsEnabled();

  useNotificationStore.getState().addNotification({
    title: formatted.title,
    description: formatted.description,
    type: formatted.type,
    category: options.category || "agent",
    avatar: options.avatar,
    iconName:
      options.iconName ||
      (isTaskIssue
        ? "ClipboardX"
        : isTaskCompleted
          ? "ClipboardCheck"
          : undefined),
    targetWorkspaceId: workspaceId,
    targetSessionId: options.targetSessionId,
  });

  if (!shouldSkipToast) {
    const showToast =
      formatted.type === "system" ? toast : toast[formatted.type];
    showToast(formatted.title, {
      id: dedupeKey,
      description: formatted.description || undefined,
      closeButton: true,
      action: options.targetSessionId
        ? {
            label: "View",
            onClick: () => {
              handleNotificationClick({
                targetWorkspaceId: workspaceId,
                targetSessionId: options.targetSessionId,
              });
            },
          }
        : undefined,
    });
  }

  if (!shouldSkipNative) {
    sendNativeNotification({
      ...options,
      targetWorkspaceId: workspaceId,
    }).catch(() => {});
  }
}

/** @deprecated Works on every desktop OS now; use `sendNativeNotification`. */
export const sendNativeWindowsNotification = sendNativeNotification;

export const notifyMarshell = triggerNotification;
