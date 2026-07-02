import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { automationPool, ensureAutomationTables } from "@/lib/automationPool";
import { resolveAutomationAccess, resolveAutomationAllowedCompanySlugs } from "@/lib/automations/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function scoreStatus(status: string): number {
  if (status === "failed" || status === "error") return 4;
  if (status === "flaky") return 3;
  if (status === "passed") return 2;
  if (status === "skipped") return 1;
  return 0;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { runId } = await params;
  if (!runId || !/^[a-f0-9\-]{32,36}$/.test(runId)) {
    return NextResponse.json({ error: "runId inválido" }, { status: 400 });
  }

  await ensureAutomationTables();

  const runRes = await automationPool.query<{
    id: string;
    company_slug: string;
    project_id: string | null;
    title: string;
    browser: string;
    status: string;
    started_at: string | null;
    finished_at: string | null;
    created_at: string;
    exit_code: number | null;
  }>(
    `SELECT id, company_slug, project_id, title, browser, status, started_at, finished_at, created_at, exit_code
     FROM playwright_runs
     WHERE id = $1`,
    [runId],
  );

  if (!runRes.rows.length) {
    return NextResponse.json({ error: "Run não encontrada" }, { status: 404 });
  }

  const run = runRes.rows[0];
  const allowed = resolveAutomationAllowedCompanySlugs(user);
  const access = resolveAutomationAccess(user, allowed.length);
  if (!access.canOpen || (!access.hasGlobalCompanyVisibility && !allowed.includes(run.company_slug))) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const resultRes = await automationPool.query<{
    id: string;
    spec_file: string;
    title: string;
    status: string;
    duration_ms: number;
    error_msg: string | null;
    created_at: string;
  }>(
    `SELECT id, spec_file, title, status, duration_ms, error_msg, created_at
     FROM playwright_run_results
     WHERE run_id = $1
     ORDER BY created_at ASC`,
    [runId],
  );

  const compareTo = new URL(request.url).searchParams.get("compareTo");
  let comparison: {
    compareTo: string;
    regressions: number;
    improvements: number;
    unchanged: number;
    newItems: number;
    byKey: Record<string, "regression" | "improvement" | "same" | "new">;
  } | null = null;

  if (compareTo && /^[a-f0-9\-]{32,36}$/.test(compareTo)) {
    const previousResults = await automationPool.query<{
      spec_file: string;
      title: string;
      status: string;
    }>(
      `SELECT spec_file, title, status
       FROM playwright_run_results
       WHERE run_id = $1`,
      [compareTo],
    );

    const prevByKey = new Map(
      previousResults.rows.map((item) => [`${item.spec_file}::${item.title}`, item.status]),
    );

    let regressions = 0;
    let improvements = 0;
    let unchanged = 0;
    let newItems = 0;
    const byKey: Record<string, "regression" | "improvement" | "same" | "new"> = {};

    for (const current of resultRes.rows) {
      const key = `${current.spec_file}::${current.title}`;
      const previousStatus = prevByKey.get(key);
      if (!previousStatus) {
        newItems += 1;
        byKey[key] = "new";
        continue;
      }

      const currentScore = scoreStatus(current.status);
      const previousScore = scoreStatus(previousStatus);
      if (currentScore > previousScore) {
        regressions += 1;
        byKey[key] = "regression";
      } else if (currentScore < previousScore) {
        improvements += 1;
        byKey[key] = "improvement";
      } else {
        unchanged += 1;
        byKey[key] = "same";
      }
    }

    comparison = {
      compareTo,
      regressions,
      improvements,
      unchanged,
      newItems,
      byKey,
    };
  }

  return NextResponse.json({ run, results: resultRes.rows, comparison });
}

