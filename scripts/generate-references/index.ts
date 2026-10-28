import { writeAssetManifest } from "../qc/asset-manifest";
import { parseArgs, runPipeline } from "../tripo/pipeline";

/**
 * Step A — Tripo image-to-image (seedream_v5):
 * photos → one master full-body figurine reference → five edition concepts derived from the master.
 * Outputs land in public/concepts/. Add --dry-run to only print the plan.
 */
const opts = parseArgs(process.argv.slice(2), { stages: ["references"] });
const result = await runPipeline(opts);
if (result.ran) await writeAssetManifest();
