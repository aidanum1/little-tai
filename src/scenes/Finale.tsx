import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { fitDistance } from "../animations/camera";
import { EASE, lerp, progress, rng } from "../animations/timing";
import { Figure, FIGURE_HEIGHT } from "../characters/Figure";
import { EDITIONS, PALETTE } from "../characters/figures";
import { FilmGrade, RevealText, useLayout } from "../components/Overlay";
import { Glow, Particles } from "../components/Particles";
import { Floor, Pedestal } from "../components/SetPieces";
import { Sfx } from "../components/Sfx";
import { CameraRig, Stage, StudioLights } from "../components/Stage";
import { FONTS } from "../theme";

/**
 * 0:32–0:36 "FINAL COLLECTION SHOT" — all five figures, the secret edition centred and raised,
 * camera gently pulls back while stars gather around the collection title, then an elegant fade.
 */

const PED = { dreamer: "#C9DDF2", shy: "#EBCBD1", rebel: "#3A1C25", wanderer: "#C7CDB7", midnight: "#0E0E13" } as const;

export const finaleLayout = (portrait: boolean) => {
  const s = portrait ? 1 : 1.55;
  return {
    dreamer: { x: -1.25 * s, z: -0.85, h: 0.42 },
    shy: { x: -0.62 * s, z: -0.15, h: 0.3 },
    midnight: { x: 0, z: 0.45, h: 0.5 },
    rebel: { x: 0.62 * s, z: -0.15, h: 0.3 },
    wanderer: { x: 1.25 * s, z: -0.85, h: 0.42 },
  } as const;
};

export const FinaleSet: React.FC<{ t: number; pull: number }> = ({ t, pull }) => {
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  const layout = finaleLayout(portrait);
  const fov = 30;
  const span = portrait ? 3.3 : 5.6;
  const wide = fitDistance(span, FIGURE_HEIGHT + 1.6, fov, width / height, portrait ? 0.95 : 0.85);
  const dist = lerp(wide * 0.78, wide * 1.04, pull);
  // keep the figures in the lower part of the frame, leaving the top for the title
  const target: [number, number, number] = [0, lerp(1.05, 1.45, pull), 0];
  return (
    <>
      <CameraRig position={[0, lerp(1.2, 1.15, pull), dist]} target={target} fov={fov} />
      <StudioLights rimA="#F1DDA9" rimB="#BFD8FF" shadowFocus={[0, 0.9, 0]} />
      <Floor color="#15151d" />
      {EDITIONS.map((e, i) => {
        const L = layout[e.id];
        const yaw = Math.sin(t * 0.6 + i) * 0.18 - L.x * 0.15;
        return (
          <group key={e.id} position={[L.x, 0, L.z]}>
            <Pedestal height={L.h} radius={e.secret ? 0.42 : 0.36} color={PED[e.id]} band={e.id === "rebel" ? "silver" : "gold"} />
            <group position={[0, L.h + (e.secret ? 0.08 : 0.05), 0]} rotation={[0, yaw, 0]}>
              <Figure edition={e} t={t} glow={1} />
            </group>
            {e.secret ? <Glow position={[0, L.h + 0.6, 0.3]} color="#FF3B4E" size={1.1} opacity={0.5} /> : null}
          </group>
        );
      })}
      <Particles
        count={120}
        seed={808}
        t={t}
        colors={["#F1DDA9", "#ECE6D9", "#8FBCE7"]}
        scale={height * 0.04}
        fn={(i, r, tt) => ({ x: (r[0] - 0.5) * 8, y: 0.3 + r[1] * 4, z: (r[2] - 0.7) * 5, size: 0.4 + r[3] * 1.2, alpha: 0.55 + 0.3 * Math.sin(tt + r[4] * 6) })}
      />
    </>
  );
};

