type V3 = [number, number, number];

/** Camera position on an orbit around `target`. angle 0 = in front (+Z). */
export const orbit = (target: V3, radius: number, angle: number, height: number): V3 => [
  target[0] + Math.sin(angle) * radius,
  target[1] + height,
  target[2] + Math.cos(angle) * radius,
];

/** Distance at which a subject of size (w × h) fills `fill` of the frame for a vertical FOV (deg) and aspect. */
export const fitDistance = (w: number, h: number, fovDeg: number, aspect: number, fill = 0.85) => {
  const t = Math.tan((fovDeg * Math.PI) / 360) * 2;
  return Math.max(h / (t * fill), w / (t * aspect * fill));
};

export const mix3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
