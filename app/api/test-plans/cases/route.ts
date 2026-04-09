import { NextResponse } from "next/server";
import { listApplications } from "@/lib/applicationsStore";
import { getClientQaseSettings } from "@/lib/qaseConfig";
import { QaseError } from "@/lib/qaseSdk";
import { getQaseCase } from "@/lib/qasePlans";
import { getManualTestPlan } from "@/lib/testPlansStore";

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
    return "Qase recusou a autenticacao deste projeto.";
  }
  if (status === 404) {
    return "Caso de teste nao encontrado no Qase.";
  }
  if (status === 422) {
    return "Qase recusou a consulta do caso informado.";
  }
  return "Nao foi possivel consultar o caso de teste no Qase.";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const companySlug = url.searchParams.get("companySlug")?.trim().toLowerCase() || "";
  const applicationId = url.searchParams.get("applicationId")?.trim() || "";
  const caseId = url.searchParams.get("caseId")?.trim() || "";
  const planId = url.searchParams.get("planId")?.trim() || "";
  const source = normalizeSource(url.searchParams.get("source"));

  if (!companySlug || !caseId) {
    return NextResponse.json({ error: "companySlug and caseId are required" }, { status: 400 });
  }

  if (source === "manual") {
    if (!planId) {
      return NextResponse.json({ error: "planId is required for manual cases" }, { status: 400 });
    }
    const plan = await getManualTestPlan({ companySlug, id: planId });
    const testCase = plan?.cases.find((item) => item.id === caseId) ?? null;
    if (!testCase) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }
    return NextResponse.json({ case: testCase });
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
