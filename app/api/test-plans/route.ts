import { NextResponse } from "next/server";
import { listApplications } from "@/lib/applicationsStore";
import { getClientQaseSettings } from "@/lib/qaseConfig";
import { QaseError } from "@/lib/qaseSdk";
import {
  extractNumericCaseIds,
  parseTestPlanCases,
  createDefaultTestPlanAutomationState,
  normalizeTestPlanAutomationState,
  type TestPlanAutomationState,
  type TestPlanCase,
} from "@/lib/testPlanCases";
import { aggregateAutomationWorkflowStatus } from "@/lib/automations/workflowStatus";
import {
  createQasePlan,
  deleteQasePlan,
  getQasePlan,
  listQasePlans,
  updateQasePlan,
} from "@/lib/qasePlans";
import {
  createManualTestPlan,
  deleteManualTestPlan,
  getManualTestPlan,
  listManualTestPlans,
  updateManualTestPlan,
} from "@/lib/testPlansStore";

type ApplicationItem = {
  id: string;
  name: string;
  slug: string;
  qaseProjectCode?: string | null;
};

type PlanSource = "manual" | "qase";

function normalizeProjectCode(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || null;
}

function normalizeSource(value: unknown): PlanSource {
  return String(value ?? "").trim().toLowerCase() === "qase" ? "qase" : "manual";
}

function toResponsePlan(input: {
  id: string;
  title: string;
  description?: string | null;
  casesCount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  projectCode?: string | null;
  source: PlanSource;
  applicationId?: string | null;
  applicationName?: string | null;
  cases?: TestPlanCase[];
  automation?: TestPlanAutomationState | null;
  automationCasesCount?: number;
}) {
  return {
    id: input.id,
    title: input.title,
    description: input.description ?? null,
    casesCount: input.casesCount,
    createdAt: input.createdAt ?? null,
    updatedAt: input.updatedAt ?? null,
    projectCode: input.projectCode ?? null,
    source: input.source,
    applicationId: input.applicationId ?? null,
    applicationName: input.applicationName ?? null,
    cases: Array.isArray(input.cases) ? input.cases : undefined,
    automation: input.automation ?? null,
    automationCasesCount: input.automationCasesCount ?? 0,
  };
}

async function resolveApplication(companySlug: string, applicationId: string) {
  const applications = await listApplications({ companySlug });
  const selectedApplication = applicationId
    ? ((applications.find((item) => item.id === applicationId) ?? null) as ApplicationItem | null)
    : null;

  return {
    applications: applications as ApplicationItem[],
    selectedApplication,
  };
}

function normalizeWarningList(values: Array<string | null | undefined>) {
  const unique = Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));
  return unique.length ? unique.join(" ") : null;
}

function resolveManualPlanAutomation(plan: {
  automation?: TestPlanAutomationState | null;
  cases: TestPlanCase[];
}) {
  const base = plan.automation ?? createDefaultTestPlanAutomationState(false);
  const enabledCaseStatuses = plan.cases
    .filter((testCase) => testCase.automation?.enabled)
    .map((testCase) => testCase.automation?.status);

  return {
    ...base,
    status: aggregateAutomationWorkflowStatus([
      base.enabled ? base.status : null,
      ...enabledCaseStatuses,
    ]),
  };
}

