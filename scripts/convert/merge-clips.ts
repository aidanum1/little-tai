import { Document, NodeIO, type Accessor } from "@gltf-transform/core";
import { existsSync } from "node:fs";
import { EDITIONS } from "../../src/characters/figures";
import { fromRepo, toRepo } from "../tripo/env";
import { log } from "../tripo/log";
import { loadManifest } from "../tripo/manifest";
import { animationBatches, animStepKey, gameFileBase } from "../tripo/pipeline";

/**
 * The retarget endpoint returns at most 5 clips per GLB, each batch carrying its own copy of the same rigged mesh.
 * This folds every batch into one `NN-<id>-animated.glb` (mesh + skeleton from batch 1, clips from all batches,
 * bound to joints by name), gives each clip its short preset name ("walk", "heart_pose"…) and turns the figure to face
 * +Z. Free and local.
 */
const shortName = (preset: string) => preset.replace(/^preset:(biped:)?/, "");

const copyAccessor = (doc: Document, src: Accessor) =>
  doc
    .createAccessor(src.getName())
    .setType(src.getType())
    .setArray(src.getArray()!.slice())
    .setNormalized(src.getNormalized())
    .setBuffer(doc.getRoot().listBuffers()[0]);

/** Requested presets of a batch, matched to the clips Tripo returned (by name when it carries one, else by order). */
const nameClips = (returned: string[], requested: string[]) => {
  const left = requested.map(shortName);
  return returned.map((name, i) => {
    const hit = left.find((s) => name.toLowerCase().includes(s));
    return hit ?? left[i] ?? name;
  });
};

export const mergeClips = async () => {
  const manifest = await loadManifest();
  const io = new NodeIO();
  const batches = animationBatches();
  let merged = 0;
  for (const e of EDITIONS) {
    const files = batches.map((_, b) => manifest.tasks[animStepKey(e.id, b)]?.outputs?.model).map((rel) => (rel ? fromRepo(rel) : null));
    if (!files[0] || !existsSync(files[0]) || !files[0].endsWith(".glb")) continue;

    const base = await io.read(files[0]);
    const nodesByName = new Map(base.getRoot().listNodes().map((n) => [n.getName(), n]));
    base.getRoot().listAnimations().forEach((a, i, all) => a.setName(nameClips(all.map((x) => x.getName()), batches[0])[i]));

    for (let b = 1; b < batches.length; b++) {
      const file = files[b];
      if (!file || !existsSync(file)) {
        log.warn(`${e.id}: clip batch ${b + 1} missing — animated GLB has ${batches[0].length} clips only`);
        continue;
      }
      const extra = await io.read(file);
      const anims = extra.getRoot().listAnimations();
      const names = nameClips(anims.map((a) => a.getName()), batches[b]);
      anims.forEach((src, i) => {
        const anim = base.createAnimation(names[i]);
        for (const ch of src.listChannels()) {
          const target = nodesByName.get(ch.getTargetNode()?.getName() ?? "");
          const s = ch.getSampler();
          if (!target || !s) continue;
          const sampler = base
            .createAnimationSampler()
            .setInput(copyAccessor(base, s.getInput()!))
            .setOutput(copyAccessor(base, s.getOutput()!))
            .setInterpolation(s.getInterpolation());
          anim.addSampler(sampler).addChannel(base.createAnimationChannel().setTargetNode(target).setTargetPath(ch.getTargetPath()!).setSampler(sampler));
        }
      });
    }

    // Tripo rigs face +X; glTF's forward is +Z. Parent the scene under one node turned −90° about Y so the file
    // faces front in every engine and viewer (clips animate below it, so they are unaffected).
    const scene = base.getRoot().getDefaultScene() ?? base.getRoot().listScenes()[0];
    const holder = base.createNode("little_tai").setRotation([0, -Math.SQRT1_2, 0, Math.SQRT1_2]);
    for (const child of scene.listChildren()) {
      scene.removeChild(child);
      holder.addChild(child);
    }
    scene.addChild(holder);

    const out = `${gameFileBase(e.id, "animated")}.glb`;
    await io.write(out, base);
    log.ok(`${e.id}: ${base.getRoot().listAnimations().map((a) => a.getName()).join(", ")} → ${toRepo(out)}`);
    merged++;
  }
  return merged;
};

if (import.meta.url === `file://${process.argv[1]}`) await mergeClips();
