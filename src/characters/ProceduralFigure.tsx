import React, { useMemo } from "react";
import * as THREE from "three";
import { BlueStar, FoldedLetter, GlowingRedStar, GoldStar, PinkHeart, SilverStarPin, Suitcase } from "./Accessories";
import {
  HEAD,
  coatGeometry,
  coatPanelGeometry,
  coatPoint,
  collarGeometry,
  hairCapGeometry,
  hairLocksGeometry,
  headGeometry,
  lapelGeometry,
  sphereDir,
  sweaterGeometry,
} from "./figureGeometry";
import { FACE_LAYOUT } from "./faceTexture";
import type { Edition, PoseId } from "./figures";
import { figureMaterials } from "./materials";

/**
 * Procedural maquette of the little TAI figure — real 3D geometry, used until (or instead of)
 * the Tripo-generated GLB for an edition. ~1.10 units tall, feet at y = 0, facing +Z.
 */

type V3 = [number, number, number];

interface ArmPose {
  hand: V3;
  pole: V3;
  /** Hide the hand (tucked in a pocket). */
  tucked?: boolean;
}

interface Pose {
  right: ArmPose; // figure's right = −X
  left: ArmPose;
  shoulderInset?: number;
}


const REST_L: ArmPose = { hand: [0.218, 0.3, 0.03], pole: [1, 0.1, -0.7] };

export const POSES: Record<PoseId, Pose> = {
  "star-up": { right: { hand: [-0.085, 0.5, 0.2], pole: [-1, -0.9, -0.1] }, left: REST_L },
  "hands-together": {
    right: { hand: [-0.03, 0.355, 0.17], pole: [-1, -0.2, -0.5] },
    left: { hand: [0.03, 0.355, 0.17], pole: [1, -0.2, -0.5] },
    shoulderInset: 0.012,
  },
  "pocket-tilt": { right: { hand: [-0.212, 0.31, 0.02], pole: [-1, 0, -0.6] }, left: { hand: [0.152, 0.34, 0.075], pole: [1, 0.2, -0.6], tucked: true } },
  suitcase: { right: { hand: [-0.255, 0.31, 0.04], pole: [-1, 0.3, -0.5] }, left: { hand: [0.205, 0.31, 0.075], pole: [1, 0.1, -0.7] } },
  "red-star": { right: { hand: [-0.04, 0.455, 0.205], pole: [-1, -0.9, -0.2] }, left: REST_L },
};

const UPPER = 0.15;
const FORE = 0.14;
const DOWN = new THREE.Vector3(0, -1, 0);

