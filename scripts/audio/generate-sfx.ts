import path from "node:path";
import { ROOT } from "../tripo/env";
import { bandpass, master, seeded, SR, Stereo, writeWav } from "./dsp";

/**
 * Original sound effects for the film, synthesised from scratch (no samples) → public/audio/sfx/*.wav.
 * Each effect is designed for one on-screen event; scenes place them frame-accurately with <Sfx>.
 */

const out = (name: string) => path.join(ROOT, "public", "audio", "sfx", `${name}.wav`);
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Glassy ping: inharmonic partials, fast attack, exponential decay. */
const ping = (s: Stereo, t: number, f: number, vel: number, pan: number, decay = 5) => {
  const start = Math.floor(t * SR);
  for (let k = 0; k < SR * 1.6; k++) {
    const x = k / SR;
    const v =
      (Math.sin(2 * Math.PI * f * x) + 0.35 * Math.sin(2 * Math.PI * f * 2.76 * x) * Math.exp(-x * 4) + 0.18 * Math.sin(2 * Math.PI * f * 5.4 * x) * Math.exp(-x * 9)) *
      Math.exp(-x * decay) *
      Math.min(1, x * 2000) *
      vel;
    s.add(start + k, v * (1 - pan * 0.8), v * (1 + pan * 0.8));
  }
};

/** Shaped noise through a moving band-pass (air, paper, card). */
const noise = (
  s: Stereo,
  t: number,
  dur: number,
  env: (x: number) => number,
  freq: (x: number) => number,
  q: number,
  vel: number,
  seed: number,
  pan: (x: number) => number = () => 0,
) => {
  const r = seeded(seed);
  const bl = bandpass(1000, q);
  const br = bandpass(1000, q);
  const start = Math.floor(t * SR);
  const n = Math.floor(dur * SR);
  for (let k = 0; k < n; k++) {
    const x = k / n;
    const f = freq(x);
    const e = env(x) * vel;
    const p = pan(x);
    s.add(start + k, bl(r() * 2 - 1, f) * e * (1 - p * 0.8), br(r() * 2 - 1, f * 1.03) * e * (1 + p * 0.8));
  }
};

/** Pitched sine drop (thumps, pops, booms). */
const drop = (s: Stereo, t: number, f0: number, f1: number, dur: number, vel: number, decay = 6) => {
  const start = Math.floor(t * SR);
  let ph = 0;
  for (let k = 0; k < dur * SR; k++) {
    const x = k / SR;
    const f = f1 + (f0 - f1) * Math.exp(-x * 18);
    ph += (2 * Math.PI * f) / SR;
    const v = Math.sin(ph) * Math.exp(-x * decay) * Math.min(1, x * 3000) * vel;
    s.add(start + k, v);
  }
};

const click = (s: Stereo, t: number, vel: number, seed: number) =>
  noise(s, t, 0.012, (x) => 1 - x, () => 3800, 1.2, vel, seed);

