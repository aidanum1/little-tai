import path from "node:path";
import { ROOT } from "../tripo/env";
import { bandpass, master, reverb, seeded, SR, Stereo, writeWav } from "./dsp";

/**
 * Original 28-second score for the "after hours" short, synthesised from scratch (no samples), project-owned.
 * Cue sheet (seconds = frame / 30), matched to src/scenes/AfterHours.tsx:
 *   0      night shelf: pad + sparse music box          3.93  he wakes: swell + chime
 *   6.0    tiptoe walk: Karplus-Strong pizzicato        8.4   greet: brighter, C major
 *   11.87  dance: 120 BPM kick / clap / hats / bass     18.2  heart pose: warm swell, sparkle
 *   22.0   ceiling lights: tape stop, silence           22.6  panic scurry → 23.93 lands, freeze
 *   25.0   lights-on resolve, 26.53 hop gag, 27 final chord
 */

const DUR = 28;
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Music-box tine. */
const tine = (s: Stereo, time: number, note: number, vel = 0.2, pan = 0) => {
  const f = midi(note);
  const start = Math.floor(time * SR);
  const partials = [
    [1, 1, 1.8],
    [2.0, 0.28, 2.8],
    [3.01, 0.12, 4.5],
    [5.4, 0.05, 8],
  ];
  for (let k = 0; k < SR * 2.2; k++) {
    const t = k / SR;
    let v = 0;
    for (const [mul, amp, dec] of partials) v += Math.sin(2 * Math.PI * f * mul * t) * amp * Math.exp(-t * dec);
    v *= vel * Math.min(1, t * 400);
    s.add(start + k, v * (1 - pan) * 0.9, v * (1 + pan) * 0.9);
  }
};

/** Warm pad: detuned additive saws through a one-pole low-pass, swell in and out. */
const pad = (s: Stereo, time: number, dur: number, notes: number[], vel = 0.05, bright = 0.35) => {
  const start = Math.floor(time * SR);
  const att = Math.min(1.2, dur * 0.35);
  const rel = Math.min(1.5, dur * 0.4);
  let lpL = 0;
  let lpR = 0;
  const a = 0.02 + bright * 0.08;
  for (let k = 0; k < dur * SR; k++) {
    const t = k / SR;
    let vl = 0;
    let vr = 0;
    for (const n of notes) {
      const f = midi(n);
      for (let h = 1; h <= 5; h++) {
        vl += (Math.sin(2 * Math.PI * f * h * 1.0016 * t) / h) * 0.5;
        vr += (Math.sin(2 * Math.PI * f * h * 0.9984 * t + 0.7) / h) * 0.5;
      }
    }
    const env = Math.min(1, t / att) * Math.min(1, (dur - t) / rel);
    lpL += a * (vl - lpL);
    lpR += a * (vr - lpR);
    s.add(start + k, lpL * env * vel, lpR * env * vel);
  }
};

/** Karplus-Strong pluck — pizzicato strings and a round synth bass. */
const pluck = (s: Stereo, time: number, note: number, vel = 0.3, pan = 0, decay = 0.996, len = 0.9, seed = 1) => {
  const f = midi(note);
  const period = Math.max(2, Math.round(SR / f));
  const r = seeded(seed + note * 13);
  const buf = Float32Array.from({ length: period }, () => r() * 2 - 1);
  // soften the excitation for a felt-pick tone
  for (let i = 1; i < period; i++) buf[i] = 0.5 * (buf[i] + buf[i - 1]);
  const start = Math.floor(time * SR);
  let idx = 0;
  for (let k = 0; k < len * SR; k++) {
    const next = (idx + 1) % period;
    const y = buf[idx];
    buf[idx] = decay * 0.5 * (buf[idx] + buf[next]);
    idx = next;
    const v = y * vel * Math.min(1, (len * SR - k) / (0.05 * SR));
    s.add(start + k, v * (1 - pan * 0.8), v * (1 + pan * 0.8));
  }
};

const kick = (s: Stereo, time: number, vel = 0.55) => {
  const start = Math.floor(time * SR);
  let ph = 0;
  for (let k = 0; k < SR * 0.32; k++) {
    const t = k / SR;
    const f = 48 + 110 * Math.exp(-t * 28);
    ph += (2 * Math.PI * f) / SR;
    s.add(start + k, Math.sin(ph) * Math.exp(-t * 9) * vel * Math.min(1, t * 2000));
  }
};

const noiseHit = (s: Stereo, time: number, dur: number, freq: number, q: number, vel: number, seed: number, pan = 0, decay = 30) => {
  const r = seeded(seed);
  const bl = bandpass(freq, q);
  const br = bandpass(freq, q);
  const start = Math.floor(time * SR);
  for (let k = 0; k < dur * SR; k++) {
    const t = k / SR;
    const e = Math.exp(-t * decay) * Math.min(1, t * 3000) * vel;
    s.add(start + k, bl(r() * 2 - 1) * e * (1 - pan), br(r() * 2 - 1) * e * (1 + pan));
  }
};

