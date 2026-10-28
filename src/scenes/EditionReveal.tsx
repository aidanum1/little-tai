import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { fitDistance, mix3, orbit } from "../animations/camera";
import { clamp01, EASE, lerp, progress, smoothstep } from "../animations/timing";
import { Figure, FIGURE_HEIGHT } from "../characters/Figure";
import type { Edition } from "../characters/figures";
import { EditionTitle, FilmGrade } from "../components/Overlay";
import { Glow, Particles } from "../components/Particles";
import { Floor, PaperCloud, PaperHeart, PaperHills, Platform, StarBurst } from "../components/SetPieces";
import { Sfx } from "../components/Sfx";
import { CameraRig, Stage, StudioLights } from "../components/Stage";
import { BlindBox, INTERIOR_FLOOR } from "../packaging/BlindBox";
import { BOX } from "../packaging/boxTextures";

/**
 * The unboxing reveal used for editions 01–04 (and their standalone 6–8 s product clips).
 * Timeline is normalised to the scene length so the same choreography works at 4 s and 7 s.
 */

type V3 = [number, number, number];

const LOOK: Record<string, { backdrop: string; floor: string; rimA: string; rimB: string; platform: string; trim: "gold" | "silver"; particles: string[] }> = {
  dreamer: {
    backdrop: "radial-gradient(ellipse 90% 70% at 50% 38%, #34557e 0%, #16223a 48%, #070a12 100%)",
    floor: "#1d2a44",
    rimA: "#A9D2FF",
    rimB: "#FFE3C9",
    platform: "#E8EEF6",
    trim: "gold",
    particles: ["#BFE0FF", "#ECE6D9", "#8FBCE7", "#FFFFFF"],
  },
  shy: {
    backdrop: "radial-gradient(ellipse 90% 70% at 50% 38%, #7a4152 0%, #2d1520 50%, #0d0709 100%)",
    floor: "#3a1f29",
    rimA: "#FFC7D2",
    rimB: "#FFE9DE",
    platform: "#F4E9E4",
    trim: "gold",
    particles: ["#FFD3DB", "#F2BCC6", "#FBF4EC"],
  },
  rebel: {
    backdrop: "radial-gradient(ellipse 85% 65% at 50% 36%, #5a1426 0%, #240a12 50%, #070405 100%)",
    floor: "#22121a",
    rimA: "#E9EEF8",
    rimB: "#C0485F",
    platform: "#1E1F25",
    trim: "silver",
    particles: ["#E9EEF8", "#FFFFFF", "#C9CDD6"],
  },
  wanderer: {
    backdrop: "radial-gradient(ellipse 95% 75% at 50% 32%, #4d5f4a 0%, #1f2a22 52%, #0a0e0b 100%)",
    floor: "#26301f",
    rimA: "#F6E7C4",
    rimB: "#B9D0A8",
    platform: "#E6DCC6",
    trim: "gold",
    particles: ["#F6E7C4", "#FFFFFF", "#E9D9B4"],
  },
};

export const revealLook = (id: string) => LOOK[id];

