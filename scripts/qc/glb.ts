import { NodeIO, getBounds } from "@gltf-transform/core";

export interface GlbReport {
  file: string;
  ok: boolean;
  problems: string[];
  meshes: number;
  primitives: number;
  triangles: number;
  vertices: number;
  materials: number;
  textures: { name: string; mimeType: string; bytes: number }[];
  bounds: { min: [number, number, number]; max: [number, number, number] };
  size: [number, number, number];
  skins: number;
  joints: number;
  animations: { name: string; duration: number; channels: number }[];
}

/** Parses a GLB fully (geometry, materials, embedded textures) and reports anything that would render invisibly or broken. */
export const inspectGlb = async (file: string): Promise<GlbReport> => {
  const io = new NodeIO();
  const problems: string[] = [];
  const doc = await io.read(file);
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  if (!scene) problems.push("no scene");

  let primitives = 0;
  let triangles = 0;
  let vertices = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      primitives++;
      const pos = prim.getAttribute("POSITION");
      if (!pos) {
        problems.push(`${mesh.getName() || "mesh"} has a primitive without POSITION`);
        continue;
      }
      vertices += pos.getCount();
      const idx = prim.getIndices();
      const count = idx ? idx.getCount() : pos.getCount();
      if (prim.getMode() === 4) triangles += count / 3;
      const arr = pos.getArray();
      if (arr && Array.from(arr as ArrayLike<number>).some((v) => !Number.isFinite(v))) problems.push(`${mesh.getName() || "mesh"} has non-finite vertex positions`);
      if (!prim.getAttribute("NORMAL")) problems.push(`${mesh.getName() || "mesh"} has no normals (will be computed)`);
    }
  }
  if (primitives === 0) problems.push("no mesh primitives");
  if (triangles < 100) problems.push(`only ${triangles} triangles`);

  const textures = root.listTextures().map((t) => ({ name: t.getName() || t.getURI() || "texture", mimeType: t.getMimeType(), bytes: t.getImage()?.byteLength ?? 0 }));
  if (textures.length === 0) problems.push("no textures (expected PBR maps)");
  if (textures.some((t) => t.bytes === 0)) problems.push("a texture has no image data");

  const b = scene ? getBounds(scene) : { min: [0, 0, 0], max: [0, 0, 0] };
  const min = b.min as [number, number, number];
  const max = b.max as [number, number, number];
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]] as [number, number, number];
  if (!size.every((s) => Number.isFinite(s) && s > 1e-5)) problems.push(`degenerate bounds ${JSON.stringify(size)}`);

  const skins = root.listSkins();
  const animations = root.listAnimations().map((a) => {
    let duration = 0;
    for (const s of a.listSamplers()) {
      const input = s.getInput();
      if (input) duration = Math.max(duration, input.getMax([0])[0]);
    }
    return { name: a.getName() || "animation", duration: Number(duration.toFixed(3)), channels: a.listChannels().length };
  });
  for (const a of animations) if (a.duration <= 0 || a.channels === 0) problems.push(`animation "${a.name}" is empty`);

  const fatal = problems.filter((p) => !p.includes("normals"));
  return {
    skins: skins.length,
    joints: skins.reduce((n, s) => n + s.listJoints().length, 0),
    animations,
    file,
    ok: fatal.length === 0,
    problems,
    meshes: root.listMeshes().length,
    primitives,
    triangles: Math.round(triangles),
    vertices,
    materials: root.listMaterials().length,
    textures,
    bounds: { min, max },
    size,
  };
};
