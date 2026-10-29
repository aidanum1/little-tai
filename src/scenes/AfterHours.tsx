import { Audio } from "@remotion/media";
import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { mix3 } from "../animations/camera";
import { blocking, performClips, type BlockKey, type Take } from "../animations/performance";
import { clamp01, EASE, lerp, progress, rng, smoothstep, window4 } from "../animations/timing";
import { getAnimatedAsset } from "../characters/assets";
import { FigureBase } from "../characters/Bases";
import { Figure } from "../characters/Figure";
import { getEdition, PALETTE, type EditionId } from "../characters/figures";
import clipTracks from "../characters/clip-tracks.json";
import { clipDurations, RiggedFigure, type ClipSample } from "../characters/RiggedFigure";
import { Fade, FilmGrade, RevealText, useLayout } from "../components/Overlay";
import { Glow, Particles } from "../components/Particles";
import { PaperHeart } from "../components/SetPieces";
import { Sfx } from "../components/Sfx";
import { ShopSet } from "../components/ShopSet";
import { CameraRig, Stage } from "../components/Stage";
import { FONTS } from "../theme";

/**
 * "little TAI — after hours": a 28 s short. The shop closes, the Little Rebel comes alive on the display shelf,
 * walks up to the camera, says hi, dances, strikes a heart pose — then the ceiling lights snap on and he scrambles
 * back onto his base, frozen, as if nothing happened. Rigged Tripo figure, clips retargeted by Tripo (rig v1.0).
 */

type V3 = [number, number, number];
export const AFTER_HOURS_FRAMES = 840;
const FPS = 30;

// ---- beats (frames) -----------------------------------------------------------------------------------------
const T = {
  wake: 118,
  walk: 180,
  greet: 248,
  dance: 356,
  heart: 546,
  heartHit: 590,
  lights: 660,
  run: 684,
  jump: 704,
  land: 720,
  end: 750,
  hop: 796,
  hopLand: 812,
} as const;

// ---- blocking (shelf coordinates: top at y = 0, the wall behind at z = -0.75) --------------------------------
const HOME: V3 = [0, 0.05, -0.25];
const MARK_Z = 1.05; // where he stops in front of the camera
/** Measured from the clips (scripts: planted-foot speed in model units × figure scale). */
const WALK_SPEED = 0.59;

const SHELF_FIGURES: { id: EditionId; x: number; z: number; yaw: number }[] = [
  { id: "dreamer", x: -1.28, z: -0.42, yaw: 0.32 },
  { id: "shy", x: -0.64, z: -0.28, yaw: 0.16 },
  { id: "wanderer", x: 0.64, z: -0.28, yaw: -0.16 },
  { id: "midnight", x: 1.28, z: -0.42, yaw: -0.32 },
];

/** The heart is held between 1.5 s and 4.0 s of the clip; slowed so the lights catch him at ~3.4 s, still in it. */
const HEART = { offset: 0.2, speed: 0.85 };

const TAKES: Take[] = [
  { clip: "idle", from: 0, hold: true, offset: 0 },
  { clip: "look_around", from: T.wake, offset: 3.0, blend: 12 },
  { clip: "walk", from: T.walk, offset: 0.3, loop: true, blend: 10 },
  { clip: "greet_01", from: T.greet, offset: 0, blend: 10 },
  { clip: "dance_01", from: T.dance, offset: 8.0, blend: 8 },
  { clip: "heart_pose", from: T.heart, offset: HEART.offset, speed: HEART.speed, blend: 10 },
  // the lights snap on: he freezes mid-pose…
  { clip: "heart_pose", from: T.lights, offset: HEART.offset + ((T.lights - T.heart) / FPS) * HEART.speed, hold: true, blend: 0 },
  // …then scrambles home
  { clip: "run", from: T.run - 8, offset: 0, loop: true, blend: 6 },
  { clip: "jump", from: T.jump, offset: 0.43, blend: 4 },
  { clip: "idle", from: T.land, hold: true, offset: 0, blend: 8 },
  { clip: "jump", from: T.hop, offset: 0.43, blend: 4 },
  { clip: "idle", from: T.hopLand, hold: true, offset: 0, blend: 6 },
];

