import { writeAssetManifest } from "./qc/asset-manifest";
import { parseArgs, runPipeline } from "./tripo/pipeline";

/**
 * Full pipeline: master reference → 5 edition concepts → 5 textured GLB figures → QC → asset manifest.
 *
 *   npm run generate:plan                 dry run, prints every paid request and the credit estimate
 *   npm run generate:all                  real run (asks for confirmation before spending)
 *   npm run generate:all -- --yes         non-interactive
 *   npm run generate:all -- --only=dreamer,midnight
 *   npm run generate:all -- --strategy=shared-master   one master GLB, editions differ by accessories/materials
 */
const opts = parseArgs(process.argv.slice(2));
const result = await runPipeline(opts);
if (result.ran) await writeAssetManifest();
