import React, { useMemo } from "react";
import * as THREE from "three";
import { cached, makeCanvas, toTexture } from "../components/canvasTextures";
import { heartGeometry, starGeometry } from "./figureGeometry";
import { gold, silver, translucent, vinyl } from "./materials";

/** Small sculpted props held by / attached to the figures. Sizes are in figure units (figure ≈ 1.1 tall). */

export const BlueStar: React.FC<{ glow?: number }> = ({ glow = 0.6 }) => (
  <group>
    <mesh geometry={starGeometry(1, 0.48, 0.3, 0.16)} material={translucent("#9CCBF5", "#5FA8F0", glow)} scale={0.062} castShadow />
    {glow > 0 ? <pointLight color="#9FD0FF" intensity={0.35 * glow} distance={0.9} decay={2} /> : null}
  </group>
);

export const GlowingRedStar: React.FC<{ glow?: number }> = ({ glow = 1 }) => (
  <group>
    <mesh geometry={starGeometry(1, 0.46, 0.34, 0.18)} material={translucent("#B3122E", "#FF2A44", 0.9 * glow + 0.2)} scale={0.07} castShadow />
    {/* inner core gives the translucent star a hot centre */}
    <mesh scale={0.026}>
      <sphereGeometry args={[1, 24, 16]} />
      <meshBasicMaterial color="#FF6B7A" toneMapped={false} />
    </mesh>
    <pointLight color="#FF2E48" intensity={1.6 * glow} distance={1.6} decay={2} />
  </group>
);

export const SilverStarPin: React.FC = () => <mesh geometry={starGeometry(1, 0.42, 0.18, 0.1)} material={silver()} scale={0.03} castShadow />;

export const PinkHeart: React.FC<{ scale?: number }> = ({ scale = 0.035 }) => (
  <mesh geometry={heartGeometry(0.28, 0.14)} material={vinyl("heart", "#F2BCC6", { roughness: 0.45, clearcoat: 0.5 })} scale={scale} castShadow />
);

const letterTexture = () =>
  cached("letter", () => {
    const { canvas, ctx } = makeCanvas(256, 160);
    ctx.fillStyle = "#F6F0E6";
    ctx.fillRect(0, 0, 256, 160);
    ctx.strokeStyle = "rgba(122,39,57,0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(128, 92);
    ctx.lineTo(256, 0);
    ctx.stroke();
    return toTexture(canvas);
  });

/** Tiny folded letter with a burgundy wax seal. */
export const FoldedLetter: React.FC = () => {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: letterTexture(), roughness: 0.85 }), []);
  return (
    <group>
      <mesh material={mat} castShadow>
        <boxGeometry args={[0.1, 0.065, 0.006]} />
      </mesh>
      <mesh position={[0, 0.002, 0.005]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.011, 0.011, 0.004, 24]} />
        <meshPhysicalMaterial color="#7A2739" roughness={0.35} clearcoat={0.8} />
      </mesh>
    </group>
  );
};

const kraftPaper = () =>
  cached("paper-star", () => {
    const { canvas, ctx } = makeCanvas(64, 64);
    ctx.fillStyle = "#EDE0C2";
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = "rgba(120,96,60,0.25)";
    for (let i = 0; i < 64; i += 6) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 8, 64);
      ctx.stroke();
    }
    return toTexture(canvas);
  });

export const PaperStar: React.FC<{ scale?: number }> = ({ scale = 0.03 }) => {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: kraftPaper(), roughness: 0.9, flatShading: true }), []);
  return <mesh geometry={starGeometry(1, 0.55, 0.55, 0.05)} material={mat} scale={scale} castShadow />;
};

/** Small cream vintage suitcase: rounded body, tan straps, brass corners, handle on top. */
export const Suitcase: React.FC = () => {
  const body = vinyl("suitcase", "#EDE2C8", { roughness: 0.55, clearcoat: 0.3 });
  const strap = vinyl("strap", "#9A6B43", { roughness: 0.6 });
  return (
    <group>
      <mesh material={body} castShadow receiveShadow>
        <boxGeometry args={[0.075, 0.16, 0.22, 2, 2, 2]} />
      </mesh>
      {[-0.06, 0.06].map((z) => (
        <mesh key={z} position={[0, 0, z]} material={strap} castShadow>
          <boxGeometry args={[0.079, 0.163, 0.016]} />
        </mesh>
      ))}
      {[-1, 1].flatMap((sy) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sy}${sz}`} position={[0, sy * 0.073, sz * 0.103]} material={gold()}>
            <sphereGeometry args={[0.012, 12, 8]} />
          </mesh>
        )),
      )}
      <mesh position={[0, 0.09, 0]} rotation={[0, Math.PI / 2, 0]} material={strap} castShadow>
        <torusGeometry args={[0.03, 0.007, 8, 20, Math.PI]} />
      </mesh>
      <group position={[-0.042, 0.03, 0.06]} rotation={[0, -Math.PI / 2, 0.3]}>
        <PaperStar scale={0.026} />
      </group>
    </group>
  );
};

export const GoldStar: React.FC<{ scale?: number }> = ({ scale = 0.012 }) => (
  <mesh geometry={starGeometry(1, 0.45, 0.25, 0.1)} material={gold()} scale={scale} castShadow />
);
