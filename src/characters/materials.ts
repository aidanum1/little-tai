import * as THREE from "three";
import { cached, grainTexture, makeCanvas, toTexture } from "../components/canvasTextures";
import { faceTexture } from "./faceTexture";
import type { Edition } from "./figures";

/** Soft-matte vinyl look: low clearcoat, gentle sheen, fine grain. Shared per edition and cached. */

const matCache = new Map<string, THREE.Material>();
const memo = <T extends THREE.Material>(key: string, make: () => T): T => {
  let m = matCache.get(key) as T | undefined;
  if (!m) {
    m = make();
    matCache.set(key, m);
  }
  return m;
};

export const vinyl = (key: string, color: string, opts: THREE.MeshPhysicalMaterialParameters = {}) =>
  memo(`vinyl-${key}-${color}`, () => {
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.62,
      metalness: 0,
      clearcoat: 0.18,
      clearcoatRoughness: 0.55,
      sheen: 0.35,
      sheenRoughness: 0.7,
      sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.35),
      bumpMap: grainTexture(11, 6),
      bumpScale: 0.25,
      ...opts,
    });
  });

const knitTexture = (edition: Edition) =>
  cached(`knit-${edition.id}`, () => {
    const W = 1024;
    const H = 512;
    const { canvas, ctx } = makeCanvas(W, H);
    ctx.fillStyle = edition.outfit.sweater;
    ctx.fillRect(0, 0, W, H);
    // ribbed knit
    for (let x = 0; x < W; x += 8) {
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(x, 0, 2, H);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(x + 4, 0, 2, H);
    }
    // V-neck revealing the shirt (front = u 0.5, top of canvas = neckline)
    const vw = W * 0.075;
    const vh = H * 0.22;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(W / 2 - vw, 0);
    ctx.lineTo(W / 2 + vw, 0);
    ctx.lineTo(W / 2, vh);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = edition.outfit.shirt;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = edition.outfit.shirtStripe;
    for (let x = W / 2 - vw; x < W / 2 + vw; x += 9) ctx.fillRect(x, 0, 3, vh);
    ctx.restore();
    // ribbed V trim
    ctx.strokeStyle = new THREE.Color(edition.outfit.sweater).multiplyScalar(0.7).getStyle();
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(W / 2 - vw - 3, 0);
    ctx.lineTo(W / 2, vh + 6);
    ctx.lineTo(W / 2 + vw + 3, 0);
    ctx.stroke();
    return toTexture(canvas);
  });

export const stripeTexture = (base: string, stripe: string) =>
  cached(`stripe-${base}-${stripe}`, () => {
    const { canvas, ctx } = makeCanvas(64, 64);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = stripe;
    for (let x = 0; x < 64; x += 16) ctx.fillRect(x, 0, 5, 64);
    const t = toTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(28, 28);
    return t;
  });

/** Red glitter for the Midnight Star panel: dense metallic flakes over deep burgundy. */
export const glitterTextures = () =>
  cached("glitter-color", () => {
    const S = 512;
    const { canvas, ctx } = makeCanvas(S, S);
    ctx.fillStyle = "#5E0F1D";
    ctx.fillRect(0, 0, S, S);
    let seed = 99;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 9000; i++) {
      const v = r();
      ctx.fillStyle = v > 0.92 ? "#FFB3BC" : v > 0.6 ? "#C9283F" : "#8E1B2E";
      ctx.fillRect(r() * S, r() * S, 1 + r() * 2.2, 1 + r() * 2.2);
    }
    const t = toTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 6);
    return t;
  });

