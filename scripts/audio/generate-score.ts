import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ROOT } from "../tripo/env";

/**
 * Original 36-second score for the promo, synthesized from scratch (no samples, no third-party audio),
 * so it is fully owned by this project. Music box + warm pads + shimmer swells, cut to the storyboard:
 *   0–4 awakening · 4/8/12/16 reveals · 20 lineup · 25 darkness → secret · 29.5 climax · 32 resolve.
 */

const SR = 44100;
const DUR = 36;
const N = SR * DUR;
const L = new Float32Array(N);
const R = new Float32Array(N);

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const add = (i: number, l: number, r: number) => {
  if (i >= 0 && i < N) {
    L[i] += l;
    R[i] += r;
  }
};

/** Music-box tine: bright attack, inharmonic partials, long exponential decay. */
const tine = (time: number, note: number, vel = 0.22, pan = 0) => {
  const f = midi(note);
  const start = Math.floor(time * SR);
  const len = Math.floor(SR * 2.6);
  const partials = [
    [1, 1, 1.6],
    [2.0, 0.28, 2.6],
    [3.01, 0.12, 4],
    [5.4, 0.05, 7],
  ];
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    let v = 0;
    for (const [mul, amp, dec] of partials) v += Math.sin(2 * Math.PI * f * mul * t) * amp * Math.exp(-t * dec);
    v *= vel * Math.min(1, t * 400);
    add(start + k, v * (1 - pan) * 0.9, v * (1 + pan) * 0.9);
  }
};

/** Soft pad chord: detuned additive saws through a gentle one-pole low-pass, slow swell. */
const pad = (time: number, dur: number, notes: number[], vel = 0.05, bright = 0.35) => {
  const start = Math.floor(time * SR);
  const len = Math.floor(dur * SR);
  const att = Math.min(1.6, dur * 0.4);
  const rel = Math.min(2.0, dur * 0.45);
  let lpL = 0;
  let lpR = 0;
  const a = 0.02 + bright * 0.08;
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    let vl = 0;
    let vr = 0;
    for (const n of notes) {
      const f = midi(n);
      for (let h = 1; h <= 6; h++) {
        vl += (Math.sin(2 * Math.PI * f * h * 1.0016 * t) / h) * 0.5;
        vr += (Math.sin(2 * Math.PI * f * h * 0.9984 * t + 0.7) / h) * 0.5;
      }
    }
    const env = Math.min(1, t / att) * Math.min(1, (dur - t) / rel);
    lpL += a * (vl - lpL);
    lpR += a * (vr - lpR);
    add(start + k, lpL * env * vel, lpR * env * vel);
  }
};

/** Rising filtered-noise shimmer into a reveal. */
const swell = (end: number, len = 1.4, vel = 0.06) => {
  const start = Math.floor((end - len) * SR);
  const n = Math.floor(len * SR);
  let lp = 0;
  for (let k = 0; k < n; k++) {
    const t = k / n;
    const noise = rand() * 2 - 1;
    lp += (0.02 + t * 0.25) * (noise - lp);
    const env = Math.pow(t, 2.4) * (1 - Math.pow(t, 18));
    add(start + k, lp * env * vel, lp * env * vel * 0.9);
  }
};

/** Bell chime cluster for each reveal hit. */
const chime = (time: number, root: number, vel = 0.14) => {
  [0, 7, 12, 16, 19].forEach((iv, i) => tine(time + i * 0.035, root + iv, vel * (1 - i * 0.12), (i - 2) * 0.25));
};

/** Low sub thump (felt, not heard) for the secret's arrival. */
const thump = (time: number, f = 46, vel = 0.35) => {
  const start = Math.floor(time * SR);
  for (let k = 0; k < SR * 1.6; k++) {
    const t = k / SR;
    const v = Math.sin(2 * Math.PI * f * t * (1 - t * 0.15)) * Math.exp(-t * 3) * vel;
    add(start + k, v, v);
  }
};

// D major / B minor colour. Chords (MIDI).
const Bm9 = [47, 54, 59, 61, 62];
const Gmaj7 = [43, 50, 55, 59, 62];
const D = [50, 57, 62, 64, 66];
const Asus = [45, 52, 57, 59, 64];
const Em = [40, 47, 52, 55, 59];
const Cmaj7 = [36, 43, 48, 52, 55];
const Dadd9 = [38, 50, 57, 62, 64, 66, 69];

// 0–4 awakening: almost silence, a single tine for the star
pad(0, 4.6, [47, 54, 59], 0.03, 0.2);
tine(0.4, 83, 0.12, 0.2);
tine(1.6, 78, 0.08, -0.2);
tine(2.8, 81, 0.07, 0.1);
swell(4.0, 1.6, 0.05);

