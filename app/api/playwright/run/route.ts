import { NextResponse } from "next/server";
import { z } from "zod";
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
  /** Array of { path, content } – scripts to include in the run */
  scripts: z.array(z.object({ path: z.string(), content: z.string() })).default([]),
  config: z.object({
    baseURL: z.string().default("http://localhost:3000"),
    browser: z.enum(["chromium", "firefox", "webkit"]).default("chromium"),
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

// ── POST /api/playwright/run ─────────────────────────────────────────────────

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = RunSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { companySlug, projectId, planId, title, scripts, config } = parsed.data;
  if (!assertAccess(user, companySlug))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const runId = await startPlaywrightRun({
    companySlug,
    projectId: projectId ?? null,
    planId: planId ?? null,
    title,
    scripts,
    config,
    createdBy: user.id ?? user.email ?? undefined,
  });

  return NextResponse.json({ runId });
}

// ── GET /api/playwright/run?companySlug=xxx ──────────────────────────────────

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(request.url);
  const companySlug = url.searchParams.get("companySlug") ?? "";
  if (!companySlug) return NextResponse.json({ error: "companySlug obrigatório" }, { status: 400 });
  if (!assertAccess(user, companySlug))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await ensureAutomationTables();

  const { rows } = await automationPool.query(
    `SELECT id, title, browser, base_url, headless, timeout_ms, workers, retries,
            status, started_at, finished_at, exit_code, created_by, created_at
     FROM playwright_runs
     WHERE company_slug = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [companySlug],
  );

  return NextResponse.json({ runs: rows });
}
