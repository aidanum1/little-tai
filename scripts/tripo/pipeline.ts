import { existsSync } from "node:fs";
import { mkdir, readFile, rename } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { EDITIONS, GAME_POSE_PROMPT, MASTER_PROMPT, MASTER_REFINE_PROMPT, editionPrompt, type EditionId } from "../../src/characters/figures";
import { TripoApiError, TripoClient, TripoTaskError, type TripoTask } from "./client";
import { config, fromRepo, paths, toRepo } from "./env";
import { c, log, table } from "./log";
import { loadManifest, saveManifest, sha256, sha256File, type Manifest, type TaskEntry } from "./manifest";

/**
 * Tripo generation pipeline as a dependency graph of paid steps.
 *
 *   references  photos → master-base (art-toy proportions) → master (likeness) → 5 edition concepts
 *   models      edition concept → textured PBR display figure (quad topology)
 *   game        edition concept → T-pose → game mesh → rig-check (free) → Mixamo-spec rig → animation clip batches
 *
 * Every step is cached in generation/manifest.json and resumable: a task_id is persisted before polling.
 */

export type Strategy = "per-edition" | "shared-master";
export type Stage = "references" | "models" | "game";

export interface PipelineOptions {
  stages: Stage[];
  dryRun: boolean;
  yes: boolean;
  only: string[] | null;
  strategy: Strategy;
  regenerateStale: boolean;
  retryFailed: boolean;
  concurrency: number;
}

interface StepDef {
  key: string;
  stage: Stage;
  endpoint: string;
  title: string;
  /** Upstream step keys that must have succeeded first. */
  deps: string[];
  /** Local files uploaded as `input`/`inputs`, in prompt order (image[1], image[2], …). */
  inputFiles?: () => string[];
  /** Upstream step keys whose Tripo task_id is passed as `input` (rig, retarget). */
  inputTasks?: string[];
  buildBody: (inputs: string[], variant: string) => Record<string, unknown>;
  /** Fallback chain (model versions); the first is preferred, later ones are tried only if rejected as unsupported. */
  variants: string[];
  /** Output name → local path without extension (extension follows the downloaded content). */
  outputs: Record<string, string>;
  estimatedCredits: number;
  /** Post-success check; returning a string rejects the result (downstream steps stay blocked). */
  verify?: (task: TripoTask) => string | null;
}

// Estimates (1 credit = $0.01). The public table (https://developers.tripo3d.ai/en/pricing) covers the H series;
// P-series prices are observed from credits_consumed: P2 + quad + detailed texture = 120 per model.
const TEXTURE_EXTRA = config.textureQuality === "detailed" ? 10 : config.textureQuality === "extreme" ? 20 : 0;
const DISPLAY_MODEL_CREDITS = config.modelVersion.startsWith("P2") ? 120 : config.modelVersion.startsWith("P1") ? 90 : 30 + 5 + TEXTURE_EXTRA;
const GAME_MODEL_VERSION = process.env.TRIPO_GAME_MODEL_VERSION?.trim() || "v3.1-20260211";
const GAME_MODEL_CREDITS = GAME_MODEL_VERSION.startsWith("P") ? 110 : 30 + TEXTURE_EXTRA;
const RIG_CREDITS = 25;
const RETARGET_CREDITS_EACH = 10;

// Rig v1.0 is the only rig with Tripo's expressive biped library (greet, dance, heart pose…); v2.5/v3.0 offer 11 generic
// presets. These eight clips drive the "after hours" short film and double as the game set.
export const GAME_ANIMATIONS = [
  "preset:biped:idle",
  "preset:biped:look_around",
  "preset:biped:walk",
  "preset:biped:greet_01",
  "preset:biped:heart_pose",
  "preset:biped:dance_01",
  "preset:biped:run",
  "preset:biped:jump",
];
/** The retarget endpoint accepts at most 5 animations per request. */
const RETARGET_BATCH = 5;
export const animationBatches = () =>
  Array.from({ length: Math.ceil(GAME_ANIMATIONS.length / RETARGET_BATCH) }, (_, i) => GAME_ANIMATIONS.slice(i * RETARGET_BATCH, (i + 1) * RETARGET_BATCH));
