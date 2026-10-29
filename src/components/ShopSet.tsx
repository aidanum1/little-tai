import React, { useMemo } from "react";
import * as THREE from "three";
import { rng } from "../animations/timing";
import { gold } from "../characters/materials";
import { cached, makeCanvas, starPath, toTexture } from "./canvasTextures";
import { Glow } from "./Particles";

/**
 * "After hours" set: a toy-shop display shelf at night. Walnut shelf (top at y = 0), star wallpaper on the back
 * wall, a window onto a moonlit city, and a string of fairy lights. `on` is the shop's ceiling lights (0–1).
 */

export const SHELF = { width: 6.4, depth: 2.2, thick: 0.16, front: 1.55, wallZ: -0.75 } as const;

const woodTexture = () =>
  cached("shop-wood", () => {
    const { canvas, ctx } = makeCanvas(1024, 512);
    ctx.fillStyle = "#4a2e1d";
    ctx.fillRect(0, 0, 1024, 512);
    const r = rng(31);
    for (let i = 0; i < 260; i++) {
      const y = r() * 512;
      ctx.strokeStyle = `rgba(${r() < 0.5 ? "28,16,10" : "112,74,48"},${0.12 + r() * 0.25})`;
      ctx.lineWidth = 0.6 + r() * 2.4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 1024; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.01 + i) * 3 + (r() - 0.5) * 1.5);
      ctx.stroke();
    }
    // plank seams
    ctx.fillStyle = "rgba(10,6,4,0.55)";
    for (const y of [127, 255, 383]) ctx.fillRect(0, y, 1024, 2);
    const t = toTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 1);
    return t;
  });

const wallpaperTexture = () =>
  cached("shop-wallpaper", () => {
    const { canvas, ctx } = makeCanvas(512, 512);
    ctx.fillStyle = "#2b2740";
    ctx.fillRect(0, 0, 512, 512);
    // soft vertical stripes
    for (let x = 0; x < 512; x += 64) {
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      ctx.fillRect(x, 0, 32, 512);
    }
    const r = rng(9);
    for (let i = 0; i < 16; i++) {
      const x = (i % 4) * 128 + 64 + (Math.floor(i / 4) % 2) * 64;
      const y = Math.floor(i / 4) * 128 + 64;
      starPath(ctx, x % 512, y, 9 + r() * 3, undefined, r() * 0.6);
      ctx.fillStyle = "rgba(214,186,120,0.55)";
      ctx.fill();
    }
    const t = toTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(5, 4);
    return t;
  });

