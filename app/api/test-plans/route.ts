import { NextResponse } from "next/server";
import { authenticateRequest, type AuthUser } from "@/backend/jwtAuth";
import { hasGlobalCompanyVisibility } from "@/backend/companyDefectsAccess";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/backend/auth/roles";
import { resolveNormalizedCompanySlugs } from "@/backend/auth/normalizeAuthenticatedUser";
import { listApplications } from "@/backend/applicationsStore";
import { getClientQaseSettings } from "@/backend/qaseConfig";
import { QaseError } from "@/backend/qaseSdk";
import { listTestCaseRecords } from "@/backend/test-cases/testCaseRepository";
import { canAccessTestCaseRecord, resolveAllowedProjectIds } from "@/backend/test-cases/testCasePermissions";
import {
  extractNumericCaseIds,
  parseTestPlanCases,
  type TestPlanCase,
} from "@/backend/testPlanCases";
import {
  createQasePlan,
  deleteQasePlan,
  getQasePlan,
  listQasePlans,
  updateQasePlan,
} from "@/backend/qasePlans";
import {
  createManualTestPlan,
  deleteManualTestPlan,
  getManualTestPlan,
  listManualTestPlans,
  updateManualTestPlan,
} from "@/backend/testPlansStore";
import { normalizeTestPlanSource, type TestPlanSource } from "@/backend/testPlanCases";

type ApplicationItem = {
  id: string;
  name: string;
  slug: string;
  qaseProjectCode?: string | null;
};

type PlanSource = TestPlanSource;