/** Step key of each retarget batch: game-anim:<id>, game-anim-2:<id>, … */
export const animStepKey = (id: EditionId, batch: number) => (batch === 0 ? `game-anim:${id}` : `game-anim-${batch + 1}:${id}`);

const MODEL_FALLBACKS = [config.modelVersion, "P1-20260311", "v3.1-20260211"].filter((v, i, a) => a.indexOf(v) === i);
const RIG_MODEL = "v1.0-20240301";

const photo = (name: string) => path.join(paths.photos, name);
const pad = (e: { index: number }) => String(e.index + 1).padStart(2, "0");

export const resolveOutput = (manifest: Manifest, key: string, name: string): string | null => {
  const rel = manifest.tasks[key]?.outputs?.[name];
  if (rel && existsSync(fromRepo(rel))) return fromRepo(rel);
  return null;
};

const conceptPath = (manifest: Manifest, id: string) => resolveOutput(manifest, `concept:${id}`, "image");

export const modelFileBase = (id: EditionId | "master") => {
  const e = EDITIONS.find((x) => x.id === id);
  return path.join(paths.models, e ? `figure-${pad(e)}-${e.id}` : "figure-00-master");
};

export const gameFileBase = (id: EditionId, suffix: string) => {
  const e = EDITIONS.find((x) => x.id === id)!;
  return path.join(paths.models, "game", `${pad(e)}-${e.id}-${suffix}`);
};

/** Portrait full-body framing per image model (each model accepts a different size vocabulary). */
const imageSize = (model: string): Record<string, unknown> => {
  if (model.startsWith("seedream")) return { size: "1728x2304" }; // explicit WxH, 3.69–10.4 MP
  if (model.startsWith("chat_image_2")) return { size: "1024x1536", quality: "medium" };
  if (model.startsWith("chat_image")) return { size: "1024x1536" };
  if (model === "banana") return { size: "864x1184" };
  return { size: "2K", aspect_ratio: "3:4" }; // banana_pro / banana2
};

const imageCredits = (model: string) => (model.startsWith("chat_image_2") || model === "banana2" ? 10 : model === "banana_pro" ? 15 : 5);

const imageBody =
  (prompt: string, extra: Record<string, unknown> = {}) =>
  (inputs: string[], model: string) => ({
    model,
    ...(inputs.length === 1 ? { input: inputs[0] } : { inputs }),
    prompt,
    ...imageSize(model),
    output_format: "png",
    ...extra,
  });

const modelBody =
  (kind: "display" | "game") =>
  (inputs: string[], modelVersion: string): Record<string, unknown> => {
    const isP2 = modelVersion.startsWith("P2");
    const isP = modelVersion.startsWith("P");
    return {
      input: inputs[0],
      model: modelVersion,
      texture: true,
      pbr: true,
      // Display figures: quad topology for clean close-ups. Game meshes: triangles, lighter, rig-friendly.
      ...(kind === "display" ? (isP2 ? { quad: true, face_limit: 20000 } : isP ? { face_limit: 20000 } : {}) : { face_limit: isP ? 14000 : 30000 }),
      texture_quality: config.textureQuality,
      texture_alignment: "original_image",
      model_seed: 20260801,
      texture_seed: 1028,
      export_uv: true,
    };
  };

