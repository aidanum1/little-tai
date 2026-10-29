import type { ClipSample } from "../characters/RiggedFigure";
import { EASE, lerp, smoothstep } from "./timing";

/**
 * Character performance as data: a sequence of takes (which clip plays from which frame) plus blocking keys
 * (where the character stands and faces). Both are pure functions of the frame.
 */

export interface Take {
  clip: string;
  /** Composition frame the take starts on; takes are sorted and play until the next one. */
  from: number;
  /** Seconds into the clip at the take's first frame. */
  offset?: number;
  speed?: number;
  loop?: boolean;
  /** Freeze on `offset` (a figure "playing dead"). */
  hold?: boolean;
  /** Frames over which this take fades in over the previous one. */
  blend?: number;
}

const sampleTake = (take: Take, frame: number, fps: number, durations: Record<string, number>) => {
  const dur = durations[take.clip] ?? 1;
  const local = take.hold ? (take.offset ?? 0) : (take.offset ?? 0) + ((frame - take.from) / fps) * (take.speed ?? 1);
  const time = take.loop ? ((local % dur) + dur) % dur : Math.max(0, Math.min(dur - 1e-4, local));
  return { name: take.clip, time };
};

export const performClips = (takes: Take[], frame: number, fps: number, durations: Record<string, number>): ClipSample[] => {
  let i = 0;
  while (i + 1 < takes.length && takes[i + 1].from <= frame) i++;
  const cur = takes[i];
  const blend = cur.blend ?? 6;
  const w = i > 0 && blend > 0 ? smoothstep(0, 1, (frame - cur.from) / blend) : 1;
  const out: ClipSample[] = [{ ...sampleTake(cur, frame, fps, durations), weight: w }];
  if (w < 1) out.push({ ...sampleTake(takes[i - 1], frame, fps, durations), weight: 1 - w });
  return out;
};

export interface BlockKey {
  f: number;
  x: number;
  z: number;
  y?: number;
  yaw: number;
  /** Easing into this key from the previous one (default: linear, for constant-speed walking). */
  ease?: keyof typeof EASE | "linear";
}

const angleLerp = (a: number, b: number, t: number) => {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
};

export const blocking = (keys: BlockKey[], frame: number) => {
  if (frame <= keys[0].f) return { x: keys[0].x, y: keys[0].y ?? 0, z: keys[0].z, yaw: keys[0].yaw };
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (frame <= b.f) {
      const raw = (frame - a.f) / Math.max(1, b.f - a.f);
      const k = b.ease && b.ease !== "linear" ? EASE[b.ease](raw) : raw;
      return { x: lerp(a.x, b.x, k), y: lerp(a.y ?? 0, b.y ?? 0, k), z: lerp(a.z, b.z, k), yaw: angleLerp(a.yaw, b.yaw, k) };
    }
  }
  const last = keys[keys.length - 1];
  return { x: last.x, y: last.y ?? 0, z: last.z, yaw: last.yaw };
};