const offBase = HOME[2] + 0.3; // base radius
const BLOCKING: BlockKey[] = [
  { f: 0, x: HOME[0], y: HOME[1], z: HOME[2], yaw: 0 },
  { f: T.walk, x: HOME[0], y: HOME[1], z: HOME[2], yaw: 0 },
  { f: T.walk + Math.round(((offBase - HOME[2]) / WALK_SPEED) * FPS), x: 0, y: 0, z: offBase, yaw: 0 },
  { f: T.walk + Math.round(((MARK_Z - HOME[2]) / WALK_SPEED) * FPS), x: 0, y: 0, z: MARK_Z, yaw: 0 },
  { f: T.lights + 16, x: 0, y: 0, z: MARK_Z, yaw: 0 },
  { f: T.run, x: 0, y: 0, z: MARK_Z - 0.05, yaw: Math.PI, ease: "out" },
  { f: T.jump, x: 0, y: 0, z: offBase - 0.05, yaw: Math.PI },
  { f: T.land, x: HOME[0], y: HOME[1], z: HOME[2], yaw: Math.PI * 2, ease: "inOut" },
];

// ---- clip hip tracks (scripts/qc/clip-tracks.ts) -------------------------------------------------------------
const TRACKS = ((clipTracks as { tracks: Record<string, Record<string, number[][]>> }).tracks.rebel ?? {}) as Record<string, number[][]>;
/** Mean hip offset of each clip: some "in place" clips still carry the body off the root (run: half a figure forward). */
const MEAN = Object.fromEntries(
  Object.entries(TRACKS).map(([k, rows]) => [k, [rows.reduce((a, r) => a + r[0], 0) / rows.length, rows.reduce((a, r) => a + r[2], 0) / rows.length] as const]),
);
const hipAt = (c: ClipSample) => {
  const rows = TRACKS[c.name];
  return rows?.length ? rows[Math.min(rows.length - 1, Math.max(0, Math.round(c.time * FPS)))] : [0, 0, 0];
};
const sum2 = (clips: ClipSample[], f: (c: ClipSample) => readonly number[]) =>
  clips.reduce<[number, number]>((acc, c) => [acc[0] + f(c)[0] * c.weight, acc[1] + f(c)[1] * c.weight], [0, 0]);
/** Rotate a figure-space (x, z) offset by the group's yaw. */
const turn = ([x, z]: [number, number], yaw: number): [number, number] => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];

/** Ceiling lights: off at night, a stuttering strike at T.lights, then on. */
const lightsOn = (f: number) => {
  const u = f - T.lights;
  if (u < 1) return 0;
  if (u < 3) return 1;
  if (u < 6) return 0;
  if (u < 8) return 1;
  if (u < 9) return 0.25;
  if (u < 11) return 0.3;
  if (u < 12) return 1;
  return 1;
};

/** Dance beat envelope (120 BPM from T.dance + 4 frames, the score's 11.87 s downbeat at frame 356). */
const beatAt = (f: number) => {
  if (f < T.dance || f > T.heart) return { k: 0, n: 0 };
  const u = (f - T.dance) / 15;
  const n = Math.floor(u);
  return { k: Math.exp(-(u - n) * 4), n };
};