export const buildSteps = (manifest: Manifest, strategy: Strategy): StepDef[] => {
  const steps: StepDef[] = [
    {
      key: "concept:master-base",
      stage: "references",
      endpoint: "/generation/image-to-image",
      title: "Master base — art-toy proportions, pose and material (photos → figurine)",
      deps: [],
      inputFiles: () => [photo("tai_02.jpg"), photo("tai_01.jpg"), photo("tai_04.jpg")],
      buildBody: imageBody(MASTER_PROMPT),
      variants: [config.imageModel],
      outputs: { image: path.join(paths.concepts, "master-base") },
      estimatedCredits: imageCredits(config.imageModel),
    },
    {
      key: "concept:master",
      stage: "references",
      endpoint: "/generation/image-to-image",
      title: "Master reference — likeness refinement on the master base",
      deps: ["concept:master-base"],
      inputFiles: () => [conceptPath(manifest, "master-base") ?? path.join(paths.concepts, "master-base.png"), photo("tai_02.jpg"), photo("tai_01.jpg")],
      buildBody: imageBody(MASTER_REFINE_PROMPT),
      variants: [config.refineModel],
      outputs: { image: path.join(paths.concepts, "master") },
      estimatedCredits: imageCredits(config.refineModel),
    },
  ];

  for (const e of EDITIONS) {
    steps.push({
      key: `concept:${e.id}`,
      stage: "references",
      endpoint: "/generation/image-to-image",
      title: `Concept — ${e.name}`,
      deps: ["concept:master"],
      inputFiles: () => [conceptPath(manifest, "master") ?? path.join(paths.concepts, "master.png"), ...e.referencePhotos.map(photo)].slice(0, 4),
      buildBody: imageBody(editionPrompt(e)),
      variants: [config.refineModel],
      outputs: { image: path.join(paths.concepts, e.id) },
      estimatedCredits: imageCredits(config.refineModel),
    });
  }

  const displayTargets: (EditionId | "master")[] = strategy === "shared-master" ? ["master"] : EDITIONS.map((e) => e.id);
  for (const id of displayTargets) {
    steps.push({
      key: `model:${id}`,
      stage: "models",
      endpoint: "/generation/image-to-model",
      title: `3D display figure — ${id === "master" ? "shared master" : EDITIONS.find((e) => e.id === id)!.name}`,
      deps: [`concept:${id}`],
      inputFiles: () => [conceptPath(manifest, id) ?? path.join(paths.concepts, `${id}.png`)],
      buildBody: modelBody("display"),
      variants: MODEL_FALLBACKS,
      outputs: { model: modelFileBase(id), preview: path.join(paths.previews, path.basename(modelFileBase(id))) },
      estimatedCredits: DISPLAY_MODEL_CREDITS,
    });
  }

  for (const e of EDITIONS) {
    const k = (s: string) => `game-${s}:${e.id}`;
    steps.push(
      {
        key: k("pose"),
        stage: "game",
        endpoint: "/generation/image-to-image",
        title: `Game T-pose sheet — ${e.name}`,
        deps: [`concept:${e.id}`],
        inputFiles: () => [conceptPath(manifest, e.id) ?? path.join(paths.concepts, `${e.id}.png`)],
        buildBody: imageBody(GAME_POSE_PROMPT, { template: "t_pose" }),
        variants: [config.refineModel, config.imageModel],
        outputs: { image: path.join(paths.concepts, "game", `${pad(e)}-${e.id}-tpose`) },
        estimatedCredits: imageCredits(config.refineModel),
      },
      {
        key: k("model"),
        stage: "game",
        endpoint: "/generation/image-to-model",
        title: `Game mesh (triangles, rig-ready) — ${e.name}`,
        deps: [k("pose")],
        inputFiles: () => [resolveOutput(manifest, k("pose"), "image") ?? path.join(paths.concepts, "game", `${pad(e)}-${e.id}-tpose.png`)],
        buildBody: modelBody("game"),
        // H series: triangle mesh, real-time friendly and far cheaper than P2 quad
        variants: [GAME_MODEL_VERSION, "v3.0-20250812"],
        outputs: { model: gameFileBase(e.id, "base"), preview: gameFileBase(e.id, "base-preview") },
        estimatedCredits: GAME_MODEL_CREDITS,
      },
      {
        key: k("rigcheck"),
        stage: "game",
        endpoint: "/animations/rig-check",
        title: `Rig check (free) — ${e.name}`,
        deps: [k("model")],
        inputTasks: [k("model")],
        buildBody: (inputs) => ({ input: inputs[0] }),
        variants: [""],
        outputs: {},
        estimatedCredits: 0,
        verify: (task) => (task.output?.riggable === false ? `not riggable (suggested rig_type: ${String(task.output?.rig_type ?? "?")})` : null),
      },
      {
        key: k("rig"),
        stage: "game",
        endpoint: "/animations/rig",
        title: `Auto-rig (biped, Mixamo skeleton) — ${e.name}`,
        deps: [k("rigcheck")],
        inputTasks: [k("model")],
        buildBody: (inputs, model) => ({
          input: inputs[0],
          model,
          rig_type: String(manifest.tasks[k("rigcheck")]?.remote_output?.rig_type ?? "biped"),
          spec: "mixamo",
          out_format: config.gameFormat,
        }),
        // no fallback: the biped presets only exist on rig v1.0
        variants: [RIG_MODEL],
        outputs: { model: gameFileBase(e.id, "rigged") },
        estimatedCredits: RIG_CREDITS,
      },
      ...animationBatches().map((clips, b) => ({
        key: animStepKey(e.id, b),
        stage: "game" as const,
        endpoint: "/animations/retarget",
        title: `Animation clips (${clips.map((a) => a.replace(/^preset:(biped:)?/, "")).join(", ")}) — ${e.name}`,
        deps: [k("rig")],
        inputTasks: [k("rig")],
        buildBody: (inputs: string[]) => ({
          input: inputs[0],
          animations: clips,
          out_format: config.gameFormat,
          export_with_geometry: true,
          animate_in_place: true,
        }),
        variants: [""],
        outputs: { model: gameFileBase(e.id, `clips-${b + 1}`) },
        estimatedCredits: RETARGET_CREDITS_EACH * clips.length,
      })),
    );
  }
  return steps;
};

