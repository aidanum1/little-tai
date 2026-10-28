import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { fitDistance, mix3, orbit } from "../animations/camera";
import { clamp01, EASE, lerp, progress, smoothstep } from "../animations/timing";
import { Figure, FIGURE_HEIGHT } from "../characters/Figure";
import { PALETTE, SECRET_EDITION } from "../characters/figures";
import { EditionTitle, FilmGrade } from "../components/Overlay";
import { Glow, Particles } from "../components/Particles";
import { Floor, Platform, SpotCone } from "../components/SetPieces";
import { Sfx } from "../components/Sfx";
import { CameraRig, Stage, StudioLights } from "../components/Stage";
import { BlindBox, INTERIOR_FLOOR } from "../packaging/BlindBox";
import { BOX } from "../packaging/boxTextures";

type V3 = [number, number, number];

/**
 * 0:25–0:32 "SECRET EDITION UNLOCKED" — the climax. Darkness, gold motes, a black-and-gold box descends
 * into a single spotlight, the rigid lid lifts away slowly, the Midnight Star rises in deep-red light.
 */
export const SecretReveal: React.FC<{ durationInFrames: number; clip?: boolean }> = ({ durationInFrames: d, clip = false }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const p = frame / d;
  const e = SECRET_EDITION;

  const descend = progress(frame, d * 0.05, d * 0.36, EASE.cine);
  const PLATFORM_H = 0.14;
  const boxY = PLATFORM_H + lerp(4.6, 0.3, descend) + Math.sin(t * 1.3) * 0.02 * descend;
  const spot = progress(frame, d * 0.14, d * 0.34, EASE.inOut);
  const open = progress(frame, d * 0.42, d * 0.7, EASE.soft);
  const rise = progress(frame, d * 0.56, d * 0.84, EASE.cine);
  const red = progress(frame, d * 0.6, d * 0.9, EASE.inOut);
  const figureY = lerp(INTERIOR_FLOOR + 0.08, BOX.h + 0.22, rise);
  const boxYaw = lerp(0.5, -0.12, EASE.inOut(p));

  const aspect = width / height;
  const boxTarget: V3 = [0, boxY + BOX.h * 0.5, 0];
  const figTarget: V3 = [0, boxY + BOX.h + 0.22 + FIGURE_HEIGHT * 0.55, 0];
  const follow = smoothstep(0.5, 0.92, p);
  let target: V3 = mix3(boxTarget, figTarget, follow);
  const near = fitDistance(1.2, FIGURE_HEIGHT + 0.5, 30, aspect, 0.9);
  const mid = fitDistance(1.6, BOX.h + 0.8, 30, aspect, 0.9);
  const radius = lerp(mid * 1.15, near * 1.12, follow);
  const camAngle = lerp(-0.35, 0.22, EASE.inOut(p));
  if (aspect > 1) {
    // 16:9: product right of centre, titles lower left
    const shift = radius * Math.tan(Math.PI / 12) * aspect * 0.32;
    target = [target[0] - Math.cos(camAngle) * shift, target[1], target[2] + Math.sin(camAngle) * shift];
  }
  const camPos = orbit(target, radius, camAngle, lerp(-0.55, 0.05, EASE.inOut(p)));

  const titleOut = Math.round(d * 0.5);
  return (
    <Stage
      backdrop="radial-gradient(ellipse 80% 60% at 50% 42%, #140a0e 0%, #050406 60%, #000 100%)"
      exposure={1.0}
      envIntensity={0.12 + 0.35 * spot}
      envWarmth="#ffcf9a"
      overlay={
        <>
          <EditionTitle number="???" name="SECRET EDITION" start={Math.round(d * 0.2)} end={titleOut} color={PALETTE.cream} accent={PALETTE.gold} />
          <EditionTitle number="SECRET" name="THE MIDNIGHT STAR" mood={e.mood} start={Math.round(d * 0.6)} end={clip ? d - 2 : d + 8} color="#F1DDA9" accent="#FF5A6E" />
          <FilmGrade vignette={0.8} grain={0.07} tint="#5a0a18" tintOpacity={0.35 * red} />
          <Sfx name="whoosh-down" at={d * 0.05} volume={0.55} />
          <Sfx name="spotlight-on" at={d * 0.14} volume={0.6} />
          <Sfx name="box-land" at={d * 0.33} volume={0.5} />
          <Sfx name="lid-lift-luxe" at={d * 0.42} volume={0.6} />
          <Sfx name="rise-shimmer-dark" at={d * 0.56} volume={0.5} />
          {/* the ignition hit lands ~1.2 s into the file, as the red light peaks */}
          <Sfx name="star-ignite" at={d * 0.72 - 1.2 * 30} volume={0.5} />
        </>
      }
    >
      <CameraRig position={camPos} target={target} fov={30} />
      <StudioLights keyLight={0.35 * spot} fill={0.06} rim={0.9 * spot + 0.6 * red} rimA="#F1DDA9" rimB="#FF3B4E" keyColor="#ffe6c4" shadowFocus={[0, 1.4, 0]} />
      {/* the spotlight */}
      <spotLight position={[0, 6.5, 0.6]} angle={0.28} penumbra={0.65} intensity={60 * spot} color="#FFE7C2" distance={14} decay={1.5} castShadow shadow-mapSize={[1024, 1024]} />
      <SpotCone position={[0, 6.4, 0.3]} length={6.3} radius={1.75} color="#FFE2B0" opacity={spot * (1 - 0.4 * red)} />
      <Floor color="#0b0a0d" />
      <Platform color="#0E0E13" radius={1.05} trim="gold" />

      <group position={[0, boxY, 0]} rotation={[0, boxYaw, 0]}>
        <BlindBox edition={e} open={open} />
        <group position={[0, figureY, 0]}>
          <Figure edition={e} t={t} glow={red} />
        </group>
        <pointLight position={[0, BOX.h + 0.2, 0.2]} color="#FF2E48" intensity={4 * red + 1.4 * open * (1 - rise)} distance={3.2} decay={1.8} />
        <Glow position={[0, BOX.h + 0.05, 0]} color="#FF3B4E" size={2.0} opacity={0.45 * open * (1 - rise * 0.5)} />
        <Glow position={[0, figureY + 0.52, 0.28]} color="#FF2E48" size={1.3 * red} opacity={0.8 * red} />
      </group>

      {/* gold motes: ambient, then a slow vortex that tightens around the box */}
      <Particles
        count={260}
        seed={404}
        t={t}
        colors={["#F1DDA9", "#C4A66D", "#FFF3D6"]}
        scale={height * 0.045}
        cross={0.8}
        fn={(i, r, tt) => {
          const appear = clamp01((tt - r[0] * 1.2) * 1.5);
          const a = r[1] * Math.PI * 2 + tt * (0.25 + r[2] * 0.35);
          const rad = lerp(1.2 + r[3] * 3.2, 0.9 + r[3] * 1.2, smoothstep(0.3, 0.8, p));
          return {
            x: Math.cos(a) * rad,
            y: 0.2 + r[4] * 4.2 + Math.sin(tt * 0.6 + r[5] * 6) * 0.15,
            z: Math.sin(a) * rad,
            size: 0.4 + r[5] * 1.4,
            alpha: appear * (0.55 + 0.45 * r[6]),
          };
        }}
      />
      {/* sparks lifting off the star once it ignites */}
      <Particles
        count={90}
        seed={911}
        t={t}
        colors={["#FF5A6E", "#FFB3BC", "#F1DDA9"]}
        scale={height * 0.04}
        fn={(i, r, tt) => {
          const t0 = (d * 0.62) / fps + r[0] * 2.2;
          const age = tt - t0;
          if (age < 0) return { x: 0, y: -10, z: 0, size: 0, alpha: 0 };
          const a = r[1] * Math.PI * 2 + age;
          return {
            x: Math.cos(a) * (0.12 + age * 0.25),
            y: boxY + figureY + 0.52 + age * (0.35 + r[2] * 0.3),
            z: 0.28 + Math.sin(a) * (0.12 + age * 0.25),
            size: 0.5 + r[3],
            alpha: clamp01(1 - age / 1.8) * red,
          };
        }}
      />
      {/* faint light rays behind the figure */}
      <Glow position={[0, boxY + BOX.h + 0.9, -0.6]} color="#C4A66D" size={interpolate(red, [0, 1], [0, 4.5])} opacity={0.25 * red} />
    </Stage>
  );
};