// ---- camera -------------------------------------------------------------------------------------------------
const shot = (f: number, focus: V3): { position: V3; target: V3; fov: number } => {
  const [rx, , rz] = focus;
  if (f < 96) {
    const k = progress(f, 0, 96, EASE.soft);
    return { position: mix3([0.9, 1.75, 7.4], [0.7, 1.45, 6.4], k), target: mix3([0, 1.25, -0.3], [0, 1.05, -0.3], k), fov: 32 };
  }
  if (f < T.walk) {
    const k = progress(f, 96, T.walk, EASE.soft);
    return { position: mix3([0.55, 0.8, 2.55], [0.38, 0.74, 2.05], k), target: [0, 0.62, HOME[2]], fov: 30 };
  }
  if (f < T.greet) {
    // low tracking shot, dollying back a little slower than he walks
    const k = progress(f, T.walk, T.greet, EASE.inOut);
    return { position: [lerp(0.55, 0.25, k), 0.45, lerp(2.7, 3.55, k)], target: [rx, 0.55, rz], fov: 32 };
  }
  if (f < T.dance) {
    const k = progress(f, T.greet, T.dance, EASE.soft);
    return { position: [lerp(0.25, 0.1, k), 0.72, MARK_Z + lerp(3.3, 2.95, k)], target: [0, 0.68, MARK_Z], fov: 30 };
  }
  if (f < T.heart) {
    // two orbiting angles, cut on the bar line
    const second = f >= T.dance + 96;
    const k = second ? progress(f, T.dance + 96, T.heart, EASE.inOut) : progress(f, T.dance, T.dance + 96, EASE.inOut);
    const a = second ? lerp(0.75, 0.25, k) : lerp(-0.7, -0.2, k);
    const r = second ? 2.8 : 3.3;
    const y = second ? 0.3 : 0.95;
    return { position: [rx + Math.sin(a) * r, y, rz + Math.cos(a) * r], target: [rx, second ? 0.62 : 0.58, rz], fov: 32 };
  }
  if (f < T.lights) {
    const k = progress(f, T.heart, T.lights, EASE.soft);
    // he leans to his right (screen left) into the heart: frame a little that way
    return { position: [rx + lerp(-0.3, -0.18, k), 0.82, MARK_Z + lerp(3.4, 3.0, k)], target: [rx - 0.15, 0.72, MARK_Z], fov: 30 };
  }
  // lights on → end: one wide, locked-off shot (the "nothing happened" frame), with a slow push at the end
  const k = progress(f, T.end, AFTER_HOURS_FRAMES, EASE.soft);
  return { position: mix3([0.55, 1.3, 5.6], [0.45, 1.2, 5.0], k), target: mix3([0, 0.85, 0.1], [0, 0.8, -0.1], k), fov: 32 };
};

// ---- overlay -------------------------------------------------------------------------------------------------
const Hand: React.FC<{ text: string; start: number; end: number; top: number; size?: number; color?: string; rotate?: number }> = ({ text, start, end, top, size = 96, color = PALETTE.cream, rotate = -4 }) => {
  const { u } = useLayout();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: top * u, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `rotate(${rotate}deg)` }}>
        <RevealText text={text} start={start} end={end} stagger={1.6} style={{ fontFamily: FONTS.hand, fontWeight: 600, fontSize: size * u, color, textShadow: "0 3px 24px rgba(0,0,0,0.65)" }} />
      </div>
    </AbsoluteFill>
  );
};