type Action = "cached" | "stale-kept" | "resume" | "new" | "blocked" | "failed-kept";

interface PlannedStep {
  step: StepDef;
  action: Action;
  reason: string;
  fingerprint: string | null;
}

const succeeded = (manifest: Manifest, key: string) => manifest.tasks[key]?.status === "success";

/** Inputs for fingerprinting: file content hashes and upstream task ids (never expiring upload tokens). */
const fingerprintOf = async (manifest: Manifest, step: StepDef): Promise<string | null> => {
  const files = step.inputFiles?.() ?? [];
  if (!files.every((f) => existsSync(f))) return null;
  const tasks = (step.inputTasks ?? []).map((k) => (succeeded(manifest, k) ? manifest.tasks[k].task_id : null));
  if (tasks.some((t) => t === null)) return null;
  const inputs = [...(await Promise.all(files.map(sha256File))), ...(tasks as string[])];
  return sha256(JSON.stringify({ endpoint: step.endpoint, body: step.buildBody(inputs, step.variants[0]) }));
};

const outputsPresent = (entry: TaskEntry | undefined, step: StepDef) => {
  if (Object.keys(step.outputs).length === 0) return true;
  const outs = Object.values(entry?.outputs ?? {});
  return outs.length > 0 && outs.every((rel) => existsSync(fromRepo(rel)));
};

