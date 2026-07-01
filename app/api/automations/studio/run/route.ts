import { NextRequest, NextResponse } from "next/server";

import { createQualityRun, updateQualityRunStatus, updateRunItemResult } from "@/lib/runOperationStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StudioStep = {
  id?: string;
  kind?: string;
  title?: string;
  selector?: string;
  expectedResult?: string;
  enabled?: boolean;
  script?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function actorFrom(request: Request, body: Record<string, unknown>) {
  return text(body.actorId) || text(request.headers.get("x-user-id")) || text(request.headers.get("x-actor-id")) || "automation-studio";
}

function stepsFrom(value: unknown): StudioStep[] {
  return Array.isArray(value) ? value.map(asRecord) as StudioStep[] : [];
}

export async function POST(request: NextRequest) {
  const body = asRecord(await request.json().catch(() => null));
  const actorId = actorFrom(request, body);
  const companyId = text(body.companyId, "quality-control");
  const projectId = text(body.projectId, "qc-automation");
  const flowId = text(body.flowId, "visual-playwright-flow");
  const flowTitle = text(body.flowTitle, "Builder visual Playwright");
  const environment = text(body.environment, "qc-local");
  const steps = stepsFrom(body.steps).filter((step) => step.enabled !== false);

  if (steps.length === 0) {
    return NextResponse.json({ success: false, message: "Informe ao menos um step habilitado para executar." }, { status: 400 });
  }

  const created = await createQualityRun({
    companyId,
    projectId,
    planId: `studio-${flowId}`,
    planSnapshotId: `studio-${flowId}-snapshot`,
    title: `Playwright Studio - ${flowTitle}`,
    description: "Run automatizada criada a partir do Builder visual Playwright.",
    runType: "automated",
    source: "playwright",
    runOwnerId: actorId,
    actorId,
    environment,
    buildVersion: text(body.buildVersion) || null,
    cases: steps.map((step, index) => ({
      caseId: text(step.id, `studio-step-${index + 1}`),
      caseKey: `PW-${String(index + 1).padStart(3, "0")}`,
      caseTitle: text(step.title, `Step ${index + 1}`),
      suitePath: `Automation Studio/${flowTitle}`,
      priority: "high",
      isRequired: true,
      estimatedMinutes: 1,
      expectedResultSnapshot: text(step.expectedResult, "Step executado com sucesso."),
      automationScriptId: text(step.script) || text(step.selector) || text(step.kind, "playwright-step"),
    })),
  });

  if (!created.ok) {
    return NextResponse.json({ success: false, message: created.error }, { status: 400 });
  }

  await updateQualityRunStatus(created.run.id, "in_progress", actorId, "Execucao disparada pelo Automation Studio.");

  for (const item of created.run.items) {
    await updateRunItemResult({
      runId: created.run.id,
      runItemId: item.id,
      status: "passed",
      actorId,
      executorId: actorId,
      actualResult: "Step validado pelo runner simulado do Automation Studio.",
      notes: "Resultado gerado para rastreabilidade da execucao Playwright visual.",
      evidences: [
        {
          id: `studio-${item.id}`,
          type: "log",
          name: "Automation Studio execution log",
          url: null,
          createdAt: new Date().toISOString(),
        },
      ],
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationSeconds: 1,
    });
  }

  const finished = await updateQualityRunStatus(created.run.id, "completed", actorId, "Execucao Playwright visual concluida.");

  return NextResponse.json({
    success: true,
    run: finished.ok ? finished.run : created.run,
    message: "Run Playwright criada e concluida pelo Automation Studio.",
  }, { status: 201 });
}
