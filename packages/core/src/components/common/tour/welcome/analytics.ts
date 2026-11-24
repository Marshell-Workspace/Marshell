/**
 * analytics.ts — Welcome Scene Tour Analytics.
 *
 * Emits strictly privacy-preserving telemetry via "tour.events" localStorage key:
 * - welcome_view { replay }
 * - welcome_ready { msToReady }
 * - welcome_fastforward { atMs }
 * - welcome_start { msSinceReady }
 * - welcome_skip { phase: "intro" | "ready", atMs }
 *
 * NO personal names or identifying metadata are ever captured.
 */

export type WelcomeTourEvent =
  | { name: "welcome_view"; payload: { replay: boolean } }
  | { name: "welcome_ready"; payload: { msToReady: number } }
  | { name: "welcome_fastforward"; payload: { atMs: number } }
  | { name: "welcome_start"; payload: { msSinceReady: number } }
  | {
      name: "welcome_skip";
      payload: { phase: "intro" | "ready"; atMs: number };
    };

export function logTourEvent(
  name: string,
  payload: Record<string, unknown> = {}
): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const raw = localStorage.getItem("tour.events");
    const events: Array<{
      event: string;
      payload: Record<string, unknown>;
      timestamp: number;
    }> = raw ? JSON.parse(raw) : [];

    events.push({ event: name, payload, timestamp: Date.now() });

    // Keep bounded history (last 100 events)
    if (events.length > 100) {
      events.splice(0, events.length - 100);
    }
    localStorage.setItem("tour.events", JSON.stringify(events));
  } catch {
    // Gracefully ignore quota or serialization errors
  }
}
