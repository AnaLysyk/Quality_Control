import { NextResponse } from "next/server";
import { authenticateRequest } from "@/backend/jwtAuth";
import {
  canAccessCompanyDefects,
  resolveAllowedCompanySlugs,
} from "@/backend/companyDefectsAccess";
import {
  canCreateManualDefect,
  canDeleteManualDefect,
  canEditManualDefect,
  resolveDefectRole,
} from "@/backend/rbac/defects";
import { getCompanyDefectsDataset } from "@/backend/companyDefectsDataset";

function normalizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const requestedCompanySlug = normalizeString(url.searchParams.get("companySlug"));
  const requestedProjectScope =
    normalizeString(url.searchParams.get("project")) ??
    normalizeString(url.searchParams.get("projectCode")) ??
    normalizeString(url.searchParams.get("projectSlug")) ??
    normalizeString(url.searchParams.get("application"));
  const requestedProjectId = normalizeString(url.searchParams.get("projectId"));
  const refreshRequested = url.searchParams.get("refresh") === "1";
  const companySlug = user.isGlobalAdmin
    ? requestedCompanySlug
    : requestedCompanySlug && canAccessCompanyDefects(user, requestedCompanySlug)
      ? requestedCompanySlug
      : user.companySlug ?? resolveAllowedCompanySlugs(user)[0] ?? null;

  if (!companySlug) {
    return NextResponse.json({ message: "Empresa não informada" }, { status: 400 });
  }
  if (!canAccessCompanyDefects(user, companySlug)) {
    return NextResponse.json({ message: "Acesso proibido" }, { status: 403 });
  }

  const role = await resolveDefectRole(user, companySlug);
  const dataset = await getCompanyDefectsDataset(companySlug, {
    forceRefresh: refreshRequested,
    project: requestedProjectScope,
    projectId: requestedProjectId,
  });
  const items = dataset.items.map((item) => ({
    ...item,
    canEdit: item.sourceType === "manual" && canEditManualDefect(role),
    canDelete: item.sourceType === "manual" && canDeleteManualDefect(role),
    canAssign: canEditManualDefect(role),
    canComment: true,
  }));

  return NextResponse.json({
    items,
    warning: dataset.warning,
    applications: dataset.applications,
    integration: dataset.integration,
    permissions: {
      canCreate: canCreateManualDefect(role),
      canEditManual: canEditManualDefect(role),
      canDeleteManual: canDeleteManualDefect(role),
      canAssignIntegrated: canEditManualDefect(role),
      canComment: true,
    },
    responsibleOptions: dataset.responsibleOptions,
  });
}

