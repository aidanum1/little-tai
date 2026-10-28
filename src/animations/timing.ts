import { Easing, interpolate, spring, type SpringConfig } from "remotion";

/** Deterministic helpers. Every animation in the film is a pure function of the frame number. */

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  soft: Easing.bezier(0.45, 0.05, 0.25, 1),
  in: Easing.bezier(0.55, 0, 1, 0.45),
  cine: Easing.bezier(0.33, 0, 0.12, 1),
};

/** 0→1 between two frames with easing, clamped. */
export const progress = (frame: number, start: number, end: number, easing: (t: number) => number = EASE.inOut) =>
  interpolate(frame, [start, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });

/** Fade in over [a,b], hold, fade out over [c,d]. */
export const window4 = (frame: number, a: number, b: number, c: number, d: number) =>
  interpolate(frame, [a, b, c, d], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOut });

export const springAt = (frame: number, fps: number, delay: number, config: Partial<SpringConfig> = {}, durationInFrames?: number) =>
  spring({ frame: frame - delay, fps, config: { damping: 18, mass: 0.9, stiffness: 90, ...config }, durationInFrames });

/** Seeded PRNG (mulberry32). */
export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Smooth deterministic 1D noise for organic drift. */
export const drift = (t: number, seed: number) =>
  Math.sin(t * 0.9 + seed * 12.9898) * 0.6 + Math.sin(t * 1.7 + seed * 78.233) * 0.3 + Math.sin(t * 3.1 + seed * 3.7) * 0.1;