const TitleBlock: React.FC<{ start: number; end?: number; top: number; disclaimer?: boolean }> = ({ start, end, top, disclaimer = false }) => {
  const { u } = useLayout();
  const shadow = "0 0 40px rgba(241,221,169,0.3), 0 4px 30px rgba(0,0,0,0.65)";
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(3,4,10,0.55) 0%, rgba(3,4,10,0.2) 24%, rgba(3,4,10,0) 36%)", opacity: window4(useCurrentFrame(), start - 10, start + 6, (end ?? 99999) - 10, end ?? 99999) }} />
      <div style={{ position: "absolute", top: top * u, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <RevealText text="little TAI" start={start} end={end} stagger={2} style={{ fontFamily: FONTS.display, fontStyle: "italic", fontWeight: 600, fontSize: 150 * u, color: PALETTE.cream, textShadow: shadow, lineHeight: 1 }} />
        <RevealText text="after hours" start={start + 14} end={end} stagger={1.8} style={{ fontFamily: FONTS.hand, fontWeight: 600, fontSize: 92 * u, color: PALETTE.gold, marginTop: 6 * u, textShadow: "0 3px 24px rgba(0,0,0,0.7)" }} />
      </div>
      {disclaimer ? (
        <div style={{ position: "absolute", bottom: 90 * u, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 * u }}>
          <RevealText text="THE FEELINGS COLLECTION" start={start + 24} end={end} stagger={0.7} style={{ fontFamily: FONTS.sans, fontSize: 36 * u, letterSpacing: "0.4em", color: PALETTE.gold, textShadow: "0 2px 18px rgba(0,0,0,0.8)" }} />
          <RevealText text="Unofficial fan-made concept." start={start + 34} end={end} stagger={0.3} style={{ fontFamily: FONTS.sans, fontWeight: 300, fontSize: 28 * u, letterSpacing: "0.12em", color: "rgba(236,230,217,0.75)", textShadow: "0 2px 12px rgba(0,0,0,0.8)" }} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** Sound: score + effects, cued to the beats above. Walk/run footfalls follow the clips' foot contacts. */
const Sound: React.FC = () => {
  const walkSteps = [0.43, 1.07, 1.62, 2.22].map((t) => T.walk + Math.round((t - 0.3) * FPS)).filter((f) => f < T.greet);
  const runSteps = Array.from({ length: 5 }, (_, i) => T.run - 6 + i * 5);
  return (
    <>
      <Audio src={staticFile("audio/after-hours-score.wav")} volume={(f) => interpolate(f, [0, 10, AFTER_HOURS_FRAMES - 30, AFTER_HOURS_FRAMES], [0, 0.8, 0.8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      {[0, 30, 60].map((f) => (
        <Sfx key={f} name="clock-tick" at={f + 4} volume={0.22} />
      ))}
      <Sfx name="star-twinkle" at={100} volume={0.45} />
      <Sfx name="rise-shimmer" at={T.wake - 2} volume={0.35} />
      {walkSteps.map((f) => (
        <Sfx key={`w${f}`} name="tiptoe" at={f} volume={0.35} />
      ))}
      <Sfx name="star-burst" at={T.heartHit - 2} volume={0.32} />
      <Sfx name="switch-click" at={T.lights - 1} volume={0.7} />
      <Sfx name="light-buzz" at={T.lights} volume={0.4} />
      {runSteps.map((f) => (
        <Sfx key={`r${f}`} name="tiptoe" at={f} volume={0.4} />
      ))}
      <Sfx name="boing" at={T.jump + 2} volume={0.32} />
      <Sfx name="tiptoe" at={T.land - 2} volume={0.5} />
      <Sfx name="boing" at={T.hop + 2} volume={0.28} />
      <Sfx name="star-twinkle" at={T.hopLand + 2} volume={0.3} />
    </>
  );
};

const FollowSpot: React.FC<{ position: V3; target: V3; intensity: number }> = ({ position, target, intensity }) => {
  const obj = useMemo(() => new THREE.Object3D(), []);
  obj.position.set(...target);
  obj.updateMatrixWorld();
  return (
    <>
      <primitive object={obj} />
      <spotLight position={position} target={obj} angle={0.42} penumbra={1} intensity={intensity} color="#E9EEFF" distance={8} decay={1.5} />
    </>
  );
};

const PULSE = ["#FF7FB0", "#7FD8FF", "#FFD27F", "#B79BFF"];

export const AfterHours: React.FC = () => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const t = frame / FPS;
  const asset = getAnimatedAsset("rebel");
  const rebelEdition = getEdition("rebel");

  const durations = asset ? clipDurations(asset) : {};
  const pos = blocking(BLOCKING, frame);
  const rebel: V3 = [pos.x, pos.y, pos.z];
  const clips = asset ? performClips(TAKES, frame, FPS, durations) : [];
  // keep each clip's mean hips over the blocking mark…
  const [sx, sz] = turn(sum2(clips, (c) => MEAN[c.name] ?? [0, 0]), pos.yaw);
  const place: V3 = [rebel[0] - sx, rebel[1], rebel[2] - sz];
  // …and let the camera follow where the dance actually carries him (smoothed over ±12 frames)
  let fx = 0;
  let fz = 0;
  for (let k = -12; k <= 12; k++) {
    const g = Math.max(0, frame + k);
    const cs = asset ? performClips(TAKES, g, FPS, durations) : [];
    const p = blocking(BLOCKING, g);
    const [dx, dz] = turn(sum2(cs, (c) => [hipAt(c)[0] - (MEAN[c.name]?.[0] ?? 0), hipAt(c)[2] - (MEAN[c.name]?.[1] ?? 0)]), p.yaw);
    fx += p.x + dx;
    fz += p.z + dz;
  }
  const focus: V3 = [fx / 25, rebel[1], fz / 25];
  const cam = shot(frame, focus);
  const on = lightsOn(frame);
  const night = 1 - on;
  const beat = beatAt(frame);
  const dancing = frame >= T.dance && frame < T.heart ? smoothstep(T.dance, T.dance + 10, frame) * (1 - smoothstep(T.heart - 10, T.heart, frame)) : 0;
  const heartGlow = window4(frame, T.heartHit - 6, T.heartHit + 8, T.lights - 30, T.lights);
  const wakeFlash = window4(frame, T.wake - 10, T.wake, T.wake + 4, T.wake + 26);

  // star that drifts in and wakes him: arcs around his head, then bursts at T.wake
  const sk = progress(frame, 92, T.wake, EASE.inOut);
  const starPos: V3 = [lerp(-0.9, 0.08, sk) + Math.sin(sk * Math.PI) * 0.2, lerp(1.25, 0.9, sk) + Math.sin(sk * Math.PI * 2) * 0.08, HOME[2] + lerp(0.6, 0.25, sk)];
  const starOpacity = window4(frame, 92, 100, T.wake - 2, T.wake + 4);

  const fairy = 0.55 + 0.45 * night + dancing * beat.k * 0.6;

  return (
    <Stage
      backdrop={`linear-gradient(180deg, ${night > 0.5 ? "#0c0e1c" : "#3a3330"} 0%, #050508 100%)`}
      exposure={lerp(1.15, 1.22, on)}
      envIntensity={lerp(0.22, 0.75, on)}
      envWarmth="#ffd9b0"
      overlay={
        <>
          <TitleBlock start={14} end={92} top={170} />
          <Hand text="psst… hi!" start={T.greet + 16} end={T.dance - 6} top={250} />
          <Hand text="uh-oh." start={T.lights + 6} end={T.land} top={250} size={104} rotate={3} />
          <TitleBlock start={T.end + 8} top={170} disclaimer />
          <FilmGrade vignette={lerp(0.7, 0.35, on)} grain={0.05} tint={on > 0.5 ? "#ffcf96" : "#1a2a66"} tintOpacity={on > 0.5 ? 0.12 : 0.28} />
          {/* the strike of the ceiling lights reads as a white flash */}
          <AbsoluteFill style={{ background: "#fff8ec", opacity: frame >= T.lights && frame < T.lights + 12 ? 0.35 * on : 0, pointerEvents: "none" }} />
          <Fade from={AFTER_HOURS_FRAMES - 16} to={AFTER_HOURS_FRAMES} />
          <Sound />
        </>
      }
    >
      <CameraRig position={cam.position} target={cam.target} fov={cam.fov} />

      {/* night: moonlight through the window, warm fairy-light bounce, cool rim */}
      <directionalLight
        position={[-3.2, 4.6, 2.6]}
        intensity={1.5 * night + 0.25}
        color="#A9C1FF"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={5}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-camera-near={0.5}
        shadow-camera-far={14}
      />
      <hemisphereLight color={on > 0.5 ? "#fff3e2" : "#3a4a80"} groundColor={on > 0.5 ? "#6a5442" : "#1a1410"} intensity={lerp(0.45, 1.5, on)} />
      <pointLight position={[0, 2.6, -0.3]} color="#FFB36B" intensity={(1.6 * night + 0.4) * fairy} distance={5} decay={1.6} />
      <spotLight position={[2.2, 2.4, -1.6]} angle={0.6} penumbra={1} intensity={6 * night + 2} color="#9EC4FF" distance={9} decay={1.6} />
      {/* a soft front key that follows him, so black clothes still read at night */}
      <FollowSpot position={[focus[0] + 0.8, 1.9, focus[2] + 2.4]} target={[focus[0], 0.55, focus[2]]} intensity={lerp(7, 2.5, on)} />
      {/* shop ceiling lights */}
      <directionalLight
        position={[0.6, 6, 3]}
        intensity={3.2 * on}
        color="#FFF1DE"
        castShadow={on > 0}
        shadow-mapSize={[2048, 2048]}
        shadow-radius={4}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />
      <rectAreaLight position={[0, 3.2, 2.6]} width={4} height={1.2} intensity={4.5 * on} color="#FFF4E8" onUpdate={(l) => l.lookAt(0, 0.4, 0)} />
      {/* dance lights */}
      <pointLight position={[-1.0, 1.1, MARK_Z + 0.6]} color={PULSE[beat.n % 4]} intensity={dancing * (0.8 + 2.6 * beat.k)} distance={3.5} decay={1.6} />
      <pointLight position={[1.0, 1.4, MARK_Z - 0.2]} color={PULSE[(beat.n + 2) % 4]} intensity={dancing * (0.8 + 2.6 * beat.k)} distance={3.5} decay={1.6} />

      <ShopSet on={on} fairy={fairy} pulse={dancing > 0 ? (i) => ({ color: PULSE[(i + beat.n) % 4], k: dancing * beat.k }) : undefined} />

      {SHELF_FIGURES.map((s) => (
        <group key={s.id} position={[s.x, 0.05, s.z]} rotation={[0, s.yaw, 0]}>
          <Figure edition={getEdition(s.id)} t={t} glow={0.6 + 0.4 * night} />
        </group>
      ))}

      {/* the Little Rebel: his base stays home, he does not */}
      <group position={[HOME[0], HOME[1], HOME[2]]}>
        <FigureBase edition={rebelEdition} t={t} />
      </group>
      {asset ? (
        <group position={place} rotation={[0, pos.yaw, 0]}>
          <RiggedFigure asset={asset} clips={clips} />
        </group>
      ) : null}

      {/* the waking star */}
      <Glow position={starPos} color="#E8EEFF" size={0.32} opacity={starOpacity} flare />
      <Glow position={[0, 0.85, HOME[2] + 0.2]} color="#CFE0FF" size={1.6} opacity={0.55 * wakeFlash} />
      <Particles
        count={70}
        seed={33}
        t={t}
        colors={["#E8EEFF", "#C9D6FF", "#FFFFFF"]}
        scale={height * 0.035}
        fn={(i, r, tt) => {
          const age = tt - T.wake / FPS - r[0] * 0.15;
          if (age < 0) return { x: 0, y: -9, z: 0, size: 0, alpha: 0 };
          const a = r[1] * Math.PI * 2;
          const sp = 0.25 + r[2] * 0.5;
          return { x: Math.cos(a) * sp * age, y: 0.85 + (r[3] - 0.3) * sp * age * 1.2 - age * age * 0.15, z: HOME[2] + 0.2 + Math.sin(a) * sp * age, size: 0.5 + r[4], alpha: clamp01(1 - age / 1.4) };
        }}
      />

      {/* dust motes in the moonlight */}
      <Particles
        count={90}
        seed={71}
        t={t}
        colors={["#C9D6FF", "#FFE2B8"]}
        scale={height * 0.025}
        opacity={0.5 * night}
        fn={(i, r, tt) => ({ x: (r[0] - 0.5) * 5, y: 0.2 + ((r[1] * 3 + tt * (0.03 + r[2] * 0.04)) % 3), z: -0.6 + r[3] * 2.2, size: 0.3 + r[4] * 0.8, alpha: 0.4 + 0.4 * Math.sin(tt * 1.3 + r[5] * 6) })}
      />

      {/* heart pose: paper hearts float up beside him (never across his face) */}
      {Array.from({ length: 6 }, (_, i) => {
        const r = rng(500 + i);
        const delay = T.heartHit + i * 5;
        const age = (frame - delay) / FPS;
        if (age < 0 || frame >= T.lights) return null;
        const side = i % 2 ? 1 : -1;
        const x = focus[0] - 0.12 + side * (0.22 + r() * 0.22);
        const y = 0.8 + r() * 0.25 + age * (0.2 + r() * 0.1);
        const s = 0.07 + r() * 0.04;
        return (
          <group key={i} position={[x, y, MARK_Z - 0.3 - r() * 0.2]} rotation={[0, Math.sin(age * 2 + i) * 0.6, Math.sin(age * 1.5 + i) * 0.2]} scale={s * smoothstep(0, 0.25, age)}>
            <PaperHeart color={i % 2 ? "#F2A7BD" : "#E9B4BE"} />
          </group>
        );
      })}
      <Glow position={[focus[0] - 0.1, 1.0, MARK_Z - 0.2]} color="#FF8FB1" size={1.5} opacity={0.5 * heartGlow} />
      <pointLight position={[0, 1.0, MARK_Z + 0.5]} color="#FF9CC0" intensity={2.2 * heartGlow} distance={2.5} decay={1.6} />
    </Stage>
  );
};
