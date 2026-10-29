import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { EDITIONS } from "../src/characters/figures";
import { ROOT } from "./tripo/env";
import { log } from "./tripo/log";

/**
 * Production renders (all outputs in out/):
 *   main       out/little-tai-collection.mp4          1080×1920, 30 fps, 36 s
 *   landscape  out/little-tai-collection-16x9.mp4     1920×1080
 *   short      out/little-tai-after-hours.mp4         1080×1920, 30 fps, 28 s — rigged "after hours" short
 *   reveals    out/reveals/<NN>-<edition>.mp4         7 s product reveal per edition
 *   stills     out/cards/*.png, out/boxes/*.png, out/little-tai-lineup.png
 * Usage: npm run render:all  |  tsx scripts/render.ts --only=main,stills
 */
const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1]?.split(",") ?? ["main", "landscape", "short", "reveals", "stills"];
const extra = process.argv.filter((a) => a.startsWith("--") && !a.startsWith("--only="));

const remotion = (args: string[]) => {
  log.step(`remotion ${args.join(" ")}`);
  const r = spawnSync("npx", ["remotion", ...args, "--log=warn", ...extra], { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) {
    log.error(`render failed: ${args[1]}`);
    process.exit(r.status ?? 1);
  }
};

const out = (...p: string[]) => path.join("out", ...p);
mkdirSync(path.join(ROOT, "out", "reveals"), { recursive: true });
mkdirSync(path.join(ROOT, "out", "cards"), { recursive: true });
mkdirSync(path.join(ROOT, "out", "boxes"), { recursive: true });

const started = Date.now();
if (only.includes("main")) remotion(["render", "LittleTaiPromo", out("little-tai-collection.mp4")]);
if (only.includes("landscape")) remotion(["render", "LittleTaiPromoLandscape", out("little-tai-collection-16x9.mp4")]);
if (only.includes("short")) remotion(["render", "AfterHours", out("little-tai-after-hours.mp4")]);
if (only.includes("reveals")) {
  for (const e of EDITIONS) remotion(["render", `Reveal-${e.id}`, out("reveals", `${String(e.index + 1).padStart(2, "0")}-${e.id}.mp4`)]);
}
if (only.includes("stills")) {
  for (const e of EDITIONS) {
    const nn = String(e.index + 1).padStart(2, "0");
    remotion(["still", `Card-${e.id}`, out("cards", `${nn}-${e.id}-card.png`)]);
    remotion(["still", `Box-${e.id}`, out("boxes", `${nn}-${e.id}-box.png`)]);
  }
  remotion(["still", "Lineup", out("little-tai-lineup.png")]);
}
log.ok(`renders finished in ${((Date.now() - started) / 60000).toFixed(1)} min`);