function resolveWarningFromQaseError(error: unknown) {
  const status = error instanceof QaseError ? error.status : 500;
  if (status === 401 || status === 403) {
    return "Qase recusou a autenticação deste projeto.";
  }
  if (status === 404) {
    return "Projeto ou plano não encontrado no Qase.";
  }
  if (status === 422) {
    return "Qase recusou os dados do plano informado.";
  }
  return "Não foi possível consultar os planos de teste no Qase.";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const companySlug = url.searchParams.get("companySlug")?.trim().toLowerCase() || "";
  const applicationId = url.searchParams.get("applicationId")?.trim() || "";
  const requestedProjectCode = normalizeProjectCode(url.searchParams.get("project"));
  const planId = url.searchParams.get("planId")?.trim() || "";
  const source = normalizeSource(url.searchParams.get("source"));

  if (!companySlug) {
    return NextResponse.json({ error: "companySlug is required" }, { status: 400 });
  }

  const { applications, selectedApplication } = await resolveApplication(companySlug, applicationId);
  const projectCode = requestedProjectCode || normalizeProjectCode(selectedApplication?.qaseProjectCode);
  const manualPlans = await listManualTestPlans({
    companySlug,
    applicationId: applicationId || undefined,
  });

  if (planId) {
    if (source === "manual") {
      const plan = await getManualTestPlan({ companySlug, id: planId });
      if (!plan) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 });
      }
      return NextResponse.json({
        plan: toResponsePlan({
          id: plan.id,
          title: plan.title,
          description: plan.description,
          casesCount: plan.cases.length,
          createdAt: plan.createdAt,
          updatedAt: plan.updatedAt,
          projectCode: plan.projectCode,
          source: "manual",
          applicationId: plan.applicationId,
          applicationName: plan.applicationName,
          cases: plan.cases,
          automation: resolveManualPlanAutomation(plan),
          automationCasesCount: plan.cases.filter((testCase) => testCase.automation?.enabled).length,
        }),
      });
    }

    if (!projectCode) {
      return NextResponse.json({ error: "projectCode is required" }, { status: 400 });
    }

    const qaseSettings = await getClientQaseSettings(companySlug);
    if (!qaseSettings?.token) {
      return NextResponse.json({ error: "Qase token missing" }, { status: 400 });
    }

    try {
      const plan = await getQasePlan({
        token: qaseSettings.token,
        baseUrl: qaseSettings.baseUrl,
        projectCode,
        planId,
      });
      if (!plan) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 });
      }
      return NextResponse.json({
        plan: toResponsePlan({
          ...plan,
          source: "qase",
          applicationId: selectedApplication?.id ?? null,
          applicationName: selectedApplication?.name ?? null,
        }),
      });
    } catch (error) {
      return NextResponse.json(
        { error: resolveWarningFromQaseError(error) },
        { status: error instanceof QaseError ? error.status : 500 },
      );
    }
  }

  const qaseSettings = await getClientQaseSettings(companySlug);
  let qasePlans = [] as ReturnType<typeof toResponsePlan>[];
  let warning: string | null = null;

  if (projectCode && qaseSettings?.token) {
    try {
      const integratedPlans = await listQasePlans({
        token: qaseSettings.token,
        baseUrl: qaseSettings.baseUrl,
        projectCode,
      });
      qasePlans = integratedPlans.map((plan) =>
        toResponsePlan({
          ...plan,
          source: "qase",
          applicationId: selectedApplication?.id ?? null,
          applicationName: selectedApplication?.name ?? null,
        }),
      );
    } catch (error) {
      warning = resolveWarningFromQaseError(error);
    }
  } else if (!applicationId && qaseSettings?.token) {
    const applicationByProject = new Map<string, ApplicationItem>();
    for (const application of applications) {
      const code = normalizeProjectCode(application.qaseProjectCode);
      if (code && !applicationByProject.has(code)) {
        applicationByProject.set(code, application);
      }
    }

    const warnings: string[] = [];
    for (const [code, application] of applicationByProject.entries()) {
      try {
        const integratedPlans = await listQasePlans({
          token: qaseSettings.token,
          baseUrl: qaseSettings.baseUrl,
          projectCode: code,
        });
        qasePlans.push(
          ...integratedPlans.map((plan) =>
            toResponsePlan({
              ...plan,
              source: "qase",
              applicationId: application.id,
              applicationName: application.name,
            }),
          ),
        );
      } catch (error) {
        warnings.push(resolveWarningFromQaseError(error));
      }
    }

    warning = normalizeWarningList(warnings);
  } else if (selectedApplication?.qaseProjectCode && !qaseSettings?.token) {
    warning = "Token do Qase ausente ou invalido para esta empresa.";
  } else if (!applicationId && applications.some((application) => normalizeProjectCode(application.qaseProjectCode)) && !qaseSettings?.token) {
    warning = "Token do Qase ausente ou invalido para esta empresa.";
  }

  const manualResponsePlans = manualPlans.map((plan) =>
    toResponsePlan({
      id: plan.id,
      title: plan.title,
      description: plan.description,
      casesCount: plan.cases.length,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      projectCode: plan.projectCode,
      source: "manual",
      applicationId: plan.applicationId,
      applicationName: plan.applicationName,
      automation: resolveManualPlanAutomation(plan),
      automationCasesCount: plan.cases.filter((testCase) => testCase.automation?.enabled).length,
    }),
  );

  const plans = [...qasePlans, ...manualResponsePlans].sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt ?? left.createdAt ?? "") || 0;
    const rightTime = Date.parse(right.updatedAt ?? right.createdAt ?? "") || 0;
    return rightTime - leftTime;
  });

  return NextResponse.json({
    plans,
    totalTests: plans.reduce((sum, item) => sum + item.casesCount, 0),
    projectCode,
    warning,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companySlug = String(body.companySlug ?? "").trim().toLowerCase();
  const applicationId = String(body.applicationId ?? "").trim();
  const source = normalizeSource(body.source);
  const title = String(body.title ?? "").trim();
  const description = typeof body.description === "string" ? body.description.trim() || null : null;
  const caseRefs = parseTestPlanCases(body.cases);
  const planAutomation = normalizeTestPlanAutomationState(body.automation);

  if (!companySlug || !applicationId || !title) {
    return NextResponse.json({ error: "companySlug, applicationId and title are required" }, { status: 400 });
  }

  const { selectedApplication } = await resolveApplication(companySlug, applicationId);
  if (!selectedApplication) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  if (source === "qase") {
    const projectCode = normalizeProjectCode(body.projectCode) || normalizeProjectCode(selectedApplication.qaseProjectCode);
    if (!projectCode) {
      return NextResponse.json({ error: "Qase project code is required" }, { status: 400 });
    }
    const qaseSettings = await getClientQaseSettings(companySlug);
    if (!qaseSettings?.token) {
      return NextResponse.json({ error: "Qase token missing" }, { status: 400 });
    }
    const numericCases = extractNumericCaseIds(caseRefs);
    if (!numericCases.length) {
      return NextResponse.json({ error: "Informe ao menos um case ID numerico para criar o plano no Qase." }, { status: 400 });
    }

    try {
      const created = await createQasePlan({
        token: qaseSettings.token,
        baseUrl: qaseSettings.baseUrl,
        projectCode,
        title,
        description,
        cases: numericCases,
      });
      return NextResponse.json({
        plan: created
          ? toResponsePlan({
              ...created,
              source: "qase",
              applicationId: selectedApplication.id,
              applicationName: selectedApplication.name,
            })
          : null,
      }, { status: 201 });
    } catch (error) {
      return NextResponse.json(
        { error: resolveWarningFromQaseError(error) },
        { status: error instanceof QaseError ? error.status : 500 },
      );
    }
  }

  const created = await createManualTestPlan({
    companySlug,
    applicationId: selectedApplication.id,
    applicationName: selectedApplication.name,
    applicationSlug: selectedApplication.slug,
    projectCode: normalizeProjectCode(body.projectCode) || normalizeProjectCode(selectedApplication.qaseProjectCode),
    title,
    description,
    cases: caseRefs,
    automation: planAutomation,
  });

  return NextResponse.json({
    plan: toResponsePlan({
      id: created.id,
      title: created.title,
      description: created.description,
      casesCount: created.cases.length,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      projectCode: created.projectCode,
      source: "manual",
      applicationId: created.applicationId,
      applicationName: created.applicationName,
      cases: created.cases,
      automation: resolveManualPlanAutomation(created),
      automationCasesCount: created.cases.filter((testCase) => testCase.automation?.enabled).length,
    }),
  }, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companySlug = String(body.companySlug ?? "").trim().toLowerCase();
  const applicationId = String(body.applicationId ?? "").trim();
  const planId = String(body.planId ?? "").trim();
  const source = normalizeSource(body.source);

  if (!companySlug || !planId) {
    return NextResponse.json({ error: "companySlug and planId are required" }, { status: 400 });
  }

  const caseRefs = body.cases === undefined ? undefined : parseTestPlanCases(body.cases);
  const planAutomation = body.automation === undefined ? undefined : normalizeTestPlanAutomationState(body.automation);

  if (source === "qase") {
    const { selectedApplication } = await resolveApplication(companySlug, applicationId);
    const projectCode = normalizeProjectCode(body.projectCode) || normalizeProjectCode(selectedApplication?.qaseProjectCode);
    if (!projectCode) {
      return NextResponse.json({ error: "Qase project code is required" }, { status: 400 });
    }
    const qaseSettings = await getClientQaseSettings(companySlug);
    if (!qaseSettings?.token) {
      return NextResponse.json({ error: "Qase token missing" }, { status: 400 });
    }

    try {
      const updated = await updateQasePlan({
        token: qaseSettings.token,
        baseUrl: qaseSettings.baseUrl,
        projectCode,
        planId,
        ...(body.title !== undefined ? { title: String(body.title ?? "").trim() } : {}),
        ...(body.description !== undefined
          ? { description: typeof body.description === "string" ? body.description.trim() || null : null }
          : {}),
        ...(caseRefs !== undefined ? { cases: extractNumericCaseIds(caseRefs) } : {}),
      });

      return NextResponse.json({
        plan: updated
          ? toResponsePlan({
              ...updated,
              source: "qase",
              applicationId: selectedApplication?.id ?? null,
              applicationName: selectedApplication?.name ?? null,
            })
          : null,
      });
    } catch (error) {
      return NextResponse.json(
        { error: resolveWarningFromQaseError(error) },
        { status: error instanceof QaseError ? error.status : 500 },
      );
    }
  }

  const { selectedApplication } = await resolveApplication(companySlug, applicationId);
  const updated = await updateManualTestPlan(companySlug, planId, {
    ...(body.title !== undefined ? { title: String(body.title ?? "").trim() } : {}),
    ...(body.description !== undefined
      ? { description: typeof body.description === "string" ? body.description.trim() || null : null }
      : {}),
    ...(caseRefs !== undefined ? { cases: caseRefs } : {}),
    ...(planAutomation !== undefined ? { automation: planAutomation } : {}),
    ...(selectedApplication
      ? {
          applicationId: selectedApplication.id,
          applicationName: selectedApplication.name,
          applicationSlug: selectedApplication.slug,
          projectCode:
            normalizeProjectCode(body.projectCode) || normalizeProjectCode(selectedApplication.qaseProjectCode),
        }
      : {}),
  });

  if (!updated) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  return NextResponse.json({
    plan: toResponsePlan({
      id: updated.id,
      title: updated.title,
      description: updated.description,
      casesCount: updated.cases.length,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      projectCode: updated.projectCode,
      source: "manual",
      applicationId: updated.applicationId,
      applicationName: updated.applicationName,
      cases: updated.cases,
      automation: resolveManualPlanAutomation(updated),
      automationCasesCount: updated.cases.filter((testCase) => testCase.automation?.enabled).length,
    }),
  });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companySlug = String(body.companySlug ?? "").trim().toLowerCase();
  const applicationId = String(body.applicationId ?? "").trim();
  const planId = String(body.planId ?? "").trim();
  const source = normalizeSource(body.source);

  if (!companySlug || !planId) {
    return NextResponse.json({ error: "companySlug and planId are required" }, { status: 400 });
  }

  if (source === "qase") {
    const { selectedApplication } = await resolveApplication(companySlug, applicationId);
    const projectCode = normalizeProjectCode(body.projectCode) || normalizeProjectCode(selectedApplication?.qaseProjectCode);
    if (!projectCode) {
      return NextResponse.json({ error: "Qase project code is required" }, { status: 400 });
    }
    const qaseSettings = await getClientQaseSettings(companySlug);
    if (!qaseSettings?.token) {
      return NextResponse.json({ error: "Qase token missing" }, { status: 400 });
    }

    try {
      await deleteQasePlan({
        token: qaseSettings.token,
        baseUrl: qaseSettings.baseUrl,
        projectCode,
        planId,
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      return NextResponse.json(
        { error: resolveWarningFromQaseError(error) },
        { status: error instanceof QaseError ? error.status : 500 },
      );
    }
  }

  const deleted = await deleteManualTestPlan(companySlug, planId);
  if (!deleted) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
