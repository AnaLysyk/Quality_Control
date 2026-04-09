import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import {
  canAccessCompanyDefects,
  resolveAllowedCompanySlugs,
} from "@/lib/companyDefectsAccess";
import {
  canCreateManualDefect,
  canDeleteManualDefect,
  canEditManualDefect,
  resolveDefectRole,
} from "@/lib/rbac/defects";
import { getCompanyDefectsDataset } from "@/lib/companyDefectsDataset";

function normalizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ message: "Nao autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const requestedCompanySlug = normalizeString(url.searchParams.get("companySlug"));
  const refreshRequested = url.searchParams.get("refresh") === "1";
  const companySlug = user.isGlobalAdmin
    ? requestedCompanySlug
    : requestedCompanySlug && canAccessCompanyDefects(user, requestedCompanySlug)
      ? requestedCompanySlug
      : user.companySlug ?? resolveAllowedCompanySlugs(user)[0] ?? null;

  if (!companySlug) {
    return NextResponse.json({ message: "Empresa nao informada" }, { status: 400 });
  }
  if (!canAccessCompanyDefects(user, companySlug)) {
    return NextResponse.json({ message: "Acesso proibido" }, { status: 403 });
  }

  const role = await resolveDefectRole(user, companySlug);
  const dataset = await getCompanyDefectsDataset(companySlug, { forceRefresh: refreshRequested });
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