const nightSkyTexture = () =>
  cached("shop-night-sky", () => {
    const { canvas, ctx } = makeCanvas(512, 640);
    const g = ctx.createLinearGradient(0, 0, 0, 640);
    g.addColorStop(0, "#0b1230");
    g.addColorStop(0.7, "#1d2a5a");
    g.addColorStop(1, "#3a3a66");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 640);
    const r = rng(77);
    for (let i = 0; i < 140; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`;
      ctx.fillRect(r() * 512, r() * 420, 1.5, 1.5);
    }
    // moon with halo
    const halo = ctx.createRadialGradient(360, 150, 20, 360, 150, 150);
    halo.addColorStop(0, "rgba(230,236,255,0.55)");
    halo.addColorStop(1, "rgba(230,236,255,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, 512, 640);
    ctx.fillStyle = "#f4f1e4";
    ctx.beginPath();
    ctx.arc(360, 150, 46, 0, Math.PI * 2);
    ctx.fill();
    // rooftops with a few lit windows
    ctx.fillStyle = "#0a0d1c";
    let x = 0;
    while (x < 512) {
      const w = 50 + r() * 70;
      const h = 90 + r() * 140;
      ctx.fillRect(x, 640 - h, w, h);
      for (let wy = 640 - h + 14; wy < 630; wy += 22)
        for (let wx = x + 8; wx < x + w - 10; wx += 16) {
          if (r() < 0.22) {
            ctx.fillStyle = r() < 0.5 ? "#ffd58a" : "#ffb070";
            ctx.fillRect(wx, wy, 7, 10);
            ctx.fillStyle = "#0a0d1c";
          }
        }
      x += w + 4;
    }
    return toTexture(canvas);
  });

const Shelf: React.FC = () => {
  const mat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({ map: woodTexture(), roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.28 });
    return m;
  }, []);
  const { width, depth, thick, front } = SHELF;
  return (
    <group>
      <mesh position={[0, -thick / 2, front - depth / 2]} material={mat} receiveShadow castShadow>
        <boxGeometry args={[width, thick, depth]} />
      </mesh>
      {/* brass edge rail */}
      <mesh position={[0, -0.02, front + 0.012]} material={gold()}>
        <boxGeometry args={[width, 0.03, 0.02]} />
      </mesh>
    </group>
  );
};

const Wall: React.FC<{ on: number }> = ({ on }) => {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: wallpaperTexture(), roughness: 0.92 }), []);
  const sky = useMemo(() => new THREE.MeshBasicMaterial({ map: nightSkyTexture(), toneMapped: false }), []);
  const frame = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e9e1d0", roughness: 0.6 }), []);
  // the window glass dims a little when the shop lights reflect in it
  sky.color.setScalar(1 - 0.35 * on);
  const W = { x: -1.55, y: 2.1, w: 1.25, h: 1.55 };
  const bars: [number, number, number, number][] = [
    [W.x, W.y + W.h / 2, W.w + 0.1, 0.06],
    [W.x, W.y - W.h / 2, W.w + 0.1, 0.06],
    [W.x - W.w / 2, W.y, 0.06, W.h],
    [W.x + W.w / 2, W.y, 0.06, W.h],
    [W.x, W.y, W.w, 0.035],
    [W.x, W.y, 0.035, W.h],
  ];
  return (
    <group position={[0, 0, SHELF.wallZ]}>
      <mesh position={[0, 2.4, 0]} material={mat} receiveShadow>
        <planeGeometry args={[12, 6]} />
      </mesh>
      <mesh position={[W.x, W.y, 0.005]} material={sky}>
        <planeGeometry args={[W.w, W.h]} />
      </mesh>
      {bars.map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.03]} material={frame} castShadow>
          <boxGeometry args={[w, h, 0.05]} />
        </mesh>
      ))}
    </group>
  );
};

/** A sagging string of warm bulbs across the wall. `pulse(i)` (0–1) lets the dance colour individual bulbs. */
const FairyLights: React.FC<{ glow: number; pulse?: (i: number) => { color: string; k: number } }> = ({ glow, pulse }) => {
  const N = 17;
  const pts = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => {
        const u = i / (N - 1);
        const x = -3 + u * 6;
        return new THREE.Vector3(x, 3.05 - Math.sin(u * Math.PI) * 0.38 - Math.sin(u * Math.PI * 3) * 0.06, SHELF.wallZ + 0.12);
      }),
    [],
  );
  const wire = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.006, 6), [pts]);
  return (
    <group>
      <mesh geometry={wire}>
        <meshStandardMaterial color="#1b1a16" roughness={0.6} />
      </mesh>
      {pts.map((p, i) => {
        const pl = pulse?.(i);
        const color = pl ? pl.color : "#FFC27A";
        const k = glow * (pl ? 0.6 + 0.9 * pl.k : 1);
        return (
          <group key={i} position={[p.x, p.y - 0.05, p.z]}>
            <mesh>
              <sphereGeometry args={[0.028, 12, 10]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
            <Glow color={color} size={0.42} opacity={0.55 * k} />
          </group>
        );
      })}
    </group>
  );
};

export const ShopSet: React.FC<{ on: number; fairy: number; pulse?: (i: number) => { color: string; k: number } }> = ({ on, fairy, pulse }) => (
  <group>
    <Shelf />
    <Wall on={on} />
    <FairyLights glow={fairy} pulse={pulse} />
    {/* moonlight falling through the window onto the wall and shelf */}
    <Glow position={[-1.0, 1.3, SHELF.wallZ + 0.4]} color="#9FB8FF" size={2.4} opacity={0.12 * (1 - on)} />
  </group>
);
