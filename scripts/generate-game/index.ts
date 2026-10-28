import { writeAssetManifest } from "../qc/asset-manifest";
import { parseArgs, runPipeline } from "../tripo/pipeline";

/**
 * Game assets — per edition: T-pose sheet (image-to-image, t_pose template) → triangle game mesh →
 * rig-check (free) → auto-rig (Tripo rig v3.0, biped, Mixamo skeleton) → retarget idle/walk/run/jump/fall
 * (in place) into one animated GLB in public/models/game/. Needs the edition concepts. --dry-run to preview.
 */
const opts = parseArgs(process.argv.slice(2), { stages: ["game"] });
const result = await runPipeline(opts);
if (result.ran) await writeAssetManifest();
