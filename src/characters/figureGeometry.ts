import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng, smoothstep } from "../animations/timing";

/**
 * Procedural geometry for the "little TAI" maquette figure.
 * Units: figure ≈ 1.10 tall, feet at y = 0, facing +Z.
 */

export const HEAD = { y: 0.84, r: 0.235, scale: [1, 0.94, 0.93] as const };

const memo = new Map<string, THREE.BufferGeometry>();
const once = <T extends THREE.BufferGeometry>(key: string, make: () => T): T => {
  let g = memo.get(key) as T | undefined;
  if (!g) {
    g = make();
    memo.set(key, g);
  }
  return g;
};

/** Sphere direction in three.js SphereGeometry convention (u=φ/2π, v=θ/π). */
export const sphereDir = (theta: number, phi: number) =>
  new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));

const FRONT = Math.PI / 2;

/** Head: sphere with a softly tapered jaw and cheeks — rounder than a ball, never a generic chibi orb. */
export const headGeometry = () =>
  once("head", () => {
    const g = new THREE.SphereGeometry(HEAD.r, 96, 64);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const ny = y / HEAD.r;
      if (ny < 0) {
        const t = Math.pow(-ny, 1.6);
        const k = 1 - 0.16 * t;
        // chin pulls slightly forward
        p.setXYZ(i, x * k, y * (1 - 0.04 * t), z * (1 - 0.1 * t) + 0.012 * t * Math.max(0, z / HEAD.r));
      }
      // full cheeks
      const cheek = Math.exp(-Math.pow((ny + 0.35) / 0.3, 2)) * Math.max(0, z / HEAD.r);
      p.setX(i, p.getX(i) * (1 + 0.035 * cheek));
    }
    g.computeVertexNormals();
    return g;
  });

