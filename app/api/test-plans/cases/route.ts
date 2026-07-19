import { NextResponse } from "next/server";
import { authenticateRequest, type AuthUser } from "@/backend/jwtAuth";
import { hasGlobalCompanyVisibility } from "@/backend/companyDefectsAccess";
import { resolveNormalizedCompanySlugs } from "@/backend/auth/normalizeAuthenticatedUser";
import { listApplications } from "@/backend/applicationsStore";
import { getClientQaseSettings } from "@/backend/qaseConfig";
import { QaseError } from "@/backend/qaseSdk";
import { getQaseCase } from "@/backend/qasePlans";
import { getTestCaseRecord } from "@/backend/test-cases/testCaseRepository";
import { canAccessTestCaseRecord } from "@/backend/test-cases/testCasePermissions";
import { getManualTestPlan } from "@/backend/testPlansStore";

function normalizeCompanySlug(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

async function requireTestPlanCaseCompanyAccess(request: Request, companySlug: string) {
  const user = await authenticateRequest(request);
  if (!user) {
    return { response: NextResponse.json({ error: "Nao autorizado" }, { status: 401 }) };
  }
  if (!companySlug) {
    return { response: NextResponse.json({ error: "companySlug is required" }, { status: 400 }) };
  }

  const allowedSlugs = resolveNormalizedCompanySlugs(user);
  if (hasGlobalCompanyVisibility(user) || allowedSlugs.includes(companySlug)) {
    return { user };
  }

  return { response: NextResponse.json({ error: "Acesso proibido" }, { status: 403 }) };
}

function canReadCentralCaseInPlan(user: AuthUser, record: Awaited<ReturnType<typeof getTestCaseRecord>>, companySlug: string) {
  if (!record || !canAccessTestCaseRecord(user, record)) return false;
  const caseCompanySlug = record.testCase.companyId?.trim().toLowerCase() || null;
  return !caseCompanySlug || caseCompanySlug === companySlug;
}

function normalizeProjectCode(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || null;
}

function normalizeSource(value: unknown) {
  return String(value ?? "").trim().toLowerCase() === "qase" ? "qase" : "manual";
}

function resolveCaseError(error: unknown) {
  const status = error instanceof QaseError ? error.status : 500;
  if (status === 401 || status === 403) {
    return "Qase recusou a autenticação deste projeto.";
  }
  if (status === 404) {
    return "Caso de teste não encontrado no Qase.";
  }
  if (status === 422) {
    return "Qase recusou a consulta do caso informado.";
  }
  return "Não foi possível consultar o caso de teste no Qase.";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const companySlug = normalizeCompanySlug(url.searchParams.get("companySlug"));
  const applicationId = url.searchParams.get("applicationId")?.trim() || "";
  const caseId = url.searchParams.get("caseId")?.trim() || "";
  const planId = url.searchParams.get("planId")?.trim() || "";
  const source = normalizeSource(url.searchParams.get("source"));

  const access = await requireTestPlanCaseCompanyAccess(request, companySlug);
  if ("response" in access) return access.response;
  const { user } = access;

  if (!caseId) {
    return NextResponse.json({ error: "companySlug and caseId are required" }, { status: 400 });
  }

  if (source === "manual") {
    if (!planId) {
      return NextResponse.json({ error: "planId is required for manual cases" }, { status: 400 });
    }
    const plan = await getManualTestPlan({ companySlug, id: planId });
    const linkedCase = plan?.cases.find((item) => item.id === caseId) ?? null;
    if (!linkedCase) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }
    const centralRecord = await getTestCaseRecord(caseId);
    if (!centralRecord) {
      return NextResponse.json({ case: linkedCase });
    }
    if (!canReadCentralCaseInPlan(user, centralRecord, companySlug)) {
      return NextResponse.json({ error: "Acesso proibido" }, { status: 403 });
    }

    return NextResponse.json({
      case: {
        id: centralRecord.testCase.id,
        title: centralRecord.testCase.title,
        description: centralRecord.testCase.description ?? null,
        preconditions: centralRecord.testCase.preconditions ?? null,
        postconditions: centralRecord.testCase.postconditions ?? null,
        severity: centralRecord.testCase.severity ?? null,
        link: null,
        steps: centralRecord.steps.map((step) => ({
          id: step.id,
          action: step.action,
          expectedResult: step.expectedResult,
          data: step.data ?? null,
        })),
        ...(linkedCase.automation ? { automation: linkedCase.automation } : {}),
      },
    });
  }

  const requestedProjectCode = normalizeProjectCode(url.searchParams.get("project"));
  const applications = await listApplications({ companySlug });
  const selectedApplication = applicationId
    ? applications.find((item) => item.id === applicationId) ?? null
    : null;
  const projectCode =
    requestedProjectCode || normalizeProjectCode(selectedApplication?.qaseProjectCode);

  if (!projectCode) {
    return NextResponse.json({ error: "projectCode is required" }, { status: 400 });
  }

  const qaseSettings = await getClientQaseSettings(companySlug);
  if (!qaseSettings?.token) {
    return NextResponse.json({ error: "Qase token missing" }, { status: 400 });
  }

  try {
    const testCase = await getQaseCase({
      token: qaseSettings.token,
      baseUrl: qaseSettings.baseUrl,
      projectCode,
      caseId,
    });
    if (!testCase) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }
    return NextResponse.json({ case: testCase });
  } catch (error) {
    return NextResponse.json(
      { error: resolveCaseError(error) },
      { status: error instanceof QaseError ? error.status : 500 },
    );
  }
}