const planStep = async (manifest: Manifest, step: StepDef, opts: PipelineOptions, pending: Set<string>): Promise<PlannedStep> => {
  const entry = manifest.tasks[step.key];
  const fp = await fingerprintOf(manifest, step);
  const waitsOnUpstream = step.deps.some((d) => pending.has(d));

  if (entry?.status === "success" && outputsPresent(entry, step)) {
    if (fp === null || entry.fingerprint === fp) return { step, action: "cached", reason: "done, assets on disk", fingerprint: fp };
    if (!opts.regenerateStale) return { step, action: "stale-kept", reason: "inputs changed — keeping existing asset (use --regenerate-stale)", fingerprint: fp };
    return { step, action: "new", reason: "inputs changed, --regenerate-stale", fingerprint: fp };
  }
  if (entry?.task_id && (entry.status === "queued" || entry.status === "running" || entry.status === "success")) {
    return { step, action: "resume", reason: `poll existing ${entry.task_id} (no new charge)`, fingerprint: fp };
  }
  if (entry && ["failed", "cancelled", "rejected"].includes(entry.status) && !opts.retryFailed) {
    return { step, action: "failed-kept", reason: `last task ${entry.status}${entry.error ? `: ${entry.error.slice(0, 60)}` : ""} — use --retry-failed`, fingerprint: fp };
  }
  if (waitsOnUpstream) return { step, action: "new", reason: `after ${step.deps.join(", ")}`, fingerprint: null };
  const missingDeps = step.deps.filter((d) => !succeeded(manifest, d));
  if (missingDeps.length || fp === null) {
    return { step, action: "blocked", reason: missingDeps.length ? `needs ${missingDeps.join(", ")}` : "missing input file", fingerprint: null };
  }
  return { step, action: "new", reason: entry ? `previous task ${entry.status}` : "not generated yet", fingerprint: fp };
};

const ACTION_LABEL: Record<Action, string> = {
  cached: c.green("cached"),
  "stale-kept": c.yellow("kept (stale)"),
  resume: c.cyan("resume"),
  new: c.magenta("NEW · paid"),
  blocked: c.red("blocked"),
  "failed-kept": c.yellow("skip (failed)"),
};

