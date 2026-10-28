import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EDITIONS } from "../src/characters/figures";
import { ROOT } from "./tripo/env";
import { log } from "./tripo/log";

/**
 * Assembles the GitHub Pages site in site/ from rendered outputs and generated assets:
 *   - web-optimised H.264 copies of the films and reveal clips (faststart, smaller CRF)
 *   - JPEG copies of the cards, box shots and lineup
 *   - display GLBs (+ quad FBX masters) and, when present, rigged/animated game GLBs
 *   - site/data.json describing exactly what exists (the page renders only what is listed)
 * The reference photographs are never copied to the site.
 */

const SITE = path.join(ROOT, "site");
const A = (...p: string[]) => path.join(SITE, "assets", ...p);
const rel = (abs: string) => path.relative(SITE, abs).split(path.sep).join("/");
const fromRoot = (p: string) => path.join(ROOT, p);
const manifest = JSON.parse(readFileSync(fromRoot("src/characters/asset-manifest.json"), "utf8"));
for (const d of ["video", "img", "cards", "boxes", "models", "models/game", "concepts"]) mkdirSync(A(d), { recursive: true });

const fresh = (src: string, dst: string) => existsSync(dst) && statSync(dst).mtimeMs >= statSync(src).mtimeMs;

const ffmpeg = (args: string[]) => execFileSync("npx", ["remotion", "ffmpeg", "-y", "-loglevel", "error", ...args], { cwd: ROOT, stdio: ["ignore", "inherit", "inherit"] });

const webVideo = (src: string, dst: string, crf = 24) => {
  if (!existsSync(src)) return null;
  if (!fresh(src, dst)) {
    log.step(`web video ${path.basename(dst)}`);
    ffmpeg(["-i", src, "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", dst]);
  }
  return rel(dst);
};

const poster = (src: string, dst: string, at = "00:00:33") => {
  if (!existsSync(src)) return null;
  if (!fresh(src, dst)) ffmpeg(["-ss", at, "-i", src, "-frames:v", "1", "-q:v", "3", dst]);
  return rel(dst);
};

const jpeg = (src: string, dst: string, width = 1200) => {
  if (!existsSync(src)) return null;
  if (!fresh(src, dst)) ffmpeg(["-i", src, "-vf", `scale='min(${width},iw)':-2`, "-q:v", "3", dst]);
  return rel(dst);
};

const copy = (src: string | null, dst: string) => {
  if (!src || !existsSync(src)) return null;
  if (!fresh(src, dst)) copyFileSync(src, dst);
  return rel(dst);
};

const film = {
  portrait: webVideo(fromRoot("out/little-tai-collection.mp4"), A("video", "little-tai-collection-9x16.mp4")),
  landscape: webVideo(fromRoot("out/little-tai-collection-16x9.mp4"), A("video", "little-tai-collection-16x9.mp4")),
  poster: poster(fromRoot("out/little-tai-collection.mp4"), A("img", "poster-9x16.jpg"), "00:00:30.5"),
  posterLandscape: poster(fromRoot("out/little-tai-collection-16x9.mp4"), A("img", "poster-16x9.jpg"), "00:00:34"),
};
const lineup = jpeg(fromRoot("out/little-tai-lineup.png"), A("img", "lineup.jpg"), 2560);

const editions = EDITIONS.map((e) => {
  const nn = String(e.index + 1).padStart(2, "0");
  const fig = manifest.figures?.[e.id] as { glb: string } | null;
  const glbSrc = fig ? fromRoot(path.join("public", fig.glb)) : null;
  const fbxSrc = glbSrc ? glbSrc.replace(/\.glb$/, ".fbx") : null;
  const game = manifest.game?.[e.id] as { animated?: { glb?: string; animations?: { name: string; duration: number }[]; ok?: boolean }; rigged?: { glb?: string; ok?: boolean } } | null;
  const animatedSrc = game?.animated?.glb && game.animated.ok ? fromRoot(path.join("public", game.animated.glb)) : null;
  const riggedSrc = game?.rigged?.glb && game.rigged.ok ? fromRoot(path.join("public", game.rigged.glb)) : null;
  const conceptRel = manifest.concepts?.[e.id] as string | null;
  return {
    id: e.id,
    index: e.index,
    number: e.number,
    name: e.name,
    label: e.label,
    secret: e.secret,
    mood: e.mood,
    feeling: e.feeling,
    rarity: e.rarity,
    palette: e.palette,
    boxColor: e.box.base,
    tagline: e.box.tagline,
    card: jpeg(fromRoot(`out/cards/${nn}-${e.id}-card.png`), A("cards", `${nn}-${e.id}-card.jpg`), 900),
    box: jpeg(fromRoot(`out/boxes/${nn}-${e.id}-box.png`), A("boxes", `${nn}-${e.id}-box.jpg`), 900),
    concept: conceptRel ? jpeg(fromRoot(path.join("public", conceptRel)), A("concepts", `${nn}-${e.id}-concept.jpg`), 900) : null,
    clip: webVideo(fromRoot(`out/reveals/${nn}-${e.id}.mp4`), A("video", `reveal-${nn}-${e.id}.mp4`), 25),
    glb: copy(glbSrc, A("models", `${nn}-${e.id}.glb`)),
    fbx: copy(fbxSrc, A("models", `${nn}-${e.id}-quad.fbx`)),
    game: animatedSrc || riggedSrc
      ? {
          animated: copy(animatedSrc, A("models", "game", `${nn}-${e.id}-animated.glb`)),
          rigged: copy(riggedSrc, A("models", "game", `${nn}-${e.id}-rigged.glb`)),
          animations: game?.animated?.animations?.map((a) => a.name) ?? [],
        }
      : null,
  };
});

const data = { title: "little TAI — The Feelings Collection", builtAt: new Date().toISOString(), film, lineup, editions };
writeFileSync(path.join(SITE, "data.json"), JSON.stringify(data, null, 2) + "\n");
writeFileSync(path.join(SITE, ".nojekyll"), "");

const size = (p: string) => {
  let total = 0;
  const walk = (d: string) => {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, f.name);
      if (f.isDirectory()) walk(full);
      else total += statSync(full).size;
    }
  };
  walk(p);
  return total;
};
const missing = editions.flatMap((e) => (["card", "box", "glb", "clip"] as const).filter((k) => !e[k]).map((k) => `${e.id}.${k}`));
if (!film.portrait) missing.unshift("film.portrait");
if (missing.length) log.warn(`not yet available (hidden on the page): ${missing.join(", ")}`);
log.ok(`site/ ready — ${(size(SITE) / 1024 / 1024).toFixed(1)} MB (GitHub Pages limit: 1 GB, 100 MB per file)`);
