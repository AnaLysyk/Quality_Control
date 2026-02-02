import { NextRequest, NextResponse } from "next/server";

import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { ClientSchema } from "@/contracts/client";
import { ErrorResponseSchema } from "@/contracts/errors";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import {
  findLocalCompanyById,
  updateLocalCompany,
  deleteLocalCompany,
  type LocalAuthCompany,
} from "@/lib/auth/localStore";

export const runtime = "nodejs";

const jsonError = (message: string, status: number) =>
  NextResponse.json(ErrorResponseSchema.parse({ error: message }), { status });

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function mapCompany(company: LocalAuthCompany) {
  return {
    id: company.id,
    name: (company.name ?? company.company_name ?? "").toString(),
    company_name: (company.company_name ?? company.name ?? "").toString(),
    slug: company.slug,
    tax_id: asString(company.tax_id),
    address: asString(company.address),
    phone: asString(company.phone),
    website: asString(company.website),
    logo_url: asString(company.logo_url),
    docs_link: asString(company.docs_link ?? company.docs_url),
    notes: asString(company.notes ?? company.description),
    qase_project_code: asString(company.qase_project_code),
    qase_project_codes: asStringArray(company.qase_project_codes),
    qase_token: asString(company.qase_token),
    jira_api_token: asString(company.jira_api_token),
    active: company.active ?? true,
    created_at: asString(company.created_at),
    created_by: asString(company.created_by),
  };
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) return jsonError(status === 401 ? "Nao autenticado" : "Sem permissao", status);

  const { id } = await context.params;
  const company = await findLocalCompanyById(id);
  if (!company) return jsonError("Cliente nao encontrado", 404);
  const payload = ClientSchema.parse(mapCompany(company));
  return NextResponse.json(payload, { status: 200 });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) return jsonError(status === 401 ? "Nao autenticado" : "Sem permissao", status);

  const { id } = await context.params;
  const body = await req.json().catch(() => null);
  const name = typeof body?.company_name === "string" ? body.company_name.trim() : typeof body?.name === "string" ? body.name.trim() : null;
  const slug = typeof body?.slug === "string" ? body.slug.trim() : null;

  const updated = await updateLocalCompany(id, {
    ...(name ? { name, company_name: name } : {}),
    ...(slug ? { slug } : {}),
    updated_at: new Date().toISOString(),
  });

  if (!updated) return jsonError("Cliente nao encontrado", 404);

  const payload = ClientSchema.parse(mapCompany(updated));
  await addAuditLogSafe({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: "client.updated",
    entityType: "client",
    entityId: payload.id,
    entityLabel: payload.name,
    metadata: { slug: payload.slug },
  });
  return NextResponse.json(payload, { status: 200 });
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) return jsonError(status === 401 ? "Nao autenticado" : "Sem permissao", status);

  const { id } = await context.params;
  const removed = await deleteLocalCompany(id);
  if (!removed) return jsonError("Cliente nao encontrado", 404);

  await addAuditLogSafe({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: "client.deleted",
    entityType: "client",
    entityId: id,
    entityLabel: id,
    metadata: {},
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