export const runPipeline = async (opts: PipelineOptions) => {
  const manifest = await loadManifest();
  const steps = buildSteps(manifest, opts.strategy).filter(
    (s) => opts.stages.includes(s.stage) && (!opts.only || opts.only.some((o) => s.key === o || s.key.endsWith(`:${o}`))),
  );

  // Steps are declared in dependency order, so `pending` is complete for each step's upstream.
  const plan: PlannedStep[] = [];
  const pending = new Set<string>();
  for (const step of steps) {
    const p = await planStep(manifest, step, opts, pending);
    if (p.action === "new" || p.action === "resume") pending.add(step.key);
    plan.push(p);
  }

  const paid = plan.filter((p) => p.action === "new");
  const estimate = paid.reduce((sum, p) => sum + p.step.estimatedCredits, 0);

  console.log();
  console.log(c.bold(`little TAI — Tripo generation plan ${opts.dryRun ? c.yellow("(dry run — nothing will be sent)") : ""}`));
  console.log(
    c.dim(
      `images ${config.imageModel} → ${config.refineModel} · 3D ${config.modelVersion} (fallbacks ${MODEL_FALLBACKS.slice(1).join(", ")}) · texture ${config.textureQuality} · rig ${RIG_MODEL}/mixamo → ${config.gameFormat} · strategy ${opts.strategy}`,
    ),
  );
  console.log();
  table(
    plan.map((p) => [p.step.key, `POST ${p.step.endpoint}`, ACTION_LABEL[p.action], p.action === "new" ? `~${p.step.estimatedCredits}` : "0", c.dim(p.reason)]),
    ["step", "request", "action", "credits", "note"],
  );
  console.log();
  console.log(`${c.bold("Paid requests:")} ${paid.length}   ${c.bold("Estimated credits:")} ~${estimate} (≈ $${(estimate / 100).toFixed(2)})   ${c.dim("uploads, polling and rig-check are free; failed tasks are refunded")}`);
  console.log();

  if (opts.dryRun) {
    for (const p of paid) {
      const placeholders = [...(p.step.inputFiles?.() ?? []).map((f) => `<file_token:${path.basename(f)}>`), ...(p.step.inputTasks ?? []).map((k) => `<task_id:${k}>`)];
      console.log(c.dim(`${p.step.key} → POST ${config.baseUrl}${p.step.endpoint}`));
      console.log(c.dim(JSON.stringify(p.step.buildBody(placeholders, p.step.variants[0]), null, 2).replace(/"prompt": "(.{90}).*?"/, '"prompt": "$1…"')));
    }
    if (!config.apiKey) log.warn("TRIPO_API_KEY is not set — copy .env.example to .env and add your key to run for real.");
    return { ran: false };
  }

  if (!config.apiKey) {
    log.error("TRIPO_API_KEY is not set. Add it to .env (see .env.example). Nothing was sent.");
    process.exitCode = 1;
    return { ran: false };
  }

  const client = new TripoClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });
  let before;
  try {
    before = await client.getBalance();
  } catch (e) {
    log.error(`${(e as Error).message}${e instanceof TripoApiError && e.suggestion ? ` — ${e.suggestion}` : ""}. Nothing was sent.`);
    process.exitCode = 1;
    return { ran: false };
  }
  log.info(`Balance: ${before.balance} credits available, ${before.frozen} frozen`);

  if (paid.length > 0) {
    if (before.balance < estimate) {
      log.error(`Estimated ~${estimate} credits but only ${before.balance} available. Top up or narrow with --only.`);
      process.exitCode = 1;
      return { ran: false };
    }
    if (!opts.yes) {
      if (!process.stdin.isTTY) {
        log.error("Refusing to spend credits non-interactively. Re-run with --yes to confirm.");
        process.exitCode = 1;
        return { ran: false };
      }
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await rl.question(`Send ${paid.length} paid request(s), ~${estimate} credits? [y/N] `);
      rl.close();
      if (!/^y(es)?$/i.test(answer.trim())) {
        log.warn("Cancelled. Nothing was sent.");
        return { ran: false };
      }
    }
  }

  const runner = new StepRunner(client, manifest);
  const failures: string[] = [];
  let queue = plan.filter((p) => p.action === "new" || p.action === "resume");
  // Run in waves: everything whose upstream has succeeded, in parallel; repeat until nothing is runnable.
  for (;;) {
    const ready = queue.filter((p) => p.step.deps.every((d) => succeeded(manifest, d)));
    if (ready.length === 0) break;
    queue = queue.filter((p) => !ready.includes(p));
    await runPool(ready, opts.concurrency, (p) => runner.run(p).catch((e) => failures.push(`${p.step.key}: ${(e as Error).message}`)));
  }
  for (const p of queue) failures.push(`${p.step.key}: skipped — upstream ${p.step.deps.filter((d) => !succeeded(manifest, d)).join(", ")} did not succeed`);

  const after = await client.getBalance().catch(() => null);
  console.log();
  console.log(c.bold("Credit usage"));
  table(
    runner.charged.map((r) => [r.key, r.taskId, String(r.credits)]),
    ["step", "task", "credits_consumed"],
  );
  const spent = runner.charged.reduce((s, r) => s + r.credits, 0);
  const lifetime = Object.values(manifest.tasks).reduce((s, t) => s + (t.status === "success" ? (t.credits_consumed ?? 0) : 0), 0);
  console.log(`This run: ${spent} credits · all cached assets so far: ${lifetime} credits${after ? ` · balance now ${after.balance} (frozen ${after.frozen})` : ""}`);

  if (failures.length) {
    console.log();
    for (const f of failures) log.error(f);
    process.exitCode = 1;
  }
  return { ran: true, failures };
};

const runPool = async <T>(items: T[], n: number, fn: (item: T) => Promise<unknown>) => {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(n, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift()!);
    }),
  );
};

class StepRunner {
  charged: { key: string; taskId: string; credits: number }[] = [];

