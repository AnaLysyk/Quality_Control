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
    return NextResponse.json({ error: "Campo 'name' obrigatorio" }, { status: 400 });
  }
  const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const company = await createLocalCompany({
    name: body.name,
    slug,
    company_name: body.company_name || body.name,
    integration_mode: body.integration_mode || "manual",
    qase_project_code: body.qase_project_code || null,
    qase_token: body.qase_token || null,
    created_at: new Date().toISOString(),
  });
  return NextResponse.json(company, { status: 201 });
}

export async function PATCH(_req: Request) {
  return NextResponse.json({ error: "PATCH nao implementado" }, { status: 501 });
}

export async function DELETE(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const url = new URL(req.url, "http://localhost");
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID da empresa e obrigatorio" }, { status: 400 });
  }

  const companies = await listLocalCompanies();
  const target = companies.find((company) => company.id === id) ?? null;
  if (!target) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
  }

  const deleted = await deleteLocalCompany(id);
  if (!deleted) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
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