const solveArm = (shoulder: THREE.Vector3, pose: ArmPose) => {
  const target = new THREE.Vector3(...pose.hand);
  const toT = target.clone().sub(shoulder);
  const d = THREE.MathUtils.clamp(toT.length(), Math.abs(UPPER - FORE) + 1e-3, UPPER + FORE - 1e-3);
  const u = toT.normalize();
  const pole = new THREE.Vector3(...pose.pole).normalize();
  const v = pole.sub(u.clone().multiplyScalar(pole.dot(u))).normalize();
  const cosA = (UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const elbow = shoulder.clone().addScaledVector(u, UPPER * cosA).addScaledVector(v, UPPER * sinA);
  const hand = shoulder.clone().addScaledVector(u, d);
  const qUpper = new THREE.Quaternion().setFromUnitVectors(DOWN, elbow.clone().sub(shoulder).normalize());
  const foreDir = hand.clone().sub(elbow).normalize();
  const qFore = new THREE.Quaternion().setFromUnitVectors(DOWN, foreDir);
  return { elbow, hand, qUpper, qFore, foreDir };
};

const Arm: React.FC<{ side: -1 | 1; pose: Pose; mats: ReturnType<typeof figureMaterials> }> = ({ side, pose, mats }) => {
  const armPose = side === -1 ? pose.right : pose.left;
  const shoulder = useMemo(() => new THREE.Vector3(side * (0.158 - (pose.shoulderInset ?? 0)), 0.548, 0), [side, pose]);
  const s = useMemo(() => solveArm(shoulder, armPose), [shoulder, armPose]);
  const upperMid = shoulder.clone().lerp(s.elbow, 0.5);
  const foreMid = s.elbow.clone().lerp(s.hand, 0.45);
  const cuffPos = s.elbow.clone().lerp(s.hand, 0.86);
  return (
    <group>
      <mesh position={shoulder} material={mats.coat} castShadow>
        <sphereGeometry args={[0.058, 24, 16]} />
      </mesh>
      <mesh position={upperMid} quaternion={s.qUpper} material={mats.coat} castShadow>
        <capsuleGeometry args={[0.054, UPPER, 8, 20]} />
      </mesh>
      <mesh position={foreMid} quaternion={s.qFore} material={mats.coat} castShadow>
        <capsuleGeometry args={[0.051, FORE * 0.82, 8, 20]} />
      </mesh>
      {/* bell cuff */}
      <mesh position={cuffPos} quaternion={s.qFore} material={mats.coat} castShadow>
        <cylinderGeometry args={[0.055, 0.06, 0.035, 24, 1, true]} />
      </mesh>
      {!armPose.tucked ? (
        <mesh position={s.hand.clone().addScaledVector(s.foreDir, 0.012)} quaternion={s.qFore} scale={[0.85, 1, 0.72]} material={mats.skinPlain} castShadow>
          <sphereGeometry args={[0.036, 20, 14]} />
        </mesh>
      ) : null}
    </group>
  );
};

/** Head-space position of a face feature from the painted layout (angles on the head sphere). */
const facePoint = (dTheta: number, dPhi: number, out = 1) =>
  sphereDir(Math.PI / 2 + dTheta, Math.PI / 2 + dPhi).multiplyScalar(HEAD.r * out);

export interface FigureProps {
  edition: Edition;
  /** Seconds, drives the glitter shimmer and subtle idle breathing. */
  t?: number;
  /** 0..1 strength of glowing accessories (and their point lights). */
  glow?: number;
}

export const ProceduralFigure: React.FC<FigureProps> = ({ edition, t = 0, glow = 1 }) => {
  const mats = figureMaterials(edition);
  const pose = POSES[edition.pose];
  const long = edition.outfit.coatLength === "long";
  const [pitch, yaw, roll] = edition.expression.head;
  const breathe = Math.sin(t * 1.6) * 0.004;

  if (mats.panel) {
    // deterministic glitter shimmer
    mats.panel.emissiveIntensity = 0.22 + 0.12 * (0.5 + 0.5 * Math.sin(t * 5.3));
    const map = mats.panel.map;
    if (map) map.offset.set(0, (t * 0.02) % 1);
  }

  const pocketY = long ? 0.3 : 0.33;
  const nose = facePoint(FACE_LAYOUT.noseDy - 0.03, 0, 0.995);

  return (
    <group>
      {/* shoes */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * 0.066, 0.036, 0.025]} scale={[0.056, 0.04, 0.088]} material={mats.shoes} castShadow receiveShadow>
          <sphereGeometry args={[1, 24, 16]} />
        </mesh>
      ))}
      {/* legs */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * 0.064, 0.13, 0]} material={mats.trousers} castShadow>
          <cylinderGeometry args={[0.046, 0.05, 0.2, 20]} />
        </mesh>
      ))}

      <group position={[0, breathe, 0]}>
        <mesh geometry={sweaterGeometry()} material={mats.sweater} castShadow />
        <mesh geometry={coatGeometry(long)} material={mats.coat} castShadow receiveShadow />
        <mesh geometry={lapelGeometry(long)} material={mats.coat} castShadow />
        <mesh geometry={collarGeometry()} material={mats.coat} castShadow />
        {mats.panel ? <mesh geometry={coatPanelGeometry(long)} material={mats.panel} castShadow /> : null}

        {/* shirt collar points */}
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * 0.042, 0.622, 0.052]} rotation={[0.55, sx * 0.5, sx * -0.55]} material={mats.shirt} castShadow>
            <coneGeometry args={[0.026, 0.06, 3, 1]} />
          </mesh>
        ))}

        {/* buttons on the figure's left edge */}
        {[0.27, 0.37, 0.47].map((y) => {
          const p = coatPoint(y, 0.3, long, 1.03);
          return (
            <mesh key={y} position={p} material={mats.buttons} castShadow>
              <sphereGeometry args={[0.0105, 16, 10]} />
            </mesh>
          );
        })}

        {/* pocket flaps */}
        {[-1, 1].map((sx) => {
          const p = coatPoint(pocketY, sx * 0.95, long, 1.035);
          return (
            <mesh key={sx} position={p} rotation={[0.08, sx * 0.95 * 0.9, 0]} material={mats.coat} castShadow>
              <boxGeometry args={[0.105, 0.032, 0.012]} />
            </mesh>
          );
        })}

        {mats.scarf ? (
          <group>
            <mesh position={[0, 0.625, 0.004]} rotation={[Math.PI / 2 + 0.12, 0, 0]} scale={[1, 0.84, 1]} material={mats.scarf} castShadow>
              <torusGeometry args={[0.098, 0.036, 16, 40]} />
            </mesh>
            <mesh position={[0.07, 0.5, 0.118]} rotation={[0.12, 0.25, -0.12]} material={mats.scarf} castShadow>
              <boxGeometry args={[0.062, 0.2, 0.026, 1, 4, 1]} />
            </mesh>
          </group>
        ) : null}

        <Arm side={-1} pose={pose} mats={mats} />
        <Arm side={1} pose={pose} mats={mats} />

        {/* neck */}
        <mesh position={[0, 0.655, 0]} material={mats.skinPlain}>
          <cylinderGeometry args={[0.044, 0.05, 0.08, 20]} />
        </mesh>

        {/* head */}
        <group position={[0, HEAD.y, 0]} rotation={[pitch, yaw, roll]}>
          <group scale={HEAD.scale as unknown as V3}>
            <mesh geometry={headGeometry()} material={mats.skin} castShadow receiveShadow />
            <mesh position={nose} scale={[0.017, 0.014, 0.012]} material={mats.skinPlain}>
              <sphereGeometry args={[1, 16, 12]} />
            </mesh>
            {[-1, 1].map((sx) => (
              <mesh key={sx} position={[sx * HEAD.r * 0.98, -0.02, -0.01]} scale={[0.02, 0.042, 0.032]} material={mats.skinPlain}>
                <sphereGeometry args={[1, 14, 10]} />
              </mesh>
            ))}
            <mesh geometry={hairCapGeometry()} material={mats.hair} castShadow />
            <mesh geometry={hairLocksGeometry()} material={mats.hair} castShadow />
          </group>
        </group>

        <EditionProps edition={edition} t={t} glow={glow} long={long} />
      </group>
    </group>
  );
};

