import { triggerNotification } from "@workspace/core/lib/notification-service";

type Kind = "error" | "info" | "success" | "warning";

/**
 * Tell the user something happened: an in-app toast, plus a desktop notification when the app
 * is in the background (the notification service decides), de-duplicated for a few seconds.
 */
export function notify(
  title: string,
  description: string,
  kind: Kind = "info",
  options: {
    category?: string;
    dedupeKey?: string;
    native?: boolean;
    workspaceId?: string;
  } = {}
): void {
  triggerNotification({
    category: options.category ?? "code",
    dedupeKey: options.dedupeKey,
    description,
    skipNative: options.native === false,
    targetWorkspaceId: options.workspaceId,
    title,
    type: kind,
  });
}