export const EditionReveal: React.FC<{ edition: Edition; durationInFrames: number; clip?: boolean }> = ({ edition, durationInFrames: d, clip = false }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const aspect = width / height;
  const p = frame / d;
  const t = frame / fps;
  const look = LOOK[edition.id];
  const id = edition.id;

  // --- choreography -----------------------------------------------------------------------
  const PLATFORM_H = 0.14;
  const hover = 0.34 + Math.sin(t * 1.5) * 0.035;
  let boxX = 0;
  let boxYaw = lerp(-0.42, 0.22, EASE.inOut(p));
  let boxDrop = 0;
  if (id === "dreamer") boxDrop = (1 - progress(frame, 0, d * 0.22, EASE.out)) * 0.9;
  if (id === "rebel") {
    const spin = progress(frame, 0, d * 0.24, EASE.out);
    boxX = (1 - spin) * 2.6;
    boxYaw = -Math.PI * 4 * (1 - spin) + lerp(-0.3, 0.15, EASE.inOut(p));
  }
  if (id === "wanderer") boxYaw = lerp(-0.2, 0.1, EASE.inOut(p));

  const boxY = PLATFORM_H + hover + boxDrop;
  const openStart = id === "rebel" ? 0.26 : 0.2;
  const open = progress(frame, d * openStart, d * (openStart + (id === "rebel" ? 0.24 : 0.34)), EASE.inOut);
  const rise = progress(frame, d * 0.38, d * 0.7, EASE.cine);
  const figureFloor = INTERIOR_FLOOR + 0.06;
  const figureTop = BOX.h + 0.2;
  const figureY = lerp(figureFloor, figureTop, rise) + (rise > 0.99 ? Math.sin((t - (d * 0.7) / fps) * 1.8) * 0.02 : 0);
  // after emerging, the figure turns a touch toward camera
  const figureYaw = lerp(0, -boxYaw * 0.6, smoothstep(0.62, 0.95, p));

  // --- camera -----------------------------------------------------------------------------
  const boxCentre: V3 = [boxX, boxY + BOX.h * 0.5, 0];
  const figureHead: V3 = [boxX, boxY + figureTop + FIGURE_HEIGHT * 0.78, 0];
  const figureMid: V3 = [boxX, boxY + figureTop + FIGURE_HEIGHT * 0.45, 0];
  const fov = 30;
  const wideD = fitDistance(1.8, BOX.h + FIGURE_HEIGHT + 0.6, fov, aspect, 0.92);
  const boxD = fitDistance(1.6, BOX.h + 0.6, fov, aspect, 0.9);
  const follow = smoothstep(0.35, 0.8, p);
  let target: V3 = mix3(boxCentre, [boxX, boxY + (BOX.h + figureTop + FIGURE_HEIGHT) * 0.55, 0], follow);
  let radius = lerp(boxD * 1.05, wideD * 0.98, follow);
  let angle = lerp(-0.55, 0.32, EASE.inOut(p));
  let camH = lerp(0.35, 0.2, p);
  let roll = 0;
  if (id === "shy") {
    // ends on a close-up of the hesitant smile
    const close = smoothstep(0.7, 1, p);
    target = mix3(target, figureHead, close);
    radius = lerp(radius, 1.35, close);
    angle = lerp(0.35, 0.18, EASE.inOut(p));
    camH = lerp(0.3, 0.05, close);
  }
  if (id === "rebel") {
    // low, slightly dutch editorial angle
    angle = lerp(0.5, -0.25, EASE.inOut(p));
    camH = lerp(-0.45, -0.3, p);
    roll = lerp(0.1, 0.06, p);
    radius *= 0.95;
  }
  if (id === "wanderer") {
    // slow pan around the miniature base
    angle = lerp(0.9, -0.35, EASE.soft(p));
    camH = lerp(0.1, 0.32, p);
    target = mix3(target, figureMid, smoothstep(0.75, 1, p) * 0.5);
  }
  if (clip) radius *= 1.04;
  // 16:9: slide the product right of centre so the lower-left title has clean space (portrait unchanged)
  if (aspect > 1) {
    const shift = radius * Math.tan((fov * Math.PI) / 360) * aspect * 0.32;
    target = [target[0] - Math.cos(angle) * shift, target[1], target[2] + Math.sin(angle) * shift];
  }
  const camPos = orbit(target, radius, angle, camH);

  // --- particles from the opening ------------------------------------------------------------
  const emergeT0 = (d * (openStart + 0.08)) / fps;
  const life = 2.4;

  return (
    <Stage
      backdrop={look.backdrop}
      exposure={1.0}
      envIntensity={0.55}
      overlay={
        <>
          <EditionTitle number={edition.number} name={edition.name} mood={edition.mood} start={Math.round(d * 0.5)} end={d - 2} accent={id === "rebel" ? "#DCE1EA" : undefined} />
          <FilmGrade vignette={0.6} grain={0.05} />
          {/* sound design, cued to the same normalised timeline as the animation */}
          {id === "dreamer" ? <Sfx name="whoosh-soft" at={0} volume={0.35} /> : null}
          {id === "shy" ? <Sfx name="paper-flutter" at={0} volume={0.7} /> : null}
          {id === "rebel" ? <Sfx name="spin-whoosh" at={0} volume={0.6} /> : null}
          {id === "rebel" ? <Sfx name="star-burst" at={2} volume={0.65} /> : null}
          {id === "wanderer" ? <Sfx name="whoosh-soft" at={0} volume={0.3} /> : null}
          {edition.box.style === "tuck" ? <Sfx name="cardboard-open" at={d * openStart} volume={0.75} /> : null}
          {edition.box.style === "flaps" ? <Sfx name="flaps-open" at={d * openStart} volume={0.7} /> : null}
          {edition.box.style === "pop" ? <Sfx name="lid-pop" at={d * openStart} volume={0.8} /> : null}
          <Sfx name="rise-shimmer" at={d * 0.38} volume={0.55} />
          {id === "dreamer" ? <Sfx name="star-twinkle" at={d * 0.66} volume={0.3} /> : null}
        </>
      }
    >
      <CameraRig position={camPos} target={target} fov={fov} roll={roll} />
      <StudioLights rimA={look.rimA} rimB={look.rimB} rim={id === "rebel" ? 1.4 : 1} keyLight={id === "rebel" ? 0.8 : 1} shadowFocus={[boxX, 1.2, 0]} />
      <Floor color={look.floor} />
      <Platform color={look.platform} trim={look.trim} />

      <group position={[boxX, boxY, 0]} rotation={[0, boxYaw, 0]}>
        <BlindBox edition={edition} open={open} />
        <group position={[0, figureY, 0]} rotation={[0, figureYaw, 0]}>
          <Figure edition={edition} t={t} glow={smoothstep(0.4, 0.75, p)} />
        </group>
        {/* warm light spilling out of the opened box */}
        <pointLight position={[0, BOX.h + 0.1, 0]} color={look.particles[0]} intensity={2.2 * open * (1 - rise * 0.5)} distance={2.4} decay={2} />
        <Glow position={[0, BOX.h + 0.05, 0]} color={look.particles[0]} size={1.6} opacity={0.5 * open * (1 - rise * 0.6)} />
      </group>

      <Particles
        count={140}
        seed={edition.index * 17 + 3}
        t={t}
        colors={look.particles}
        scale={height * 0.05}
        fn={(i, r, tt) => {
          const birth = emergeT0 + r[0] * (d / fps - emergeT0) * 0.85;
          const age = tt - birth;
          if (age < 0) return { x: 0, y: -10, z: 0, size: 0, alpha: 0 };
          const k = age / life;
          const a = r[1] * Math.PI * 2 + age * (0.8 + r[2]);
          const rad = 0.15 + r[3] * 0.4 + k * 0.5;
          return {
            x: boxX + Math.cos(a) * rad,
            y: boxY + BOX.h + age * (0.35 + r[4] * 0.45),
            z: Math.sin(a) * rad,
            size: 0.6 + r[5] * 1.4,
            alpha: clamp01(age * 4) * (1 - clamp01(k)),
          };
        }}
      />
      {/* ambient dust */}
      <Particles
        count={90}
        seed={edition.index * 31 + 9}
        t={t}
        colors={["#ffffff", look.particles[0]]}
        scale={height * 0.03}
        twinkle={0.8}
        cross={0}
        opacity={0.55}
        fn={(i, r, tt) => ({
          x: (r[0] - 0.5) * 8,
          y: r[1] * 5 + Math.sin(tt * 0.3 + r[2] * 6) * 0.15,
          z: (r[3] - 0.7) * 6,
          size: 0.5 + r[4],
          alpha: 0.35 + 0.4 * r[5],
        })}
      />

      {id === "shy" ? <ShyIntro frame={frame} d={d} camPos={camPos} target={target} /> : null}
      {id === "rebel" ? <StarBurst t={Math.max(0, t - 0.05)} origin={[0, 1.6, 0.4]} power={3.4} count={54} /> : null}
      {id === "wanderer" ? <Storybook t={t} /> : null}
      {id === "dreamer" ? <DreamerStars t={t} /> : null}
    </Stage>
  );
};