const sfx: Record<string, () => { s: Stereo; wet?: number; fb?: number }> = {
  "star-twinkle": () => {
    const s = new Stereo(2.4);
    [96, 103, 100, 108].forEach((m, i) => ping(s, i * 0.07, midi(m), 0.22 - i * 0.03, (i - 1.5) * 0.4, 4.5));
    noise(s, 0, 1.2, (x) => Math.pow(1 - x, 3) * Math.min(1, x * 40), () => 9000, 3, 0.25, 11);
    return { s, wet: 0.55 };
  },
  "whoosh-soft": () => {
    const s = new Stereo(1.6);
    noise(s, 0, 1.4, (x) => Math.sin(Math.PI * Math.pow(x, 0.8)) ** 2, (x) => 300 + 2400 * Math.sin(Math.PI * x), 2.2, 0.6, 21, (x) => x * 2 - 1);
    return { s, wet: 0.25 };
  },
  "whoosh-down": () => {
    const s = new Stereo(3.0);
    noise(s, 0, 2.8, (x) => Math.sin(Math.PI * Math.min(1, x * 1.1)) ** 2, (x) => 2600 * Math.pow(1 - x, 1.5) + 160, 2.5, 0.55, 23);
    return { s, wet: 0.4 };
  },
  "spin-whoosh": () => {
    const s = new Stereo(1.3);
    // tremolo'd air for the spinning box, slowing down
    noise(s, 0, 1.2, (x) => (0.55 + 0.45 * Math.sin(2 * Math.PI * (14 * x - 5 * x * x))) * Math.pow(1 - x, 1.4), (x) => 1800 - 1100 * x, 2, 0.6, 29, (x) => 1 - x * 1.6);
    return { s, wet: 0.2 };
  },
  "cardboard-open": () => {
    const s = new Stereo(1.6);
    click(s, 0, 0.7, 31); // tab release
    noise(s, 0.02, 0.55, (x) => (0.6 + 0.4 * Math.sin(x * 60)) * Math.sin(Math.PI * x), (x) => 520 + 300 * x, 4, 0.55, 33); // card friction creak
    noise(s, 0.55, 0.25, (x) => Math.pow(1 - x, 2), () => 260, 3, 0.5, 35); // lid settles
    drop(s, 0.58, 140, 70, 0.3, 0.35, 14);
    return { s, wet: 0.2 };
  },
  "flaps-open": () => {
    const s = new Stereo(1.5);
    for (const [t, p] of [
      [0, -0.5],
      [0.16, 0.5],
      [0.42, -0.3],
      [0.55, 0.3],
    ] as const) {
      noise(s, t, 0.16, (x) => Math.pow(1 - x, 2) * Math.min(1, x * 30), () => 900, 2.5, 0.55, 40 + Math.round(t * 100), () => p);
      drop(s, t + 0.01, 220, 120, 0.12, 0.18, 20);
    }
    return { s, wet: 0.25 };
  },
  "paper-flutter": () => {
    const s = new Stereo(1.5);
    noise(s, 0, 1.4, (x) => Math.pow(Math.abs(Math.sin(Math.PI * 9 * x * (1 - 0.3 * x))), 3) * Math.pow(1 - x, 1.2), (x) => 2400 - 900 * x, 1.6, 0.6, 51, (x) => -0.6 + x * 1.4);
    return { s, wet: 0.35 };
  },
  "lid-pop": () => {
    const s = new Stereo(1.2);
    drop(s, 0, 420, 90, 0.18, 0.7, 22); // suction pop
    click(s, 0, 0.6, 61);
    noise(s, 0.02, 0.4, (x) => Math.pow(1 - x, 2.5), (x) => 3000 - 2000 * x, 1.5, 0.35, 63); // air release
    return { s, wet: 0.3 };
  },
  "star-burst": () => {
    const s = new Stereo(2.6);
    const r = seeded(71);
    drop(s, 0, 300, 60, 0.4, 0.5, 9);
    noise(s, 0, 0.5, (x) => Math.pow(1 - x, 3), () => 5000, 1, 0.4, 73);
    for (let i = 0; i < 26; i++) ping(s, 0.02 + r() * 0.5, 2400 + r() * 5200, 0.08 * (1 - i / 30), r() * 2 - 1, 7 + r() * 6);
    return { s, wet: 0.45 };
  },
  "rise-shimmer": () => {
    const s = new Stereo(3.0);
    [74, 78, 81, 86, 90, 93].forEach((m, i) => ping(s, i * 0.14, midi(m), 0.13, (i % 2 ? 1 : -1) * 0.35, 3.2));
    noise(s, 0, 1.6, (x) => Math.pow(x, 1.8) * Math.pow(1 - x, 0.5), (x) => 3000 + 6000 * x, 3, 0.18, 81);
    return { s, wet: 0.6, fb: 0.86 };
  },
  "rise-shimmer-dark": () => {
    const s = new Stereo(3.6);
    [62, 69, 74, 77, 81, 86].forEach((m, i) => ping(s, i * 0.2, midi(m), 0.13, (i % 2 ? 1 : -1) * 0.35, 2.4));
    noise(s, 0, 2.0, (x) => Math.pow(x, 1.6) * Math.pow(1 - x, 0.4), (x) => 1500 + 3500 * x, 3, 0.16, 83);
    return { s, wet: 0.7, fb: 0.88 };
  },
  "spotlight-on": () => {
    const s = new Stereo(2.2);
    click(s, 0, 0.9, 91);
    drop(s, 0.005, 120, 48, 0.9, 0.7, 4.5);
    noise(s, 0.01, 1.8, (x) => Math.pow(1 - x, 2) * 0.6, () => 120, 6, 0.3, 93); // electrical hum swell
    return { s, wet: 0.5 };
  },
  "box-land": () => {
    const s = new Stereo(3.4);
    drop(s, 0, 90, 34, 2.6, 1.0, 1.9); // sub boom
    noise(s, 0, 0.25, (x) => Math.pow(1 - x, 2), () => 400, 2, 0.35, 101);
    noise(s, 0.02, 2.4, (x) => Math.pow(1 - x, 3) * 0.6, () => 2200, 2, 0.12, 103); // air tail
    return { s, wet: 0.55, fb: 0.86 };
  },
  "lid-lift-luxe": () => {
    const s = new Stereo(3.4);
    noise(s, 0, 3.0, (x) => Math.sin(Math.PI * x) ** 1.5, (x) => 180 + 500 * x, 5, 0.4, 111); // slow rigid-lid air slide
    [57, 64].forEach((m, i) => ping(s, 0.8 + i * 0.6, midi(m), 0.06, i ? 0.4 : -0.4, 1.4));
    return { s, wet: 0.6, fb: 0.86 };
  },
  "star-ignite": () => {
    const s = new Stereo(3.0);
    noise(s, 0, 1.4, (x) => Math.pow(x, 2) * (x < 0.85 ? 1 : (1 - x) / 0.15), (x) => 300 + 2600 * x * x, 2, 0.5, 121); // reverse swell
    drop(s, 1.2, 160, 55, 1.4, 0.6, 2.6);
    [81, 88, 93].forEach((m, i) => ping(s, 1.2 + i * 0.05, midi(m), 0.12, (i - 1) * 0.5, 2.6));
    return { s, wet: 0.6, fb: 0.86 };
  },
  "finale-chimes": () => {
    const s = new Stereo(4.2);
    const r = seeded(131);
    const scale = [74, 76, 78, 81, 83, 86, 88, 90, 93, 95];
    for (let i = 0; i < 22; i++) {
      const tt = (i / 22) * 2.2 + r() * 0.06;
      ping(s, tt, midi(scale[Math.floor(r() * scale.length)]), 0.08 + 0.04 * (i / 22), r() * 2 - 1, 3);
    }
    return { s, wet: 0.65, fb: 0.87 };
  },
  // ---- "after hours" short ----
  "clock-tick": () => {
    const s = new Stereo(0.6);
    click(s, 0, 0.8, 141);
    ping(s, 0, 2100, 0.12, 0.2, 60); // tiny wooden resonance
    return { s, wet: 0.45 };
  },
  tiptoe: () => {
    const s = new Stereo(0.4);
    noise(s, 0, 0.05, (x) => Math.pow(1 - x, 2) * Math.min(1, x * 40), () => 1100, 2.2, 0.5, 151);
    drop(s, 0.002, 260, 140, 0.08, 0.35, 40);
    return { s, wet: 0.2 };
  },
  "switch-click": () => {
    const s = new Stereo(0.8);
    click(s, 0, 0.9, 161);
    drop(s, 0, 900, 420, 0.05, 0.4, 60);
    click(s, 0.032, 0.7, 163);
    drop(s, 0.032, 700, 300, 0.06, 0.3, 50);
    return { s, wet: 0.35 };
  },
  "light-buzz": () => {
    // fluorescent tubes striking: gated 100 Hz buzz + tinks, matching the on-screen flicker (on at 0.03 s, 0.2 s, 0.4 s)
    const s = new Stereo(1.8);
    const gate = (t: number) => (t >= 0.03 && t < 0.1 ? 1 : t >= 0.2 && t < 0.27 ? 1 : t >= 0.3 && t < 0.37 ? 0.35 : t >= 0.4 ? Math.exp(-(t - 0.4) * 2.2) : 0);
    const start = 0;
    for (let k = 0; k < 1.8 * SR; k++) {
      const t = k / SR;
      const g = gate(t);
      if (!g) continue;
      let v = 0;
      for (let h = 1; h <= 9; h += 2) v += Math.sin(2 * Math.PI * 100 * h * t) / h;
      s.add(start + k, v * g * 0.18);
    }
    [0.03, 0.2, 0.4].forEach((t, i) => ping(s, t, 3600 + i * 400, 0.12, (i - 1) * 0.5, 30));
    return { s, wet: 0.4 };
  },
  boing: () => {
    const s = new Stereo(0.9);
    let ph = 0;
    for (let k = 0; k < 0.7 * SR; k++) {
      const t = k / SR;
      const f = 180 + 260 * (1 - Math.exp(-t * 9)) + 70 * Math.sin(2 * Math.PI * 16 * t) * Math.exp(-t * 5);
      ph += (2 * Math.PI * f) / SR;
      s.add(k, Math.sin(ph) * Math.exp(-t * 6) * Math.min(1, t * 800) * 0.6);
    }
    return { s, wet: 0.25 };
  },
};

for (const [name, make] of Object.entries(sfx)) {
  const { s, wet, fb } = make();
  await writeWav(out(name), master(s, { wet, fb, peak: 0.85, fadeOut: 0.08 }));
}
console.log(`wrote ${Object.keys(sfx).length} sound effects to public/audio/sfx/`);