  constructor(
    private client: TripoClient,
    private manifest: Manifest,
  ) {}

  /** Upload with token cache keyed by file content hash. Tokens older than 12h are refreshed (uploads are free). */
  private async token(file: string) {
    const hash = await sha256File(file);
    const cached = this.manifest.uploads[hash];
    if (cached && Date.now() - Date.parse(cached.uploaded_at) < 12 * 3600_000) return cached.file_token;
    log.step(`upload ${toRepo(file)}`);
    const file_token = await this.client.uploadFile(file);
    this.manifest.uploads[hash] = { file: toRepo(file), sha256: hash, file_token, uploaded_at: new Date().toISOString() };
    await saveManifest(this.manifest);
    return file_token;
  }

  async run(p: PlannedStep) {
    const { step } = p;
    log.step(`${c.bold(step.key)} — ${step.title}`);
    let entry = this.manifest.tasks[step.key];
    const fingerprint = p.fingerprint ?? (await fingerprintOf(this.manifest, step)) ?? "unknown";

    if (p.action === "new" || !entry?.task_id) {
      // Never destroy a paid asset: earlier outputs move to generation/history/ before regenerating.
      for (const rel of Object.values(entry?.outputs ?? {})) {
        const abs = fromRepo(rel);
        if (!existsSync(abs)) continue;
        const dest = path.join(paths.root, "generation", "history", `${step.key.replace(":", "-")}-${entry!.task_id.slice(0, 8)}${path.extname(abs)}`);
        await mkdir(path.dirname(dest), { recursive: true });
        await rename(abs, dest);
        log.info(`  kept previous output → ${toRepo(dest)}`);
      }
      const fileInputs = await Promise.all((step.inputFiles?.() ?? []).map((f) => this.token(f)));
      const taskInputs = (step.inputTasks ?? []).map((k) => this.manifest.tasks[k].task_id);
      const { taskId, body, variant } = await this.create(step, [...fileInputs, ...taskInputs]);
      const history = entry ? [...(entry.history ?? []), { task_id: entry.task_id, status: entry.status, error: entry.error, at: new Date().toISOString() }] : [];
      entry = {
        key: step.key,
        endpoint: step.endpoint,
        fingerprint,
        request: body,
        task_id: taskId,
        status: "queued",
        progress: 0,
        created_at: new Date().toISOString(),
        model_version: variant || undefined,
        history: history.length ? history : undefined,
      };
      this.manifest.tasks[step.key] = entry;
      await saveManifest(this.manifest); // persisted before polling → resumable
      log.ok(`created ${taskId}`);
    } else {
      log.info(`  resuming ${entry.task_id}`);
    }

    let task: TripoTask;
    try {
      task = await this.client.waitForTask(entry.task_id, {
        timeoutMs: config.pollTimeoutMs,
        onUpdate: (t) => {
          entry!.status = t.status;
          entry!.progress = t.progress ?? 0;
        },
      });
    } catch (e) {
      if (e instanceof TripoTaskError) {
        entry.status = e.task.status;
        entry.error = e.message;
      }
      await saveManifest(this.manifest);
      throw e;
    }

    entry.progress = 100;
    entry.completed_at = task.completed_at ?? new Date().toISOString();
    entry.credits_consumed = task.credits_consumed ?? 0;
    entry.remote_output = task.output;
    entry.error = undefined;
    this.charged.push({ key: step.key, taskId: task.task_id, credits: entry.credits_consumed });

    const rejection = step.verify?.(task) ?? null;
    if (rejection) {
      entry.status = "rejected";
      entry.error = rejection;
      await saveManifest(this.manifest);
      throw new Error(rejection);
    }

    entry.outputs = await this.downloadOutputs(step, task);
    entry.status = "success";
    await saveManifest(this.manifest);
    const files = Object.values(entry.outputs);
    log.ok(`${step.key} done · ${entry.credits_consumed} credits${files.length ? ` · ${files.join(", ")}` : ` · ${JSON.stringify(task.output)}`}`);
  }

