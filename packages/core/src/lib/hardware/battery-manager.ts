/**
 * Hardware Battery Sensory Manager for Marshell Eco Mode.
 *
 * Provides a unified, event-driven interface to the W3C Battery Status API
 * with zero-overhead fallback for unsupported browsers and desktop runtimes.
 */

export interface BatteryStatus {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  isCritical: boolean; // level <= 10 && !charging
  isLow: boolean; // level <= 20 && !charging
  level: number; // 0 to 100
  supported: boolean;
}

interface W3CBatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  onchargingchange: ((this: W3CBatteryManager, ev: Event) => void) | null;
  onchargingtimechange: ((this: W3CBatteryManager, ev: Event) => void) | null;
  ondischargingtimechange:
    | ((this: W3CBatteryManager, ev: Event) => void)
    | null;
  onlevelchange: ((this: W3CBatteryManager, ev: Event) => void) | null;
}

type BatterySubscriber = (status: BatteryStatus) => void;

const DEFAULT_BATTERY_STATUS: BatteryStatus = {
  supported: false,
  level: 100,
  charging: true,
  chargingTime: 0,
  dischargingTime: Number.POSITIVE_INFINITY,
  isLow: false,
  isCritical: false,
};

export class BatteryManager {
  private static instance: BatteryManager | null = null;
  private readonly subscribers = new Set<BatterySubscriber>();
  private status: BatteryStatus = { ...DEFAULT_BATTERY_STATUS };
  private batteryApi: W3CBatteryManager | null = null;
  private isInitialized = false;

  private constructor() {
    // Lazy initialization
  }

  static getInstance(): BatteryManager {
    if (!BatteryManager.instance) {
      BatteryManager.instance = new BatteryManager();
    }
    return BatteryManager.instance;
  }

  getStatus(): BatteryStatus {
    return this.status;
  }

  subscribe(fn: BatterySubscriber): () => void {
    this.subscribers.add(fn);

    if (!this.isInitialized) {
      this.init();
    }

    return () => {
      this.subscribers.delete(fn);
    };
  }

  private async init(): Promise<void> {
    if (this.isInitialized || typeof window === "undefined") {
      return;
    }
    this.isInitialized = true;

    // Feature detection for W3C Battery Status API
    const nav = navigator as unknown as {
      getBattery?: () => Promise<W3CBatteryManager>;
    };

    if (typeof nav.getBattery !== "function") {
      this.status = { ...DEFAULT_BATTERY_STATUS, supported: false };
      return;
    }

    try {
      const battery = await nav.getBattery();
      this.batteryApi = battery;

      this.updateFromBattery(battery);

      battery.addEventListener("levelchange", this.handleBatteryEvent);
      battery.addEventListener("chargingchange", this.handleBatteryEvent);
      battery.addEventListener("chargingtimechange", this.handleBatteryEvent);
      battery.addEventListener(
        "dischargingtimechange",
        this.handleBatteryEvent
      );
    } catch {
      this.status = { ...DEFAULT_BATTERY_STATUS, supported: false };
    }
  }

  private readonly handleBatteryEvent = (): void => {
    if (this.batteryApi) {
      this.updateFromBattery(this.batteryApi);
    }
  };

  private updateFromBattery(battery: W3CBatteryManager): void {
    const rawLevel = battery.level;
    const level = Math.round((Number.isFinite(rawLevel) ? rawLevel : 1) * 100);
    const charging = battery.charging;

    this.status = {
      supported: true,
      level,
      charging,
      chargingTime: battery.chargingTime ?? 0,
      dischargingTime: battery.dischargingTime ?? Number.POSITIVE_INFINITY,
      isLow: level <= 20 && !charging,
      isCritical: level <= 10 && !charging,
    };

    this.notifySubscribers();
  }

  private notifySubscribers(): void {
    for (const fn of this.subscribers) {
      try {
        fn(this.status);
      } catch (err) {
        console.error("Error in battery subscriber:", err);
      }
    }
  }
}

export const batteryManager = BatteryManager.getInstance();
