import React, { useMemo } from "react";
import * as THREE from "three";
import { rng } from "../animations/timing";
import { cached, makeCanvas, starPath, toTexture } from "../components/canvasTextures";
import { GoldStar, PinkHeart } from "./Accessories";
import { starGeometry } from "./figureGeometry";
import type { Edition } from "./figures";
import { gold, silver, vinyl } from "./materials";

/** Display bases. Top surface at y = 0 so the figure's feet sit exactly on it. */

export const BASE_RADIUS = 0.3;
const H = 0.05;

const RoundBase: React.FC<{ color: string; rim?: THREE.Material; radius?: number; height?: number }> = ({ color, rim, radius = BASE_RADIUS, height = H }) => {
  const profile = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0, -height),
          new THREE.Vector2(radius - 0.004, -height),
          new THREE.Vector2(radius, -height + 0.006),
          new THREE.Vector2(radius, -0.008),
          new THREE.Vector2(radius - 0.008, 0),
          new THREE.Vector2(0, 0),
        ],
        96,
      ),
    [radius, height],
  );
  return (
    <group>
      <mesh geometry={profile} material={vinyl(`base-${color}`, color, { roughness: 0.5, clearcoat: 0.35 })} castShadow receiveShadow />
      {rim ? (
        <mesh position={[0, -height * 0.5, 0]} rotation={[Math.PI / 2, 0, 0]} material={rim}>
          <torusGeometry args={[radius + 0.002, 0.004, 8, 96]} />
        </mesh>
      ) : null}
    </group>
  );
};

const DreamerBase: React.FC = () => {
  const stars = useMemo(() => {
    const r = rng(4);
    return Array.from({ length: 11 }, (_, i) => {
      const a = (i / 11) * Math.PI * 2 + 0.2;
      const rad = BASE_RADIUS - 0.045 - r() * 0.03;
      return { x: Math.sin(a) * rad, z: Math.cos(a) * rad, s: 0.016 + r() * 0.014, rot: r() * 6, tilt: (r() - 0.5) * 0.6, c: i % 3 };
    });
  }, []);
  const mats = [vinyl("dstar-a", "#8FBCE7", { roughness: 0.4 }), vinyl("dstar-b", "#ECE6D9", { roughness: 0.4 }), vinyl("dstar-c", "#26355A", { roughness: 0.4 })];
  return (
    <group>
      <RoundBase color="#E9EEF5" rim={vinyl("rim-blue", "#8FBCE7")} />
      {stars.map((s, i) => (
        <mesh key={i} geometry={starGeometry(1, 0.48, 0.5, 0.2)} material={mats[s.c]} position={[s.x, s.s * 0.4, s.z]} rotation={[-Math.PI / 2 + s.tilt, 0, s.rot]} scale={s.s} castShadow />
      ))}
    </group>
  );
};

const ShyBase: React.FC = () => (
  <group>
    <RoundBase color="#F4ECE6" rim={vinyl("rim-pink", "#D9A5AE")} />
    <group position={[0.17, 0.026, 0.14]} rotation={[-1.2, 0, 0.4]}>
      <PinkHeart scale={0.04} />
    </group>
    <group position={[-0.2, 0.016, 0.09]} rotation={[-1.35, 0, -0.5]}>
      <PinkHeart scale={0.024} />
    </group>
  </group>
);

const RebelBase: React.FC = () => (
  <group>
    <RoundBase color="#1A1B20" rim={silver()} />
    <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[BASE_RADIUS - 0.05, BASE_RADIUS - 0.042, 96]} />
      <meshStandardMaterial color="#7A2739" roughness={0.5} />
    </mesh>
    <mesh geometry={starGeometry(1, 0.42, 0.3, 0.12)} material={silver()} position={[-0.19, 0.012, 0.15]} rotation={[-Math.PI / 2, 0, 0.4]} scale={0.03} castShadow />
  </group>
);

/** Miniature cobblestone plinth: rounded stones packed in a circle on a stone base. */
const CobbleBase: React.FC = () => {
  const stones = useMemo(() => {
    const r = rng(77);
    const out: { x: number; z: number; sx: number; sz: number; rot: number; shade: number; h: number }[] = [];
    const step = 0.052;
    for (let x = -BASE_RADIUS; x <= BASE_RADIUS; x += step) {
      for (let z = -BASE_RADIUS; z <= BASE_RADIUS; z += step * 0.86) {
        const jx = x + (Math.round(z / (step * 0.86)) % 2 ? step / 2 : 0) + (r() - 0.5) * 0.008;
        const jz = z + (r() - 0.5) * 0.008;
        if (Math.hypot(jx, jz) > BASE_RADIUS - 0.03) continue;
        out.push({ x: jx, z: jz, sx: step * (0.42 + r() * 0.08), sz: step * (0.36 + r() * 0.08), rot: r() * Math.PI, shade: r(), h: 0.012 + r() * 0.006 });
      }
    }
    return out;
  }, []);
  const mats = ["#A79F93", "#8F887D", "#B9B0A2", "#7E786F"].map((c) => vinyl(`cobble-${c}`, c, { roughness: 0.85, clearcoat: 0 }));
  return (
    <group>
      <RoundBase color="#6F695F" height={0.045} radius={BASE_RADIUS + 0.01} rim={vinyl("rim-forest", "#526047")} />
      {stones.map((s, i) => (
        <mesh key={i} position={[s.x, -0.004, s.z]} rotation={[0, s.rot, 0]} scale={[s.sx, s.h, s.sz]} material={mats[Math.floor(s.shade * mats.length)]} castShadow receiveShadow>
          <sphereGeometry args={[1, 14, 8]} />
        </mesh>
      ))}
    </group>
  );
};

