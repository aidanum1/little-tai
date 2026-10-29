import { useGLTF } from "@react-three/drei";
import React, { useLayoutEffect, useMemo } from "react";
import { staticFile } from "remotion";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { GameAsset } from "./assets";
import { FIGURE_HEIGHT } from "./Figure";

/**
 * A rigged, animated figure driven purely by the frame: every render sets each clip's time and weight and
 * evaluates the mixer with a zero delta, so any frame renders identically on any worker, in any order.
 */

export interface ClipSample {
  name: string;
  /** Seconds into the clip (already wrapped or clamped by the caller). */
  time: number;
  weight: number;
}

export const RiggedFigure: React.FC<{ asset: GameAsset; clips: ClipSample[]; yaw?: number; height?: number }> = ({ asset, clips, yaw = 0, height = FIGURE_HEIGHT }) => {
  const gltf = useGLTF(staticFile(asset.glb), staticFile("draco/"));

  const rig = useMemo(() => {
    const scene = cloneSkinned(gltf.scene) as THREE.Group;
    scene.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // skinned bounds are computed in bind pose — animated limbs would be culled wrongly
      mesh.frustumCulled = false;
      const src = mesh.material as THREE.MeshStandardMaterial;
      if (!src?.isMeshStandardMaterial) return;
      const phys = new THREE.MeshPhysicalMaterial();
      THREE.MeshStandardMaterial.prototype.copy.call(phys, src);
      phys.clearcoat = 0.2;
      phys.clearcoatRoughness = 0.5;
      phys.sheen = 0.3;
      phys.sheenRoughness = 0.6;
      mesh.material = phys;
    });
    const mixer = new THREE.AnimationMixer(scene);
    const actions = new Map(
      gltf.animations.map((clip) => {
        const action = mixer.clipAction(clip);
        action.play();
        action.setEffectiveWeight(0);
        return [clip.name, action] as const;
      }),
    );

    // normalise on the first idle frame (feet on y = 0, centred, FIGURE_HEIGHT tall)
    const idle = actions.get("idle") ?? actions.values().next().value;
    if (idle) {
      idle.setEffectiveWeight(1);
      idle.time = 0;
    }
    mixer.update(0);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene, true);
    return { scene, mixer, actions, box };
  }, [gltf]);

  useLayoutEffect(() => {
    const total = clips.reduce((s, c) => s + (rig.actions.has(c.name) ? c.weight : 0), 0) || 1;
    for (const [name, action] of rig.actions) {
      const c = clips.find((x) => x.name === name);
      action.setEffectiveWeight(c ? c.weight / total : 0);
      action.time = c ? Math.max(0, Math.min(c.time, action.getClip().duration)) : 0;
    }
    rig.mixer.update(0);
  });

  const { min, max } = rig.box;
  const s = height / (max.y - min.y);
  const cx = (min.x + max.x) / 2;
  const cz = (min.z + max.z) / 2;
  return (
    <group rotation={[0, yaw, 0]} scale={s}>
      <primitive object={rig.scene} position={[-cx, -min.y, -cz]} />
    </group>
  );
};

/** Clip durations from the asset manifest (seconds). */
export const clipDurations = (asset: GameAsset) => Object.fromEntries(asset.animations.map((a) => [a.name, a.duration]));
