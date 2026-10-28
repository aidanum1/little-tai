import { writeAssetManifest } from "./asset-manifest";

// npm run qc:models — validates every downloaded GLB and refreshes src/characters/asset-manifest.json.
const out = await writeAssetManifest();
const missing = Object.entries(out.figures).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.log(`\nNo verified GLB for: ${missing.join(", ")} — the video uses the procedural stand-in figure for these.`);
}