const celestialTexture = () =>
  cached("celestial-top", () => {
    const S = 1024;
    const { canvas, ctx } = makeCanvas(S, S);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, S, S);
    const r = rng(9);
    ctx.translate(S / 2, S / 2);
    ctx.strokeStyle = "#fff";
    for (const rad of [470, 430, 300]) {
      ctx.lineWidth = rad === 430 ? 2 : 5;
      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
    // zodiac-like tick ring
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const l = i % 6 === 0 ? 26 : 10;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 432, Math.sin(a) * 432);
      ctx.lineTo(Math.cos(a) * (432 + l), Math.sin(a) * (432 + l));
      ctx.stroke();
    }
    // constellations
    ctx.lineWidth = 1.5;
    for (let c = 0; c < 6; c++) {
      const a0 = (c / 6) * Math.PI * 2 + 0.3;
      const pts = Array.from({ length: 4 }, () => [Math.cos(a0 + (r() - 0.5) * 0.5) * (330 + r() * 80), Math.sin(a0 + (r() - 0.5) * 0.5) * (330 + r() * 80)]);
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.fillStyle = "#fff";
      for (const [x, y] of pts) {
        starPath(ctx, x, y, 9, 4);
        ctx.fill();
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return toTexture(canvas, false);
  });

/**
 * The secret edition's black celestial platform: two glossy tiers, engraved gold star chart,
 * gold rim rings and a tilted orrery ring with orbiting gold stars (orbit driven by `t`).
 */
const CelestialBase: React.FC<{ t: number }> = ({ t }) => {
  const top = useMemo(() => {
    const tex = celestialTexture();
    return new THREE.MeshPhysicalMaterial({
      color: "#0B0B10",
      roughness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      metalness: 0.2,
      emissive: new THREE.Color("#C4A66D"),
      emissiveMap: tex,
      emissiveIntensity: 0.55,
      metalnessMap: tex,
    });
  }, []);
  const black = vinyl("onyx", "#0C0C11", { roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 });
  return (
    <group>
      <mesh position={[0, -0.05, 0]} material={black} castShadow receiveShadow>
        <cylinderGeometry args={[BASE_RADIUS + 0.06, BASE_RADIUS + 0.075, 0.04, 96]} />
      </mesh>
      <mesh position={[0, -0.016, 0]} material={black} castShadow receiveShadow>
        <cylinderGeometry args={[BASE_RADIUS + 0.01, BASE_RADIUS + 0.02, 0.032, 96]} />
      </mesh>
      <mesh position={[0, 0.0005, 0]} rotation={[-Math.PI / 2, 0, 0]} material={top} receiveShadow>
        <circleGeometry args={[BASE_RADIUS + 0.008, 96]} />
      </mesh>
      {[
        [BASE_RADIUS + 0.077, -0.07],
        [BASE_RADIUS + 0.062, -0.031],
        [BASE_RADIUS + 0.022, -0.032],
        [BASE_RADIUS + 0.012, 0.0],
      ].map(([rad, y], i) => (
        <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={gold()}>
          <torusGeometry args={[rad, 0.0045, 10, 128]} />
        </mesh>
      ))}
      {/* orrery ring */}
      <group rotation={[0.32, t * 0.25, 0.18]} position={[0, 0.46, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={gold()}>
          <torusGeometry args={[0.43, 0.0035, 8, 160]} />
        </mesh>
        {Array.from({ length: 7 }, (_, i) => {
          const a = (i / 7) * Math.PI * 2 + t * 0.6;
          return (
            <group key={i} position={[Math.cos(a) * 0.43, 0, Math.sin(a) * 0.43]} rotation={[0, -a, t * 1.5 + i]}>
              <GoldStar scale={i % 2 ? 0.014 : 0.02} />
            </group>
          );
        })}
      </group>
    </group>
  );
};

export const FigureBase: React.FC<{ edition: Edition; t?: number }> = ({ edition, t = 0 }) => {
  switch (edition.id) {
    case "dreamer":
      return <DreamerBase />;
    case "shy":
      return <ShyBase />;
    case "rebel":
      return <RebelBase />;
    case "wanderer":
      return <CobbleBase />;
    case "midnight":
      return <CelestialBase t={t} />;
  }
};