// 4–20 four reveals: chord per scene, music-box ostinato, chime on each emergence
const reveals: [number, number[], number][] = [
  [4, Bm9, 71],
  [8, Gmaj7, 67],
  [12, D, 74],
  [16, Asus, 69],
];
const motif = [0, 7, 12, 14, 12, 7, 9, 7];
for (const [t0, chord, root] of reveals) {
  pad(t0, 4.6, chord, 0.045, 0.4);
  motif.forEach((iv, i) => tine(t0 + 0.1 + i * 0.47, root + iv, 0.12 + (i % 4 === 0 ? 0.05 : 0), Math.sin(i) * 0.4));
  chime(t0 + 1.55, root + 12, 0.11);
  swell(t0 + 4.0, 1.2, 0.035);
}

// 20–25 lineup: warmer, fuller
pad(20, 5.4, D, 0.055, 0.5);
[74, 78, 81, 78, 76, 74, 73, 76, 78, 81].forEach((n, i) => tine(20.15 + i * 0.47, n, 0.13, Math.cos(i) * 0.4));
swell(25.0, 0.9, 0.03);

// 25–32 secret: darkness, heartbeat, then the climax
pad(25, 4.5, Em.map((n) => n - 12), 0.05, 0.15);
thump(25.6, 44, 0.32);
thump(26.4, 44, 0.2);
thump(27.6, 44, 0.32);
thump(28.4, 44, 0.2);
[88, 86, 83].forEach((n, i) => tine(26.2 + i * 0.9, n, 0.07, (i - 1) * 0.5));
swell(29.4, 2.0, 0.07);
pad(29.4, 3.2, Cmaj7, 0.06, 0.55);
chime(29.45, 72, 0.16);
chime(30.3, 79, 0.1);
[84, 83, 79, 76, 79].forEach((n, i) => tine(30.6 + i * 0.32, n, 0.1, (i - 2) * 0.3));

// 32–36 resolve
pad(32, 4.0, Dadd9, 0.06, 0.45);
[78, 81, 86, 85, 81, 78].forEach((n, i) => tine(32.1 + i * 0.45, n, 0.12, Math.sin(i * 2) * 0.4));
chime(34.8, 74, 0.08);

// --- Schroeder reverb (stereo-decorrelated) --------------------------------------------------
const reverb = (input: Float32Array, combs: number[], allpasses: number[], fb = 0.82, damp = 0.25) => {
  const out = new Float32Array(N);
  for (const d of combs) {
    const buf = new Float32Array(d);
    let idx = 0;
    let lp = 0;
    for (let i = 0; i < N; i++) {
      const y = buf[idx];
      lp = y * (1 - damp) + lp * damp;
      buf[idx] = input[i] + lp * fb;
      out[i] += y / combs.length;
      idx = (idx + 1) % d;
    }
  }
  for (const d of allpasses) {
    const buf = new Float32Array(d);
    let idx = 0;
    for (let i = 0; i < N; i++) {
      const b = buf[idx];
      const x = out[i];
      buf[idx] = x + b * 0.5;
      out[i] = b - x * 0.5;
      idx = (idx + 1) % d;
    }
  }
  return out;
};
const wetL = reverb(L, [1557, 1617, 1491, 1422], [225, 556]);
const wetR = reverb(R, [1580, 1640, 1514, 1445], [248, 579]);

// mix, soft-clip, normalise, fade
let peak = 0;
const mixL = new Float32Array(N);
const mixR = new Float32Array(N);
for (let i = 0; i < N; i++) {
  mixL[i] = Math.tanh((L[i] * 0.75 + wetL[i] * 0.55) * 1.2);
  mixR[i] = Math.tanh((R[i] * 0.75 + wetR[i] * 0.55) * 1.2);
  peak = Math.max(peak, Math.abs(mixL[i]), Math.abs(mixR[i]));
}
const gain = 0.89 / peak;
const fadeOut = SR * 1.5;
const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write("WAVE", 8);
buf.write("fmt ", 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const f = i > N - fadeOut ? (N - i) / fadeOut : 1;
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mixL[i] * gain * f)) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mixR[i] * gain * f)) * 32767), 46 + i * 4);
}
const out = path.join(ROOT, "public", "audio", "feelings-score.wav");
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, buf);
await writeFile(
  path.join(ROOT, "public", "audio", "LICENSE.txt"),
  "feelings-score.wav — original music synthesized procedurally by scripts/audio/generate-score.ts.\nsfx/*.wav — original sound effects synthesized procedurally by scripts/audio/generate-sfx.ts.\nNo samples or third-party recordings are used anywhere. Owned by this project; free to use with it.\n",
);
console.log(`wrote ${path.relative(ROOT, out)} (${DUR}s, ${(buf.length / 1024 / 1024).toFixed(1)} MB, peak gain ${gain.toFixed(2)})`);
