import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

dotenv.config({ path: path.join(ROOT, ".env"), quiet: true });

export const config = {
  apiKey: process.env.TRIPO_API_KEY?.trim() || null,
  baseUrl: process.env.TRIPO_BASE_URL?.trim() || "https://openapi.tripo3d.ai/v3",
  /** Photos → art-toy master base (proportions, pose, material). */
  imageModel: process.env.TRIPO_IMAGE_MODEL?.trim() || "seedream_v5",
  /** Likeness refinement and edition variants (strong identity preservation of image[1]). */
  refineModel: process.env.TRIPO_REFINE_MODEL?.trim() || "chat_image_2",
  modelVersion: process.env.TRIPO_MODEL_VERSION?.trim() || "P2-20260801",
  /** Rigged/animated game assets: glb (web, Godot, three.js, Unity glTFast) or fbx (Unity/Unreal native). */
  gameFormat: (process.env.TRIPO_GAME_FORMAT?.trim() || "glb") as "glb" | "fbx",
  textureQuality: process.env.TRIPO_TEXTURE_QUALITY?.trim() || "detailed",
  pollTimeoutMs: Number(process.env.TRIPO_POLL_TIMEOUT_MINUTES ?? 25) * 60_000,
};

export const paths = {
  root: ROOT,
  photos: path.join(ROOT, "public", "photos"),
  concepts: path.join(ROOT, "public", "concepts"),
  models: path.join(ROOT, "public", "models"),
  previews: path.join(ROOT, "public", "models", "previews"),
  manifest: path.join(ROOT, "generation", "manifest.json"),
  tmp: path.join(ROOT, "generation", "tmp"),
  assetManifest: path.join(ROOT, "src", "characters", "asset-manifest.json"),
};

/** Path relative to public/, as used by staticFile() in Remotion. */
export const toPublic = (abs: string) => path.relative(path.join(ROOT, "public"), abs).split(path.sep).join("/");
export const toRepo = (abs: string) => path.relative(ROOT, abs).split(path.sep).join("/");
export const fromRepo = (rel: string) => path.join(ROOT, rel);