/** Edition-specific held items and pins. Positions are in figure space, matched to the IK hand targets. */
const EditionProps: React.FC<{ edition: Edition; t: number; glow: number; long: boolean }> = ({ edition, t, glow, long }) => {
  switch (edition.id) {
    case "dreamer":
      return (
        <group position={[-0.07, 0.565 + Math.sin(t * 2) * 0.006, 0.23]} rotation={[0.1, 0.25, Math.sin(t * 0.8) * 0.08]}>
          <BlueStar glow={glow} />
        </group>
      );
    case "shy":
      return (
        <group>
          <group position={[0, 0.375, 0.205]} rotation={[-0.25, 0, 0.12]}>
            <FoldedLetter />
          </group>
          <group position={coatPoint(0.52, 0.42, long, 1.05)} rotation={[0, 0.4, 0.15]}>
            <PinkHeart scale={0.022} />
          </group>
        </group>
      );
    case "rebel":
      return (
        <group position={coatPoint(0.54, -0.62, long, 1.05)} rotation={[-0.2, -0.55, 0.2]}>
          <SilverStarPin />
        </group>
      );
    case "wanderer":
      return (
        <group position={[-0.265, 0.17, 0.045]} rotation={[0, -0.35, 0.03]}>
          <Suitcase />
        </group>
      );
    case "midnight":
      return (
        <group>
          <group position={[-0.02, 0.52, 0.245]} rotation={[0.05, 0, Math.sin(t * 0.7) * 0.06]}>
            <GlowingRedStar glow={glow} />
          </group>
          {[
            [0.24, 0.6],
            [0.42, 1.4],
            [0.33, 2.3],
            [0.5, -2.6],
            [0.2, -1.7],
            [0.46, 0.95],
            [0.15, 2.9],
          ].map(([y, phi], i) => {
            const p = coatPoint(y, phi, long, 1.04);
            return (
              <group key={i} position={p} rotation={[0, phi, i]}>
                <GoldStar scale={0.011 + (i % 3) * 0.003} />
              </group>
            );
          })}
        </group>
      );
  }
};