  private async create(step: StepDef, inputs: string[]) {
    let lastError: unknown;
    for (const variant of step.variants) {
      const body = step.buildBody(inputs, variant);
      try {
        return { taskId: await this.client.createTask(step.endpoint, body), body, variant };
      } catch (e) {
        lastError = e;
        const unsupported = e instanceof TripoApiError && (e.code === 2002 || e.code === 2015 || (e.httpStatus === 400 && /model|version|quad|template|size|quality/i.test(e.message)));
        if (step.variants.length === 1 || !unsupported) throw e;
        log.warn(`${variant} rejected (${(e as Error).message}) — trying next supported variant`);
      }
    }
    throw lastError;
  }

  private async downloadOutputs(step: StepDef, task: TripoTask): Promise<Record<string, string>> {
    const out = task.output ?? {};
    const urls: Record<string, string | undefined> = {};
    if ("image" in step.outputs) urls.image = pickUrl(out, ["generated_image_url", "image_url", "image"]);
    if ("model" in step.outputs) urls.model = pickUrl(out, ["model_url", "pbr_model", "model", "base_model"]);
    if ("preview" in step.outputs) urls.preview = pickUrl(out, ["rendered_image_url", "rendered_image"]);
    const saved: Record<string, string> = {};
    for (const [name, url] of Object.entries(urls)) {
      if (!url) {
        if (name === "preview") continue;
        throw new Error(`${step.key}: task succeeded but output has no ${name} URL (${JSON.stringify(out).slice(0, 200)})`);
      }
      const base = step.outputs[name];
      const tmpDest = `${base}.download`;
      await mkdir(path.dirname(base), { recursive: true });
      const { bytes } = await TripoClient.download(url, tmpDest, paths.tmp);
      const ext = await sniffExtension(tmpDest, name === "model" ? `.${config.gameFormat}` : ".png");
      const dest = `${base}${ext}`;
      await rename(tmpDest, dest);
      saved[name] = toRepo(dest);
      log.info(`  ↓ ${toRepo(dest)} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
    }
    return saved;
  }
}

const pickUrl = (output: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) {
    const v = output[k];
    if (typeof v === "string" && /^https?:\/\//.test(v)) return v;
    if (v && typeof v === "object" && typeof (v as { url?: unknown }).url === "string") return (v as { url: string }).url;
  }
  return undefined;
};

const sniffExtension = async (file: string, fallback: string) => {
  const head = (await readFile(file)).subarray(0, 32);
  if (head.toString("ascii", 0, 4) === "glTF") return ".glb";
  if (head.toString("ascii", 0, 18) === "Kaydara FBX Binary") return ".fbx";
  if (head[0] === 0x89 && head.toString("ascii", 1, 4) === "PNG") return ".png";
  if (head[0] === 0xff && head[1] === 0xd8) return ".jpg";
  if (head.toString("ascii", 8, 12) === "WEBP") return ".webp";
  if (head.toString("ascii", 0, 2) === "PK") return ".zip";
  return fallback;
};

export const parseArgs = (argv: string[], defaults: Partial<PipelineOptions> = {}): PipelineOptions => {
  const flag = (name: string) => argv.includes(`--${name}`);
  const value = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const only = value("only");
  const stages = value("stages");
  return {
    stages: stages ? (stages.split(",") as Stage[]) : (defaults.stages ?? ["references", "models", "game"]),
    dryRun: flag("dry-run") || defaults.dryRun === true,
    yes: flag("yes"),
    only: only ? only.split(",").map((s) => s.trim()) : null,
    strategy: (value("strategy") as Strategy) ?? "per-edition",
    regenerateStale: flag("regenerate-stale"),
    retryFailed: flag("retry-failed"),
    concurrency: Number(value("concurrency") ?? 3),
  };
};
