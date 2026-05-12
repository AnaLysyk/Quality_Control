import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { authenticateRequest } from "@/lib/jwtAuth";
import { resolveAutomationAccess, resolveAutomationAllowedCompanySlugs } from "@/lib/automations/access";
import { startPlaywrightRun } from "@/lib/playwright/executionService";
import { automationPool, ensureAutomationTables } from "@/lib/automationPool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RunSchema = z.object({
  companySlug: z.string().trim().min(1),
  projectId: z.string().trim().optional(),
  planId: z.string().trim().optional(),
  title: z.string().trim().default("Execução manual"),
  runMode: z.enum(["all", "changed", "failed"]).default("all"),
  sourceRunId: z.string().trim().optional(),
  /** Array of { path, content } – scripts to include in the run */
  scripts: z.array(z.object({ path: z.string(), content: z.string() })).default([]),
  config: z.object({
    baseURL: z.string().default("http://localhost:3000"),
    browser: z.enum(["chromium", "firefox", "webkit"]).default("chromium"),
    browsers: z.array(z.enum(["chromium", "firefox", "webkit"])).optional(),
    headless: z.boolean().default(true),
    timeoutMs: z.number().int().positive().default(30000),
    workers: z.number().int().positive().default(2),
    retries: z.number().int().min(0).default(0),
    screenshotOn: z.string().default("only-on-failure"),
    videoOn: z.string().default("retain-on-failure"),
    traceOn: z.string().default("off"),
  }).default({
    baseURL: "http://localhost:3000",
    browser: "chromium",
    browsers: ["chromium"],
    headless: true,
    timeoutMs: 30000,
    workers: 2,
    retries: 0,
    screenshotOn: "only-on-failure",
    videoOn: "retain-on-failure",
    traceOn: "off",
  }),
});

function assertAccess(
  user: Awaited<ReturnType<typeof authenticateRequest>>,
  companySlug: string,
) {
  if (!user) return false;
  const allowed = resolveAutomationAllowedCompanySlugs(user);
  const access = resolveAutomationAccess(user, allowed.length);
  if (!access.canOpen) return false;
  if (!access.hasGlobalCompanyVisibility && !allowed.includes(companySlug)) return false;
  return true;
}

function isSpecPath(filePath: string): boolean {
  return /(^|\/)tests\/.+\.spec\.(ts|js)$/i.test(filePath);
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function resolveSelectedSpecs(opts: {
  companySlug: string;
  runMode: "all" | "changed" | "failed";
  sourceRunId?: string;
  scripts: Array<{ path: string; content: string }>;
}): Promise<string[]> {
  const specScripts = opts.scripts.filter((script) => isSpecPath(script.path));
  if (opts.runMode === "all") {
    return specScripts.map((script) => script.path);
  }

  if (opts.runMode === "changed") {
    if (!specScripts.length) return [];
    const paths = specScripts.map((script) => script.path);
    const snapshots = await automationPool.query<{ spec_path: string; content_hash: string }>(
      `SELECT spec_path, content_hash
       FROM playwright_spec_snapshots
       WHERE company_slug = $1 AND spec_path = ANY($2::text[])`,
      [opts.companySlug, paths],
    );
    const hashByPath = new Map(snapshots.rows.map((row) => [row.spec_path, row.content_hash]));
    return specScripts
      .filter((script) => hashByPath.get(script.path) !== hashContent(script.content))
      .map((script) => script.path);
  }

  if (!opts.sourceRunId) return [];
  const failed = await automationPool.query<{ spec_file: string }>(
    `SELECT DISTINCT spec_file
     FROM playwright_run_results
     WHERE run_id = $1 AND status = 'failed' AND spec_file <> ''`,
    [opts.sourceRunId],
  );
  const failedSet = new Set(failed.rows.map((row) => row.spec_file));
  return specScripts.filter((script) => failedSet.has(script.path)).map((script) => script.path);
}

// ── POST /api/playwright/run ─────────────────────────────────────────────────

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = RunSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { companySlug, projectId, planId, title, scripts, config, runMode, sourceRunId } = parsed.data;
  if (!assertAccess(user, companySlug))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await ensureAutomationTables();
  const selectedSpecs = await resolveSelectedSpecs({
    companySlug,
    runMode,
    sourceRunId,
    scripts,
  });
  if (!selectedSpecs.length) {
    const modeLabel = runMode === "changed" ? "alterados" : runMode === "failed" ? "falhos" : "executáveis";
    return NextResponse.json({ error: `Nenhum spec ${modeLabel} encontrado para executar` }, { status: 400 });
  }

  const normalizedBrowsers = Array.from(new Set((config.browsers ?? [config.browser]).filter(Boolean)));
  if (!normalizedBrowsers.length) {
    return NextResponse.json({ error: "Selecione ao menos um navegador para executar" }, { status: 400 });
  }

  const runId = await startPlaywrightRun({
    companySlug,
    projectId: projectId ?? null,
    planId: planId ?? null,
    title,
    scripts,
    runMode,
    selectedSpecs,
    sourceRunId: sourceRunId ?? null,
    config: {
      ...config,
      browser: normalizedBrowsers[0],
      browsers: normalizedBrowsers,
    },
    createdBy: user.id ?? user.email ?? undefined,
  });

  return NextResponse.json({ runId, runMode, selectedSpecs });
}

// ── GET /api/playwright/run?companySlug=xxx ──────────────────────────────────

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(request.url);
  const companySlug = url.searchParams.get("companySlug") ?? "";
  const projectId = (url.searchParams.get("projectId") ?? "").trim();
  if (!companySlug) return NextResponse.json({ error: "companySlug obrigatório" }, { status: 400 });
  if (!assertAccess(user, companySlug))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await ensureAutomationTables();

  const hasProjectFilter = Boolean(projectId);
  const { rows } = await automationPool.query(
    `SELECT id, project_id, title, browser, base_url, headless, timeout_ms, workers, retries,
            status, run_mode, selected_specs, source_run_id, started_at, finished_at, exit_code, created_by, created_at
     FROM playwright_runs
     WHERE company_slug = $1
       AND ($2::boolean = false OR project_id = $3)
     ORDER BY created_at DESC
     LIMIT 50`,
    [companySlug, hasProjectFilter, projectId],
  );

  return NextResponse.json({ runs: rows });
}
