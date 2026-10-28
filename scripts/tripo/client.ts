import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { log } from "./log";

/** Tripo API v3 client. Docs: https://developers.tripo3d.ai/en/docs/introduction */

export type TaskStatus = "queued" | "running" | "success" | "failed" | "cancelled";

export interface TripoTask {
  task_id: string;
  type: string;
  status: TaskStatus;
  progress: number;
  output?: Record<string, unknown>;
  credits_consumed?: number;
  error_code?: number;
  error_message?: string;
  created_at?: string;
  completed_at?: string;
}

export interface Balance {
  balance: number;
  frozen: number;
}

// Codes documented as transient: 1007 rate limit, 2000 concurrency limit.
const RETRYABLE_CODES = new Set([1007, 2000]);

export class TripoApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly code: number | undefined,
    readonly retryable: boolean,
    readonly suggestion?: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "TripoApiError";
  }
}

export class TripoTaskError extends Error {
  constructor(
    message: string,
    readonly task: TripoTask,
  ) {
    super(message);
    this.name = "TripoTaskError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

export class TripoClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly maxRetries: number;

  constructor(opts: { apiKey: string; baseUrl: string; maxRetries?: number }) {
    if (!opts.apiKey) throw new Error("TRIPO_API_KEY is missing");
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.maxRetries = opts.maxRetries ?? 5;
  }

  private async request<T>(method: "GET" | "POST", pathname: string, body?: { json?: unknown; form?: FormData }): Promise<T> {
    const url = `${this.baseUrl}${pathname}`;
    let attempt = 0;
    // "Concurrency limit" (code 2000) only means all task slots are busy: wait for a slot for up to ~15 min
    // without spending the normal retry budget.
    let slotWaits = 0;
    for (;;) {
      let retryAfterMs: number | null = null;
      try {
        const res = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            ...(body?.json !== undefined ? { "Content-Type": "application/json" } : {}),
          },
          body: body?.form ?? (body?.json !== undefined ? JSON.stringify(body.json) : undefined),
          signal: AbortSignal.timeout(body?.form ? 180_000 : 60_000),
        });
        const text = await res.text();
        let parsed: { code?: number; data?: T; message?: string; suggestion?: string; request_id?: string } = {};
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { message: text.slice(0, 300) };
        }
        if (res.ok && parsed.code === 0) return parsed.data as T;

        const retryable = res.status === 429 || res.status >= 500 || (parsed.code !== undefined && RETRYABLE_CODES.has(parsed.code));
        const retryAfter = res.headers.get("retry-after");
        if (retryAfter && !Number.isNaN(Number(retryAfter))) retryAfterMs = Number(retryAfter) * 1000;
        const err = new TripoApiError(
          `${method} ${pathname} → HTTP ${res.status}${parsed.code !== undefined ? ` code ${parsed.code}` : ""}: ${parsed.message ?? "unknown error"}`,
          res.status,
          parsed.code,
          retryable,
          parsed.suggestion,
          parsed.request_id,
        );
        if (parsed.code === 2000 && slotWaits < 45) {
          slotWaits++;
          const wait = retryAfterMs ?? 20_000;
          if (slotWaits === 1 || slotWaits % 5 === 0) log.info(`  all Tripo task slots busy — waiting for a free slot (${slotWaits})`);
          await sleep(wait);
          continue;
        }
        if (!retryable || attempt >= this.maxRetries) throw err;
        log.warn(`${err.message} — retrying`);
      } catch (e) {
        if (e instanceof TripoApiError) throw e;
        // Network failure / timeout: retry with backoff.
        if (attempt >= this.maxRetries) throw e;
        log.warn(`${method} ${pathname} network error (${(e as Error).message}) — retrying`);
      }
      const backoff = retryAfterMs ?? Math.min(60_000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 400);
      attempt++;
      log.info(`  waiting ${(backoff / 1000).toFixed(1)}s before retry ${attempt}/${this.maxRetries}`);
      await sleep(backoff);
    }
  }

  async getBalance(): Promise<Balance> {
    return this.request<Balance>("GET", "/account/balance");
  }

  /** POST /files — multipart upload, returns a file_token usable as `input`. */
  async uploadFile(filePath: string): Promise<string> {
    const buf = await readFile(filePath);
    const type = MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
    const form = new FormData();
    form.append("file", new Blob([buf], { type }), path.basename(filePath));
    const data = await this.request<{ file_token: string }>("POST", "/files", { form });
    if (!data?.file_token) throw new Error(`Upload of ${filePath} returned no file_token`);
    return data.file_token;
  }

  async createTask(endpoint: string, body: Record<string, unknown>): Promise<string> {
    const data = await this.request<{ task_id: string }>("POST", endpoint, { json: body });
    if (!data?.task_id) throw new Error(`${endpoint} returned no task_id`);
    return data.task_id;
  }

  async getTask(taskId: string): Promise<TripoTask> {
    return this.request<TripoTask>("GET", `/tasks/${encodeURIComponent(taskId)}`);
  }

  /** Polls GET /tasks/{id} until a final status, with a gently growing interval and a hard timeout. */
  async waitForTask(
    taskId: string,
    opts: { timeoutMs: number; onUpdate?: (task: TripoTask) => void },
  ): Promise<TripoTask> {
    const started = Date.now();
    let interval = 3000;
    let lastLine = "";
    for (;;) {
      const task = await this.getTask(taskId);
      opts.onUpdate?.(task);
      const line = `${task.status} ${task.progress ?? 0}%`;
      if (line !== lastLine) {
        log.info(`  ${taskId}  ${progressBar(task.progress ?? 0)} ${line}`);
        lastLine = line;
      }
      if (task.status === "success") return task;
      if (task.status === "failed" || task.status === "cancelled") {
        throw new TripoTaskError(
          `Task ${taskId} ${task.status}${task.error_code ? ` (code ${task.error_code})` : ""}${task.error_message ? `: ${task.error_message}` : ""}`,
          task,
        );
      }
      if (Date.now() - started > opts.timeoutMs) {
        throw new Error(
          `Timed out after ${Math.round(opts.timeoutMs / 60000)} min waiting for ${taskId} (last: ${line}). It is saved in the manifest — re-run to resume polling without paying again.`,
        );
      }
      await sleep(interval);
      interval = Math.min(15_000, Math.round(interval * 1.2));
    }
  }

  /** Downloads to a temp file then renames, so an interrupted download never leaves a truncated asset. */
  static async download(url: string, dest: string, tmpDir: string): Promise<{ bytes: number; contentType: string | null }> {
    await mkdir(path.dirname(dest), { recursive: true });
    await mkdir(tmpDir, { recursive: true });
    const tmp = path.join(tmpDir, `${path.basename(dest)}.${process.pid}.part`);
    let attempt = 0;
    for (;;) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(300_000) });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        await pipeline(Readable.fromWeb(res.body as unknown as WebReadableStream), createWriteStream(tmp));
        const { size } = await stat(tmp);
        if (size === 0) throw new Error("empty response");
        await rename(tmp, dest);
        return { bytes: size, contentType: res.headers.get("content-type") };
      } catch (e) {
        await rm(tmp, { force: true });
        if (++attempt > 4) throw new Error(`Download failed for ${path.basename(dest)}: ${(e as Error).message}`);
        await sleep(1000 * 2 ** attempt);
      }
    }
  }
}

const progressBar = (p: number) => {
  const n = Math.round(Math.max(0, Math.min(100, p)) / 5);
  return `[${"█".repeat(n)}${"·".repeat(20 - n)}]`;
};