export const figureMaterials = (edition: Edition) => {
  const o = edition.outfit;
  const secret = edition.secret;
  return {
    skin: memo(`skin-${edition.id}`, () => {
      return new THREE.MeshPhysicalMaterial({
        map: faceTexture(edition),
        roughness: 0.58,
        clearcoat: 0.12,
        clearcoatRoughness: 0.6,
        sheen: 0.5,
        sheenColor: new THREE.Color("#FFD9CF"),
        sheenRoughness: 0.55,
      });
    }),
    skinPlain: vinyl("skin", "#F3DDCB", { sheen: 0.5, sheenColor: new THREE.Color("#FFD9CF"), roughness: 0.58, bumpScale: 0.05 }),
    hair: memo(`hair-${edition.id}`, () => {
      return new THREE.MeshPhysicalMaterial({
        color: secret ? "#0B0B10" : "#141519",
        roughness: secret ? 0.32 : 0.42,
        clearcoat: secret ? 0.9 : 0.55,
        clearcoatRoughness: 0.3,
        sheen: 0.4,
        sheenColor: new THREE.Color(secret ? "#B9A6D8" : "#56637E"),
        sheenRoughness: 0.4,
        // pearlescent highlights on the secret edition
        iridescence: secret ? 0.85 : 0,
        iridescenceIOR: 1.7,
        iridescenceThicknessRange: [180, 620],
      });
    }),
    coat: vinyl(`coat-${edition.id}`, o.coat, {
      roughness: secret ? 0.34 : 0.74,
      clearcoat: secret ? 0.65 : 0.1,
      clearcoatRoughness: secret ? 0.25 : 0.6,
      sheen: secret ? 0.2 : 0.6,
      side: THREE.DoubleSide,
      bumpScale: 0.6,
    }),
    sweater: memo(`sweater-${edition.id}`, () => {
      return new THREE.MeshPhysicalMaterial({
        map: knitTexture(edition),
        roughness: 0.85,
        sheen: 0.6,
        sheenColor: new THREE.Color(o.sweater).lerp(new THREE.Color("#fff"), 0.4),
        bumpMap: grainTexture(5, 10),
        bumpScale: 0.4,
      });
    }),
    shirt: memo(`shirt-${edition.id}`, () => {
      return new THREE.MeshPhysicalMaterial({ map: stripeTexture(o.shirt, o.shirtStripe), roughness: 0.7, sheen: 0.3, side: THREE.DoubleSide });
    }),
    trousers: vinyl(`trousers-${edition.id}`, o.trousers, { roughness: 0.7 }),
    shoes: vinyl(`shoes-${edition.id}`, o.shoes, { roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
    buttons: memo(`buttons-${edition.id}`, () => {
      return new THREE.MeshPhysicalMaterial({ color: o.buttons, roughness: 0.25, metalness: secret ? 1 : 0.2, clearcoat: 1 });
    }),
    scarf: o.scarf ? vinyl(`scarf-${edition.id}`, o.scarf, { roughness: 0.9, sheen: 0.8, bumpMap: grainTexture(3, 14), bumpScale: 0.8 }) : null,
    panel: o.panel
      ? memo("panel-glitter", () => {
          return new THREE.MeshPhysicalMaterial({
            map: glitterTextures(),
            color: "#ffffff",
            roughness: 0.28,
            metalness: 0.55,
            clearcoat: 1,
            clearcoatRoughness: 0.15,
            emissive: new THREE.Color("#7A0F22"),
            emissiveMap: glitterTextures(),
            emissiveIntensity: 0.25,
            side: THREE.DoubleSide,
          });
        })
      : null,
  };
};

export const gold = () =>
  memo("gold", () => new THREE.MeshPhysicalMaterial({ color: "#D8B872", metalness: 1, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.2 }));

export const silver = () =>
  memo("silver", () => new THREE.MeshPhysicalMaterial({ color: "#E6E9EF", metalness: 1, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.08 }));

/** Translucent candy-vinyl for the held stars and hearts. */
export const translucent = (color: string, emissive: string, emissiveIntensity = 0.6) =>
  memo(`translucent-${color}-${emissive}-${emissiveIntensity}`, () => {
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.12,
      transmission: 0.82,
      thickness: 0.5,
      ior: 1.45,
      attenuationColor: new THREE.Color(color),
      attenuationDistance: 0.35,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      emissive: new THREE.Color(emissive),
      emissiveIntensity,
      transparent: true,
    });
  });
