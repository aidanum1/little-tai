import { mergeClips } from "../convert/merge-clips";
import { writeAssetManifest } from "../qc/asset-manifest";
import { parseArgs, runPipeline } from "../tripo/pipeline";

/**
 * Game assets — per edition: T-pose sheet (image-to-image, t_pose template) → triangle game mesh →
 * rig-check (free) → auto-rig (Tripo rig v1.0, biped, Mixamo skeleton) → retarget the biped clips in batches of 5
 * (in place), merged locally into one animated GLB in public/models/game/. Needs the edition concepts.
 * --dry-run to preview; --only=rebel for a single figure.
 */
const opts = parseArgs(process.argv.slice(2), { stages: ["game"] });
const result = await runPipeline(opts);
if (result.ran) {
  await mergeClips();
  await writeAssetManifest();
}
