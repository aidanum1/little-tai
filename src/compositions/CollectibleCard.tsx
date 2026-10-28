import { ThreeCanvas } from "@remotion/three";
import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { Figure, FIGURE_HEIGHT } from "../characters/Figure";
import { EDITIONS, getEdition, PALETTE, type EditionId } from "../characters/figures";
import { AssetGate } from "../components/AssetGate";
import { starPath } from "../components/canvasTextures";
import { Particles } from "../components/Particles";
import { Pedestal } from "../components/SetPieces";
import { CameraRig, StudioLights } from "../components/Stage";
import { FONTS } from "../theme";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export const cardSchema = z.object({
  edition: z.enum(EDITIONS.map((e) => e.id) as [EditionId, ...EditionId[]]),
});

const W = 1200;
const H = 1680;
const ART_H = 1060;

const Env: React.FC = () => {
  const { gl, scene } = useThree();
  const env = useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const rt = pm.fromScene(new RoomEnvironment(), 0.04);
    pm.dispose();
    return rt;
  }, [gl]);
  useLayoutEffect(() => {
    scene.environment = env.texture;
    scene.environmentIntensity = 0.45;
  }, [scene, env]);
  return null;
};

const StarIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => {
  const ref = React.useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    ctx.clearRect(0, 0, size, size);
    starPath(ctx, size / 2, size / 2, size / 2, size * 0.2);
    ctx.fillStyle = color;
    ctx.fill();
  }, [size, color]);
  return <canvas ref={ref} width={size} height={size} style={{ width: size, height: size }} />;
};

/**
 * Collectible character card (5:7, 1200×1680). The figure is a live 3D render — the same asset as the film.
 */
export const CollectibleCard: React.FC<z.infer<typeof cardSchema>> = ({ edition: id }) => {
  const e = getEdition(id);
  const secret = e.secret;
  const ink = secret ? "#F1DDA9" : "#1C2233";
  const bg = secret
    ? "radial-gradient(ellipse at 50% 30%, #3a0b16 0%, #0d0b10 60%, #050407 100%)"
    : `radial-gradient(ellipse at 50% 28%, #ffffff 0%, ${e.box.base} 55%, ${e.box.base} 100%)`;
  const frame = secret ? `linear-gradient(135deg, #9C7B3E, #F3E2B0 30%, #B8954F 55%, #F3E2B0 80%, #A8853F)` : `linear-gradient(135deg, ${PALETTE.cream}, #ffffff 40%, ${PALETTE.cream})`;
  return (
    <AssetGate>
      <AbsoluteFill style={{ background: "#0b0c10", padding: 0 }}>
        <AbsoluteFill style={{ background: frame, borderRadius: 54, margin: 24 }} />
        <AbsoluteFill style={{ background: bg, borderRadius: 40, margin: 46, overflow: "hidden", boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.12)" }}>
          {/* art window */}
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: ART_H }}>
            <ThreeCanvas width={W - 92} height={ART_H} shadows={{ type: THREE.PCFShadowMap }} dpr={1} gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }} style={{ position: "absolute", inset: 0 }}>
              <Env />
              <CameraRig position={[0.25, 1.05, 3.55]} target={[0, 0.78, 0]} fov={30} />
              <StudioLights rimA={e.palette.glow} rimB="#FFE3C9" shadowFocus={[0, 0.7, 0]} />
              <Pedestal height={0.12} radius={0.5} color={secret ? "#0E0E13" : "#F6F1E7"} band={e.id === "rebel" ? "silver" : "gold"} />
              <group position={[0, 0.17, 0]} rotation={[0, -0.18, 0]}>
                <Figure edition={e} t={0.6} glow={1} />
              </group>
              <Particles
                count={28}
                seed={e.index + 3}
                t={0.6}
                colors={secret ? ["#F1DDA9", "#FF5A6E"] : ["#ffffff", e.palette.glow]}
                scale={240}
                cross={1}
                fn={(i, r) => ({ x: (r[0] - 0.5) * 2.6, y: 0.2 + r[1] * FIGURE_HEIGHT * 1.6, z: (r[2] - 0.9) * 1.4, size: 0.5 + r[3] * 1.1, alpha: 0.7 })}
              />
            </ThreeCanvas>
          </div>
          {/* header */}
          <div style={{ position: "absolute", top: 46, left: 56, right: 56, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontFamily: FONTS.display, fontStyle: "italic", fontWeight: 600, fontSize: 54, color: ink }}>little TAI</div>
            <div style={{ fontFamily: FONTS.sans, fontSize: 30, letterSpacing: "0.2em", color: ink, opacity: 0.85 }}>{secret ? "???" : `${e.number} / 04`}</div>
          </div>
          {/* footer panel */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: H - 92 - ART_H + 40,
              background: secret ? "linear-gradient(180deg, rgba(12,10,14,0.2), rgba(12,10,14,0.95) 30%)" : "linear-gradient(180deg, rgba(255,255,255,0), rgba(250,247,240,0.96) 30%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
              padding: "0 70px 60px",
            }}
          >
            <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
              {Array.from({ length: secret ? 5 : 3 }, (_, i) => (
                <StarIcon key={i} size={30} color={secret ? "#D8B872" : e.box.base} />
              ))}
            </div>
            <div style={{ fontFamily: FONTS.serif, fontWeight: 600, fontSize: e.name.length > 14 ? 84 : 96, letterSpacing: "0.05em", color: ink, lineHeight: 1, textAlign: "center" }}>{e.name}</div>
            <div style={{ height: 2, width: 360, margin: "26px 0", background: `linear-gradient(90deg, transparent, ${secret ? "#C4A66D" : ink}, transparent)` }} />
            <div style={{ fontFamily: FONTS.serif, fontStyle: "italic", fontWeight: 500, fontSize: 44, color: ink, opacity: 0.9 }}>{e.mood.join(" · ")}</div>
            <div style={{ fontFamily: FONTS.serif, fontSize: 38, color: ink, opacity: 0.8, marginTop: 22, textAlign: "center", lineHeight: 1.3 }}>“{e.feeling}”</div>
            <div style={{ marginTop: 34, display: "flex", justifyContent: "space-between", width: "100%", fontFamily: FONTS.sans, fontSize: 22, letterSpacing: "0.22em", color: ink, opacity: 0.7 }}>
              <span>THE FEELINGS COLLECTION</span>
              <span>{e.rarity}</span>
            </div>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </AssetGate>
  );
};
