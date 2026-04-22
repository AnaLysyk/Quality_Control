import { NextResponse } from "next/server";
import { z } from "zod";

import { buildManualAutomationIndex } from "@/lib/automations/manualLinks";
import {
  resolveAutomationAccess,
  resolveAutomationAllowedCompanySlugs,
} from "@/lib/automations/access";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getManualTestPlan, updateManualTestPlan } from "@/lib/testPlansStore";
import {
  normalizeTestPlanAutomationState,
  normalizeTestPlanCaseAutomation,
  type TestPlanAutomationState,
  type TestPlanCaseAutomation,
} from "@/lib/testPlanCases";
import { normalizeAutomationWorkflowStatus } from "@/lib/automations/workflowStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  companySlug: z.string().trim().min(1),
});

const PatchSchema = z.object({
  companySlug: z.string().trim().min(1),
  planId: z.string().trim().min(1),
  caseId: z.string().trim().optional(),
  automation: z
    .object({
      enabled: z.boolean().optional(),
      flowId: z.string().trim().nullable().optional(),
      linkedAt: z.string().trim().nullable().optional(),
      publishedAt: z.string().trim().nullable().optional(),
      scriptTemplateId: z.string().trim().nullable().optional(),
      status: z.enum(["not_started", "draft", "published"]).optional(),
      updatedAt: z.string().trim().nullable().optional(),
    })
    .partial(),
});

function resolveRequestContext(user: Awaited<ReturnType<typeof authenticateRequest>>) {
  const allowedCompanySlugs = resolveAutomationAllowedCompanySlugs(user);
  return {
    access: resolveAutomationAccess(user, allowedCompanySlugs.length),
    allowedCompanySlugs,
  };
}

function ensureCompanyScope(
  companySlug: string,
  access: ReturnType<typeof resolveAutomationAccess>,
  allowedCompanySlugs: string[],
) {
  if (access.hasGlobalCompanyVisibility) return true;
  return allowedCompanySlugs.includes(companySlug);
}

function mergePlanAutomation(
  current: TestPlanAutomationState,
  patch: Partial<TestPlanAutomationState>,
): TestPlanAutomationState {
  const now = new Date().toISOString();
  const enabled = patch.enabled ?? current.enabled;
  let status = patch.status ?? current.status;

  if (!enabled) {
    status = "not_started";
  }

  return {
    enabled,
    status: normalizeAutomationWorkflowStatus(status),
    linkedAt: enabled ? patch.linkedAt ?? current.linkedAt ?? now : null,
    updatedAt: enabled ? patch.updatedAt ?? now : now,
    publishedAt:
      enabled && normalizeAutomationWorkflowStatus(status) === "published"
        ? patch.publishedAt ?? current.publishedAt ?? now
        : null,
  };
}

function mergeCaseAutomation(
  current: TestPlanCaseAutomation,
  patch: Partial<TestPlanCaseAutomation>,
): TestPlanCaseAutomation {
  const now = new Date().toISOString();
  const enabled = patch.enabled ?? current.enabled;
  const hasConfigChange =
    patch.flowId !== undefined || patch.scriptTemplateId !== undefined;
  let status = patch.status ?? current.status;

  if (!enabled) {
    status = "not_started";
  } else if (!patch.status && current.status === "not_started" && hasConfigChange) {
    status = "draft";
  }

  return {
    enabled,
    status: normalizeAutomationWorkflowStatus(status),
    flowId: patch.flowId !== undefined ? patch.flowId : current.flowId ?? null,
    scriptTemplateId:
      patch.scriptTemplateId !== undefined
        ? patch.scriptTemplateId
        : current.scriptTemplateId ?? null,
    linkedAt: enabled ? patch.linkedAt ?? current.linkedAt ?? now : null,
    updatedAt: enabled ? patch.updatedAt ?? now : now,
    publishedAt:
      enabled && normalizeAutomationWorkflowStatus(status) === "published"
        ? patch.publishedAt ?? current.publishedAt ?? now
        : null,
  };
}

export async function GET(request: Request) {
  const user = await authenticateRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { access, allowedCompanySlugs } = resolveRequestContext(user);
  if (!access.canOpen) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const parsed = QuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Parametros invalidos" }, { status: 400 });
  }

  const companySlug = parsed.data.companySlug.trim().toLowerCase();
  if (!ensureCompanyScope(companySlug, access, allowedCompanySlugs)) {
    return NextResponse.json({ error: "Empresa fora do escopo da sessao." }, { status: 403 });
  }

  const index = await buildManualAutomationIndex(companySlug);
  return NextResponse.json(index);
}

export async function PATCH(request: Request) {
  const user = await authenticateRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { access, allowedCompanySlugs } = resolveRequestContext(user);
  if (!access.canOpen) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
  }

  const companySlug = parsed.data.companySlug.trim().toLowerCase();
  if (!ensureCompanyScope(companySlug, access, allowedCompanySlugs)) {
    return NextResponse.json({ error: "Empresa fora do escopo da sessao." }, { status: 403 });
  }

  const plan = await getManualTestPlan({ companySlug, id: parsed.data.planId });
  if (!plan) {
    return NextResponse.json({ error: "Plano nao encontrado" }, { status: 404 });
  }

  if (!parsed.data.caseId) {
    const mergedPlanAutomation = mergePlanAutomation(
      normalizeTestPlanAutomationState(plan.automation, plan.automation.enabled),
      parsed.data.automation,
    );

    const updatedPlan = await updateManualTestPlan(companySlug, plan.id, {
      automation: mergedPlanAutomation,
    });

    return NextResponse.json({ ok: Boolean(updatedPlan) });
  }

  const caseId = parsed.data.caseId.trim();
  const caseIndex = plan.cases.findIndex((item) => item.id === caseId);
  if (caseIndex < 0) {
    return NextResponse.json({ error: "Caso nao encontrado" }, { status: 404 });
  }

  const currentCase = plan.cases[caseIndex];
  const mergedCaseAutomation = mergeCaseAutomation(
    normalizeTestPlanCaseAutomation(currentCase.automation),
    parsed.data.automation,
  );

  const nextCases = plan.cases.map((item, index) =>
    index === caseIndex ? { ...item, automation: mergedCaseAutomation } : item,
  );

  const updatedPlan = await updateManualTestPlan(companySlug, plan.id, {
    cases: nextCases,
  });

  return NextResponse.json({ ok: Boolean(updatedPlan) });
}
