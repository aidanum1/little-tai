import React, { useMemo } from "react";
import * as THREE from "three";
import { rng } from "../animations/timing";
import { flareTexture, glowTexture } from "./canvasTextures";

/**
 * Deterministic particle field. Positions are recomputed from `t` every frame by a pure function,
 * so any frame renders identically in isolation — no simulation state, no requestAnimationFrame.
 */

export interface ParticleState {
  x: number;
  y: number;
  z: number;
  size: number;
  alpha: number;
}

export type ParticleFn = (i: number, r: number[], t: number) => ParticleState;

const vertex = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  attribute float aPhase;
  uniform float uTime;
  uniform float uScale;
  uniform float uTwinkle;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
    float tw = 1.0 - uTwinkle + uTwinkle * (0.5 + 0.5 * sin(uTime * (2.0 + aPhase * 3.0) + aPhase * 6.2831));
    vColor = aColor;
    vAlpha = aAlpha * tw;
  }
`;

const fragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  uniform float uCross;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float core = pow(smoothstep(0.5, 0.0, d), 2.2);
    float cross = (max(0.0, 1.0 - abs(c.x) * 16.0) * smoothstep(0.5, 0.0, abs(c.y))
                 + max(0.0, 1.0 - abs(c.y) * 16.0) * smoothstep(0.5, 0.0, abs(c.x))) * uCross;
    float a = (core + cross * 0.6) * vAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vColor * (1.0 + core * 0.6), a);
  }
`;

export const Particles: React.FC<{
  count: number;
  seed: number;
  t: number;
  fn: ParticleFn;
  colors: string[];
  /** On-screen size scale (pixels at 1 unit distance). */
  scale?: number;
  twinkle?: number;
  cross?: number;
  opacity?: number;
}> = ({ count, seed, t, fn, colors, scale = 220, twinkle = 0.6, cross = 0.4, opacity = 1 }) => {
  const randoms = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, () => Array.from({ length: 8 }, r));
  }, [count, seed]);

  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(count), 1));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(count), 1));
    const col = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    randoms.forEach((r, i) => {
      const c = new THREE.Color(colors[Math.floor(r[7] * colors.length)]);
      col.set([c.r, c.g, c.b], i * 3);
      phase[i] = r[6];
    });
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uTime: { value: 0 }, uScale: { value: scale }, uTwinkle: { value: twinkle }, uCross: { value: cross } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: g, material: m };
  }, [count, randoms, colors, scale, twinkle, cross]);

  // recompute every frame from t (pure)
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const size = geometry.attributes.aSize as THREE.BufferAttribute;
  const alpha = geometry.attributes.aAlpha as THREE.BufferAttribute;
  for (let i = 0; i < count; i++) {
    const p = fn(i, randoms[i], t);
    pos.setXYZ(i, p.x, p.y, p.z);
    size.setX(i, p.size);
    alpha.setX(i, Math.max(0, p.alpha) * opacity);
  }
  pos.needsUpdate = true;
  size.needsUpdate = true;
  alpha.needsUpdate = true;
  material.uniforms.uTime.value = t;

  return <points geometry={geometry} material={material} frustumCulled={false} />;
};

/** Additive glow sprite (always faces the camera). */
export const Glow: React.FC<{ position?: [number, number, number]; color: string; size: number; opacity?: number; flare?: boolean }> = ({
  position = [0, 0, 0],
  color,
  size,
  opacity = 1,
  flare = false,
}) => {
  const mat = useMemo(
    () => new THREE.SpriteMaterial({ map: flare ? flareTexture() : glowTexture(), color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }),
    [color, flare],
  );
  mat.opacity = opacity;
  return <sprite position={position} scale={[size, size, 1]} material={mat} />;
};