/** Hair cap: covers the skull, hairline high at the front (the fringe locks cover the forehead), lower at the nape. */
export const hairCapGeometry = () =>
  once("hair-cap", () => {
    const segU = 96;
    const segV = 28;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j <= segV; j++) {
      for (let i = 0; i <= segU; i++) {
        const phi = (i / segU) * Math.PI * 2;
        let d = Math.abs(phi - FRONT);
        if (d > Math.PI) d = Math.PI * 2 - d;
        const thetaMax = Math.PI * (0.3 + 0.38 * smoothstep(0.2, Math.PI, d));
        const t = j / segV;
        const theta = t * thetaMax;
        const rad = HEAD.r * (1.04 + 0.045 * (1 - t) * (1 - t));
        const v = sphereDir(theta, phi).multiplyScalar(rad);
        pos.push(v.x, v.y, v.z);
      }
    }
    for (let j = 0; j < segV; j++) {
      for (let i = 0; i < segU; i++) {
        const a = j * (segU + 1) + i;
        const b = a + segU + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });

interface LockSpec {
  phi: number;
  theta0: number;
  theta1: number;
  width: number;
  thick: number;
  curl?: number;
  flare?: number;
  bulge?: number;
  lift?: number;
}

/** A single sculpted hair lock: a tapered, slightly flattened petal that hugs the skull and flicks at the tip. */
const lockGeometry = (s: LockSpec) => {
  const segS = 16;
  const segA = 10;
  const pos: number[] = [];
  const idx: number[] = [];
  const centre = (t: number) => {
    const theta = s.theta0 + (s.theta1 - s.theta0) * t;
    const phi = s.phi + (s.curl ?? 0) * t * t;
    const th = s.thick * (1 - Math.pow(t, 3)) * (0.7 + 0.3 * Math.sin(Math.PI * t));
    const rad = HEAD.r * (1.03 + (s.bulge ?? 0.02) * Math.sin(Math.PI * t) + (s.flare ?? 0) * Math.pow(t, 3) + (s.lift ?? 0)) + th;
    return { p: sphereDir(theta, phi).multiplyScalar(rad), n: sphereDir(theta, phi), th };
  };
  for (let i = 0; i <= segS; i++) {
    const t = i / segS;
    const { p, n, th } = centre(t);
    const ahead = centre(Math.min(1, t + 0.01)).p;
    const behind = centre(Math.max(0, t - 0.01)).p;
    const tan = ahead.sub(behind).normalize();
    const bin = new THREE.Vector3().crossVectors(tan, n).normalize();
    const w = s.width * (1 - Math.pow(t, 2.2)) * (0.72 + 0.28 * Math.sin(Math.PI * Math.min(1, t * 1.2)));
    for (let k = 0; k <= segA; k++) {
      const a = (k / segA) * Math.PI * 2;
      const v = p
        .clone()
        .addScaledVector(bin, Math.cos(a) * w)
        .addScaledVector(n, Math.sin(a) * th);
      pos.push(v.x, v.y, v.z);
    }
  }
  for (let i = 0; i < segS; i++) {
    for (let k = 0; k < segA; k++) {
      const a = i * (segA + 1) + k;
      const b = a + segA + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

/**
 * Tai's signature hair: a piecey black fringe falling over the brows, layered locks over the ears that flick out
 * at the jaw, a soft mullet-ish nape and volume at the crown.
 */
export const hairLocksGeometry = () =>
  once("hair-locks", () => {
    const r = rng(1028);
    const locks: LockSpec[] = [];
    const P = Math.PI;
    // fringe
    const fringeEnds = [0.468, 0.488, 0.462, 0.492, 0.47, 0.452, 0.482, 0.495, 0.465, 0.486, 0.474, 0.46, 0.49];
    fringeEnds.forEach((end, i) => {
      const u = i / (fringeEnds.length - 1) - 0.5;
      locks.push({
        phi: FRONT + u * 2.0,
        theta0: 0.12 * P,
        theta1: end * P + Math.abs(u) * 0.06 * P,
        width: 0.034 + r() * 0.008,
        thick: 0.017 + r() * 0.004,
        curl: u * 0.22 + (r() - 0.5) * 0.06,
        flare: 0.03,
        bulge: 0.03,
      });
    });
    // side layers over the ears
    for (const side of [-1, 1]) {
      [1.08, 1.3, 1.52, 1.75, 1.98].forEach((d, i) => {
        locks.push({
          phi: FRONT + side * d,
          theta0: 0.16 * P,
          theta1: (0.6 + i * 0.022 + r() * 0.02) * P,
          width: 0.042 + r() * 0.008,
          thick: 0.02,
          curl: side * (0.06 + r() * 0.05),
          flare: 0.13,
          bulge: 0.045,
        });
      });
    }
    // nape / back
    for (let i = 0; i < 9; i++) {
      const d = 2.2 + (i / 8) * (2 * P - 4.4);
      locks.push({
        phi: FRONT + d,
        theta0: 0.14 * P,
        theta1: (0.72 + r() * 0.06) * P,
        width: 0.05 + r() * 0.01,
        thick: 0.022,
        curl: (r() - 0.5) * 0.12,
        flare: 0.1,
        bulge: 0.05,
      });
    }
    // crown volume
    for (let i = 0; i < 8; i++) {
      locks.push({
        phi: FRONT + (i / 8) * 2 * P + 0.3,
        theta0: 0.01 * P,
        theta1: (0.3 + r() * 0.06) * P,
        width: 0.055,
        thick: 0.022,
        curl: 0.25,
        bulge: 0.06,
        lift: 0.01,
      });
    }
    return mergeGeometries(locks.map(lockGeometry), false)!;
  });

export interface CoatShape {
  long: boolean;
}

const coatProfile = (long: boolean): [number, number][] =>
  long
    ? [
        [0.226, 0.07],
        [0.232, 0.1],
        [0.222, 0.2],
        [0.205, 0.3],
        [0.191, 0.4],
        [0.183, 0.48],
        [0.178, 0.53],
        [0.168, 0.575],
        [0.14, 0.605],
        [0.1, 0.626],
        [0.07, 0.64],
      ]
    : [
        [0.207, 0.165],
        [0.215, 0.19],
        [0.206, 0.26],
        [0.193, 0.36],
        [0.184, 0.46],
        [0.178, 0.53],
        [0.168, 0.575],
        [0.14, 0.605],
        [0.1, 0.626],
        [0.07, 0.64],
      ];

export const COAT_DEPTH = 0.76;

/** Half-angle of the coat's front opening at height y: nearly closed at the hem, opening into a V at the collar. */
export const coatGap = (y: number) => 0.16 + 0.12 * smoothstep(0.2, 0.45, y) + 0.62 * smoothstep(0.45, 0.64, y);

export const coatRadiusAt = (y: number, long: boolean) => {
  const prof = coatProfile(long);
  for (let i = 0; i < prof.length - 1; i++) {
    const [r0, y0] = prof[i];
    const [r1, y1] = prof[i + 1];
    if (y >= y0 && y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return prof[prof.length - 1][0];
};

/** Point on the coat surface at (height, angle from front). */
export const coatPoint = (y: number, phi: number, long: boolean, out = 1.0) => {
  const r = coatRadiusAt(y, long) * out;
  return new THREE.Vector3(r * Math.sin(phi), y, r * Math.cos(phi) * COAT_DEPTH);
};

/** Oversized open coat: a lathe whose front opening widens toward the collar. */
export const coatGeometry = (long: boolean) =>
  once(`coat-${long}`, () => {
    const prof = coatProfile(long);
    // densify profile
    const rows: [number, number][] = [];
    for (let i = 0; i < prof.length - 1; i++) {
      for (let k = 0; k < 4; k++) {
        const t = k / 4;
        rows.push([prof[i][0] + (prof[i + 1][0] - prof[i][0]) * t, prof[i][1] + (prof[i + 1][1] - prof[i][1]) * t]);
      }
    }
    rows.push(prof[prof.length - 1]);
    const seg = 72;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    rows.forEach(([rad, y], j) => {
      const g = coatGap(y);
      for (let i = 0; i <= seg; i++) {
        const phi = g + (i / seg) * (Math.PI * 2 - 2 * g);
        pos.push(rad * Math.sin(phi), y, rad * Math.cos(phi) * COAT_DEPTH);
        uv.push(i / seg, j / (rows.length - 1));
      }
    });
    for (let j = 0; j < rows.length - 1; j++) {
      for (let i = 0; i < seg; i++) {
        const a = j * (seg + 1) + i;
        const b = a + seg + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  });

/** Rolled lapel edges along both sides of the opening — gives the coat real thickness. */
export const lapelGeometry = (long: boolean) =>
  once(`lapels-${long}`, () => {
    const yStart = long ? 0.075 : 0.17;
    const parts: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 24; k++) {
        const y = yStart + ((0.638 - yStart) * k) / 24;
        pts.push(coatPoint(y, side * coatGap(y), long, 0.995));
      }
      parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.011, 8, false));
    }
    // hem roll
    const hem: THREE.Vector3[] = [];
    for (let k = 0; k <= 48; k++) {
      const g = coatGap(yStart);
      const phi = g + (k / 48) * (Math.PI * 2 - 2 * g);
      hem.push(coatPoint(yStart + 0.004, phi, long, 1.0));
    }
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hem), 96, 0.01, 8, false));
    return mergeGeometries(parts, false)!;
  });

/** Big soft collar standing around the neck, open at the front like the coat. */
export const collarGeometry = () =>
  once("collar", () => {
    const pts = [
      new THREE.Vector2(0.172, 0.565),
      new THREE.Vector2(0.15, 0.6),
      new THREE.Vector2(0.115, 0.645),
      new THREE.Vector2(0.088, 0.672),
      new THREE.Vector2(0.078, 0.668),
    ];
    const g = new THREE.LatheGeometry(pts, 64, Math.PI * 0.62, Math.PI * 2 - Math.PI * 1.24);
    g.scale(1, 1, COAT_DEPTH + 0.06);
    g.computeVertexNormals();
    return g;
  });

/** Knit sweater body; seam at the back so the front can carry the V-neck print. */
export const sweaterGeometry = () =>
  once("sweater", () => {
    const pts = [
      [0.0, 0.22],
      [0.168, 0.22],
      [0.173, 0.24],
      [0.17, 0.32],
      [0.165, 0.42],
      [0.158, 0.52],
      [0.13, 0.585],
      [0.088, 0.618],
      [0.056, 0.632],
      [0.0, 0.632],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(pts, 64, Math.PI, Math.PI * 2);
    g.scale(1, 1, 0.72);
    g.computeVertexNormals();
    return g;
  });

/**
 * A strip that follows the coat surface on the figure's right front — the Midnight Star's red glitter panel.
 */
export const coatPanelGeometry = (long: boolean) =>
  once(`panel-${long}`, () => {
    const yStart = long ? 0.09 : 0.18;
    const rows = 40;
    const cols = 8;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j <= rows; j++) {
      const y = yStart + ((0.632 - yStart) * j) / rows;
      const g = coatGap(y);
      const width = 0.2 + 0.12 * smoothstep(0.4, 0.62, y);
      for (let i = 0; i <= cols; i++) {
        const phi = -(g + 0.012 + (i / cols) * width);
        const v = coatPoint(y, phi, long, 1.012);
        pos.push(v.x, v.y, v.z);
        uv.push(i / cols, j / rows);
      }
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i;
        const b = a + cols + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  });

/** Extruded, bevelled 5-point star (used for every star prop in the collection). */
export const starGeometry = (outer = 1, inner = 0.46, depth = 0.25, bevel = 0.12) =>
  once(`star-${outer}-${inner}-${depth}-${bevel}`, () => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? outer : inner * outer;
      const a = Math.PI / 2 + (i * Math.PI) / 5;
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad;
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 4, steps: 1 });
    g.center();
    g.computeVertexNormals();
    return g;
  });

export const heartGeometry = (depth = 0.25, bevel = 0.12) =>
  once(`heart-${depth}-${bevel}`, () => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.62);
    s.bezierCurveTo(-0.15, -0.45, -1.0, 0.0, -0.75, 0.48);
    s.bezierCurveTo(-0.55, 0.85, -0.12, 0.75, 0, 0.42);
    s.bezierCurveTo(0.12, 0.75, 0.55, 0.85, 0.75, 0.48);
    s.bezierCurveTo(1.0, 0.0, 0.15, -0.45, 0, -0.62);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.7, bevelSegments: 5, curveSegments: 24 });
    g.center();
    g.computeVertexNormals();
    return g;
  });
