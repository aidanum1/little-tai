import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/** Tiny DSP kit shared by the score and SFX generators (stereo float buffers → 16-bit WAV). */

export const SR = 44100;

export class Stereo {
  readonly L: Float32Array;
  readonly R: Float32Array;
  constructor(readonly seconds: number) {
    this.L = new Float32Array(Math.ceil(seconds * SR));
    this.R = new Float32Array(Math.ceil(seconds * SR));
  }
  get length() {
    return this.L.length;
  }
  add(i: number, l: number, r = l) {
    if (i >= 0 && i < this.L.length) {
      this.L[i] += l;
      this.R[i] += r;
    }
  }
}

export const seeded = (seed: number) => {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

/** Schroeder reverb (4 damped combs + 2 allpasses). */
export const reverb = (input: Float32Array, combs: number[], allpasses: number[], fb = 0.82, damp = 0.25) => {
  const n = input.length;
  const out = new Float32Array(n);
  for (const d of combs) {
    const buf = new Float32Array(d);
    let idx = 0;
    let lp = 0;
    for (let i = 0; i < n; i++) {
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
    for (let i = 0; i < n; i++) {
      const b = buf[idx];
      const x = out[i];
      buf[idx] = x + b * 0.5;
      out[i] = b - x * 0.5;
      idx = (idx + 1) % d;
    }
  }
  return out;
};

/** Adds a stereo room, soft-clips, normalises to `peakDb` and fades the tail; returns the WAV bytes. */
export const master = (s: Stereo, opts: { wet?: number; peak?: number; fadeOut?: number; fb?: number } = {}) => {
  const { wet = 0.35, peak = 0.89, fadeOut = 0.05, fb = 0.8 } = opts;
  const wl = wet > 0 ? reverb(s.L, [1557, 1617, 1491, 1422], [225, 556], fb) : null;
  const wr = wet > 0 ? reverb(s.R, [1580, 1640, 1514, 1445], [248, 579], fb) : null;
  const n = s.length;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  let max = 1e-9;
  for (let i = 0; i < n; i++) {
    L[i] = Math.tanh((s.L[i] + (wl ? wl[i] * wet : 0)) * 1.1);
    R[i] = Math.tanh((s.R[i] + (wr ? wr[i] * wet : 0)) * 1.1);
    max = Math.max(max, Math.abs(L[i]), Math.abs(R[i]));
  }
  const g = peak / max;
  const fade = Math.floor(fadeOut * SR);
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 4, 4);
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
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const f = fade > 0 && i > n - fade ? (n - i) / fade : 1;
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g * f)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g * f)) * 32767), 46 + i * 4);
  }
  return buf;
};

export const writeWav = async (file: string, bytes: Buffer) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
};

/** Resonant band-pass (state-variable filter) — shapes noise into paper, card and air. */
export const bandpass = (freq: number, q: number) => {
  let low = 0;
  let band = 0;
  return (x: number, f = freq) => {
    const k = 2 * Math.sin((Math.PI * Math.min(f, SR / 6)) / SR);
    low += k * band;
    const high = x - low - band / q;
    band += k * high;
    return band;
  };
};