/** A paper heart flutters from right in front of the lens off into the distance, uncovering the box. */
const ShyIntro: React.FC<{ frame: number; d: number; camPos: V3; target: V3 }> = ({ frame, d, camPos, target }) => {
  const k = progress(frame, 0, d * 0.3, EASE.soft);
  if (k >= 1) return null;
  const dir: V3 = [target[0] - camPos[0], target[1] - camPos[1], target[2] - camPos[2]];
  const len = Math.hypot(...dir);
  const n: V3 = [dir[0] / len, dir[1] / len, dir[2] / len];
  const dist = lerp(0.9, len + 3.5, k);
  const pos: V3 = [camPos[0] + n[0] * dist + Math.sin(k * 5) * 0.4 + k * 1.2, camPos[1] + n[1] * dist + k * 1.4 + Math.sin(k * 7) * 0.15, camPos[2] + n[2] * dist];
  return (
    <group position={pos} rotation={[0.3 + k * 1.5, Math.atan2(n[0], n[2]) + Math.sin(k * 6) * 0.6, k * 2.2]} scale={0.55}>
      <PaperHeart />
    </group>
  );
};

/** Tiny sculpted stars drifting around the Dreamer's box. */
const DreamerStars: React.FC<{ t: number }> = ({ t }) => {
  const { height } = useVideoConfig();
  return (
  <Particles
    count={36}
    seed={77}
    t={t}
    colors={["#BFE0FF", "#FFFFFF"]}
    scale={900 * (height / 1920)}
    cross={1}
    fn={(i, r, tt) => {
      const a = r[0] * Math.PI * 2 + tt * (0.15 + r[1] * 0.2);
      const rad = 1.3 + r[2] * 1.4;
      return { x: Math.cos(a) * rad, y: 0.4 + r[3] * 3.4 + Math.sin(tt * 0.5 + r[4] * 6) * 0.1, z: Math.sin(a) * rad - 0.4, size: 0.8 + r[5] * 1.6, alpha: 0.7 };
    }}
  />
  );
};

