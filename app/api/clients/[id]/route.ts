import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { ClientSchema } from "@/contracts/client";
import { ErrorResponseSchema } from "@/contracts/errors";
import { addAuditLogSafe } from "@/data/auditLogRepository";

export const runtime = "nodejs";

const jsonError = (message: string, status: number) =>
  NextResponse.json(ErrorResponseSchema.parse({ error: message }), { status });

function mapCompany(company: { id: string; name: string; slug: string }) {
  return {
    id: company.id,
    name: company.name,
    company_name: company.name,
    slug: company.slug,
    tax_id: null,
    address: null,
    phone: null,
    website: null,
    logo_url: null,
    docs_link: null,
    notes: null,
    qase_project_code: null,
    qase_project_codes: null,
    qase_token: null,
    jira_api_token: null,
    active: true,
    created_at: null,
    created_by: null,
  };
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) return jsonError(status === 401 ? "Nao autenticado" : "Sem permissao", status);

  const { id } = await context.params;
  const company = await prisma.company.findUnique({ where: { id } });
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

  const updated = await prisma.company.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(slug ? { slug } : {}),
    },
  }).catch(() => null);

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
  const removed = await prisma.company.delete({ where: { id } }).catch(() => null);
  if (!removed) return jsonError("Cliente nao encontrado", 404);

  await addAuditLogSafe({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: "client.deleted",
    entityType: "client",
    entityId: removed.id,
    entityLabel: removed.name,
    metadata: { slug: removed.slug },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
