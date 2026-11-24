// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetAudioContextForTesting,
  getTourSoundEnabled,
  playTourCompleteSound,
  playTourSound,
  playTourStartSound,
  playWorkspaceCreatedSound,
  setTourSoundEnabled,
} from "./sound";

describe("Tour Sound Synthesizer (sound.ts)", () => {
  beforeEach(() => {
    localStorage.clear();
    _resetAudioContextForTesting();
    vi.restoreAllMocks();
  });

  it("manages localStorage sound preference defaulting to true", () => {
    expect(getTourSoundEnabled()).toBe(true);

    setTourSoundEnabled(false);
    expect(getTourSoundEnabled()).toBe(false);
    expect(localStorage.getItem("marshell_tour_sound_v1")).toBe("false");

    setTourSoundEnabled(true);
    expect(getTourSoundEnabled()).toBe(true);
    expect(localStorage.getItem("marshell_tour_sound_v1")).toBe("true");
  });

  it("safely handles playTourSound without throwing when AudioContext is unavailable", () => {
    const originalAudioContext = window.AudioContext;
    // @ts-expect-error test override
    window.AudioContext = undefined;

    expect(() => playTourSound("ignite")).not.toThrow();
    expect(() => playTourSound("confirm")).not.toThrow();

    window.AudioContext = originalAudioContext;
  });

  it("skips playback silently when document is hidden", () => {
    const createGainSpy = vi.fn();
    const resumeSpy = vi.fn().mockResolvedValue(undefined);

    class MockAudioContext {
      currentTime = 0;
      state = "running";
      destination = {};
      createGain = createGainSpy;
      createBiquadFilter = vi.fn(() => ({
        type: "lowpass",
        frequency: { setValueAtTime: vi.fn() },
        Q: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
      }));
      createOscillator = vi.fn(() => ({
        type: "sine",
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }));
      resume = resumeSpy;
    }

    // @ts-expect-error mock assignment
    window.AudioContext = MockAudioContext;

    Object.defineProperty(document, "hidden", {
      value: true,
      configurable: true,
    });

    playTourSound("ignite");
    expect(createGainSpy).not.toHaveBeenCalled();

    Object.defineProperty(document, "hidden", {
      value: false,
      configurable: true,
    });
  });

  it("skips playback when user disabled tour sound in localStorage", () => {
    setTourSoundEnabled(false);

    const createGainSpy = vi.fn();
    class MockAudioContext {
      currentTime = 0;
      state = "running";
      destination = {};
      createGain = createGainSpy;
      resume = vi.fn().mockResolvedValue(undefined);
    }
    // @ts-expect-error mock assignment
    window.AudioContext = MockAudioContext;

    playTourSound("confirm");
    expect(createGainSpy).not.toHaveBeenCalled();
  });

  it("skips playback when reduced motion is preferred", () => {
    window.matchMedia = vi.fn().mockImplementation(
      (query) =>
        ({
          matches: query.includes("prefers-reduced-motion"),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList
    );

    const createGainSpy = vi.fn();
    class MockAudioContext {
      currentTime = 0;
      state = "running";
      destination = {};
      createGain = createGainSpy;
      resume = vi.fn().mockResolvedValue(undefined);
    }
    // @ts-expect-error mock assignment
    window.AudioContext = MockAudioContext;

    playTourSound("success");
    expect(createGainSpy).not.toHaveBeenCalled();
  });

  it("synthesizes all 4 sound kinds with appropriate peak gain <= 0.06", () => {
    window.matchMedia = vi.fn().mockImplementation(
      () =>
        ({
          matches: false,
          media: "",
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList
    );

    const recordedGains: number[] = [];

    class MockAudioContext {
      currentTime = 10;
      state = "running";
      destination = {};
      createBiquadFilter = vi.fn(() => ({
        type: "lowpass",
        frequency: { setValueAtTime: vi.fn() },
        Q: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
      }));
      createGain = vi.fn(() => ({
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: (val: number) => recordedGains.push(val),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      }));
      createOscillator = vi.fn(() => ({
        type: "sine",
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }));
      resume = vi.fn().mockResolvedValue(undefined);
    }

    // @ts-expect-error mock assignment
    window.AudioContext = MockAudioContext;

    playTourSound("ignite");
    playTourSound("confirm");
    playTourSound("success");
    playTourSound("complete");

    expect(recordedGains.length).toBeGreaterThanOrEqual(4);
    for (const gain of recordedGains) {
      expect(gain).toBeLessThanOrEqual(0.06);
      expect(gain).toBeGreaterThan(0);
    }
  });

  it("attempts to resume a suspended audio context", () => {
    window.matchMedia = vi.fn().mockImplementation(
      () =>
        ({
          matches: false,
          media: "",
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList
    );

    const resumeSpy = vi.fn().mockResolvedValue(undefined);

    class MockAudioContext {
      currentTime = 0;
      state = "suspended";
      destination = {};
      resume = resumeSpy;
      createBiquadFilter = vi.fn(() => ({
        type: "lowpass",
        frequency: { setValueAtTime: vi.fn() },
        Q: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
      }));
      createGain = vi.fn(() => ({
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      }));
      createOscillator = vi.fn(() => ({
        type: "sine",
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }));
    }

    // @ts-expect-error mock assignment
    window.AudioContext = MockAudioContext;

    playTourSound("confirm");
    expect(resumeSpy).toHaveBeenCalledTimes(1);
  });

  it("synthesizes workspaceCreated, tourStart, and tourComplete sounds and debounces within 150ms", () => {
    window.matchMedia = vi.fn().mockImplementation(
      () =>
        ({
          matches: false,
          media: "",
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList
    );

    const createdOscillators: string[] = [];
    class MockAudioContext {
      currentTime = 0;
      sampleRate = 44_100;
      state = "running";
      destination = {};
      createBiquadFilter = vi.fn(() => ({
        type: "lowpass",
        frequency: { setValueAtTime: vi.fn() },
        Q: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
      }));
      createGain = vi.fn(() => ({
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      }));
      createOscillator = vi.fn(() => ({
        type: "sine",
        frequency: {
          setValueAtTime: vi.fn((freq: number) => {
            createdOscillators.push(`${freq}`);
          }),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }));
      createBuffer = vi.fn(() => ({
        getChannelData: vi.fn(() => new Float32Array(100)),
        sampleRate: 44_100,
      }));
      createConvolver = vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
      }));
      resume = vi.fn().mockResolvedValue(undefined);
    }

    // @ts-expect-error mock assignment
    window.AudioContext = MockAudioContext;

    // Test workspaceCreated
    playWorkspaceCreatedSound();
    expect(createdOscillators.length).toBeGreaterThanOrEqual(2);

    // Repeated immediate call should be ignored by 150ms debounce
    const countBeforeDebounced = createdOscillators.length;
    playWorkspaceCreatedSound();
    expect(createdOscillators.length).toBe(countBeforeDebounced);

    // Reset and test tourStart
    _resetAudioContextForTesting();
    playTourStartSound();
    expect(createdOscillators.length).toBeGreaterThan(countBeforeDebounced);

    // Reset and test tourComplete
    _resetAudioContextForTesting();
    const countBeforeComplete = createdOscillators.length;
    playTourCompleteSound();
    expect(createdOscillators.length).toBeGreaterThan(countBeforeComplete);
  });
});