/** Miniature storybook landscape: layered paper hills, paper clouds and tiny stars. */
const Storybook: React.FC<{ t: number }> = ({ t }) => {
  const { height } = useVideoConfig();
  return (
  <group>
    <group position={[0, 0, -2.2]}>
      <PaperHills width={9} height={1.0} seed={4} color="#7C8B66" trees={10} />
    </group>
    <group position={[0, 0, -3.4]}>
      <PaperHills width={12} height={1.6} seed={9} color="#5B6B4F" trees={14} />
    </group>
    <group position={[0, 0, -4.8]}>
      <PaperHills width={16} height={2.4} seed={13} color="#3F4C35" trees={10} />
    </group>
    {[
      [-2.3, 2.3, -2.6, 0.55, 0.2],
      [2.5, 2.7, -3.2, 0.7, 0.9],
      [-3.4, 3.0, -4.0, 0.5, 1.7],
      [2.1, 1.6, -1.4, 0.35, 2.4],
    ].map(([x, y, z, s, ph], i) => (
      <group key={i} position={[x + Math.sin(t * 0.35 + ph) * 0.25, y + Math.sin(t * 0.6 + ph) * 0.06, z]} scale={s}>
        <PaperCloud />
      </group>
    ))}
    <Particles
      count={60}
      seed={21}
      t={t}
      colors={["#F6E7C4", "#FFFFFF"]}
      scale={700 * (height / 1920)}
      cross={1}
      fn={(i, r) => ({ x: (r[0] - 0.5) * 9, y: 2.2 + r[1] * 3.5, z: -2.5 - r[2] * 2.5, size: 0.6 + r[3] * 1.5, alpha: 0.8 })}
    />
  </group>
  );
};
