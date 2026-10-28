import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { ROOT } from "../tripo/env";
import { c, log, table } from "../tripo/log";

/** ffprobe every rendered video: resolution, fps, duration, codecs, audio. Fails loudly on any mismatch. */
const probe = (file: string) =>
  JSON.parse(
    execFileSync("npx", ["remotion", "ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,sample_rate,channels:format=duration,size", "-of", "json", file], {
      cwd: ROOT,
      encoding: "utf8",
    }),
  );

const expect = [
  { file: "out/little-tai-collection.mp4", w: 1080, h: 1920, dur: 36 },
  { file: "out/little-tai-collection-16x9.mp4", w: 1920, h: 1080, dur: 36 },
  ...(existsSync(path.join(ROOT, "out/reveals")) ? readdirSync(path.join(ROOT, "out/reveals")).filter((f) => f.endsWith(".mp4")).map((f) => ({ file: `out/reveals/${f}`, w: 1080, h: 1920, dur: 7 })) : []),
];

const rows: string[][] = [];
let failed = 0;
for (const x of expect) {
  const abs = path.join(ROOT, x.file);
  if (!existsSync(abs)) {
    rows.push([x.file, c.yellow("missing"), "", "", "", ""]);
    continue;
  }
  const j = probe(abs);
  const v = j.streams.find((s: { codec_type: string }) => s.codec_type === "video");
  const a = j.streams.find((s: { codec_type: string }) => s.codec_type === "audio");
  const [num, den] = String(v.r_frame_rate).split("/").map(Number);
  const fps = num / (den || 1);
  const dur = Number(j.format.duration);
  const ok = v.width === x.w && v.height === x.h && Math.abs(fps - 30) < 0.01 && Math.abs(dur - x.dur) < 0.1 && v.codec_name === "h264" && v.pix_fmt === "yuv420p";
  if (!ok) failed++;
  rows.push([
    x.file,
    ok ? c.green("ok") : c.red("MISMATCH"),
    `${v.width}×${v.height} ${v.codec_name} ${v.pix_fmt}`,
    `${fps} fps · ${dur.toFixed(2)} s`,
    a ? `${a.codec_name} ${a.sample_rate} Hz ${a.channels}ch` : "no audio",
    `${(statSync(abs).size / 1024 / 1024).toFixed(1)} MB`,
  ]);
}
table(rows, ["file", "qc", "video", "timing", "audio", "size"]);
if (failed) {
  log.error(`${failed} render(s) do not match spec`);
  process.exitCode = 1;
} else log.ok("all renders match spec");
