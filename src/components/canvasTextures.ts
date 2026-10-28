import * as THREE from "three";
import { rng } from "../animations/timing";

/** Canvas helpers. All painting is seeded, so textures are identical on every frame and every render worker. */

export const makeCanvas = (w: number, h: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  return { canvas, ctx };
};

export const toTexture = (canvas: HTMLCanvasElement, color = true) => {
  const tex = new THREE.CanvasTexture(canvas);
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
};

const cache = new Map<string, THREE.Texture>();
export const cached = (key: string, make: () => THREE.Texture) => {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
};

/** Soft radial glow for additive sprites (stars, light blooms). */
export const glowTexture = () =>
  cached("glow", () => {
    const { canvas, ctx } = makeCanvas(256, 256);
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.08, "rgba(255,255,255,0.85)");
    g.addColorStop(0.25, "rgba(255,255,255,0.32)");
    g.addColorStop(0.55, "rgba(255,255,255,0.08)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return toTexture(canvas);
  });

/** Four-point star flare used on twinkling highlights. */
export const flareTexture = () =>
  cached("flare", () => {
    const { canvas, ctx } = makeCanvas(256, 256);
    ctx.translate(128, 128);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 40);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.fill();
    for (const rot of [0, Math.PI / 2]) {
      ctx.save();
      ctx.rotate(rot);
      const lg = ctx.createLinearGradient(-128, 0, 128, 0);
      lg.addColorStop(0, "rgba(255,255,255,0)");
      lg.addColorStop(0.5, "rgba(255,255,255,0.9)");
      lg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.ellipse(0, 0, 128, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    return toTexture(canvas);
  });

/** Fine fabric / vinyl grain used as a bump map so surfaces never look CG-flat. */
export const grainTexture = (seed = 7, scale = 1) =>
  cached(`grain-${seed}-${scale}`, () => {
    const size = 512;
    const { canvas, ctx } = makeCanvas(size, size);
    const r = rng(seed);
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, size, size);
    const img = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (r() - 0.5) * 60;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    // soft woven streaks
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 900; i++) {
      ctx.strokeStyle = r() > 0.5 ? "#fff" : "#000";
      const x = r() * size;
      const y = r() * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 6, y + 6 + r() * 10);
      ctx.stroke();
    }
    const tex = toTexture(canvas, false);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(scale, scale);
    return tex;
  });

/** Draws a 5-point star path. */
export const starPath = (ctx: CanvasRenderingContext2D, x: number, y: number, outer: number, inner = outer * 0.45, rot = 0, points = 5) => {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = rot - Math.PI / 2 + (i * Math.PI) / points;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
};

export const heartPath = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 0.9, y - s * 0.25, x - s * 0.45, y - s * 0.95, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.45, y - s * 0.95, x + s * 0.9, y - s * 0.25, x, y + s * 0.35);
  ctx.closePath();
};
