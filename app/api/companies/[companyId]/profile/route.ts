import { NextResponse } from "next/server";

import { addAuditLogSafe } from "@/data/auditLogRepository";
import { listAdminUserItems } from "@/lib/adminUsers";
import { getAccessContext } from "@/lib/auth/session";
import { findLocalCompanyById, updateLocalCompany } from "@/lib/auth/localStore";
import { authenticateRequest } from "@/lib/jwtAuth";
import { resolveCompanyProfilePermissions, buildProfileContext } from "@/lib/profile/profilePermissions";

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function pickEditableCompanyPatch(body: Record<string, unknown>, privileged: boolean) {
  const patch: Record<string, unknown> = {};
  const editableTextFields = [
    "name",
    "company_name",
    "tax_id",
    "slug",
    "phone",
    "website",
    "logo_url",
    "docs_link",
    "linkedin_url",
    "cep",
    "address",
    "address_detail",
  ] as const;

  for (const field of editableTextFields) {
    if (typeof body[field] === "string") patch[field] = readText(body[field]);
    if (privileged && body[field] === null) patch[field] = null;
  }

  if (typeof body.active === "boolean" && privileged) patch.active = body.active;
  if (typeof body.status === "string" && privileged) patch.status = readText(body.status);
  if (Array.isArray(body.qase_project_codes) && privileged) {
    patch.qase_project_codes = body.qase_project_codes.filter((item) => typeof item === "string");
  }
  if (typeof body.qase_token === "string" && privileged) patch.qase_token = readText(body.qase_token);
  if (typeof body.jira_base_url === "string" && privileged) patch.jira_base_url = readText(body.jira_base_url);
  if (typeof body.jira_email === "string" && privileged) patch.jira_email = readText(body.jira_email);
  if (typeof body.jira_api_token === "string" && privileged) patch.jira_api_token = readText(body.jira_api_token);
  if (typeof body.notifications_fanout_enabled === "boolean" && privileged) {
    patch.notifications_fanout_enabled = body.notifications_fanout_enabled;
  }

  return patch;
}

export async function GET(req: Request, context: { params: Promise<{ companyId: string }> }) {
  const authUser = await authenticateRequest(req);
  if (!authUser) return NextResponse.json({ message: "Não autenticado" }, { status: 401 });

  const { companyId } = await context.params;
  const company = await findLocalCompanyById(companyId);
  if (!company) return NextResponse.json({ message: "Empresa não encontrada" }, { status: 404 });

  const permissions = resolveCompanyProfilePermissions(authUser, company, "view");
  const hasScope =
    authUser.isGlobalAdmin === true ||
    permissions.canEdit ||
    permissions.canDelete ||
    permissions.canDeactivate ||
    (authUser.companySlugs ?? []).some((slug) => (slug ?? "").trim().toLowerCase() === (company.slug ?? "").trim().toLowerCase());
  if (!hasScope) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 });
  }

  const users = await listAdminUserItems({ companyId });
  const profileContext = buildProfileContext({
    profileType: "company",
    targetId: companyId,
    mode: "view",
    viewer: authUser,
    permissions,
  });

  return NextResponse.json({ item: company, users, profileContext }, { status: 200 });
}

export async function PATCH(req: Request, context: { params: Promise<{ companyId: string }> }) {
  const authUser = await authenticateRequest(req);
  if (!authUser) return NextResponse.json({ message: "Não autenticado" }, { status: 401 });

  const access = await getAccessContext(req);
  const { companyId } = await context.params;
  const company = await findLocalCompanyById(companyId);
  if (!company) return NextResponse.json({ message: "Empresa não encontrada" }, { status: 404 });

  const permissions = resolveCompanyProfilePermissions(authUser, company, "edit");
  if (!permissions.canEdit) return NextResponse.json({ message: "Sem permissão" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Payload inválido" }, { status: 400 });

  const privileged = Boolean(access && (access.role === "leader_tc" || access.companyRole === "leader_tc" || access.isGlobalAdmin));
  const patch = pickEditableCompanyPatch(body, privileged);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ message: "Nenhum campo editável informado" }, { status: 400 });
  }

  if (!privileged && ("status" in patch || "active" in patch || "qase_token" in patch || "jira_api_token" in patch)) {
    return NextResponse.json({ message: "Sem permissão para alterar campos administrativos" }, { status: 403 });
  }

  const updated = await updateLocalCompany(companyId, patch as never);
  if (!updated) return NextResponse.json({ message: "Empresa não encontrada" }, { status: 404 });

  addAuditLogSafe({
    actorUserId: authUser.id,
    actorEmail: authUser.email,
    action: "client.updated",
    entityType: "client",
    entityId: companyId,
    entityLabel: updated.company_name ?? updated.name ?? updated.slug ?? updated.id,
    metadata: {
      targetCompanyId: companyId,
      mode: privileged ? "admin" : "self",
      fields: Object.keys(patch),
    },
  });

  const users = await listAdminUserItems({ companyId });
  const profileContext = buildProfileContext({
    profileType: "company",
    targetId: companyId,
    mode: privileged ? "admin-edit" : "edit",
    viewer: authUser,
    permissions,
  });

  return NextResponse.json({ item: updated, users, profileContext }, { status: 200 });
}

