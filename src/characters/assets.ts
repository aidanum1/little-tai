import { staticFile } from "remotion";
import manifest from "./asset-manifest.json";
import type { EditionId } from "./figures";

/**
 * Typed view of asset-manifest.json (written by `npm run qc:models` after GLB validation).
 * Remotion only ever loads files listed here, from public/ — never temporary Tripo URLs.
 */

export interface FigureAsset {
  glb: string;
  preview: string | null;
  taskId: string | null;
  shared: boolean;
  triangles: number;
  textures: number;
  bounds: { min: [number, number, number]; max: [number, number, number] };
}

/** Rigged + animated game GLB (Tripo auto-rig → retargeted clips, merged by scripts/convert/merge-clips.ts). */
export interface GameAsset {
  glb: string;
  ok: boolean;
  joints: number;
  animations: { name: string; duration: number; channels: number }[];
  bounds: { min: [number, number, number]; max: [number, number, number] };
}

type Manifest = {
  strategy: string;
  concepts: Record<string, string | null>;
  figures: Record<string, FigureAsset | null>;
  game?: Record<string, { animated?: GameAsset | null } | null>;
};

const m = manifest as unknown as Manifest;

export const getFigureAsset = (id: EditionId): FigureAsset | null => m.figures[id] ?? null;

export const getAnimatedAsset = (id: EditionId): GameAsset | null => {
  const a = m.game?.[id]?.animated;
  return a?.ok && a.glb ? a : null;
};

export const getConceptUrl = (id: EditionId | "master"): string | null => {
  const rel = m.concepts[id];
  return rel ? staticFile(rel) : null;
};

export const hasGeneratedFigures = () => Object.values(m.figures).some(Boolean);
