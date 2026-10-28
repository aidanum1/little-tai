import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { paths } from "./env";

/**
 * Persistent task manifest (generation/manifest.json).
 * Every paid task is written here the moment Tripo returns its task_id, so an interrupted run
 * resumes by polling the same task instead of paying for a new one.
 */

export interface UploadEntry {
  file: string;
  sha256: string;
  file_token: string;
  uploaded_at: string;
}

export interface TaskEntry {
  key: string;
  endpoint: string;
  fingerprint: string;
  request: Record<string, unknown>;
  task_id: string;
  status: string;
  progress: number;
  created_at: string;
  completed_at?: string;
  credits_consumed?: number;
  outputs?: Record<string, string>;
  remote_output?: Record<string, unknown>;
  error?: string;
  model_version?: string;
  history?: { task_id: string; status: string; error?: string; at: string }[];
}

export interface Manifest {
  version: 1;
  uploads: Record<string, UploadEntry>;
  tasks: Record<string, TaskEntry>;
}

export const sha256File = async (file: string) => createHash("sha256").update(await readFile(file)).digest("hex");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export const loadManifest = async (): Promise<Manifest> => {
  if (!existsSync(paths.manifest)) return { version: 1, uploads: {}, tasks: {} };
  return JSON.parse(await readFile(paths.manifest, "utf8")) as Manifest;
};

let writing = Promise.resolve();

/**
 * Tripo outputs are signed, expiring CDN links that embed the account's client id. Nothing needs them after
 * download (download-assets re-queries the task), so they are never written to disk — the manifest is safe to commit.
 */
const redactUrls = (value: unknown): unknown => {
  if (typeof value === "string") return /^https?:\/\//.test(value) ? "<signed url omitted>" : value;
  if (Array.isArray(value)) return value.map(redactUrls);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactUrls(v)]));
  return value;
};

/** Atomic write (temp + rename), serialized so concurrent steps never interleave. */
export const saveManifest = (m: Manifest) => {
  writing = writing.then(async () => {
    await mkdir(path.dirname(paths.manifest), { recursive: true });
    const tmp = `${paths.manifest}.tmp`;
    const safe = { ...m, tasks: Object.fromEntries(Object.entries(m.tasks).map(([k, t]) => [k, { ...t, remote_output: redactUrls(t.remote_output) as Record<string, unknown> | undefined }])) };
    await writeFile(tmp, JSON.stringify(safe, null, 2) + "\n");
    await rename(tmp, paths.manifest);
  });
  return writing;
};
