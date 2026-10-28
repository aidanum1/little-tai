import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { fitDistance, orbit } from "../animations/camera";
import { clamp01, EASE, lerp, progress } from "../animations/timing";
import { getEdition } from "../characters/figures";
import { Caption, FilmGrade } from "../components/Overlay";
import { Glow, Particles } from "../components/Particles";
import { Floor, Platform } from "../components/SetPieces";
import { Sfx } from "../components/Sfx";
import { CameraRig, Stage, StudioLights } from "../components/Stage";
import { BlindBox } from "../packaging/BlindBox";
import { BOX } from "../packaging/boxTextures";

/**
 * 0:00–0:04 "THE COLLECTION AWAKENS" — a single star appears in total darkness, drifts down and,
 * with its own light, slowly reveals a closed blind box while the camera creeps in.
 */
export const Awakens: React.FC<{ durationInFrames: number }> = ({ durationInFrames: d }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const p = frame / d;
  const edition = getEdition("dreamer");

  const appear = progress(frame, 6, 34, EASE.out);
  const drift = progress(frame, 10, d, EASE.soft);
  const starPos: [number, number, number] = [lerp(0.55, 0.18, drift), lerp(2.75, BOX.h + 0.55, drift), lerp(1.1, 0.75, drift)];
  const starLight = 3.2 * appear * (0.92 + 0.08 * Math.sin(t * 9));
  const ambient = progress(frame, d * 0.35, d, EASE.inOut);

  const target: [number, number, number] = [0, BOX.h * 0.62, 0];
  const far = fitDistance(1.5, BOX.h + 1.4, 30, width / height, 0.7);
  const radius = lerp(far * 1.35, far * 0.92, EASE.soft(p));
  const cam = orbit(target, radius, lerp(-0.18, 0.06, p), lerp(0.55, 0.3, p));

  return (
    <Stage
      backdrop="#030407"
      exposure={1.05}
      envIntensity={0.08 + 0.25 * ambient}
      overlay={
        <>
          <Caption text="Some feelings are too small for words." start={Math.round(d * 0.3)} end={d + 6} y={0.73} size={66} />
          <FilmGrade vignette={0.75} grain={0.06} />
          <Sfx name="star-twinkle" at={6} volume={0.7} />
          <Sfx name="star-twinkle" at={d * 0.58} volume={0.3} />
        </>
      }
    >
      <CameraRig position={cam} target={target} fov={30} />
      <StudioLights keyLight={0.25 * ambient} fill={0.08 * ambient} rim={0.6 * ambient} rimA="#9CC4F0" rimB="#2a3550" shadowFocus={[0, 0.8, 0]} />
      <Floor color="#0d111b" opacity={0.25 + 0.75 * ambient} />
      <group position={[0, -0.0, 0]}>
        <Platform color="#1E2638" radius={1.05} />
      </group>
      <group position={[0, 0.14, 0]} rotation={[0, lerp(-0.35, -0.12, p), 0]}>
        <BlindBox edition={edition} open={0} />
      </group>

      {/* the star */}
      <group position={starPos}>
        <pointLight color="#DCEBFF" intensity={starLight} distance={4.5} decay={1.6} castShadow={false} />
        <Glow color="#CFE6FF" size={0.9 * appear} opacity={0.9 * appear} />
        <Glow color="#FFFFFF" size={0.42 * appear} opacity={appear} flare />
        <Glow color="#9CC4F0" size={2.6 * appear} opacity={0.22 * appear} />
      </group>
      {/* motes caught in the star's light */}
      <Particles
        count={70}
        seed={5}
        t={t}
        colors={["#DCEBFF", "#ffffff"]}
        scale={height * 0.025}
        cross={0}
        twinkle={0.9}
        fn={(i, r, tt) => {
          const x = starPos[0] + (r[0] - 0.5) * 2.2;
          const y = starPos[1] + (r[1] - 0.5) * 1.8 + Math.sin(tt * 0.4 + r[2] * 6) * 0.1;
          const z = starPos[2] + (r[3] - 0.5) * 1.6;
          const dist = Math.hypot(x - starPos[0], y - starPos[1], z - starPos[2]);
          return { x, y, z, size: 0.6 + r[4], alpha: appear * clamp01(1.2 - dist) };
        }}
      />
    </Stage>
  );
};
