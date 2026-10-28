import React, { useMemo } from "react";
import * as THREE from "three";
import { rng } from "../animations/timing";
import { heartGeometry, starGeometry } from "../characters/figureGeometry";
import { gold, silver, vinyl } from "../characters/materials";
import { cached, makeCanvas, toTexture } from "./canvasTextures";

/** Studio floor that fades to transparent, so the CSS backdrop shows through at the horizon. */
export const Floor: React.FC<{ color?: string; radius?: number; y?: number; opacity?: number }> = ({ color = "#1c2030", radius = 9, y = 0, opacity = 1 }) => {
  const mat = useMemo(() => {
    const alpha = cached("floor-alpha", () => {
      const { canvas, ctx } = makeCanvas(512, 512);
      const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
      g.addColorStop(0, "#fff");
      g.addColorStop(0.35, "#bbb");
      g.addColorStop(0.75, "#222");
      g.addColorStop(1, "#000");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 512);
      return toTexture(canvas, false);
    });
    return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.0, alphaMap: alpha, transparent: true, depthWrite: false });
  }, [color]);
  mat.opacity = opacity;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} material={mat} receiveShadow>
      <circleGeometry args={[radius, 96]} />
    </mesh>
  );
};

/** Round display platform with a gold inlay ring — the stage each box floats above. */
export const Platform: React.FC<{ radius?: number; height?: number; color?: string; trim?: "gold" | "silver" }> = ({ radius = 1.05, height = 0.14, color = "#ECE6D9", trim = "gold" }) => {
  const geo = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0, 0),
          new THREE.Vector2(radius * 0.97, 0),
          new THREE.Vector2(radius, 0.012),
          new THREE.Vector2(radius, height - 0.02),
          new THREE.Vector2(radius - 0.02, height),
          new THREE.Vector2(0, height),
        ],
        128,
      ),
    [radius, height],
  );
  return (
    <group>
      <mesh geometry={geo} material={vinyl(`platform-${color}`, color, { roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2, bumpScale: 0.05 })} castShadow receiveShadow />
      <mesh position={[0, height + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} material={trim === "gold" ? gold() : silver()}>
        <ringGeometry args={[radius * 0.86, radius * 0.875, 128]} />
      </mesh>
      <mesh position={[0, height * 0.5, 0]} rotation={[Math.PI / 2, 0, 0]} material={trim === "gold" ? gold() : silver()}>
        <torusGeometry args={[radius + 0.002, 0.006, 8, 128]} />
      </mesh>
    </group>
  );
};

/** Product pedestal (cylinder with a soft bevel and a metallic band). Top at y = height. */
export const Pedestal: React.FC<{ height?: number; radius?: number; color: string; band?: "gold" | "silver" }> = ({ height = 0.42, radius = 0.42, color, band = "gold" }) => {
  const geo = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0, 0),
          new THREE.Vector2(radius + 0.03, 0),
          new THREE.Vector2(radius + 0.03, 0.05),
          new THREE.Vector2(radius, 0.07),
          new THREE.Vector2(radius, height - 0.03),
          new THREE.Vector2(radius - 0.025, height),
          new THREE.Vector2(0, height),
        ],
        96,
      ),
    [height, radius],
  );
  return (
    <group>
      <mesh geometry={geo} material={vinyl(`pedestal-${color}`, color, { roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.25, bumpScale: 0.05 })} castShadow receiveShadow />
      <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]} material={band === "gold" ? gold() : silver()}>
        <torusGeometry args={[radius + 0.004, 0.007, 8, 96]} />
      </mesh>
    </group>
  );
};

/** Volumetric-looking spotlight cone (additive, fades along its length and toward its edges). */
export const SpotCone: React.FC<{ position: [number, number, number]; length: number; radius: number; color: string; opacity: number }> = ({
  position,
  length,
  radius,
  color,
  opacity,
}) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
        vertexShader: /* glsl */ `
          varying float vY; varying vec3 vN; varying vec3 vView;
          void main(){
            vY = uv.y;
            vec4 mv = modelViewMatrix * vec4(position,1.0);
            vN = normalize(normalMatrix * normal);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform float uOpacity;
          varying float vY; varying vec3 vN; varying vec3 vView;
          void main(){
            float edge = pow(abs(dot(vN, vView)), 2.0);
            float along = smoothstep(0.0, 0.25, vY) * (1.0 - smoothstep(0.85, 1.0, vY));
            gl_FragColor = vec4(uColor, edge * along * uOpacity * 0.35);
          }`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    [color],
  );
  mat.uniforms.uOpacity.value = opacity;
  return (
    <mesh position={[position[0], position[1] - length / 2, position[2]]} material={mat}>
      <cylinderGeometry args={[0.02, radius, length, 64, 1, true]} />
    </mesh>
  );
};

const paperTexture = (color: string) =>
  cached(`paper-${color}`, () => {
    const { canvas, ctx } = makeCanvas(256, 256);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 256, 256);
    const r = rng(5);
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
      ctx.fillRect(r() * 256, r() * 256, 1 + r() * 4, 1);
    }
    const t = toTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });

