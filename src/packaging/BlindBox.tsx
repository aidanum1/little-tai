import React, { useMemo } from "react";
import * as THREE from "three";
import { clamp01, EASE } from "../animations/timing";
import type { Edition } from "../characters/figures";
import { BOX, boxMaterials } from "./boxTextures";

/**
 * Animated blind box. Real cuboid geometry with board thickness, printed outer faces, printed interior,
 * and a per-edition opening mechanism driven by `open` (0 = sealed, 1 = fully open):
 *   tuck   hinged tuck-top lid + front tuck flap + two dust flaps          (Dreamer, Wanderer)
 *   flaps  four top flaps, outer pair first, then inner pair              (Shy One)
 *   pop    telescoping lid that pops and flies off                        (Little Rebel)
 *   luxe   rigid two-piece box, gilded edges, lid rises slowly away       (Midnight Star)
 * Origin: centre of the box floor. The interior floor is at y = BOX.t.
 */

const { w, h, d, t, lidH } = BOX;

const seg = (open: number, a: number, b: number, ease: (x: number) => number = EASE.inOut) => ease(clamp01((open - a) / (b - a)));

export const INTERIOR_FLOOR = t;

export const BlindBox: React.FC<{ edition: Edition; open: number }> = ({ edition, open }) => {
  const m = boxMaterials(edition);
  const wall = useMemo(() => (outer: THREE.Material) => [m.edge, m.edge, m.edge, m.edge, outer, m.interior], [m]);
  const style = edition.box.style;

  return (
    <group>
      {/* body */}
      <mesh position={[0, h / 2, d / 2 - t / 2]} material={wall(m.front)} castShadow receiveShadow>
        <boxGeometry args={[w, h, t]} />
      </mesh>
      <mesh position={[0, h / 2, -d / 2 + t / 2]} rotation={[0, Math.PI, 0]} material={wall(m.back)} castShadow receiveShadow>
        <boxGeometry args={[w, h, t]} />
      </mesh>
      <mesh position={[-w / 2 + t / 2, h / 2, 0]} rotation={[0, -Math.PI / 2, 0]} material={wall(m.left)} castShadow receiveShadow>
        <boxGeometry args={[d - 2 * t, h, t]} />
      </mesh>
      <mesh position={[w / 2 - t / 2, h / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={wall(m.right)} castShadow receiveShadow>
        <boxGeometry args={[d - 2 * t, h, t]} />
      </mesh>
      <mesh position={[0, t / 2, 0]} rotation={[Math.PI / 2, 0, 0]} material={wall(m.bottom)} receiveShadow>
        <boxGeometry args={[w - 2 * t, d - 2 * t, t]} />
      </mesh>

      {style === "tuck" ? <TuckTop m={m} open={open} /> : null}
      {style === "flaps" ? <FourFlaps m={m} open={open} /> : null}
      {style === "pop" || style === "luxe" ? <TelescopingLid m={m} open={open} luxe={style === "luxe"} /> : null}
    </group>
  );
};

type M = ReturnType<typeof boxMaterials>;

const TuckTop: React.FC<{ m: M; open: number }> = ({ m, open }) => {
  const lid = seg(open, 0, 0.6, EASE.cine);
  const tuck = seg(open, 0.02, 0.35);
  const dust = seg(open, 0.45, 0.95);
  const panel = [m.edge, m.edge, m.edge, m.edge, m.top, m.interior];
  return (
    <group>
      {/* lid hinged on the back top edge, swings up and over to the back */}
      <group position={[0, h, -d / 2 + t / 2]} rotation={[-lid * 1.95, 0, 0]}>
        <mesh position={[0, t / 2, d / 2 - t / 2]} rotation={[-Math.PI / 2, 0, 0]} material={panel} castShadow>
          <boxGeometry args={[w, d, t]} />
        </mesh>
        {/* tuck flap on the lid's front edge: tucked inside the front wall when closed */}
        <group position={[0, 0, d - 1.5 * t]} rotation={[tuck * 1.25, 0, 0]}>
          <mesh position={[0, -0.06, -t * 0.6]} material={[m.edge, m.edge, m.edge, m.edge, m.flap, m.interior]}>
            <boxGeometry args={[w - 2 * t - 0.01, 0.12, t * 0.7]} />
          </mesh>
        </group>
      </group>
      {/* dust flaps on the side top edges */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (w / 2 - t), h - t * 0.6, 0]} rotation={[0, 0, side * dust * 1.85]}>
          <mesh position={[-side * 0.1, 0, 0]} material={m.interior} castShadow>
            <boxGeometry args={[0.2, t * 0.6, d - 2 * t - 0.01]} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const FourFlaps: React.FC<{ m: M; open: number }> = ({ m, open }) => {
  const outer = seg(open, 0, 0.55, EASE.cine);
  const inner = seg(open, 0.3, 0.85, EASE.cine);
  const flapMat = [m.edge, m.edge, m.edge, m.edge, m.flap, m.interior];
  return (
    <group>
      {/* inner side flaps (under) */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (w / 2 - t / 2), h - t * 0.5, 0]} rotation={[0, 0, -side * inner * Math.PI * 0.62]}>
          <mesh position={[-side * (w / 4 - t / 2), 0, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.interior} castShadow>
            <boxGeometry args={[w / 2 - t, d - 2 * t, t * 0.8]} />
          </mesh>
        </group>
      ))}
      {/* outer front/back flaps (over), front one carries the heart seal */}
      <group position={[0, h + t * 0.4, d / 2 - t / 2]} rotation={[outer * Math.PI * 0.66, 0, 0]}>
        <mesh position={[0, 0, -d / 4]} rotation={[-Math.PI / 2, 0, 0]} material={flapMat} castShadow>
          <boxGeometry args={[w, d / 2, t]} />
        </mesh>
      </group>
      <group position={[0, h + t * 0.4, -d / 2 + t / 2]} rotation={[-outer * Math.PI * 0.66, 0, 0]}>
        <mesh position={[0, 0, d / 4]} rotation={[-Math.PI / 2, 0, Math.PI]} material={flapMat} castShadow>
          <boxGeometry args={[w, d / 2, t]} />
        </mesh>
      </group>
    </group>
  );
};

