import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/jwtAuth";
import { resolveAutomationAccess, resolveAutomationAllowedCompanySlugs } from "@/lib/automations/access";
import { startScriptRun } from "@/lib/playwright/executionService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RunScriptSchema = z.object({
  companySlug: z.string().trim().min(1),
  title: z.string().trim().default("Execução manual de script"),
  scriptContent: z.string().min(1, "O script está vazio."),
  timeoutMs: z.number().int().positive().max(300_000).default(60_000),
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

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = RunScriptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { companySlug, title, scriptContent, timeoutMs } = parsed.data;
  if (!assertAccess(user, companySlug)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const runId = await startScriptRun({
    companySlug,
    title,
    scriptContent,
    timeoutMs,
    createdBy: user.id ?? user.email ?? undefined,
  });

  return NextResponse.json({ runId });
}
