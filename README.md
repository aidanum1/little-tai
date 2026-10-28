# little TAI — The Feelings Collection

An unofficial, fan-made premium blind-box concept for A2O SOUL's Tai: five 3D designer-toy figures generated with the
**Tripo 3D API v3**, five original animated 3D boxes, collectible cards, and a 36-second cinematic launch film rendered
with **Remotion + React Three Fiber**. A static showcase site in `site/` is ready for **GitHub Pages**.

**Live showcase: https://aidanum1.github.io/little-tai/**

> Unofficial fan-made concept. Not affiliated with, endorsed by or connected to A2O SOUL, its members or its agency.

## What's here

| Deliverable | Where |
| --- | --- |
| 5 textured 3D figures (GLB, Tripo P2, PBR) + quad-topology FBX masters | `public/models/figure-0N-*.glb` / `.fbx` |
| Concept art (master reference + 5 editions) | `public/concepts/` |
| 5 animated 3D blind boxes (real geometry, painted foil/emboss print) | `src/packaging/` |
| 36 s film, 1080×1920, 30 fps | `out/little-tai-collection.mp4` |
| 16:9 cut, 1920×1080 | `out/little-tai-collection-16x9.mp4` |
| 7 s reveal clip per edition | `out/reveals/` |
| 5 collectible cards · 5 box key-art stills · lineup | `out/cards/`, `out/boxes/`, `out/little-tai-lineup.png` |
| Original score + 16 sound effects (synthesised from scratch, project-owned) | `public/audio/feelings-score.wav`, `public/audio/sfx/` |
| GitHub Pages showcase | `site/` + `.github/workflows/pages.yml` |

## Setup

```bash
npm install
cp .env.example .env   # add TRIPO_API_KEY=tsk_…  (the secret key, not the tcli_ client id)
```

Reference photos go in `public/photos/tai_01.jpg … tai_09.jpg`. They are git-ignored and never published.

## Commands

| | |
| --- | --- |
| `npm run generate:plan` | **Dry run.** Prints every paid Tripo request, its body and the credit estimate. Sends nothing. |
| `npm run generate:references` | Step A: photos → master base → master likeness → 5 edition concepts |
| `npm run generate:models` | Step B: concepts → 5 textured PBR figures (P2, quad) → FBX→GLB → QC |
| `npm run generate:game` | Rig stage: T-pose → game mesh → rig-check → Mixamo-spec rig → idle/walk/run/jump/fall |
| `npm run generate:all` | All stages (asks before spending; `-- --yes` for non-interactive) |
| `npm run tripo:balance` | Credit balance |
| `npm run convert:models` | FBX (Tripo quad output) → GLB via local Blender, turned to face +Z |
| `npm run qc:models` | Parses every GLB (meshes, bounds, textures, skins, clips) and refreshes `src/characters/asset-manifest.json` |
| `npm run audio:score` / `npm run audio:sfx` | Re-synthesise the music / sound effects (deterministic, no samples) |
| `npm run dev` | Remotion Studio preview (all compositions, plus a 3D `Turntable` viewer) |
| `npm run render` | Final film → `out/little-tai-collection.mp4` |
| `npm run render:all` | Film, 16:9 cut, reveal clips, cards, boxes, lineup |
| `npm run qc:video` | ffprobe check: resolution, fps, duration, codecs, audio |
| `npm run build:site` | Builds `site/` (web-optimised videos, images, models, `data.json`) |
| `npm run serve:site` | Local preview of the site at http://localhost:4173 |

Useful flags for the generate scripts: `--only=dreamer,midnight`, `--stages=models,game`, `--strategy=shared-master`,
`--regenerate-stale`, `--retry-failed`, `--concurrency=2`.

## How the Tripo pipeline stays safe and resumable

- **Dependency graph** of steps (`scripts/tripo/pipeline.ts`), executed in waves; uploads and polling are free.
- **Manifest** `generation/manifest.json` records each task the moment Tripo returns its `task_id` (atomic writes),
  before polling, so an interrupted run resumes by polling the same task and never pays twice.
- **Cache**: each step is fingerprinted (endpoint, request body, input file hashes and upstream task ids). Unchanged
  steps are skipped. Changed prompts are kept unless `--regenerate-stale`. Old outputs move to `generation/history/`.
- **Retries**: exponential backoff on 429/5xx/network errors. Code 2000 ("all task slots busy") waits for a free slot
  and honours `Retry-After`. Downloads go to a temp file then rename. Polling has a timeout.
- **Cost guard**: plan + estimate first, balance check, then confirmation (`--yes` to skip). Credits actually consumed
  are reported per task. Observed prices: image-to-image 5–10, P2 quad figure 120, rig 25, retarget 10 per clip.
- **Model fallback**: P2-20260801 → P1-20260311 → v3.1 only when a version is rejected as unsupported.
- Remotion only loads local files listed in `asset-manifest.json`, written after GLB validation. It never uses
  temporary Tripo URLs.

### Identity consistency

The master is built in two passes: Seedream v5 turns the photos into art-toy proportions and material, then
`chat_image_2` refines the face and hair toward Tai's likeness while keeping image[1]'s proportions. Every edition is
derived from that one master (image[1]) plus edition-specific photo references, so face, hair and proportions stay
consistent. Figure-only props (stars, hearts, suitcase) are part of each generated mesh. Bases, boxes and the Midnight
Star's orrery are procedural.

## Game-ready rigging (deferred)

`npm run generate:game` creates, per edition: a T-pose sheet (`template: t_pose`), a triangle game mesh (H-series
v3.1), a free rig-check, a Mixamo-compatible rig (rig v3.0), and one GLB with in-place idle/walk/run/jump/fall
clips. That's about 125 credits per edition. Run `npm run generate:plan` first to see the exact plan. Set
`TRIPO_GAME_FORMAT=fbx` for Unity/Unreal-native FBX. Two T-pose sheets (Dreamer, Rebel) are already generated and
cached. When rigged GLBs exist, `npm run build:site` adds a playable "Game-ready" section with clip buttons and downloads.

## Publishing on GitHub Pages

1. `npm run render:all && npm run build:site`
2. Push to a GitHub repository (default branch `main`).
3. Settings → Pages → Source: **GitHub Actions**. The workflow publishes `site/` on every push that touches it.

All site paths are relative, so it works at `https://<user>.github.io/<repo>/`. The page shows only assets listed in
`site/data.json`.

## Project layout

```
src/
  characters/   figure metadata + prompts, GLB/procedural figure, bases, accessories, materials
  packaging/    blind-box geometry, opening mechanisms, painted packaging textures
  scenes/       Awakens, EditionReveal (01–04), Collection, SecretReveal, Finale
  components/   Stage (lights, env, camera), particles, set pieces, typography overlays, asset gate
  animations/   deterministic timing, easing, seeded RNG, camera helpers
  compositions/ Promo (9:16 + 16:9), RevealClip, CollectibleCard, BoxShot, Lineup, Turntable viewer
scripts/
  tripo/ generate-references/ generate-models/ generate-game/ download-assets/ convert/ qc/ audio/
site/           GitHub Pages showcase (model-viewer 4.4.0 vendored, Apache-2.0)
```

Everything animates from `useCurrentFrame()` (no `requestAnimationFrame`, no simulation state). Fonts, concept
images and GLBs block rendering until loaded.
