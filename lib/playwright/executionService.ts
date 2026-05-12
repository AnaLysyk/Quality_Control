import "server-only";
import { spawn } from "child_process";
import EventEmitter from "events";
import { createHash } from "crypto";
import fs from "fs/promises";
import path from "path";
import { automationPool, ensureAutomationTables } from "@/lib/automationPool";
import { prepareWorkspace, cleanupWorkspace, getRunDir } from "./workspaceService";
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
  runMode?: "all" | "changed" | "failed";
  selectedSpecs?: string[];
  sourceRunId?: string | null;
  config: PlaywrightConfigOptions;
  createdBy?: string;
}

function resolvedBrowsers(config: PlaywrightConfigOptions): string[] {
  const allowed = new Set(["chromium", "firefox", "webkit"]);
  const list = Array.from(new Set((config.browsers ?? [config.browser]).filter((item) => allowed.has(item))));
  return list.length ? list : ["chromium"];
}

function browserLabel(config: PlaywrightConfigOptions): string {
  const list = resolvedBrowsers(config);
  return list.length > 1 ? `matrix:${list.join("+")}` : list[0];
}

// ── DB helpers ───────────────────────────────────────────────────────────────

async function createRunRecord(opts: {
  companySlug: string;
  projectId?: string | null;
  title: string;
  runMode: "all" | "changed" | "failed";
  selectedSpecs: string[];
  sourceRunId?: string | null;
  config: PlaywrightConfigOptions;
  createdBy?: string;
}): Promise<string> {
  const { rows } = await automationPool.query<{ id: string }>(
    `INSERT INTO playwright_runs
       (company_slug, project_id, title, browser, base_url, headless, timeout_ms, workers, retries,
        screenshot_on, video_on, trace_on, status, run_mode, selected_specs, source_run_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'queued',$13,$14,$15,$16)
     RETURNING id`,
    [
      opts.companySlug,
      opts.projectId ?? null,
      opts.title,
      browserLabel(opts.config),
      opts.config.baseURL,
      opts.config.headless,
      opts.config.timeoutMs,
      opts.config.workers,
      opts.config.retries,
      opts.config.screenshotOn,
      opts.config.videoOn,
      opts.config.traceOn,
      opts.runMode,
      JSON.stringify(opts.selectedSpecs),
      opts.sourceRunId ?? null,
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

type PlaywrightJsonResult = {
  suites?: Array<{
    title?: string;
    specs?: Array<{
      title?: string;
      file?: string;
      tests?: Array<{
        results?: Array<{
          status?: string;
          duration?: number;
          error?: { message?: string };
        }>;
      }>;
    }>;
    suites?: PlaywrightJsonResult["suites"];
  }>;
};

async function replaceRunResultsFromJson(runId: string, workDir: string): Promise<void> {
  const resultFile = path.join(workDir, "results.json");
  const raw = await fs.readFile(resultFile, "utf8");
  const parsed = JSON.parse(raw) as PlaywrightJsonResult;

  const collected: Array<{ specFile: string; title: string; status: string; durationMs: number; errorMsg?: string }> = [];

  function walkSuites(suites: PlaywrightJsonResult["suites"]) {
    if (!suites) return;
    for (const suite of suites) {
      if (suite.specs) {
        for (const spec of suite.specs) {
          const first = spec.tests?.[0]?.results?.[0];
          if (!first) continue;
          collected.push({
            specFile: spec.file ?? "",
            title: spec.title ?? suite.title ?? "Teste",
            status: first.status ?? "unknown",
            durationMs: Number.isFinite(first.duration) ? Number(first.duration) : 0,
            errorMsg: first.error?.message,
          });
        }
      }
      walkSuites(suite.suites);
    }
  }

  walkSuites(parsed.suites);
  await automationPool.query(`DELETE FROM playwright_run_results WHERE run_id = $1`, [runId]);
  for (const row of collected) {
    await saveResult(runId, row);
  }
}

function isSpecPath(filePath: string): boolean {
  return /(^|\/)tests\/.+\.spec\.(ts|js)$/i.test(filePath);
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function upsertSpecSnapshots(
  companySlug: string,
  runId: string,
  scripts: ScriptFile[],
): Promise<void> {
  const specScripts = scripts.filter((script) => isSpecPath(script.path));
  for (const script of specScripts) {
    await automationPool.query(
      `INSERT INTO playwright_spec_snapshots (company_slug, spec_path, content_hash, last_run_id, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (company_slug, spec_path)
       DO UPDATE SET content_hash = EXCLUDED.content_hash, last_run_id = EXCLUDED.last_run_id, updated_at = NOW()`,
      [companySlug, script.path, hashContent(script.content), runId],
    );
  }
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

  const runMode = opts.runMode ?? "all";
  const selectedSpecs = Array.isArray(opts.selectedSpecs) ? opts.selectedSpecs : [];

  const runId = await createRunRecord({
    companySlug: opts.companySlug,
    projectId: opts.projectId ?? null,
    title: opts.title,
    runMode,
    selectedSpecs,
    sourceRunId: opts.sourceRunId,
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
        browser: browserLabel(opts.config),
        baseUrl: opts.config.baseURL,
        headless: opts.config.headless ?? true,
        status: "pending",
        createdById: opts.createdBy ?? null,
      },
    });
  } catch {
    // Non-blocking: Prisma record failure should not abort the run
  }

  // Emit Brian event
  try {
    const { emitBrainEvent } = await import("@/lib/brain/events");
    emitBrainEvent({
      type: "test_run.started",
      subject: runId,
      source: "/api/playwright/run",
      actorId: opts.createdBy ?? "system",
      companyId: opts.companySlug,
      projectId: opts.projectId ?? null,
      data: { title: opts.title, browser: browserLabel(opts.config), browsers: resolvedBrowsers(opts.config) },
    });
  } catch { /* non-blocking */ }

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
    const runBrowsers = resolvedBrowsers(opts.config);
    emit(`[system] Iniciando Playwright (${runBrowsers.join(", ")}, headless=${opts.config.headless})…`);

    await updateRunStatus(runId, "running");

    const specArgs = (opts.selectedSpecs ?? []).filter(Boolean);
    if (specArgs.length) {
      emit(`[system] Escopo da run: ${specArgs.length} spec(s) selecionado(s).`);
    }

    const child = spawn(
      "npx",
      ["playwright", "test", ...specArgs],
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

    try {
      await replaceRunResultsFromJson(runId, getRunDir(opts.companySlug, runId));
    } catch {
      // Keep line-based fallback when JSON reporter is unavailable.
    }

    try {
      await upsertSpecSnapshots(opts.companySlug, runId, opts.scripts);
    } catch {
      // Snapshot update is best-effort and should not break the run status.
    }

    emit(`[system] Execução concluída — status=${finalStatus} (exit code ${exitCode})`);
    await updateRunStatus(runId, finalStatus, exitCode);

    // Emit Brian event for run completion
    try {
      const { emitBrainEvent } = await import("@/lib/brain/events");
      emitBrainEvent({
        type: finalStatus === "passed" ? "test_run.finished" : "test_run.failed",
        subject: runId,
        source: "/api/playwright/run",
        actorId: opts.createdBy ?? "system",
        companyId: opts.companySlug,
        projectId: opts.projectId ?? null,
        data: { title: opts.title, exitCode, finalStatus },
      });
    } catch { /* non-blocking */ }

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
