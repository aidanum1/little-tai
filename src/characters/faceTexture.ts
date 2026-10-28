import * as THREE from "three";
import { cached, makeCanvas, starPath, toTexture } from "../components/canvasTextures";
import type { Edition } from "./figures";

/**
 * "Tampo-printed" face, painted in the head sphere's equirectangular UV space.
 * The face centre is u = 0.25 (sphere front, +Z) and v = 0.5; 1 radian ≈ 326 px on a 2048×1024 canvas,
 * so features can be placed by angle on the head.
 */

const W = 2048;
const H = 1024;
const PX = W / (Math.PI * 2);
const CX = W * 0.25;
const CY = H / 2;

export const FACE_LAYOUT = {
  eyeDx: 0.38,
  eyeDy: 0.12,
  noseDy: 0.38,
  mouthDy: 0.63,
  blushDx: 0.62,
  blushDy: 0.38,
};

export const SKIN = "#F3DDCB";

const almond = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, mirror: number, lidDrop = 0) => {
  // inner corner sits slightly lower than the outer corner (gentle, slightly downturned almond)
  const ix = x - (w / 2) * mirror;
  const ox = x + (w / 2) * mirror;
  ctx.beginPath();
  ctx.moveTo(ix, y + h * 0.1);
  ctx.bezierCurveTo(ix + w * 0.15 * mirror, y - h * (0.78 - lidDrop), ox - w * 0.25 * mirror, y - h * (0.82 - lidDrop), ox, y - h * 0.02);
  ctx.bezierCurveTo(ox - w * 0.2 * mirror, y + h * 0.58, ix + w * 0.2 * mirror, y + h * 0.62, ix, y + h * 0.1);
  ctx.closePath();
};

const upperLid = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, mirror: number, lidDrop: number) => {
  const ix = x - (w / 2) * mirror;
  const ox = x + (w / 2) * mirror;
  ctx.beginPath();
  ctx.moveTo(ix, y + h * 0.1);
  ctx.bezierCurveTo(ix + w * 0.15 * mirror, y - h * (0.78 - lidDrop), ox - w * 0.25 * mirror, y - h * (0.82 - lidDrop), ox, y - h * 0.02);
};

