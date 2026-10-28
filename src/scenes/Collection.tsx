import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { fitDistance } from "../animations/camera";
import { EASE, lerp, progress } from "../animations/timing";
import { Figure, FIGURE_HEIGHT } from "../characters/Figure";
import { PALETTE, STANDARD_EDITIONS } from "../characters/figures";
import { Caption, FilmGrade } from "../components/Overlay";
import { Particles } from "../components/Particles";
import { Floor, Pedestal } from "../components/SetPieces";
import { Sfx } from "../components/Sfx";
import { CameraRig, Stage, StudioLights } from "../components/Stage";

/**
 * 0:20–0:25 "COLLECT THEM ALL" — the four standard figures on their own pedestals,
 * a slow lateral camera move across the lineup that settles into a balanced group shot.
 */

const PED_COLORS = ["#C9DDF2", "#EBCBD1", "#3A1C25", "#C7CDB7"];

export const lineupLayout = (portrait: boolean) =>
  portrait
    ? [
        { x: -0.98, z: -0.75, h: 0.62 },
        { x: -0.36, z: 0.25, h: 0.3 },
        { x: 0.36, z: 0.25, h: 0.3 },
        { x: 0.98, z: -0.75, h: 0.62 },
      ]
    : [
        { x: -1.95, z: -0.35, h: 0.42 },
        { x: -0.66, z: 0.15, h: 0.34 },
        { x: 0.66, z: 0.15, h: 0.34 },
        { x: 1.95, z: -0.35, h: 0.42 },
      ];

export const Collection: React.FC<{ durationInFrames: number }> = ({ durationInFrames: d }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const p = frame / d;
  const portrait = height > width;
  const layout = lineupLayout(portrait);
  const fov = 30;
  const spanW = portrait ? 2.9 : 5.0;
  const wide = fitDistance(spanW, FIGURE_HEIGHT + 0.9, fov, width / height, 0.9);

  // track across, then settle into the group shot
  const travel = EASE.inOut(p);
  const settle = progress(frame, d * 0.55, d, EASE.inOut);
  const camX = lerp(portrait ? -1.0 : -1.4, 0, travel);
  const dist = lerp(wide * 0.62, wide * 0.9, settle);
  const camY = lerp(1.0, 1.35, settle);
  const target: [number, number, number] = [lerp(camX * 0.6, 0, settle), lerp(0.85, 1.0, settle), 0];

  return (
    <Stage
      backdrop="radial-gradient(ellipse 100% 70% at 50% 40%, #2b3346 0%, #141823 55%, #07080c 100%)"
      exposure={1.02}
      envIntensity={0.6}
      overlay={
        <>
          <Caption text="FOUR LITTLE FEELINGS." start={Math.round(d * 0.12)} end={Math.round(d * 0.52)} y={portrait ? 0.1 : 0.1} size={72} italic={false} tracking="0.14em" color={PALETTE.cream} />
          <Caption text="ONE LITTLE WORLD." start={Math.round(d * 0.56)} end={d + 10} y={portrait ? 0.1 : 0.1} size={72} italic={false} tracking="0.14em" color={PALETTE.gold} />
          <FilmGrade vignette={0.55} grain={0.05} />
          <Sfx name="whoosh-soft" at={0} volume={0.28} />
          <Sfx name="star-twinkle" at={d * 0.56} volume={0.3} />
        </>
      }
    >
      <CameraRig position={[camX, camY, dist]} target={target} fov={fov} />
      <StudioLights rimA="#BFD8FF" rimB="#FFD9C2" shadowFocus={[0, 0.8, 0]} />
      <Floor color="#1a1e2a" />
      {STANDARD_EDITIONS.map((e, i) => {
        const L = layout[i];
        const yaw = Math.sin(t * 0.7 + i * 1.3) * 0.32 - L.x * 0.12;
        return (
          <group key={e.id} position={[L.x, 0, L.z]}>
            <Pedestal height={L.h} radius={0.36} color={PED_COLORS[i]} band={e.id === "rebel" ? "silver" : "gold"} />
            <group position={[0, L.h + 0.05, 0]} rotation={[0, yaw, 0]}>
              <Figure edition={e} t={t} glow={1} />
            </group>
          </group>
        );
      })}
      <Particles
        count={80}
        seed={66}
        t={t}
        colors={["#ECE6D9", "#C4A66D", "#8FBCE7"]}
        scale={height * 0.04}
        fn={(i, r, tt) => ({
          x: (r[0] - 0.5) * 7,
          y: 0.3 + r[1] * 3.6 + Math.sin(tt * 0.4 + r[2] * 6) * 0.12,
          z: (r[3] - 0.65) * 4,
          size: 0.5 + r[4] * 1.2,
          alpha: 0.6,
        })}
      />
    </Stage>
  );
};
