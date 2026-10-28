import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";

RectAreaLightUniformsLib.init();

/**
 * Studio environment for reflections: a dark cyclorama with three soft boxes (key, two strip lights) and a warm
 * floor bounce, baked once into a PMREM cube. No HDR download, identical on every render worker.
 */
const StudioEnvironment: React.FC<{ intensity: number; warmth?: string }> = ({ intensity, warmth = "#ffe8d6" }) => {
  const { gl, scene } = useThree();
  const env = useMemo(() => {
    const envScene = new THREE.Scene();
    const room = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ color: "#16181f", side: THREE.BackSide }));
    envScene.add(room);
    const box = (w: number, hgt: number, color: string, strength: number, pos: [number, number, number]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), side: THREE.DoubleSide }));
      m.position.set(...pos);
      m.lookAt(0, 0, 0);
      envScene.add(m);
    };
    box(5, 3, "#ffffff", 3.2, [-3, 5, 4]); // key softbox
    box(1.2, 6, "#dfe8ff", 2.4, [6, 1.5, -2]); // cool strip
    box(1.2, 6, warmth, 2.2, [-6, 1.5, -3]); // warm strip
    box(8, 8, "#3a2e2a", 1, [0, -6, 0]); // floor bounce
    const pmrem = new THREE.PMREMGenerator(gl);
    const rt = pmrem.fromScene(envScene, 0.035);
    pmrem.dispose();
    return rt;
  }, [gl, warmth]);
  useLayoutEffect(() => {
    scene.environment = env.texture;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = null;
    };
  }, [scene, env, intensity]);
  return null;
};

const Exposure: React.FC<{ value: number }> = ({ value }) => {
  const { gl } = useThree();
  useLayoutEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = value;
  }, [gl, value]);
  return null;
};

export interface CameraShot {
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
  /** Dutch angle in radians. */
  roll?: number;
}

/** Applies a frame-driven camera every render (before R3F's manual frame advance). */
export const CameraRig: React.FC<CameraShot> = ({ position, target, fov = 30, roll = 0 }) => {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.set(...position);
    cam.up.set(Math.sin(roll), Math.cos(roll), 0);
    cam.lookAt(...target);
    cam.fov = fov;
    cam.near = 0.05;
    cam.far = 100;
    cam.updateProjectionMatrix();
  });
  return null;
};

/** Key softbox + shadow caster + hemispheric fill + two coloured rim lights. */
export const StudioLights: React.FC<{
  keyLight?: number;
  fill?: number;
  rimA?: string;
  rimB?: string;
  rim?: number;
  keyColor?: string;
  shadowFocus?: [number, number, number];
}> = ({ keyLight = 1, fill = 0.35, rimA = "#BFD8FF", rimB = "#FFD9C2", rim = 1, keyColor = "#fff4ea", shadowFocus = [0, 0.6, 0] }) => {
  const k = keyLight;
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(...shadowFocus);
    return o;
  }, [shadowFocus]);
  return (
    <>
      <primitive object={target} />
      <directionalLight
        position={[-2.6, 4.2, 3.2]}
        intensity={1.6 * k}
        color={keyColor}
        target={target}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={4}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-2.5}
        shadow-camera-right={2.5}
        shadow-camera-top={2.5}
        shadow-camera-bottom={-2.5}
        shadow-camera-near={0.5}
        shadow-camera-far={14}
      />
      <rectAreaLight position={[-1.8, 2.6, 2.4]} width={2.2} height={1.6} intensity={2.6 * k} color={keyColor} onUpdate={(l) => l.lookAt(0, 0.7, 0)} />
      <hemisphereLight args={["#dfe6ff", "#3b2d2a", fill]} />
      <spotLight position={[2.4, 2.8, -2.6]} angle={0.55} penumbra={1} intensity={9 * rim} color={rimA} target={target} distance={10} decay={1.6} />
      <spotLight position={[-2.6, 2.2, -2.4]} angle={0.55} penumbra={1} intensity={7 * rim} color={rimB} target={target} distance={10} decay={1.6} />
    </>
  );
};

/**
 * A 3D scene layered between a CSS backdrop (behind a transparent canvas) and an HTML overlay.
 * The canvas renders with shadows, ACES tone mapping and the baked studio environment.
 */
export const Stage: React.FC<{
  backdrop: React.CSSProperties["background"];
  exposure?: number;
  envIntensity?: number;
  envWarmth?: string;
  children: React.ReactNode;
  overlay?: React.ReactNode;
}> = ({ backdrop, exposure = 1, envIntensity = 0.6, envWarmth, children, overlay }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: backdrop }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows={{ type: THREE.PCFShadowMap }}
        dpr={1}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Exposure value={exposure} />
        <StudioEnvironment intensity={envIntensity} warmth={envWarmth} />
        {children}
      </ThreeCanvas>
      {overlay}
    </AbsoluteFill>
  );
};
