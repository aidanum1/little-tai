import { existsSync } from "node:fs";
import { TripoClient } from "../tripo/client";
import { config, fromRepo, paths, toRepo } from "../tripo/env";
import { log } from "../tripo/log";
import { loadManifest, saveManifest } from "../tripo/manifest";
import { writeAssetManifest } from "../qc/asset-manifest";

/**
 * Re-fetches outputs of already-successful tasks whose local files are missing (e.g. a fresh clone).
 * It queries each task again for fresh output URLs — this never creates a task and costs nothing.
 */
const URL_KEYS: Record<string, string[]> = {
  image: ["generated_image_url", "image_url"],
  model: ["model_url", "pbr_model", "model"],
  preview: ["rendered_image_url"],
};

const manifest = await loadManifest();
const missing = Object.values(manifest.tasks).filter(
  (t) => t.status === "success" && Object.values(t.outputs ?? {}).some((rel) => !existsSync(fromRepo(rel))),
);

if (missing.length === 0) {
  log.ok("All successful task outputs are on disk.");
} else if (!config.apiKey) {
  log.error(`${missing.length} task output(s) missing locally but TRIPO_API_KEY is not set.`);
  process.exitCode = 1;
} else {
  const client = new TripoClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });
  for (const entry of missing) {
    log.step(`${entry.key} ← ${entry.task_id}`);
    const task = await client.getTask(entry.task_id);
    const out = (task.output ?? {}) as Record<string, unknown>;
    for (const [name, rel] of Object.entries(entry.outputs ?? {})) {
      if (existsSync(fromRepo(rel))) continue;
      const url = URL_KEYS[name]?.map((k) => out[k]).find((v): v is string => typeof v === "string");
      if (!url) {
        log.warn(`  no ${name} URL returned for ${entry.task_id}`);
        continue;
      }
      await TripoClient.download(url, fromRepo(rel), paths.tmp);
      log.ok(`  ${toRepo(fromRepo(rel))}`);
    }
    await saveManifest(manifest);
  }
}
await writeAssetManifest();
