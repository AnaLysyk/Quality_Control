import { NextRequest, NextResponse } from "next/server";

import { addAuditLogSafe } from "@/data/auditLogRepository";
import { createLocalCompany, deleteLocalCompany, listLocalCompanies } from "@/lib/auth/localStore";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export async function GET() {
  const companies = await listLocalCompanies();
  return NextResponse.json(companies);
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (!body.name) {
    return NextResponse.json({ error: "Campo 'name' obrigatório" }, { status: 400 });
  }
  const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  // build integrations from legacy fields if integrations array not provided
  const integrations: Array<{ type: string; config?: Record<string, unknown> }> = [];
  if (Array.isArray(body.integrations)) {
    for (const it of body.integrations) {
      if (!it || typeof it !== "object") continue;
      integrations.push({ type: it.type, config: it.config ?? {} });
    }
  } else {
    const normalizedProjectCodes = Array.isArray(body.qase_project_codes)
      ? body.qase_project_codes
      : typeof body.qase_project_code === "string"
      ? [body.qase_project_code]
      : [];
    if (body.qase_token || normalizedProjectCodes.length) {
      integrations.push({ type: "QASE", config: { token: body.qase_token ?? null, projects: normalizedProjectCodes } });
    }
    if (body.jira_api_token || body.jira_base_url) {
      integrations.push({ type: "JIRA", config: { baseUrl: body.jira_base_url ?? null, email: body.jira_email ?? null, apiToken: body.jira_api_token ?? null } });
    }
  }

  const company = await createLocalCompany({
    name: body.name,
    slug,
    company_name: body.company_name || body.name,
    integration_mode: body.integration_mode || "manual",
    qase_project_code: (Array.isArray(body.qase_project_codes) && body.qase_project_codes.length ? body.qase_project_codes[0] : (typeof body.qase_project_code === 'string' ? body.qase_project_code : null)) || null,
    qase_project_codes: Array.isArray(body.qase_project_codes) ? body.qase_project_codes : (typeof body.qase_project_code === 'string' ? [body.qase_project_code] : []),
    qase_token: body.qase_token || null,
    integrations: integrations.length ? integrations : undefined,
    created_at: new Date().toISOString(),
  });
  return NextResponse.json(company, { status: 201 });
}

export async function PATCH(_req: Request) {
  return NextResponse.json({ error: "PATCH não implementado" }, { status: 501 });
}

export async function DELETE(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Não autenticado" : "Sem permissão" }, { status });
  }

  const url = new URL(req.url, "http://localhost");
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID da empresa e obrigatório" }, { status: 400 });
  }

  const companies = await listLocalCompanies();
  const target = companies.find((company) => company.id === id) ?? null;
  if (!target) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const deleted = await deleteLocalCompany(id);
  if (!deleted) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  await addAuditLogSafe({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: "client.deleted",
    entityType: "client",
    entityId: target.id,
    entityLabel: target.name ?? target.company_name ?? target.slug ?? target.id,
    metadata: { slug: target.slug ?? null },
  });

  return NextResponse.json({ ok: true });
}