export const paperMaterial = (color: string) =>
  new THREE.MeshStandardMaterial({ map: paperTexture(color), roughness: 0.95, side: THREE.DoubleSide });

/** Folded paper heart (two halves with a crease) — the transition into The Shy One. */
export const PaperHeart: React.FC<{ color?: string }> = ({ color = "#E9B4BE" }) => {
  const mat = useMemo(() => paperMaterial(color), [color]);
  return (
    <group>
      <mesh geometry={heartGeometry(0.04, 0.02)} material={mat} rotation={[0, -0.12, 0]} castShadow />
    </group>
  );
};

/** Flat paper cloud cut-out. */
export const PaperCloud: React.FC<{ color?: string }> = ({ color = "#F3ECDD" }) => {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-1, 0);
    s.absarc(-0.55, 0.18, 0.45, Math.PI, Math.PI * 0.25, true);
    s.absarc(0.1, 0.42, 0.55, Math.PI * 0.9, Math.PI * 0.1, true);
    s.absarc(0.68, 0.15, 0.38, Math.PI * 0.7, 0, true);
    s.lineTo(1.06, 0);
    s.lineTo(-1, 0);
    return new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 });
  }, []);
  const mat = useMemo(() => paperMaterial(color), [color]);
  return <mesh geometry={geo} material={mat} castShadow />;
};

/** Layered paper hills for the storybook landscape (one cut-out layer). */
export const PaperHills: React.FC<{ width: number; height: number; seed: number; color: string; trees?: number }> = ({ width, height, seed, color, trees = 0 }) => {
  const { geo, treeList } = useMemo(() => {
    const r = rng(seed);
    const s = new THREE.Shape();
    s.moveTo(-width / 2, 0);
    const n = 40;
    const ph = r() * 6;
    for (let i = 0; i <= n; i++) {
      const x = -width / 2 + (width * i) / n;
      const y = height * (0.55 + 0.3 * Math.sin(x * 1.3 + ph) + 0.15 * Math.sin(x * 3.1 + ph * 2));
      s.lineTo(x, y);
    }
    s.lineTo(width / 2, 0);
    s.lineTo(-width / 2, 0);
    const list = Array.from({ length: trees }, () => {
      const x = -width / 2 + r() * width;
      const y = height * (0.55 + 0.3 * Math.sin(x * 1.3 + ph) + 0.15 * Math.sin(x * 3.1 + ph * 2));
      return { x, y, s: 0.12 + r() * 0.12 };
    });
    return { geo: new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }), treeList: list };
  }, [width, height, seed, trees]);
  const mat = useMemo(() => paperMaterial(color), [color]);
  const treeMat = useMemo(() => paperMaterial(new THREE.Color(color).multiplyScalar(0.7).getStyle()), [color]);
  return (
    <group>
      <mesh geometry={geo} material={mat} castShadow receiveShadow />
      {treeList.map((tr, i) => (
        <mesh key={i} position={[tr.x, tr.y + tr.s * 0.6, 0.01]} material={treeMat} castShadow>
          <coneGeometry args={[tr.s * 0.4, tr.s * 1.4, 3]} />
        </mesh>
      ))}
    </group>
  );
};

/** Silver star burst: N stars thrown out from a point with drag, tumbling (pure function of `t`). */
export const StarBurst: React.FC<{ t: number; count?: number; seed?: number; origin?: [number, number, number]; power?: number; metal?: "silver" | "gold" }> = ({
  t,
  count = 46,
  seed = 3,
  origin = [0, 1, 0],
  power = 2.6,
  metal = "silver",
}) => {
  const stars = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, () => {
      const th = r() * Math.PI * 2;
      const ph = Math.acos(2 * r() - 1);
      return { dir: new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph) * 0.8 + 0.2, Math.sin(ph) * Math.sin(th)), speed: 0.6 + r() * 0.8, spin: (r() - 0.5) * 10, size: 0.025 + r() * 0.05 };
    });
  }, [count, seed]);
  if (t <= 0) return null;
  const geo = starGeometry(1, 0.45, 0.3, 0.12);
  const mat = metal === "silver" ? silver() : gold();
  return (
    <group position={origin}>
      {stars.map((s, i) => {
        // exponential drag: distance saturates; gentle gravity afterwards
        const dist = (power * s.speed * (1 - Math.exp(-3.2 * t))) / 3.2;
        const p = s.dir.clone().multiplyScalar(dist);
        p.y -= 0.12 * t * t;
        const scale = s.size * Math.min(1, t * 8) * (t > 2.4 ? Math.max(0, 1 - (t - 2.4) * 2) : 1);
        return <mesh key={i} geometry={geo} material={mat} position={p} rotation={[s.spin * t * 0.3, s.spin * t, 0]} scale={scale} castShadow />;
      })}
    </group>
  );
};