const paintEye = (ctx: CanvasRenderingContext2D, edition: Edition, x: number, y: number, mirror: number) => {
  const { gaze, lid } = edition.expression;
  const w = 92;
  const h = 62;
  const secret = edition.secret;
  const lidDrop = lid * 0.95;

  // soft socket shadow
  ctx.save();
  const sock = ctx.createRadialGradient(x, y - 6, 4, x, y - 6, 70);
  sock.addColorStop(0, "rgba(170,110,100,0.18)");
  sock.addColorStop(1, "rgba(170,110,100,0)");
  ctx.fillStyle = sock;
  ctx.fillRect(x - 80, y - 80, 160, 160);
  ctx.restore();

  ctx.save();
  almond(ctx, x, y, w, h, mirror);
  ctx.clip();
  ctx.fillStyle = "#F8F3EE";
  ctx.fillRect(x - w, y - h, w * 2, h * 2);

  const ir = h * 0.66;
  const icx = x + gaze[0] * w * 0.42;
  const icy = y - gaze[1] * h * 0.55 + h * 0.04;
  const iris = ctx.createRadialGradient(icx, icy, 0, icx, icy, ir);
  iris.addColorStop(0, "#0C0808");
  iris.addColorStop(0.42, "#160E0D");
  iris.addColorStop(0.72, secret ? "#4A0F1C" : "#3A2219");
  iris.addColorStop(0.93, secret ? "#6E1426" : "#523126");
  iris.addColorStop(1, "#24140F");
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.arc(icx, icy, ir, 0, Math.PI * 2);
  ctx.fill();

  // catch-lights: the "sparkle" that gives vinyl eyes their life
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.beginPath();
  ctx.ellipse(icx - ir * 0.32 * mirror, icy - ir * 0.36, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = secret ? "rgba(255,140,150,0.9)" : "rgba(255,255,255,0.75)";
  ctx.beginPath();
  ctx.arc(icx + ir * 0.34 * mirror, icy + ir * 0.3, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // upper-lid ambient shadow on the eyeball
  const shade = ctx.createLinearGradient(x, y - h, x, y + h * 0.2);
  shade.addColorStop(0, "rgba(60,30,26,0.55)");
  shade.addColorStop(0.5 + lidDrop * 0.3, "rgba(60,30,26,0.12)");
  shade.addColorStop(1, "rgba(60,30,26,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(x - w, y - h, w * 2, h * 2);

  // eyelid (skin) coming down for sleepy / calm expressions
  if (lidDrop > 0.01) {
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.rect(x - w, y - h * 1.5, w * 2, h * 0.5);
    ctx.fill();
    almond(ctx, x, y, w, h, mirror);
    ctx.save();
    ctx.clip();
    upperLid(ctx, x, y, w, h, mirror, lidDrop);
    ctx.lineTo(x + w * mirror, y - h * 2);
    ctx.lineTo(x - w * mirror, y - h * 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // lash line along the (possibly lowered) lid edge, with a soft outer flick
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#1B1312";
  ctx.lineWidth = 7.5;
  upperLid(ctx, x, y, w, h, mirror, lidDrop);
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath();
  const ox = x + (w / 2) * mirror;
  ctx.moveTo(ox - 6 * mirror, y - h * 0.06);
  ctx.quadraticCurveTo(ox + 8 * mirror, y - h * 0.1, ox + 16 * mirror, y - h * 0.28);
  ctx.stroke();
  // faint lower lash
  ctx.strokeStyle = "rgba(90,52,46,0.35)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x - (w / 2) * mirror * 0.6, y + h * 0.42);
  ctx.quadraticCurveTo(x, y + h * 0.55, x + (w / 2) * mirror * 0.85, y + h * 0.2);
  ctx.stroke();
  // brow (mostly under the fringe)
  ctx.strokeStyle = "rgba(38,26,24,0.55)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x - (w / 2) * mirror * 0.8, y - h * 1.18);
  ctx.quadraticCurveTo(x, y - h * (1.42 - lid * 0.2), x + (w / 2) * mirror * 0.95, y - h * 1.2);
  ctx.stroke();
  ctx.restore();
};

export const paintFace = (edition: Edition) =>
  cached(`face-${edition.id}`, () => {
    const { canvas, ctx } = makeCanvas(W, H);
    const { expression } = edition;
    ctx.fillStyle = SKIN;
    ctx.fillRect(0, 0, W, H);

    // warm lower-face gradient (gives the vinyl a slightly painted, airbrushed feel)
    const warm = ctx.createRadialGradient(CX, CY + 160, 20, CX, CY + 160, 420);
    warm.addColorStop(0, "rgba(246,214,200,0.9)");
    warm.addColorStop(1, "rgba(246,214,200,0)");
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, W, H);

    // blush
    for (const side of [-1, 1]) {
      const bx = CX + side * FACE_LAYOUT.blushDx * PX;
      const by = CY + FACE_LAYOUT.blushDy * PX;
      const g = ctx.createRadialGradient(bx, by, 4, bx, by, 95);
      g.addColorStop(0, `rgba(238,128,140,${0.42 * expression.blush})`);
      g.addColorStop(0.6, `rgba(238,128,140,${0.16 * expression.blush})`);
      g.addColorStop(1, "rgba(238,128,140,0)");
      ctx.fillStyle = g;
      ctx.fillRect(bx - 110, by - 110, 220, 220);
      if (expression.blush > 0.8) {
        ctx.strokeStyle = "rgba(214,98,116,0.45)";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(bx - 26 + i * 18, by + 8);
          ctx.lineTo(bx - 18 + i * 18, by - 8);
          ctx.stroke();
        }
      }
    }

    for (const side of [-1, 1]) {
      paintEye(ctx, edition, CX + side * FACE_LAYOUT.eyeDx * PX, CY + FACE_LAYOUT.eyeDy * PX, side);
    }

    // nose: a whisper of shadow + highlight; the 3D nose bump does the rest
    const ny = CY + FACE_LAYOUT.noseDy * PX;
    ctx.strokeStyle = "rgba(196,128,112,0.55)";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(CX - 7, ny + 6);
    ctx.quadraticCurveTo(CX, ny + 10, CX + 8, ny + 5);
    ctx.stroke();

    // mouth
    const my = CY + FACE_LAYOUT.mouthDy * PX;
    const mw = 46 * expression.mouthWidth;
    const lift = expression.smirk * 12;
    ctx.strokeStyle = "#A2525C";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(CX - mw / 2, my - expression.smile * 4);
    ctx.quadraticCurveTo(CX + lift * 0.3, my + expression.smile * 16, CX + mw / 2, my - expression.smile * 4 - lift);
    ctx.stroke();
    const lip = ctx.createRadialGradient(CX, my + 10, 1, CX, my + 10, 22);
    lip.addColorStop(0, "rgba(226,140,140,0.45)");
    lip.addColorStop(1, "rgba(226,140,140,0)");
    ctx.fillStyle = lip;
    ctx.fillRect(CX - 30, my - 10, 60, 44);

    if (edition.secret) {
      // tiny gold star beauty mark — the secret edition's signature
      const sx = CX + 0.5 * PX;
      const sy = CY + 0.36 * PX;
      starPath(ctx, sx, sy, 13, 5.5, 0.2);
      ctx.fillStyle = "#D9BC7A";
      ctx.fill();
    }

    return toTexture(canvas);
  });

export const faceTexture = (edition: Edition): THREE.Texture => paintFace(edition);
