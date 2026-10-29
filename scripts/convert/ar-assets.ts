import { getBounds, NodeIO, type Texture } from "@gltf-transform/core";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EDITIONS } from "../../src/characters/figures";
import { fromRepo, paths, toRepo } from "../tripo/env";
import { log } from "../tripo/log";
import { gameFileBase } from "../tripo/pipeline";

/**
 * Phone-friendly copies of every figure in public/models/ar/ (free, local, needs Blender):
 *   <name>.glb   textures downscaled to 2048 px (normal maps stay PNG, colour/ORM become JPEG) — the site viewer,
 *                Android Scene Viewer and WebXR load this instead of the 12–14 MB master
 *   <name>.usdz  iOS Quick Look file exported by Blender from that GLB; the animated figure carries its rig and
 *                one clip (UsdSkel), so it dances in the room instead of standing in T-pose
 * The full-resolution GLBs stay the download files.
 */
const BLENDER = process.env.BLENDER_BIN ?? "/Applications/Blender.app/Contents/MacOS/Blender";
const SCRIPT = path.join(paths.root, "scripts", "convert", "blender_ar_assets.py");
const OUT = path.join(paths.models, "ar");
const MAX = 2048;
/** The clip the animated figure plays in Quick Look. */
export const AR_CLIP = "dance_01";

const blender = (args: string[]) =>
  execFileSync(BLENDER, ["-b", "--factory-startup", "-P", SCRIPT, "--", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });

const fresh = (src: string, dst: string) => existsSync(dst) && statSync(dst).mtimeMs >= statSync(src).mtimeMs;

const lightGlb = async (src: string, dst: string) => {
  const io = new NodeIO();
  const doc = await io.read(src);
  const normals = new Set<Texture>();
  for (const m of doc.getRoot().listMaterials()) {
    const n = m.getNormalTexture();
    if (n) normals.add(n);
  }
  const tmp = path.join(paths.root, "generation", "tmp", "ar-textures");
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const jobs = doc.getRoot().listTextures().map((t, i) => {
    const png = normals.has(t);
    const input = path.join(tmp, `in-${i}${t.getMimeType() === "image/png" ? ".png" : ".jpg"}`);
    const output = path.join(tmp, `out-${i}${png ? ".png" : ".jpg"}`);
    writeFileSync(input, t.getImage()!);
    return { t, input, output, png };
  });
  blender(["resize", String(MAX), ...jobs.flatMap((j) => [j.input, j.output, j.png ? "PNG" : "JPEG"])]);
  for (const j of jobs) {
    j.t.setImage(new Uint8Array(readFileSync(j.output)));
    j.t.setMimeType(j.png ? "image/png" : "image/jpeg");
    if (j.t.getURI()) j.t.setURI(j.t.getURI().replace(/\.(png|jpe?g)$/i, j.png ? ".png" : ".jpg"));
  }
  // Scene Viewer and Quick Look stand a model on its origin: put the feet on y = 0, centred (rigged files already are)
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  if (!doc.getRoot().listSkins().length) {
    const { min, max } = getBounds(scene);
    const holder = doc.createNode("on_floor").setTranslation([-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2]);
    for (const child of scene.listChildren()) {
      scene.removeChild(child);
      holder.addChild(child);
    }
    scene.addChild(holder);
  }
  await io.write(dst, doc);
  rmSync(tmp, { recursive: true, force: true });
};

export interface ArAsset {
  glb: string;
  usdz: string;
}

/** Builds (or reuses) the AR/web copies; returns repo-relative paths keyed by "figure:<id>" / "animated:<id>". */
export const buildArAssets = async (force = false): Promise<Record<string, ArAsset>> => {
  mkdirSync(OUT, { recursive: true });
  const manifest = JSON.parse(readFileSync(path.join(paths.root, "src", "characters", "asset-manifest.json"), "utf8"));
  const sources: { key: string; src: string; name: string; clip?: string }[] = [];
  for (const e of EDITIONS) {
    const fig = manifest.figures?.[e.id];
    if (fig?.glb) sources.push({ key: `figure:${e.id}`, src: fromRepo(path.join("public", fig.glb)), name: path.basename(fig.glb, ".glb") });
    const animated = `${gameFileBase(e.id, "animated")}.glb`;
    if (manifest.game?.[e.id]?.animated?.ok && existsSync(animated)) sources.push({ key: `animated:${e.id}`, src: animated, name: path.basename(animated, ".glb"), clip: AR_CLIP });
  }
  if (!existsSync(BLENDER)) {
    log.warn(`Blender not found at ${BLENDER} (set BLENDER_BIN) — AR/web copies not rebuilt`);
  }
  const out: Record<string, ArAsset> = {};
  for (const s of sources) {
    const glb = path.join(OUT, `${s.name}.glb`);
    const usdz = path.join(OUT, `${s.name}.usdz`);
    if (existsSync(BLENDER) && (force || !fresh(s.src, glb))) {
      log.step(`AR glb  ${toRepo(glb)}`);
      await lightGlb(s.src, glb);
    }
    if (existsSync(BLENDER) && existsSync(glb) && (force || !fresh(glb, usdz))) {
      log.step(`AR usdz ${toRepo(usdz)}${s.clip ? ` (clip ${s.clip})` : ""}`);
      blender(["usdz", glb, usdz, ...(s.clip ? [s.clip] : [])]);
    }
    if (existsSync(glb) && existsSync(usdz)) out[s.key] = { glb: toRepo(glb), usdz: toRepo(usdz) };
  }
  return out;
};

/** Prints what Quick Look will see in a USDZ (axis, scale, bounds, facing). */
export const inspectUsdz = (file: string) => blender(["inspect", file]);

if (import.meta.url === `file://${process.argv[1]}`) {
  const built = await buildArAssets(process.argv.includes("--force"));
  for (const [k, v] of Object.entries(built)) log.ok(`${k}: ${v.glb} · ${v.usdz}`);
}