const clap = (s: Stereo, time: number, vel = 0.5, seed = 5) => {
  [0, 0.011, 0.023].forEach((d, i) => noiseHit(s, time + d, 0.03, 1400, 1.3, vel * 0.7, seed + i, 0, 70));
  noiseHit(s, time + 0.03, 0.22, 1300, 1.1, vel * 0.45, seed + 9, 0, 16);
};

const hat = (s: Stereo, time: number, vel = 0.18, open = false, seed = 3) => noiseHit(s, time, open ? 0.2 : 0.05, 8200, 0.9, vel, seed, 0.25, open ? 14 : 70);

/** Wood block (scurry percussion). */
const block = (s: Stereo, time: number, note: number, vel = 0.2, pan = 0) => {
  const f = midi(note);
  const start = Math.floor(time * SR);
  for (let k = 0; k < SR * 0.12; k++) {
    const t = k / SR;
    const v = (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 2.6 * t)) * Math.exp(-t * 45) * vel;
    s.add(start + k, v * (1 - pan), v * (1 + pan));
  }
};

const chime = (s: Stereo, time: number, root: number, vel = 0.14) => [0, 7, 12, 16, 19].forEach((iv, i) => tine(s, time + i * 0.035, root + iv, vel * (1 - i * 0.12), (i - 2) * 0.25));

const swell = (s: Stereo, end: number, len: number, vel: number, seed = 17) => {
  const r = seeded(seed);
  const start = Math.floor((end - len) * SR);
  const n = Math.floor(len * SR);
  let lp = 0;
  for (let k = 0; k < n; k++) {
    const x = k / n;
    lp += (0.02 + x * 0.25) * (r() * 2 - 1 - lp);
    const env = Math.pow(x, 2.4) * (1 - Math.pow(x, 18));
    s.add(start + k, lp * env * vel, lp * env * vel * 0.9);
  }
};

// A minor · C major colour
const Am = [45, 52, 57, 60, 64];
const Fmaj7 = [41, 48, 53, 57, 64];
const Cmaj = [48, 55, 60, 64, 67];
const G6 = [43, 50, 55, 59, 64];
const Am9 = [45, 52, 59, 60, 64, 71];

// ---- part A: everything before the ceiling lights (cut by a tape stop at 22.0 s) ----------------------------
const A = new Stereo(DUR);

// 0–6 night, he wakes at 3.93
pad(A, 0, 6.6, Am, 0.035, 0.2);
[
  [0.35, 88],
  [1.45, 84],
  [2.4, 81],
].forEach(([t, n], i) => tine(A, t, n, 0.09, (i - 1) * 0.4));
swell(A, 3.93, 1.6, 0.05);
chime(A, 3.93, 81, 0.12);
[69, 72, 76, 81, 84, 88].forEach((n, i) => tine(A, 4.25 + i * 0.22, n, 0.08, Math.sin(i) * 0.4));

// 6.0–8.4 tiptoe walk (100 BPM, 0.6 s beats): sneaky pizzicato + music-box line in eighths
const tip = [57, 64, 60, 64, 57, 64, 62, 64];
tip.forEach((n, i) => pluck(A, 6.0 + i * 0.3, n - 12, i % 2 ? 0.16 : 0.24, i % 2 ? 0.3 : -0.3, 0.993, 0.5, 7));
[76, 75, 76, 72, 74, 72, 71, 69].forEach((n, i) => tine(A, 6.15 + i * 0.3, n, 0.075, Math.cos(i) * 0.3));

// 8.4–11.87 greet: brighter, C major
pad(A, 8.4, 3.8, Cmaj, 0.04, 0.4);
[72, 76, 79, 84, 83, 79, 81, 79, 76, 77, 76, 74].forEach((n, i) => tine(A, 8.5 + i * 0.28, n, 0.085, Math.sin(i * 1.3) * 0.4));
[48, 55, 52, 55, 48, 55].forEach((n, i) => pluck(A, 8.45 + i * 0.6, n, 0.22, i % 2 ? 0.3 : -0.3, 0.994, 0.6, 9));
tine(A, 9.4, 91, 0.06, 0.5); // the salute "ping"

