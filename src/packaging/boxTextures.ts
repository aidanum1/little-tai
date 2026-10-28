import * as THREE from "three";
import { rng } from "../animations/timing";
import { conceptImages } from "../components/AssetGate";
import { cached, heartPath, makeCanvas, starPath, toTexture } from "../components/canvasTextures";
import { EDITIONS, PALETTE, type Edition } from "../characters/figures";
import { FONTS } from "../theme";

/**
 * Packaging artwork. Every face is painted into four aligned layers so the print reads physically:
 *   color  → albedo (with board grain)
 *   bump   → embossing / debossing
 *   foil   → metalness (gold / silver hot-foil)
 *   rough  → roughness (foil is glossy, card is matte)
 */

export const BOX = { w: 1.05, h: 1.42, d: 0.85, t: 0.014, lidH: 0.26 };

const PX_PER_UNIT = 975;

interface Surface {
  w: number;
  h: number;
  color: CanvasRenderingContext2D;
  bump: CanvasRenderingContext2D;
  foil: CanvasRenderingContext2D;
  rough: CanvasRenderingContext2D;
  canvases: HTMLCanvasElement[];
}

const surface = (wu: number, hu: number, base: string): Surface => {
  const w = Math.round(wu * PX_PER_UNIT);
  const h = Math.round(hu * PX_PER_UNIT);
  const c = makeCanvas(w, h);
  const b = makeCanvas(w, h);
  const f = makeCanvas(w, h);
  const r = makeCanvas(w, h);
  c.ctx.fillStyle = base;
  c.ctx.fillRect(0, 0, w, h);
  b.ctx.fillStyle = "#808080";
  b.ctx.fillRect(0, 0, w, h);
  f.ctx.fillStyle = "#000";
  f.ctx.fillRect(0, 0, w, h);
  r.ctx.fillStyle = "#d0d0d0";
  r.ctx.fillRect(0, 0, w, h);
  return { w, h, color: c.ctx, bump: b.ctx, foil: f.ctx, rough: r.ctx, canvases: [c.canvas, b.canvas, f.canvas, r.canvas] };
};

type Paint = (ctx: CanvasRenderingContext2D, ink: string | CanvasGradient) => void;

const ink = (s: Surface, color: string | CanvasGradient, draw: Paint) => draw(s.color, color);
const emboss = (s: Surface, draw: Paint, depth = 0.25) => draw(s.bump, `rgba(255,255,255,${depth})`);

const goldGradient = (ctx: CanvasRenderingContext2D, h: number, metal: "gold" | "silver" = "gold") => {
  const g = ctx.createLinearGradient(0, 0, h * 0.3, h);
  const stops = metal === "gold" ? ["#9C7B3E", "#E8D29B", "#B8954F", "#F3E2B0", "#A8853F"] : ["#8D939E", "#F4F6FA", "#AEB4BF", "#FFFFFF", "#9AA0AB"];
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
};

/** Hot-foil: metallic in color, white in metalness, glossy in roughness, slightly raised. */
const foil = (s: Surface, draw: Paint, metal: "gold" | "silver" = "gold") => {
  draw(s.color, goldGradient(s.color, s.h, metal));
  draw(s.foil, "#ffffff");
  draw(s.rough, "#3a3a3a");
  draw(s.bump, "rgba(255,255,255,0.18)");
};

const grain = (s: Surface, seed: number, strength = 1) => {
  const r = rng(seed);
  const { color, w, h } = s;
  color.save();
  for (let i = 0; i < (w * h) / 220; i++) {
    color.globalAlpha = (0.025 + r() * 0.035) * strength;
    color.fillStyle = r() > 0.5 ? "#ffffff" : "#000000";
    const x = r() * w;
    const y = r() * h;
    color.fillRect(x, y, 1 + r() * 2.5, 0.6 + r() * 1.2);
  }
  color.restore();
  // board fibre in the bump layer
  s.bump.save();
  for (let i = 0; i < (w * h) / 400; i++) {
    s.bump.globalAlpha = 0.08;
    s.bump.fillStyle = r() > 0.5 ? "#fff" : "#000";
    s.bump.fillRect(r() * w, r() * h, 1 + r() * 3, 1);
  }
  s.bump.restore();
};

const font = (weight: number | string, size: number, family: string, italic = false) => `${italic ? "italic " : ""}${weight} ${size}px ${family}`;

