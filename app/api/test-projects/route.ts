import { NextResponse } from "next/server";
import { authenticateRequest } from "@/backend/jwtAuth";
import { listTestProjects } from "@/backend/test-projects/testProjectsRepository";
import { resolveNormalizedCompanySlugs } from "@/backend/auth/normalizeAuthenticatedUser";
import { hasGlobalCompanyVisibility } from "@/backend/companyDefectsAccess";

function normalizeCompanySlug(value: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const url = new URL(request.url);
  const requestedCompanySlug = normalizeCompanySlug(url.searchParams.get("companySlug") ?? url.searchParams.get("companyId"));
  const applicationId = url.searchParams.get("applicationId")?.trim() || null;
  const includeCases = ["1", "true", "yes"].includes(String(url.searchParams.get("includeCases") ?? "").toLowerCase());
  const allowedSlugs = resolveNormalizedCompanySlugs(user);
  const companySlug =
    hasGlobalCompanyVisibility(user) && requestedCompanySlug
      ? requestedCompanySlug
      : requestedCompanySlug && allowedSlugs.includes(requestedCompanySlug)
        ? requestedCompanySlug
        : allowedSlugs[0] ?? user.companySlug ?? null;

  if (!companySlug) {
    return NextResponse.json({ message: "Empresa obrigatória" }, { status: 400 });
  }

  if (!hasGlobalCompanyVisibility(user) && !allowedSlugs.includes(companySlug)) {
    return NextResponse.json({ message: "Acesso proibido" }, { status: 403 });
  }

  const result = await listTestProjects({
    companySlug,
    applicationId,
    includeCases,
  });

  return NextResponse.json({
    ...result,
    companySlug,
    traceability: "Empresa > Aplicacao > Projeto > Suite > Caso",
  });
}

