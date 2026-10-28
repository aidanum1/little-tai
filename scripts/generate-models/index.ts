import { writeAssetManifest } from "../qc/asset-manifest";
import { parseArgs, runPipeline } from "../tripo/pipeline";

/**
 * Step B — Tripo image-to-model (P2-20260801, textured PBR, quad topology):
 * each edition concept → GLB in public/models/, then GLB QC and asset-manifest refresh.
 * Requires the concepts from `npm run generate:references`. Add --dry-run to only print the plan.
 */
const opts = parseArgs(process.argv.slice(2), { stages: ["models"] });
const result = await runPipeline(opts);
if (result.ran) await writeAssetManifest();