/** 2D stars that converge from the edges onto an ellipse around the title. */
const GatheringStars: React.FC<{ cx: number; cy: number; rx: number; ry: number; k: number }> = ({ cx, cy, rx, ry, k }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const r = rng(12);
  const stars = Array.from({ length: 46 }, (_, i) => {
    const a = (i / 46) * Math.PI * 2 + r() * 0.08;
    const sx = r() * width;
    const sy = r() * height;
    return { a, sx, sy, s: 4 + r() * 9, delay: r() * 0.35, tw: r() * 6 };
  });
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
      {stars.map((s, i) => {
        const kk = EASE.cine(Math.max(0, Math.min(1, (k - s.delay) / (1 - s.delay))));
        const tx = cx + Math.cos(s.a) * rx;
        const ty = cy + Math.sin(s.a) * ry;
        const x = lerp(s.sx, tx, kk);
        const y = lerp(s.sy, ty, kk);
        const tw = 0.6 + 0.4 * Math.sin(frame * 0.25 + s.tw);
        const pts = Array.from({ length: 10 }, (_, j) => {
          const rad = j % 2 ? s.s * 0.42 : s.s;
          const ang = -Math.PI / 2 + (j * Math.PI) / 5;
          return `${x + Math.cos(ang) * rad},${y + Math.sin(ang) * rad}`;
        }).join(" ");
        return <polygon key={i} points={pts} fill={i % 3 === 0 ? PALETTE.gold : PALETTE.cream} opacity={tw * Math.min(1, k * 3)} style={{ filter: `drop-shadow(0 0 ${s.s}px rgba(241,221,169,0.8))` }} />;
      })}
    </svg>
  );
};

export const FinaleTitle: React.FC<{ start: number; gather: number; showDisclaimer?: boolean }> = ({ start, gather, showDisclaimer = true }) => {
  const { u, portrait, width, height } = useLayout();
  const cy = height * (portrait ? 0.2 : 0.2);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <GatheringStars cx={width / 2} cy={cy + 20 * u} rx={(portrait ? 470 : 640) * u} ry={(portrait ? 190 : 200) * u} k={gather} />
      <div style={{ position: "absolute", top: cy - 120 * u, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <RevealText
          text="little TAI"
          start={start}
          stagger={2.2}
          style={{ fontFamily: FONTS.display, fontStyle: "italic", fontWeight: 600, fontSize: 168 * u, color: PALETTE.cream, textShadow: "0 0 40px rgba(241,221,169,0.35), 0 4px 30px rgba(0,0,0,0.6)", lineHeight: 1 }}
        />
        <RevealText
          text="THE FEELINGS COLLECTION"
          start={start + 14}
          stagger={0.8}
          style={{ fontFamily: FONTS.sans, fontWeight: 400, fontSize: 40 * u, letterSpacing: "0.42em", color: PALETTE.gold, marginTop: 26 * u, textShadow: "0 2px 18px rgba(0,0,0,0.7)" }}
        />
      </div>
      {showDisclaimer ? (
        <div style={{ position: "absolute", bottom: (portrait ? 70 : 40) * u, left: 0, right: 0, textAlign: "center" }}>
          <RevealText text="Unofficial fan-made concept." start={start + 26} stagger={0.3} style={{ fontFamily: FONTS.sans, fontWeight: 300, fontSize: 30 * u, letterSpacing: "0.12em", color: "rgba(236,230,217,0.7)" }} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const Finale: React.FC<{ durationInFrames: number }> = ({ durationInFrames: d }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const pull = progress(frame, 0, d, EASE.soft);
  const gather = progress(frame, 8, d * 0.75, EASE.inOut);
  const fadeOut = interpolate(frame, [d - 24, d], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOut });
  return (
    <Stage
      backdrop="radial-gradient(ellipse 100% 70% at 50% 30%, #262a3b 0%, #11131b 55%, #050608 100%)"
      exposure={1.02}
      envIntensity={0.6}
      overlay={
        <>
          <FinaleTitle start={10} gather={gather} />
          <Sfx name="finale-chimes" at={6} volume={0.55} />
          <FilmGrade vignette={0.6} grain={0.05} />
          <AbsoluteFill style={{ background: "#000", opacity: fadeOut }} />
        </>
      }
    >
      <FinaleSet t={t} pull={pull} />
    </Stage>
  );
};
