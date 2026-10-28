import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fromRepo, paths, toRepo } from "../tripo/env";
import { log } from "../tripo/log";
import { loadManifest, saveManifest } from "../tripo/manifest";

/**
 * Tripo returns FBX for quad-topology models (glTF cannot store quads). This converts each FBX output to a
 * web/Remotion-ready GLB with the local Blender install (free, no API credits), keeping the FBX as the quad master.
 * Records the GLB as the `model` output and the FBX as `model_fbx` in generation/manifest.json.
 */
const BLENDER = process.env.BLENDER_BIN ?? "/Applications/Blender.app/Contents/MacOS/Blender";
const SCRIPT = path.join(paths.root, "scripts", "convert", "blender_fbx_to_glb.py");

export const convertFbxOutputs = async (force = false) => {
  const manifest = await loadManifest();
  let converted = 0;
  for (const entry of Object.values(manifest.tasks)) {
    const fbxRel = entry.outputs?.model_fbx ?? (entry.outputs?.model?.endsWith(".fbx") ? entry.outputs.model : undefined);
    if (!fbxRel || entry.status !== "success") continue;
    const fbx = fromRepo(fbxRel);
    const glb = fbx.replace(/\.fbx$/i, ".glb");
    if (existsSync(glb) && !force) {
      entry.outputs = { ...entry.outputs, model: toRepo(glb), model_fbx: fbxRel };
      continue;
    }
    if (!existsSync(BLENDER)) throw new Error(`Blender not found at ${BLENDER} (set BLENDER_BIN)`);
    log.step(`FBX → GLB  ${toRepo(fbx)}`);
    const out = execFileSync(BLENDER, ["-b", "--factory-startup", "-P", SCRIPT, "--", fbx, glb], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const line = out.split("\n").find((l) => l.startsWith("converted"));
    if (!existsSync(glb)) throw new Error(`conversion failed for ${fbxRel}:\n${out.slice(-800)}`);
    log.ok(line ?? `wrote ${toRepo(glb)}`);
    entry.outputs = { ...entry.outputs, model: toRepo(glb), model_fbx: fbxRel };
    converted++;
  }
  await saveManifest(manifest);
  return converted;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = await convertFbxOutputs(process.argv.includes("--force"));
  log.ok(`${n} model(s) converted`);
  const { writeAssetManifest } = await import("../qc/asset-manifest");
  await writeAssetManifest();
}