const text = (ctx: CanvasRenderingContext2D, str: string, x: number, y: number, f: string, fill: string | CanvasGradient, opts: { tracking?: number; align?: CanvasTextAlign } = {}) => {
  ctx.save();
  ctx.font = f;
  ctx.fillStyle = fill;
  ctx.textAlign = opts.align ?? "center";
  ctx.textBaseline = "alphabetic";
  if (opts.tracking) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${opts.tracking}px`;
  }
  ctx.fillText(str, x, y);
  ctx.restore();
};

const wordmark = (s: Surface, cx: number, y: number, size: number, color: string, mode: "ink" | "foil" | "silver" = "ink") => {
  const draw: Paint = (ctx, c) => {
    text(ctx, "little TAI", cx, y, font(600, size, FONTS.display, true), c);
    starPath(ctx, cx + size * 1.36, y - size * 0.78, size * 0.12, size * 0.05, 0.25);
    ctx.fillStyle = c;
    ctx.fill();
  };
  if (mode === "ink") ink(s, color, draw);
  else foil(s, draw, mode === "foil" ? "gold" : "silver");
  emboss(s, draw, 0.45);
};

/** Arched window shape (rounded top) — the box's "peek" illustration frame. */
const archPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + w / 2);
  ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
};

// ---------------------------------------------------------------------------------------------
// Illustration of the figure (used on boxes and cards when no generated concept image exists)
// ---------------------------------------------------------------------------------------------

export const drawFigureIllustration = (ctx: CanvasRenderingContext2D, edition: Edition, cx: number, cy: number, s: number, silhouette?: string) => {
  const o = edition.outfit;
  const sil = silhouette;
  const col = (c: string) => sil ?? c;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // soft ground shadow
  if (!sil) {
    const sh = ctx.createRadialGradient(0, 300, 5, 0, 300, 150);
    sh.addColorStop(0, "rgba(0,0,0,0.25)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh;
    ctx.fillRect(-160, 260, 320, 80);
  }
  // shoes + legs
  ctx.fillStyle = col(o.trousers);
  ctx.fillRect(-48, 200, 34, 80);
  ctx.fillRect(14, 200, 34, 80);
  ctx.fillStyle = col(o.shoes);
  for (const x of [-34, 34]) {
    ctx.beginPath();
    ctx.ellipse(x, 290, 34, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // coat (A-line)
  const hem = o.coatLength === "long" ? 262 : 222;
  ctx.fillStyle = col(o.coat);
  ctx.beginPath();
  ctx.moveTo(-70, -40);
  ctx.quadraticCurveTo(-128, -30, -132, 30);
  ctx.lineTo(-150, hem);
  ctx.quadraticCurveTo(0, hem + 18, 150, hem);
  ctx.lineTo(132, 30);
  ctx.quadraticCurveTo(128, -30, 70, -40);
  ctx.closePath();
  ctx.fill();
  if (!sil) {
    // sweater + shirt V
    ctx.fillStyle = o.sweater;
    ctx.beginPath();
    ctx.moveTo(-46, -38);
    ctx.lineTo(0, 120);
    ctx.lineTo(46, -38);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = o.shirt;
    ctx.beginPath();
    ctx.moveTo(-26, -40);
    ctx.lineTo(0, 22);
    ctx.lineTo(26, -40);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = o.shirtStripe;
    ctx.lineWidth = 3;
    for (let x = -20; x <= 20; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, -40);
      ctx.lineTo(x * 0.3, 10);
      ctx.stroke();
    }
    // lapels
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-46, -38);
    ctx.lineTo(-6, hem);
    ctx.moveTo(46, -38);
    ctx.lineTo(6, 130);
    ctx.stroke();
    if (o.panel) {
      ctx.fillStyle = o.panel;
      ctx.beginPath();
      ctx.moveTo(-50, -36);
      ctx.lineTo(-12, hem - 4);
      ctx.lineTo(-52, hem - 2);
      ctx.lineTo(-84, -20);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,170,180,0.6)";
      const r = rng(3);
      for (let i = 0; i < 90; i++) ctx.fillRect(-80 + r() * 60, -20 + r() * (hem - 10), 2, 2);
    }
    if (o.scarf) {
      ctx.fillStyle = o.scarf;
      ctx.beginPath();
      ctx.ellipse(0, -44, 64, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(14, -40, 30, 110);
    }
  }
  // arms (simple sleeves)
  ctx.fillStyle = col(o.coat);
  ctx.beginPath();
  ctx.ellipse(-138, 70, 30, 92, 0.12, 0, Math.PI * 2);
  ctx.ellipse(138, 70, 30, 92, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = col("#F3DDCB");
  ctx.beginPath();
  ctx.arc(-148, 160, 18, 0, Math.PI * 2);
  ctx.arc(148, 160, 18, 0, Math.PI * 2);
  ctx.fill();

  // head
  const hy = -175;
  ctx.fillStyle = col("#F3DDCB");
  ctx.beginPath();
  ctx.ellipse(0, hy, 128, 120, 0, 0, Math.PI * 2);
  ctx.fill();
  // hair: cap + layered sides + piecey fringe
  ctx.fillStyle = col(edition.secret ? "#0B0B10" : "#15161B");
  ctx.beginPath();
  ctx.moveTo(-140, hy + 70);
  ctx.quadraticCurveTo(-158, hy - 120, 0, hy - 140);
  ctx.quadraticCurveTo(158, hy - 120, 140, hy + 70);
  ctx.lineTo(118, hy + 95);
  ctx.lineTo(112, hy + 10);
  const fringe = [96, 72, 48, 24, 0, -24, -48, -72, -96];
  fringe.forEach((x, i) => {
    const depth = [30, 44, 26, 48, 34, 22, 46, 30, 40][i];
    ctx.lineTo(x + 10, hy - 4 + depth);
    ctx.lineTo(x - 2, hy - 20);
  });
  ctx.lineTo(-112, hy + 10);
  ctx.lineTo(-118, hy + 95);
  ctx.closePath();
  ctx.fill();
  if (!sil) {
    // hair sheen
    ctx.strokeStyle = edition.secret ? "rgba(200,180,255,0.35)" : "rgba(140,155,190,0.35)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, hy - 30, 110, -2.4, -1.2);
    ctx.stroke();
    // eyes
    const e = edition.expression;
    for (const sx of [-1, 1]) {
      const ex = sx * 46 + e.gaze[0] * 10;
      const ey = hy + 40 - e.gaze[1] * 8;
      ctx.fillStyle = "#1B1312";
      ctx.beginPath();
      ctx.ellipse(ex, ey, 15, 17 * (1 - e.lid * 0.55), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(ex - 5, ey - 6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1B1312";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(sx * 46 - 20, hy + 32 - (1 - e.lid) * 10);
      ctx.quadraticCurveTo(sx * 46, hy + 22 + e.lid * 14, sx * 46 + 22, hy + 30 - (1 - e.lid) * 8);
      ctx.stroke();
      // blush
      const b = ctx.createRadialGradient(sx * 74, hy + 72, 2, sx * 74, hy + 72, 28);
      b.addColorStop(0, `rgba(238,128,140,${0.55 * e.blush})`);
      b.addColorStop(1, "rgba(238,128,140,0)");
      ctx.fillStyle = b;
      ctx.fillRect(sx * 74 - 30, hy + 42, 60, 60);
    }
    ctx.strokeStyle = "#A2525C";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-12, hy + 92);
    ctx.quadraticCurveTo(e2(edition), hy + 92 + edition.expression.smile * 10, 12, hy + 92 - edition.expression.smirk * 8);
    ctx.stroke();
  }

  // held prop
  const prop = (draw: () => void) => {
    ctx.save();
    draw();
    ctx.restore();
  };
  if (!sil) {
    switch (edition.id) {
      case "dreamer":
        prop(() => {
          starPath(ctx, -40, 30, 36, 16, 0.2);
          ctx.fillStyle = "#9CCBF5";
          ctx.shadowColor = "#BFE0FF";
          ctx.shadowBlur = 30;
          ctx.fill();
        });
        break;
      case "shy":
        prop(() => {
          ctx.fillStyle = "#F6F0E6";
          ctx.fillRect(-34, 110, 68, 44);
          ctx.strokeStyle = "rgba(122,39,57,0.5)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-34, 110);
          ctx.lineTo(0, 136);
          ctx.lineTo(34, 110);
          ctx.stroke();
          heartPath(ctx, 70, -10, 26);
          ctx.fillStyle = "#F2BCC6";
          ctx.fill();
        });
        break;
      case "rebel":
        prop(() => {
          starPath(ctx, -78, -10, 18, 8, 0.3);
          ctx.fillStyle = "#E6E9EF";
          ctx.fill();
        });
        break;
      case "wanderer":
        prop(() => {
          ctx.fillStyle = "#EDE2C8";
          ctx.beginPath();
          ctx.roundRect(-232, 150, 92, 104, 12);
          ctx.fill();
          ctx.fillStyle = "#9A6B43";
          ctx.fillRect(-212, 150, 12, 104);
          ctx.fillRect(-172, 150, 12, 104);
        });
        break;
      case "midnight":
        prop(() => {
          starPath(ctx, -8, 40, 40, 18, 0.15);
          ctx.fillStyle = "#C2162F";
          ctx.shadowColor = "#FF2E48";
          ctx.shadowBlur = 50;
          ctx.fill();
        });
        break;
    }
  }
  ctx.restore();
};
const e2 = (edition: Edition) => edition.expression.smirk * 6;

const drawConceptOrIllustration = (ctx: CanvasRenderingContext2D, edition: Edition, x: number, y: number, w: number, h: number) => {
  const img = conceptImages.get(edition.id);
  if (img) {
    // cover-fit the generated concept inside the window
    const scale = Math.max(w / img.width, h / img.height) * 1.02;
    const iw = img.width * scale;
    const ih = img.height * scale;
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) * 0.35, iw, ih);
    return;
  }
  drawFigureIllustration(ctx, edition, x + w / 2, y + h * 0.56, Math.min(w / 420, h / 620));
};

// ---------------------------------------------------------------------------------------------
// Motif backgrounds
// ---------------------------------------------------------------------------------------------

const scatterStars = (ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, n: number, colors: string[], sizes: [number, number]) => {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    starPath(ctx, r() * w, r() * h, sizes[0] + r() * (sizes[1] - sizes[0]), undefined, r() * 1.2);
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    ctx.fill();
  }
};

const motifBackground = (s: Surface, e: Edition, seed: number) => {
  const { color: ctx, w, h } = s;
  switch (e.box.motif) {
    case "stars": {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#9DC2E8");
      g.addColorStop(1, "#CFE2F5");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      scatterStars(ctx, w, h, seed, Math.round((w * h) / 9000), ["#ECE6D9", "#FFFFFF", "#26355A"], [5, 16]);
      // dotted constellation trails
      const r = rng(seed + 1);
      ctx.fillStyle = "rgba(38,53,90,0.35)";
      for (let k = 0; k < 4; k++) {
        let x = r() * w;
        let y = r() * h;
        for (let i = 0; i < 24; i++) {
          x += 9 + r() * 4;
          y += Math.sin(i * 0.4 + k) * 6;
          ctx.beginPath();
          ctx.arc(x % w, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // crescent moon
      ctx.fillStyle = PALETTE.cream;
      ctx.beginPath();
      ctx.arc(w * 0.84, h * 0.12, w * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#A2C6EA";
      ctx.beginPath();
      ctx.arc(w * 0.865, h * 0.105, w * 0.055, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "love-notes": {
      ctx.fillStyle = "#D9A5AE";
      ctx.fillRect(0, 0, w, h);
      const lines = ["i wanted to tell you…", "maybe tomorrow", "do you remember?", "you, always", "p.s. don't read this", "♡ ♡ ♡", "it's nothing, really", "sincerely, me"];
      ctx.save();
      ctx.rotate(-0.1);
      ctx.font = font(400, Math.round(w * 0.045), FONTS.hand);
      ctx.fillStyle = "rgba(94,31,46,0.28)";
      const r = rng(seed);
      for (let y = -40; y < h + 120; y += w * 0.07) {
        let x = -60 - r() * 120;
        while (x < w + 80) {
          const str = lines[Math.floor(r() * lines.length)];
          ctx.fillText(str, x, y);
          x += ctx.measureText(str).width + 40;
        }
      }
      ctx.restore();
      const r2 = rng(seed + 3);
      for (let i = 0; i < 26; i++) {
        heartPath(ctx, r2() * w, r2() * h, 10 + r2() * 16);
        ctx.fillStyle = r2() > 0.5 ? "#FBF4EC" : "#7A2739";
        ctx.fill();
      }
      break;
    }
    case "silver-stars": {
      ctx.fillStyle = "#7A2739";
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 10;
      for (let x = -h; x < w; x += 44) {
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x + h, 0);
        ctx.stroke();
      }
      ctx.restore();
      const r = rng(seed);
      const pts = Array.from({ length: Math.round((w * h) / 16000) }, () => [r() * w, r() * h, 6 + r() * 22, r() * 2] as const);
      foil(
        s,
        (c, inkColor) => {
          c.fillStyle = inkColor;
          for (const [x, y, size, rot] of pts) {
            starPath(c, x, y, size, size * 0.42, rot);
            c.fill();
          }
        },
        "silver",
      );
      break;
    }
    case "landscapes": {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#5B6B4F");
      g.addColorStop(1, "#46553E");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      scatterStars(ctx, w, h * 0.5, seed, 40, ["#F3ECDD", "#E9D9B4"], [3, 8]);
      // three tiny storybook vignettes stacked as bands
      const r = rng(seed + 7);
      const bands = [0.78, 0.88, 0.97];
      bands.forEach((by, bi) => {
        ctx.fillStyle = ["#7C8B66", "#68784F", "#3F4C35"][bi];
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 20) ctx.lineTo(x, h * by - Math.sin(x / (90 + bi * 40) + bi) * 26 - 20);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
        for (let i = 0; i < 9; i++) {
          const x = r() * w;
          const y = h * by - Math.sin(x / (90 + bi * 40) + bi) * 26 - 22;
          ctx.fillStyle = bi === 2 ? "#2F3A28" : "#3F4C35";
          ctx.beginPath();
          ctx.moveTo(x, y - 34 - r() * 20);
          ctx.lineTo(x - 12, y + 4);
          ctx.lineTo(x + 12, y + 4);
          ctx.fill();
        }
        if (bi === 1) {
          // little houses
          for (const hx of [w * 0.18, w * 0.7]) {
            const hy = h * by - Math.sin(hx / 130 + 1) * 26 - 24;
            ctx.fillStyle = "#F3ECDD";
            ctx.fillRect(hx - 16, hy - 22, 32, 24);
            ctx.fillStyle = PALETTE.burgundy;
            ctx.beginPath();
            ctx.moveTo(hx - 20, hy - 22);
            ctx.lineTo(hx, hy - 40);
            ctx.lineTo(hx + 20, hy - 22);
            ctx.fill();
            ctx.fillStyle = "#E9C77A";
            ctx.fillRect(hx - 4, hy - 14, 8, 8);
          }
        }
      });
      // winding cream path
      ctx.strokeStyle = "#E9D9B4";
      ctx.lineWidth = 10;
      ctx.setLineDash([16, 12]);
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h);
      ctx.bezierCurveTo(w * 0.2, h * 0.94, w * 0.8, h * 0.88, w * 0.45, h * 0.8);
      ctx.stroke();
      ctx.setLineDash([]);
      // paper clouds
      for (const [cxr, cyr, sc] of [
        [0.18, 0.1, 1],
        [0.78, 0.2, 0.8],
        [0.4, 0.05, 0.6],
      ]) {
        ctx.fillStyle = "#F3ECDD";
        ctx.beginPath();
        ctx.arc(w * cxr, h * cyr, 30 * sc, 0, Math.PI * 2);
        ctx.arc(w * cxr + 34 * sc, h * cyr - 12 * sc, 38 * sc, 0, Math.PI * 2);
        ctx.arc(w * cxr + 72 * sc, h * cyr, 28 * sc, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "celestial": {
      ctx.fillStyle = "#0C0C11";
      ctx.fillRect(0, 0, w, h);
      const r = rng(seed);
      foil(s, (c, i) => {
        c.strokeStyle = i;
        c.fillStyle = i;
        c.lineWidth = 2.5;
        for (const rad of [0.36, 0.44, 0.58]) {
          c.beginPath();
          c.arc(w / 2, h * 0.43, w * rad, 0, Math.PI * 2);
          c.stroke();
        }
        for (let k = 0; k < 64; k++) {
          const a = (k / 64) * Math.PI * 2;
          c.beginPath();
          c.moveTo(w / 2 + Math.cos(a) * w * 0.44, h * 0.43 + Math.sin(a) * w * 0.44);
          c.lineTo(w / 2 + Math.cos(a) * w * (k % 4 ? 0.455 : 0.475), h * 0.43 + Math.sin(a) * w * (k % 4 ? 0.455 : 0.475));
          c.stroke();
        }
        for (let i = 0; i < 70; i++) {
          starPath(c, r() * w, r() * h, 3 + r() * 9, undefined, r());
          c.fill();
        }
        // moon phases
        for (let i = 0; i < 7; i++) {
          const x = w * (0.2 + i * 0.1);
          const y = h * 0.955;
          c.beginPath();
          c.arc(x, y, 11, 0, Math.PI * 2);
          c.lineWidth = 2;
          c.stroke();
          c.beginPath();
          c.arc(x, y, 11, -Math.PI / 2, Math.PI / 2, i < 3);
          c.ellipse(x, y, Math.abs(3 - i) * 3.6, 11, 0, Math.PI / 2, -Math.PI / 2, i >= 3);
          c.fill();
        }
      });
      break;
    }
  }
};

const isFoilBox = (e: Edition) => e.box.motif === "celestial" || e.box.motif === "silver-stars";
const metalOf = (e: Edition): "gold" | "silver" => (e.box.motif === "celestial" ? "gold" : "silver");

// ---------------------------------------------------------------------------------------------
// Faces
// ---------------------------------------------------------------------------------------------

const paintFront = (e: Edition, telescoping: boolean) => {
  const s = surface(BOX.w, BOX.h, e.box.base);
  const { w, h } = s;
  motifBackground(s, e, 11 + e.index);
  grain(s, 3 + e.index);

  const top = telescoping ? BOX.lidH / BOX.h + 0.04 : 0;
  const ty = h * top;
  if (!telescoping) {
    wordmark(s, w / 2, ty + h * 0.135, w * 0.15, e.box.ink, isFoilBox(e) ? (e.box.motif === "celestial" ? "foil" : "silver") : "ink");
    ink(s, e.box.ink, (c, i) => text(c, "THE FEELINGS COLLECTION", w / 2, ty + h * 0.18, font(500, w * 0.026, FONTS.sans), i, { tracking: w * 0.012 }));
  }

  // window
  const ww = w * 0.6;
  const wh = h * (telescoping ? 0.45 : 0.49);
  const wx = (w - ww) / 2;
  const wy = telescoping ? ty + h * 0.03 : h * 0.215;
  const c = s.color;
  c.save();
  archPath(c, wx, wy, ww, wh);
  c.clip();
  const glow = c.createRadialGradient(w / 2, wy + wh * 0.45, 10, w / 2, wy + wh * 0.45, ww * 0.9);
  glow.addColorStop(0, e.secret ? "#3A0A16" : e.box.interior);
  glow.addColorStop(1, e.secret ? "#0C0C11" : new THREE.Color(e.box.base).lerp(new THREE.Color("#ffffff"), 0.35).getStyle());
  c.fillStyle = glow;
  c.fillRect(wx, wy, ww, wh);
  if (e.secret) {
    // the secret box never shows the figure — a gold "?" silhouette instead
    drawFigureIllustration(c, e, w / 2, wy + wh * 0.58, ww / 470, "#1E1A16");
  } else {
    drawConceptOrIllustration(c, e, wx, wy, ww, wh);
  }
  c.restore();
  const frame: Paint = (cx, i) => {
    cx.strokeStyle = i;
    cx.lineWidth = w * 0.012;
    archPath(cx, wx, wy, ww, wh);
    cx.stroke();
    cx.lineWidth = w * 0.003;
    archPath(cx, wx - w * 0.022, wy - w * 0.022, ww + w * 0.044, wh + w * 0.044);
    cx.stroke();
  };
  if (isFoilBox(e)) foil(s, frame, metalOf(e));
  else ink(s, e.box.accent, frame);
  emboss(s, frame, 0.5);

  if (e.secret) {
    foil(s, (cx, i) => text(cx, "?", w / 2, wy + wh * 0.5, font(600, w * 0.3, FONTS.serif), i));
  }

  // edition title block
  const by = wy + wh + h * 0.058;
  const title = e.secret ? "SECRET EDITION" : e.name;
  const numberDraw: Paint = (cx, i) => text(cx, e.secret ? "???" : `No. ${e.number}`, w / 2, by, font(500, w * 0.034, FONTS.sans), i, { tracking: w * 0.014 });
  const titleDraw: Paint = (cx, i) => text(cx, title, w / 2, by + h * 0.068, font(600, w * 0.072, FONTS.serif), i, { tracking: w * 0.008 });
  if (isFoilBox(e)) {
    foil(s, numberDraw, metalOf(e));
    foil(s, titleDraw, metalOf(e));
  } else {
    ink(s, e.box.ink, numberDraw);
    ink(s, e.box.ink, titleDraw);
  }
  emboss(s, titleDraw, 0.4);
  ink(s, e.secret ? PALETTE.gold : e.box.ink, (cx, i) => text(cx, e.box.tagline, w / 2, by + h * 0.118, font(500, w * 0.04, FONTS.serif, true), i));
  ink(s, e.secret ? "rgba(196,166,109,0.8)" : e.box.ink, (cx, i) =>
    text(cx, "BLIND BOX · 1 FIGURE · 4 + 1 SECRET", w / 2, h * 0.962, font(400, w * 0.02, FONTS.sans), i, { tracking: w * 0.008 }),
  );

  // inset border
  const border: Paint = (cx, i) => {
    cx.strokeStyle = i;
    cx.lineWidth = 3;
    cx.strokeRect(w * 0.035, h * 0.025, w * 0.93, h * 0.95);
  };
  if (isFoilBox(e)) foil(s, border, metalOf(e));
  else ink(s, e.box.ink, border);
  return s;
};

const paintSide = (e: Edition, which: "left" | "right", telescoping: boolean) => {
  const s = surface(BOX.d, BOX.h, e.box.base);
  const { w, h, color: c } = s;
  motifBackground(s, e, 31 + e.index + (which === "left" ? 0 : 5));
  grain(s, 13 + e.index);
  // solid band behind the type for legibility
  const bandX = w * 0.18;
  const bandW = w * 0.64;
  c.fillStyle = e.secret ? "#0C0C11" : new THREE.Color(e.box.base).lerp(new THREE.Color(e.box.ink), 0.08).getStyle();
  c.fillRect(bandX, telescoping ? h * 0.2 : 0, bandW, h);
  const inkMode = isFoilBox(e);
  if (which === "right") {
    // vertical wordmark
    const draw: Paint = (cx, i) => {
      cx.save();
      cx.translate(w / 2 + w * 0.08, h * 0.6);
      cx.rotate(-Math.PI / 2);
      text(cx, "little TAI", 0, 0, font(600, w * 0.24, FONTS.display, true), i);
      cx.restore();
    };
    if (inkMode) foil(s, draw, metalOf(e));
    else ink(s, e.box.ink, draw);
    emboss(s, draw, 0.45);
  } else {
    // collector checklist
    ink(s, e.secret ? PALETTE.gold : e.box.ink, (cx, i) => {
      text(cx, "COLLECT", w / 2, h * 0.3, font(500, w * 0.06, FONTS.sans), i, { tracking: w * 0.02 });
      text(cx, "them all", w / 2, h * 0.35, font(400, w * 0.08, FONTS.display, true), i);
    });
    EDITIONS.forEach((ed, k) => {
      const y = h * 0.43 + k * h * 0.095;
      const sil = ed.secret ? (e.secret ? "#C4A66D" : "rgba(0,0,0,0.55)") : e.secret ? "#C4A66D" : e.box.ink;
      drawFigureIllustration(c, ed, w * 0.32, y, 0.11, sil);
      ink(s, e.secret ? PALETTE.gold : e.box.ink, (cx, i) => {
        text(cx, ed.secret ? "???" : ed.number, w * 0.5, y + 6, font(500, w * 0.045, FONTS.sans), i, { align: "left" });
        text(cx, ed.secret ? "SECRET" : ed.name.replace("THE ", ""), w * 0.5, y + w * 0.065, font(600, w * 0.042, FONTS.serif), i, { align: "left" });
      });
    });
  }
  return s;
};

const paintBack = (e: Edition) => {
  const s = surface(BOX.w, BOX.h, e.box.base);
  const { w, h, color: c } = s;
  c.fillStyle = e.secret ? "#0C0C11" : new THREE.Color(e.box.base).lerp(new THREE.Color("#ffffff"), 0.12).getStyle();
  c.fillRect(0, 0, w, h);
  grain(s, 23 + e.index);
  const inkColor = e.secret ? PALETTE.gold : e.box.ink;
  wordmark(s, w / 2, h * 0.2, w * 0.11, inkColor, e.secret ? "foil" : "ink");
  ink(s, inkColor, (cx, i) => {
    text(cx, "THE FEELINGS COLLECTION", w / 2, h * 0.245, font(500, w * 0.024, FONTS.sans), i, { tracking: w * 0.012 });
    text(cx, "Some feelings are too small for words.", w / 2, h * 0.31, font(500, w * 0.038, FONTS.serif, true), i);
  });
  // lineup
  EDITIONS.forEach((ed, k) => {
    const x = w * (0.14 + k * 0.18);
    const y = h * 0.5;
    c.save();
    c.fillStyle = e.secret ? "rgba(196,166,109,0.12)" : "rgba(255,255,255,0.45)";
    c.beginPath();
    c.ellipse(x, y + h * 0.1, w * 0.07, w * 0.015, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
    drawFigureIllustration(c, ed, x, y, 0.2, ed.secret ? (e.secret ? "#C4A66D" : "#1E1E26") : undefined);
    ink(s, inkColor, (cx, i) => {
      text(cx, ed.secret ? "???" : ed.number, x, y + h * 0.15, font(500, w * 0.024, FONTS.sans), i, { tracking: 2 });
      text(cx, ed.secret ? "SECRET" : ed.name.replace("THE ", "").replace("LITTLE ", ""), x, y + h * 0.18, font(600, w * 0.025, FONTS.serif), i);
    });
  });
  ink(s, inkColor, (cx, i) => {
    const lines = [
      "Each box holds one of four little feelings — or, if the stars allow, the secret Midnight Star.",
      "Soft-touch vinyl figure ≈ 7 cm · display base included.",
      "Unofficial fan-made concept. Not affiliated with or endorsed by A2O SOUL or its agency.",
    ];
    lines.forEach((l, k) => text(cx, l, w / 2, h * (0.82 + k * 0.035), font(400, w * 0.02, FONTS.sans), i));
  });
  return s;
};

const paintTop = (e: Edition, wu: number, du: number) => {
  const s = surface(wu, du, e.box.base);
  const { w, h } = s;
  motifBackground(s, e, 51 + e.index);
  grain(s, 33 + e.index);
  const c = s.color;
  c.fillStyle = e.secret ? "rgba(12,12,17,0.85)" : "rgba(255,255,255,0.28)";
  c.beginPath();
  c.ellipse(w / 2, h / 2, w * 0.36, h * 0.3, 0, 0, Math.PI * 2);
  c.fill();
  wordmark(s, w / 2, h * 0.56, w * 0.13, e.secret ? PALETTE.gold : e.box.ink, isFoilBox(e) ? (e.box.motif === "celestial" ? "foil" : "silver") : "ink");
  return s;
};

const paintLidBand = (e: Edition, wu: number) => {
  const s = surface(wu, BOX.lidH, e.box.base);
  const { w, h } = s;
  motifBackground(s, e, 61 + e.index);
  grain(s, 43 + e.index);
  s.color.fillStyle = e.secret ? "rgba(12,12,17,0.7)" : "rgba(0,0,0,0.12)";
  s.color.fillRect(0, 0, w, h);
  wordmark(s, w / 2, h * 0.6, h * 0.42, e.secret ? PALETTE.gold : e.box.ink, isFoilBox(e) ? (e.box.motif === "celestial" ? "foil" : "silver") : "ink");
  ink(s, e.secret ? PALETTE.gold : e.box.ink, (cx, i) => text(cx, "THE FEELINGS COLLECTION", w / 2, h * 0.86, font(500, h * 0.085, FONTS.sans), i, { tracking: h * 0.04 }));
  return s;
};

const paintInterior = (e: Edition) => {
  const s = surface(1, 1, e.box.interior);
  const { w, h } = s;
  scatterStars(s.color, w, h, 91 + e.index, 60, [e.secret ? "rgba(196,166,109,0.35)" : "rgba(255,255,255,0.4)"], [4, 10]);
  grain(s, 53 + e.index, 0.6);
  return s;
};

// ---------------------------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------------------------

const toMaterial = (s: Surface, opts: { glossy?: boolean } = {}) => {
  const [c, b, f, r] = s.canvases;
  return new THREE.MeshPhysicalMaterial({
    map: toTexture(c),
    bumpMap: toTexture(b, false),
    bumpScale: 1.2,
    metalnessMap: toTexture(f, false),
    metalness: 1,
    roughnessMap: toTexture(r, false),
    roughness: 1,
    clearcoat: opts.glossy ? 0.6 : 0.08,
    clearcoatRoughness: opts.glossy ? 0.15 : 0.6,
    sheen: opts.glossy ? 0 : 0.25,
    sheenRoughness: 0.8,
  });
};

export interface BoxMaterials {
  front: THREE.Material;
  back: THREE.Material;
  left: THREE.Material;
  right: THREE.Material;
  top: THREE.Material;
  bottom: THREE.Material;
  interior: THREE.Material;
  edge: THREE.Material;
  lidBand?: THREE.Material;
  lidBandSide?: THREE.Material;
  flap: THREE.Material;
}

const paintFlap = (e: Edition) => {
  const s = surface(BOX.w, BOX.d / 2, e.box.base);
  motifBackground(s, e, 71 + e.index);
  grain(s, 63 + e.index);
  if (e.box.motif === "love-notes") {
    // a burgundy wax-seal heart sticker where the flaps meet
    const { w, h } = s;
    const draw: Paint = (cx, i) => {
      heartPath(cx, w / 2, h * 0.9, h * 0.22);
      cx.fillStyle = i;
      cx.fill();
    };
    ink(s, PALETTE.burgundy, draw);
    emboss(s, draw, 0.5);
  }
  return s;
};

const boxMatCache = new Map<string, BoxMaterials>();

export const boxMaterials = (e: Edition): BoxMaterials => {
  const hit = boxMatCache.get(e.id);
  if (hit) return hit;
  const telescoping = e.box.style === "pop" || e.box.style === "luxe";
  const glossy = e.secret;
  const lidW = BOX.w + 2 * BOX.t + 0.008;
  const lidD = BOX.d + 2 * BOX.t + 0.008;
  const mats: BoxMaterials = {
    front: toMaterial(paintFront(e, telescoping), { glossy }),
    back: toMaterial(paintBack(e), { glossy }),
    left: toMaterial(paintSide(e, "left", telescoping), { glossy }),
    right: toMaterial(paintSide(e, "right", telescoping), { glossy }),
    top: toMaterial(telescoping ? paintTop(e, lidW, lidD) : paintTop(e, BOX.w, BOX.d), { glossy }),
    bottom: toMaterial(paintInterior(e)),
    interior: toMaterial(paintInterior(e)),
    // gilded edges on the secret box; raw board edges on the standard ones
    edge: e.secret
      ? new THREE.MeshPhysicalMaterial({ color: "#D8B872", metalness: 1, roughness: 0.25, clearcoat: 0.5 })
      : new THREE.MeshStandardMaterial({ color: "#E4DACA", roughness: 0.9 }),
    flap: toMaterial(paintFlap(e), { glossy }),
  };
  if (telescoping) {
    mats.lidBand = toMaterial(paintLidBand(e, lidW), { glossy });
    mats.lidBandSide = toMaterial(paintLidBand(e, lidD), { glossy });
  }
  boxMatCache.set(e.id, mats);
  return mats;
};

/** Flat card artwork for the collectible cards (reuses the box painter). */
export const frontArtCanvas = (e: Edition) => cached(`front-art-${e.id}`, () => toTexture(paintFront(e, false).canvases[0]));