function normalizeCompanySlug(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function hasGlobalTestPlanWriteAccess(user: AuthUser) {
  if (user.isGlobalAdmin) return true;
  return [user.role, user.globalRole, user.permissionRole, user.companyRole]
    .some((role) => normalizeLegacyRole(role) === SYSTEM_ROLES.LEADER_TC);
}

function matchesPlanProjectScope(user: AuthUser, projectId?: string | null) {
  const allowedProjectIds = resolveAllowedProjectIds(user);
  if (!allowedProjectIds) return true;
  return Boolean(projectId && allowedProjectIds.includes(projectId));
}

async function requireTestPlanCompanyAccess(
  request: Request,
  companySlug: string,
  mode: "read" | "write",
  projectId?: string | null,
) {
  const user = await authenticateRequest(request);
  if (!user) {
    return { response: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  }
  if (!companySlug) {
    return { response: NextResponse.json({ error: "companySlug is required" }, { status: 400 }) };
  }

  const allowedSlugs = resolveNormalizedCompanySlugs(user);
  const hasCompanyAccess =
    (mode === "read" && hasGlobalCompanyVisibility(user)) ||
    (mode === "write" && hasGlobalTestPlanWriteAccess(user)) ||
    allowedSlugs.includes(companySlug);

  if (!hasCompanyAccess) {
    return { response: NextResponse.json({ error: "Acesso proibido" }, { status: 403 }) };
  }
  if (projectId !== undefined && !matchesPlanProjectScope(user, projectId)) {
    return { response: NextResponse.json({ error: "Acesso proibido" }, { status: 403 }) };
  }

  return { user };
}

function assertCaseCanBeUsedInPlan(user: AuthUser, record: Awaited<ReturnType<typeof listTestCaseRecords>>[number], companySlug: string) {
  if (!canAccessTestCaseRecord(user, record)) {
    throw new Error("TEST_CASE_FORBIDDEN");
  }

  const caseCompanySlug = record.testCase.companyId?.trim().toLowerCase() || null;
  if (caseCompanySlug && caseCompanySlug !== companySlug) {
    throw new Error("TEST_CASE_FORBIDDEN");
  }
}

function normalizeProjectCode(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || null;
}

function normalizeSource(value: unknown): PlanSource {
  return normalizeTestPlanSource(value, "local");
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
    type: input.source,
    applicationId: input.applicationId ?? null,
    applicationName: input.applicationName ?? null,
    cases: Array.isArray(input.cases) ? input.cases : undefined,
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

async function resolveCentralTestPlanCases(caseRefs: TestPlanCase[], user: AuthUser, companySlug: string) {
  if (!caseRefs.length) return [];

  const records = await listTestCaseRecords();
  const byId = new Map(records.map((record) => [record.testCase.id, record]));

  return caseRefs.map((caseRef) => {
    const record = byId.get(caseRef.id);
    if (!record) {
      throw new Error(`TEST_CASE_NOT_FOUND:${caseRef.id}`);
    }
    assertCaseCanBeUsedInPlan(user, record, companySlug);

    return {
      id: record.testCase.id,
      title: record.testCase.title,
      description: record.testCase.description ?? null,
      preconditions: record.testCase.preconditions ?? null,
      postconditions: record.testCase.postconditions ?? null,
      severity: record.testCase.severity ?? null,
      link: null,
      steps: record.steps.map((step) => ({
        id: step.id,
        action: step.action,
        expectedResult: step.expectedResult,
        data: step.data ?? null,
      })),
    } satisfies TestPlanCase;
  });
}

async function hydrateManualPlanCases(caseRefs: TestPlanCase[], user: AuthUser, companySlug: string) {
  if (!caseRefs.length) return [];

  const records = await listTestCaseRecords();
  const byId = new Map(records.map((record) => [record.testCase.id, record]));

  return caseRefs.map((caseRef) => {
    const record = byId.get(caseRef.id);
    if (!record) {
      return {
        id: caseRef.id,
        ...(caseRef.automation ? { automation: caseRef.automation } : {}),
      };
    }
    try {
      assertCaseCanBeUsedInPlan(user, record, companySlug);
    } catch {
      return {
        id: caseRef.id,
        ...(caseRef.automation ? { automation: caseRef.automation } : {}),
      };
    }

    return {
      id: record.testCase.id,
      title: record.testCase.title,
      description: record.testCase.description ?? null,
      preconditions: record.testCase.preconditions ?? null,
      postconditions: record.testCase.postconditions ?? null,
      severity: record.testCase.severity ?? null,
      link: null,
      steps: record.steps.map((step) => ({
        id: step.id,
        action: step.action,
        expectedResult: step.expectedResult,
        data: step.data ?? null,
      })),
      ...(caseRef.automation ? { automation: caseRef.automation } : {}),
    } satisfies TestPlanCase;
  });
}

async function resolveCentralTestPlanCasesByIds(testCaseIds: string[], user: AuthUser, companySlug: string) {
  if (!testCaseIds.length) return [];

  const caseRefs = testCaseIds.map((id) => ({ id }));
  return resolveCentralTestPlanCases(caseRefs, user, companySlug);
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
  const companySlug = normalizeCompanySlug(url.searchParams.get("companySlug"));
  const applicationId = url.searchParams.get("applicationId")?.trim() || "";
  const projectId = url.searchParams.get("projectId")?.trim() || "";
  const requestedProjectCode = normalizeProjectCode(
    url.searchParams.get("project") ??
      url.searchParams.get("projectCode") ??
      url.searchParams.get("projectSlug"),
  );
  const planId = url.searchParams.get("planId")?.trim() || "";
  const source = normalizeSource(url.searchParams.get("source"));

  const access = await requireTestPlanCompanyAccess(request, companySlug, "read", projectId || undefined);
  if ("response" in access) return access.response;
  const { user } = access;

  const { applications, selectedApplication } = await resolveApplication(companySlug, applicationId);
  const projectCode = requestedProjectCode || normalizeProjectCode(selectedApplication?.qaseProjectCode);
  const allowedProjectIds = resolveAllowedProjectIds(user);
  const manualPlans = (
    await listManualTestPlans({
      companySlug,
      applicationId: applicationId || undefined,
      projectId: projectId || undefined,
    })
  ).filter((plan) => !allowedProjectIds || (plan.projectId && allowedProjectIds.includes(plan.projectId)));

  if (planId) {
    if (source === "manual") {
      const plan = await getManualTestPlan({ companySlug, id: planId });
      if (!plan || !matchesPlanProjectScope(user, plan.projectId)) {
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
          cases: await hydrateManualPlanCases(plan.cases, user, companySlug),
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

  const companySlug = normalizeCompanySlug(body.companySlug);
  const applicationId = String(body.applicationId ?? "").trim();
  const planProjectId = String(body.projectId ?? "").trim() || null;
  const source = normalizeSource(body.source);
  const title = String(body.title ?? "").trim();
  const description = typeof body.description === "string" ? body.description.trim() || null : null;
  const caseRefs = parseTestPlanCases(body.cases);
  const testCaseIds = Array.isArray(body.testCaseIds)
    ? body.testCaseIds.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];

  const access = await requireTestPlanCompanyAccess(request, companySlug, "write", planProjectId);
  if ("response" in access) return access.response;
  const { user } = access;

  if (!applicationId || !title) {
    return NextResponse.json({ error: "companySlug, applicationId and title are required" }, { status: 400 });
  }

  const { selectedApplication } = await resolveApplication(companySlug, applicationId);
  if (!selectedApplication) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  let resolvedCaseRefs = caseRefs;
  try {
    if (testCaseIds.length) {
      resolvedCaseRefs = await resolveCentralTestPlanCasesByIds(testCaseIds, user, companySlug);
    } else {
      resolvedCaseRefs = await resolveCentralTestPlanCases(caseRefs, user, companySlug);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("TEST_CASE_NOT_FOUND:")) {
      return NextResponse.json({ error: "One or more linked cases were not found in the central repository" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "TEST_CASE_FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissão para vincular um ou mais casos" }, { status: 403 });
    }
    throw error;
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
    projectId: planProjectId,
    source,
    title,
    description,
    cases: resolvedCaseRefs,
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
      source: created.source,
      applicationId: created.applicationId,
      applicationName: created.applicationName,
      cases: await hydrateManualPlanCases(created.cases, user, companySlug),
    }),
  }, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companySlug = normalizeCompanySlug(body.companySlug);
  const applicationId = String(body.applicationId ?? "").trim();
  const planId = String(body.planId ?? "").trim();
  const source = normalizeSource(body.source);

  const access = await requireTestPlanCompanyAccess(request, companySlug, "write");
  if ("response" in access) return access.response;
  const { user } = access;

  if (!planId) {
    return NextResponse.json({ error: "companySlug and planId are required" }, { status: 400 });
  }

  if (source === "manual") {
    const existingPlan = await getManualTestPlan({ companySlug, id: planId });
    if (!existingPlan || !matchesPlanProjectScope(user, existingPlan.projectId)) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
  }

  const caseRefs = body.cases === undefined ? undefined : parseTestPlanCases(body.cases);
  const testCaseIds = Array.isArray(body.testCaseIds)
    ? body.testCaseIds.map((item) => String(item ?? "").trim()).filter(Boolean)
    : undefined;

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
  let resolvedCaseRefs = caseRefs;
  if (testCaseIds !== undefined) {
    try {
      resolvedCaseRefs = await resolveCentralTestPlanCasesByIds(testCaseIds, user, companySlug);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("TEST_CASE_NOT_FOUND:")) {
        return NextResponse.json({ error: "One or more linked cases were not found in the central repository" }, { status: 400 });
      }
      if (error instanceof Error && error.message === "TEST_CASE_FORBIDDEN") {
        return NextResponse.json({ error: "Sem permissão para vincular um ou mais casos" }, { status: 403 });
      }
      throw error;
    }
  } else if (caseRefs !== undefined) {
    try {
      resolvedCaseRefs = await resolveCentralTestPlanCases(caseRefs, user, companySlug);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("TEST_CASE_NOT_FOUND:")) {
        return NextResponse.json({ error: "One or more linked cases were not found in the central repository" }, { status: 400 });
      }
      if (error instanceof Error && error.message === "TEST_CASE_FORBIDDEN") {
        return NextResponse.json({ error: "Sem permissão para vincular um ou mais casos" }, { status: 403 });
      }
      throw error;
    }
  }

  const updated = await updateManualTestPlan(companySlug, planId, {
    ...(body.title !== undefined ? { title: String(body.title ?? "").trim() } : {}),
    ...(body.description !== undefined
      ? { description: typeof body.description === "string" ? body.description.trim() || null : null }
      : {}),
    ...(resolvedCaseRefs !== undefined ? { cases: resolvedCaseRefs } : {}),
    ...(selectedApplication
      ? {
          applicationId: selectedApplication.id,
          applicationName: selectedApplication.name,
          applicationSlug: selectedApplication.slug,
          projectCode:
            normalizeProjectCode(body.projectCode) || normalizeProjectCode(selectedApplication.qaseProjectCode),
          source,
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
      source: updated.source,
      applicationId: updated.applicationId,
      applicationName: updated.applicationName,
      cases: await hydrateManualPlanCases(updated.cases, user, companySlug),
    }),
  });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companySlug = normalizeCompanySlug(body.companySlug);
  const applicationId = String(body.applicationId ?? "").trim();
  const planId = String(body.planId ?? "").trim();
  const source = normalizeSource(body.source);

  const access = await requireTestPlanCompanyAccess(request, companySlug, "write");
  if ("response" in access) return access.response;
  const { user } = access;

  if (!planId) {
    return NextResponse.json({ error: "companySlug and planId are required" }, { status: 400 });
  }

  if (source === "manual") {
    const existingPlan = await getManualTestPlan({ companySlug, id: planId });
    if (!existingPlan || !matchesPlanProjectScope(user, existingPlan.projectId)) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
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

