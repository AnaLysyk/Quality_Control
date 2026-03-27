import { NextResponse } from "next/server";
import { listApplications } from "@/lib/applicationsStore";
import { getClientQaseSettings } from "@/lib/qaseConfig";
import { createQaseClient, QaseError } from "@/lib/qaseSdk";

type RawPlan = {
  id?: number | string;
  title?: string;
  name?: string;
  description?: string | null;
  cases_count?: number | string | null;
  casesCount?: number | string | null;
  created?: string | null;
  created_at?: string | null;
  updated?: string | null;
  updated_at?: string | null;
};

function normalizeProjectCode(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || null;
}

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizePlan(raw: RawPlan) {
  const id = String(raw.id ?? "").trim();
  if (!id) return null;
  const title = String(raw.title ?? raw.name ?? `Plano ${id}`).trim() || `Plano ${id}`;
  return {
    id,
    title,
    description: typeof raw.description === "string" ? raw.description : null,
    casesCount: toNumber(raw.cases_count ?? raw.casesCount),
    createdAt:
      typeof raw.created_at === "string"
        ? raw.created_at
        : typeof raw.created === "string"
          ? raw.created
          : null,
    updatedAt:
      typeof raw.updated_at === "string"
        ? raw.updated_at
        : typeof raw.updated === "string"
          ? raw.updated
          : null,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const companySlug = url.searchParams.get("companySlug")?.trim().toLowerCase() || "";
  const applicationId = url.searchParams.get("applicationId")?.trim() || "";
  const requestedProjectCode = normalizeProjectCode(url.searchParams.get("project"));

  if (!companySlug) {
    return NextResponse.json({ error: "companySlug is required" }, { status: 400 });
  }

  const applications = await listApplications({ companySlug });
  const selectedApplication = applicationId
    ? applications.find((item) => item.id === applicationId) ?? null
    : null;

  const projectCode = requestedProjectCode || normalizeProjectCode(selectedApplication?.qaseProjectCode);
  if (!projectCode) {
    return NextResponse.json({
      plans: [],
      totalTests: 0,
      projectCode: null,
      warning: "A aplicacao selecionada nao possui project code do Qase.",
    });
  }

  const qaseSettings = await getClientQaseSettings(companySlug);
  if (!qaseSettings?.token) {
    return NextResponse.json({
      plans: [],
      totalTests: 0,
      projectCode,
      warning: "Token do Qase ausente ou invalido para esta empresa.",
    });
  }

  try {
    const client = createQaseClient({
      token: qaseSettings.token,
      baseUrl: qaseSettings.baseUrl,
      defaultFetchOptions: { cache: "no-store" },
    });
    const response = await client.listPlans(projectCode, { limit: 50 });
    const entities = Array.isArray(response?.result?.entities) ? response.result.entities : [];
    const plans = entities
      .map((item) => normalizePlan((item ?? {}) as RawPlan))
      .filter((item): item is NonNullable<ReturnType<typeof normalizePlan>> => item !== null);

    return NextResponse.json({
      plans,
      totalTests: plans.reduce((sum, item) => sum + item.casesCount, 0),
      projectCode,
      warning: null,
    });
  } catch (error) {
    const status = error instanceof QaseError ? error.status : 500;
    const warning =
      status === 401 || status === 403
        ? "Qase recusou a autenticacao deste projeto."
        : status === 404
          ? "Projeto nao encontrado no Qase."
          : "Nao foi possivel consultar os planos de teste no Qase.";

    return NextResponse.json({
      plans: [],
      totalTests: 0,
      projectCode,
      warning,
    }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}
