import { useGLTF } from "@react-three/drei";
import React, { useMemo } from "react";
import { staticFile } from "remotion";
import * as THREE from "three";
import { getFigureAsset, type FigureAsset } from "./assets";
import { FigureBase } from "./Bases";
import type { Edition } from "./figures";
import { ProceduralFigure } from "./ProceduralFigure";
import { BlueStar, GlowingRedStar } from "./Accessories";

/** Every figure — generated or procedural — is normalised to this height (feet at y = 0) so boxes and bases fit. */
export const FIGURE_HEIGHT = 1.1;

/**
 * Tripo exports face +X; scripts/convert turns the GLBs to face +Z (glTF front) when converting, so no global
 * yaw is needed here. Per-edition overrides (if a generation ever comes out rotated) go in GLB_FIXES.
 */
const TRIPO_FORWARD_YAW = 0;
const GLB_FIXES: Partial<Record<Edition["id"], { yaw?: number; scale?: number }>> = {};

const GlbFigure: React.FC<{ asset: FigureAsset; edition: Edition }> = ({ asset, edition }) => {
  const gltf = useGLTF(staticFile(asset.glb), staticFile("draco/"));
  const fix = GLB_FIXES[edition.id] ?? {};
  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const src = mesh.material as THREE.MeshStandardMaterial;
      if (!src?.isMeshStandardMaterial) return;
      // upgrade to physical for the vinyl clearcoat; the secret edition gets a pearlescent sheen
      const phys = new THREE.MeshPhysicalMaterial();
      THREE.MeshStandardMaterial.prototype.copy.call(phys, src);
      phys.clearcoat = edition.secret ? 0.6 : 0.2;
      phys.clearcoatRoughness = edition.secret ? 0.2 : 0.5;
      phys.sheen = 0.3;
      phys.sheenRoughness = 0.6;
      if (edition.secret) {
        phys.iridescence = 0.35;
        phys.iridescenceIOR = 1.6;
      }
      phys.envMapIntensity = 1;
      mesh.material = phys;
    });
    return clone;
  }, [gltf, edition.secret]);

  const { min, max } = asset.bounds;
  const height = max[1] - min[1];
  const s = (FIGURE_HEIGHT / height) * (fix.scale ?? 1);
  const cx = (min[0] + max[0]) / 2;
  const cz = (min[2] + max[2]) / 2;
  return (
    <group rotation={[0, TRIPO_FORWARD_YAW + (fix.yaw ?? 0), 0]} scale={s}>
      <primitive object={scene} position={[-cx, -min[1], -cz]} />
    </group>
  );
};

export interface FigureProps {
  edition: Edition;
  t?: number;
  glow?: number;
  withBase?: boolean;
  /** Force the procedural stand-in even when a GLB exists (A/B comparisons). */
  procedural?: boolean;
}

export const Figure: React.FC<FigureProps> = ({ edition, t = 0, glow = 1, withBase = true, procedural = false }) => {
  const asset = procedural ? null : getFigureAsset(edition.id);
  return (
    <group>
      {withBase ? <FigureBase edition={edition} t={t} /> : null}
      {asset ? (
        <>
          <GlbFigure asset={asset} edition={edition} />
          {/* a shared master mesh carries no edition props — float the signature item beside it */}
          {asset.shared && edition.id === "dreamer" ? (
            <group position={[-0.32, 0.62 + Math.sin(t * 2) * 0.02, 0.15]}>
              <BlueStar glow={glow} />
            </group>
          ) : null}
          {asset.shared && edition.id === "midnight" ? (
            <group position={[0, 0.5, 0.3]}>
              <GlowingRedStar glow={glow} />
            </group>
          ) : null}
          {/* the generated meshes have the star baked in; a light makes it glow */}
          {!asset.shared && edition.id === "midnight" ? <pointLight position={[0, 0.5, 0.3]} color="#FF2E48" intensity={1.6 * glow} distance={1.6} decay={2} /> : null}
          {!asset.shared && edition.id === "dreamer" ? <pointLight position={[-0.1, 0.55, 0.3]} color="#9FD0FF" intensity={0.4 * glow} distance={1} decay={2} /> : null}
        </>
      ) : (
        <ProceduralFigure edition={edition} t={t} glow={glow} />
      )}
    </group>
  );
};