const TelescopingLid: React.FC<{ m: M; open: number; luxe: boolean }> = ({ m, open, luxe }) => {
  const W = w + 2 * t + 0.008;
  const D = d + 2 * t + 0.008;
  let y = 0;
  let x = 0;
  let z = 0;
  let rx = 0;
  let rz = 0;
  if (luxe) {
    // slow, weightless lift, then glide back and up out of the way
    const lift = seg(open, 0, 0.55, EASE.soft);
    const away = seg(open, 0.45, 1, EASE.inOut);
    y = lift * 0.55 + away * 1.6;
    z = -away * 0.9;
    rx = -lift * 0.06 - away * 0.35;
  } else {
    // pop! a quick spring up, then it tumbles off to the side
    const pop = seg(open, 0, 0.22, EASE.out);
    const fly = seg(open, 0.2, 1, EASE.in);
    y = pop * 0.32 + fly * 2.8;
    x = fly * 1.9;
    rx = pop * 0.18 + fly * 0.9;
    rz = -pop * 0.12 - fly * 1.6;
  }
  const bandF = [m.edge, m.edge, m.edge, m.edge, m.lidBand!, m.interior];
  const bandS = [m.edge, m.edge, m.edge, m.edge, m.lidBandSide!, m.interior];
  const top = [m.edge, m.edge, m.edge, m.edge, m.top, m.interior];
  return (
    <group position={[x, h + t + y, z]} rotation={[rx, 0, rz]}>
      <mesh position={[0, -t / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} material={top} castShadow>
        <boxGeometry args={[W, D, t]} />
      </mesh>
      <mesh position={[0, -lidH / 2, D / 2 - t / 2]} material={bandF} castShadow>
        <boxGeometry args={[W, lidH, t]} />
      </mesh>
      <mesh position={[0, -lidH / 2, -D / 2 + t / 2]} rotation={[0, Math.PI, 0]} material={bandF} castShadow>
        <boxGeometry args={[W, lidH, t]} />
      </mesh>
      <mesh position={[-W / 2 + t / 2, -lidH / 2, 0]} rotation={[0, -Math.PI / 2, 0]} material={bandS} castShadow>
        <boxGeometry args={[D - 2 * t, lidH, t]} />
      </mesh>
      <mesh position={[W / 2 - t / 2, -lidH / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={bandS} castShadow>
        <boxGeometry args={[D - 2 * t, lidH, t]} />
      </mesh>
    </group>
  );
};

/** How far (in figure-space units) the lid/flaps still block the opening; figures wait until this reaches 0. */
export const openingClear = (edition: Edition, open: number) => {
  switch (edition.box.style) {
    case "tuck":
      return open > 0.42;
    case "flaps":
      return open > 0.5;
    case "pop":
      return open > 0.3;
    case "luxe":
      return open > 0.5;
  }
};
