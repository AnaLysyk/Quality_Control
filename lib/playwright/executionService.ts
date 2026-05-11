import "server-only";
import { spawn } from "child_process";
import EventEmitter from "events";
import { automationPool, ensureAutomationTables } from "@/lib/automationPool";
import { prepareWorkspace, cleanupWorkspace } from "./workspaceService";
import type { PlaywrightConfigOptions, ScriptFile } from "./workspaceService";

// ── In-memory SSE bus keyed by runId ────────────────────────────────────────

type RunEmitter = EventEmitter & {
  finished: boolean;
};

const runBus = new Map<string, RunEmitter>();

export function getRunEmitter(runId: string): RunEmitter | null {
  return runBus.get(runId) ?? null;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface StartRunOptions {
  companySlug: string;
  projectId?: string | null;
  planId?: string | null;
  title: string;
  scripts: ScriptFile[];
  config: PlaywrightConfigOptions;
  createdBy?: string;
}

// ── DB helpers ───────────────────────────────────────────────────────────────

async function createRunRecord(opts: {
  companySlug: string;
  title: string;
  config: PlaywrightConfigOptions;
  createdBy?: string;
}): Promise<string> {
  const { rows } = await automationPool.query<{ id: string }>(
    `INSERT INTO playwright_runs
       (company_slug, title, browser, base_url, headless, timeout_ms, workers, retries,
        screenshot_on, video_on, trace_on, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'queued',$12)
     RETURNING id`,
    [
      opts.companySlug,
      opts.title,
      opts.config.browser,
      opts.config.baseURL,
      opts.config.headless,
      opts.config.timeoutMs,
      opts.config.workers,
      opts.config.retries,
      opts.config.screenshotOn,
      opts.config.videoOn,
      opts.config.traceOn,
      opts.createdBy ?? null,
    ],
  );
  return rows[0].id;
}

async function updateRunStatus(runId: string, status: string, exitCode?: number) {
  if (status === "running") {
    await automationPool.query(
      `UPDATE playwright_runs SET status=$1, started_at=NOW() WHERE id=$2`,
      [status, runId],
    );
  } else {
    await automationPool.query(
      `UPDATE playwright_runs SET status=$1, finished_at=NOW(), exit_code=$2 WHERE id=$3`,
      [status, exitCode ?? null, runId],
    );
  }
}

async function saveResult(runId: string, opts: {
  specFile: string;
  title: string;
  status: string;
  durationMs: number;
  errorMsg?: string;
}) {
  await automationPool.query(
    `INSERT INTO playwright_run_results (run_id, spec_file, title, status, duration_ms, error_msg)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [runId, opts.specFile, opts.title, opts.status, opts.durationMs, opts.errorMsg ?? null],
  );
}

// ── Line parser — parses Playwright's list reporter output ──────────────────

const PASSED_RE = /✓\s+\[.*?\]\s+(.+?)\s+\((\d+(?:\.\d+)?)(ms|s)\)/;
const FAILED_RE = /✘\s+\[.*?\]\s+(.+?)\s+\((\d+(?:\.\d+)?)(ms|s)\)/;
const FLAKY_RE  = /~\s+\[.*?\]\s+(.+?)\s+\((\d+(?:\.\d+)?)(ms|s)\)/;
const SKIP_RE   = /-\s+\[.*?\]\s+(.+)/;

async function parseAndPersistLine(runId: string, line: string) {
  const passedMatch = PASSED_RE.exec(line);
  if (passedMatch) {
    const ms = parseDuration(passedMatch[2], passedMatch[3]);
    await saveResult(runId, { specFile: "", title: passedMatch[1].trim(), status: "passed", durationMs: ms });
    return;
  }
  const failedMatch = FAILED_RE.exec(line);
  if (failedMatch) {
    const ms = parseDuration(failedMatch[2], failedMatch[3]);
    await saveResult(runId, { specFile: "", title: failedMatch[1].trim(), status: "failed", durationMs: ms });
    return;
  }
  const flakyMatch = FLAKY_RE.exec(line);
  if (flakyMatch) {
    const ms = parseDuration(flakyMatch[2], flakyMatch[3]);
    await saveResult(runId, { specFile: "", title: flakyMatch[1].trim(), status: "flaky", durationMs: ms });
    return;
  }
  const skipMatch = SKIP_RE.exec(line);
  if (skipMatch) {
    await saveResult(runId, { specFile: "", title: skipMatch[1].trim(), status: "skipped", durationMs: 0 });
  }
}

function parseDuration(value: string, unit: string): number {
  const n = parseFloat(value);
  return unit === "s" ? Math.round(n * 1000) : Math.round(n);
}

// ── Main ─────────────────────────────────────────────────────────────────────

/**
 * Creates a DB record, writes workspace to disk, spawns `npx playwright test`,
 * streams output via an in-memory EventEmitter keyed by runId, and updates
 * the DB on completion. Returns runId immediately (non-blocking).
 */
export async function startPlaywrightRun(opts: StartRunOptions): Promise<string> {
  await ensureAutomationTables();

  const runId = await createRunRecord({
    companySlug: opts.companySlug,
    title: opts.title,
    config: opts.config,
    createdBy: opts.createdBy,
  });

  // Also create a Prisma TestRun for cross-module traceability
  try {
    const { prisma } = await import("@/lib/prismaClient");
    await prisma.testRun.create({
      data: {
        companyId: opts.companySlug,
        projectId: opts.projectId ?? null,
        planId: opts.planId ?? null,
        title: opts.title,
        source: "playwright",
        browser: opts.config.browser,
        baseUrl: opts.config.baseURL,
        headless: opts.config.headless ?? true,
        status: "pending",
        createdById: opts.createdBy ?? null,
      },
    });
  } catch {
    // Non-blocking: Prisma record failure should not abort the run
  }

  const emitter = new EventEmitter() as RunEmitter;
  emitter.setMaxListeners(50);
  emitter.finished = false;
  runBus.set(runId, emitter);

  // Execute asynchronously — do NOT await
  void executeRun(runId, opts, emitter);

  return runId;
}

async function executeRun(
  runId: string,
  opts: StartRunOptions,
  emitter: RunEmitter,
) {
  const emit = (line: string) => emitter.emit("line", line);

  try {
    emit(`[system] Preparando workspace para ${opts.companySlug}…`);
    const workDir = await prepareWorkspace(
      opts.companySlug,
      runId,
      opts.scripts,
      opts.config,
    );
    emit(`[system] Workspace: ${workDir}`);
    emit(`[system] Iniciando Playwright (${opts.config.browser}, headless=${opts.config.headless})…`);

    await updateRunStatus(runId, "running");

    const child = spawn(
      "npx",
      ["playwright", "test", "--reporter=list"],
      {
        cwd: workDir,
        env: {
          ...process.env,
          PLAYWRIGHT_BROWSERS_PATH: "0",       // use globally installed browsers
          CI: "false",
        },
        shell: process.platform === "win32",   // required on Windows
      },
    );

    let exitCode = 0;

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;
        emit(`[stdout] ${line}`);
        void parseAndPersistLine(runId, line);
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;
        emit(`[stderr] ${line}`);
      }
    });

    await new Promise<void>((resolve) => {
      child.on("close", (code) => {
        exitCode = code ?? 1;
        resolve();
      });
      child.on("error", (err) => {
        emit(`[error] Falha ao iniciar processo: ${err.message}`);
        exitCode = 1;
        resolve();
      });
    });

    const finalStatus = exitCode === 0 ? "passed" : "failed";
    emit(`[system] Execução concluída — status=${finalStatus} (exit code ${exitCode})`);
    await updateRunStatus(runId, finalStatus, exitCode);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    emit(`[error] ${msg}`);
    await updateRunStatus(runId, "error", 1).catch(() => {});
  } finally {
    emitter.finished = true;
    emitter.emit("done");
    // Keep emitter in map for a short while so SSE clients can read the done signal
    setTimeout(() => runBus.delete(runId), 60_000);
    await cleanupWorkspace(opts.companySlug, runId).catch(() => {});
  }
}