// 11.87–18.2 dance, 120 BPM (beat 0.5 s)
const D0 = 11.87;
const BEAT = 0.5;
const bass = [45, 45, 57, 45, 48, 50, 52, 50, 41, 41, 53, 41, 43, 47, 50, 52];
for (let b = 0; b < 13; b++) {
  const t = D0 + b * BEAT;
  kick(A, t, b === 0 ? 0.7 : 0.55);
  if (b % 2 === 1) clap(A, t, 0.45, 20 + b);
  hat(A, t + BEAT / 2, 0.16, b % 4 === 3, 40 + b);
  hat(A, t + BEAT * 0.25, 0.07, false, 60 + b);
  hat(A, t + BEAT * 0.75, 0.07, false, 80 + b);
  // bass in eighths
  for (let e = 0; e < 2; e++) pluck(A, t + e * BEAT * 0.5, bass[(b * 2 + e) % bass.length] - 12, 0.3, 0, 0.99, 0.28, 101);
}
// chord stabs on the off-beats
const stabChords = [Am, Am, Fmaj7, Fmaj7, Cmaj, Cmaj, G6, G6];
for (let b = 0; b < 12; b++) {
  const ch = stabChords[Math.floor(b / 1.5) % stabChords.length];
  ch.slice(1).forEach((n, i) => pluck(A, D0 + b * BEAT + BEAT * 0.5, n + 12, 0.07, (i - 2) * 0.3, 0.985, 0.22, 200 + i));
}
// hook (positions in beats)
const hook: [number, number][] = [
  [0, 76], [1, 79], [1.5, 81], [2.5, 79], [3, 76], [4, 74], [5, 76], [6, 72],
  [8, 76], [9, 79], [9.5, 81], [10.5, 84], [11, 83], [11.5, 81],
];
hook.forEach(([b, n], i) => tine(A, D0 + b * BEAT, n, 0.11, Math.sin(i) * 0.35));
// fill into the heart pose
[84, 83, 81, 79].forEach((n, i) => block(A, D0 + 12 * BEAT + i * 0.083, n, 0.18, (i - 1.5) * 0.3));

// 18.2–22.0 heart pose: warm swell, sparkle at 19.67 (the arm reaches the top), half-time pulse
pad(A, 18.2, 4.2, Fmaj7, 0.05, 0.45);
pad(A, 20.2, 2.2, Cmaj, 0.04, 0.45);
swell(A, 19.67, 1.0, 0.04, 23);
chime(A, 19.67, 84, 0.13);
for (let b = 0; b < 7; b++) {
  kick(A, 18.37 + b * 0.5, b % 2 ? 0.25 : 0.38);
  hat(A, 18.37 + b * 0.5 + 0.25, 0.1, false, 300 + b);
}
[84, 88, 91, 88, 86, 84, 83, 84].forEach((n, i) => tine(A, 20.1 + i * 0.25, n, 0.08, Math.sin(i) * 0.4));

// ---- part B: after the lights come on ------------------------------------------------------------------------
const B = new Stereo(DUR);
// 22.6–23.93 panic scurry: descending sixteenths on pizz + wood blocks, then a "plonk" on landing
const scurry = [81, 80, 79, 78, 77, 76, 75, 74, 73, 72, 71, 70, 69, 68, 67, 66, 65, 64, 63, 62];
scurry.forEach((n, i) => {
  pluck(B, 22.62 + i * 0.065, n - 12, 0.2, i % 2 ? 0.4 : -0.4, 0.99, 0.18, 400 + i);
  if (i % 2 === 0) block(B, 22.62 + i * 0.065, n + 5, 0.12, i % 4 ? 0.3 : -0.3);
});
pluck(B, 23.93, 33, 0.45, 0, 0.995, 0.9, 777); // plonk
// 25.0–28 lights-on resolve: the opening music-box phrase, now in C, a hop "blip" and the final chord
pad(B, 25.0, 3.0, Am9, 0.04, 0.3);
[[25.2, 76], [25.65, 72], [26.1, 74]].forEach(([t, n], i) => tine(B, t, n, 0.1, (i - 1) * 0.4));
tine(B, 26.75, 84, 0.08, 0.3);
chime(B, 27.0, 72, 0.12);
pad(B, 27.0, 1.0, Cmaj, 0.045, 0.4);

// ---- mix: room on each part, tape-stop A at 22.0 s, sum, master -----------------------------------------------
const room = (s: Stereo, wet: number) => {
  const wl = reverb(s.L, [1557, 1617, 1491, 1422], [225, 556], 0.8);
  const wr = reverb(s.R, [1580, 1640, 1514, 1445], [248, 579], 0.8);
  for (let i = 0; i < s.length; i++) {
    s.L[i] += wl[i] * wet;
    s.R[i] += wr[i] * wet;
  }
};
room(A, 0.4);
room(B, 0.4);

const out = new Stereo(DUR);
const STOP = 22.0;
const STOP_LEN = 0.38;
for (let i = 0; i < out.length; i++) {
  const t = i / SR;
  let a = 0;
  let aR = 0;
  if (t < STOP) {
    a = A.L[i];
    aR = A.R[i];
  } else if (t < STOP + STOP_LEN) {
    // playback rate falls linearly to zero: position = STOP + ∫ rate
    const u = t - STOP;
    const p = (STOP + u - (u * u) / (2 * STOP_LEN)) * SR;
    const j = Math.floor(p);
    const fr = p - j;
    const g = 1 - Math.pow(u / STOP_LEN, 3);
    a = (A.L[j] * (1 - fr) + A.L[j + 1] * fr) * g;
    aR = (A.R[j] * (1 - fr) + A.R[j + 1] * fr) * g;
  }
  out.L[i] = a + B.L[i];
  out.R[i] = aR + B.R[i];
}

const file = path.join(ROOT, "public", "audio", "after-hours-score.wav");
await writeWav(file, master(out, { wet: 0, peak: 0.89, fadeOut: 0.8 }));
console.log(`wrote ${path.relative(ROOT, file)} (${DUR}s)`);
