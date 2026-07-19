import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/backend/jwtAuth";
import { startScriptRun } from "@/backend/playwright/executionService";
import { isEmbeddedAutomationExecutionEnabled } from "@/backend/playwright/executionPolicy";
import { resolveOperationalContext } from "@/backend/context/operationalContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RunScriptSchema = z.object({
  companySlug: z.string().trim().min(1),
  title: z.string().trim().max(200).default("Execução manual de script"),
  scriptContent: z.string().min(1, "O script está vazio.").max(1_000_000, "O script excede 1 MB."),
  timeoutMs: z.number().int().positive().max(300_000).default(60_000),
});

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = RunScriptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { companySlug, title, scriptContent, timeoutMs } = parsed.data;
  const contextResult = await resolveOperationalContext(request, {
    moduleId: "playwright",
    action: "execute",
    companySlug,
    requireCompany: true,
  });
  if (!contextResult.ok) return contextResult.response;

  if (!user.isGlobalAdmin) {
    return NextResponse.json({ error: "Somente administrador global pode executar código local." }, { status: 403 });
  }
  if (!isEmbeddedAutomationExecutionEnabled()) {
    return NextResponse.json({
      error: "Runner embutido desativado. Configure um worker isolado para executar código.",
    }, { status: 503 });
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
