import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { ClientCreateRequestSchema, ClientListResponseSchema, ClientSchema } from "@/contracts/client";
import { ErrorResponseSchema } from "@/contracts/errors";
import { addAuditLogSafe } from "@/data/auditLogRepository";

export const runtime = "nodejs";

const jsonError = (message: string, status: number) =>
  NextResponse.json(ErrorResponseSchema.parse({ error: message }), { status });

function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

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

export async function GET(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) return jsonError(status === 401 ? "Nao autenticado" : "Sem permissao", status);

  const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });
  const payload = ClientListResponseSchema.parse({ items: companies.map(mapCompany) });
  return NextResponse.json(payload, { status: 200 });
}

export async function POST(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) return jsonError(status === 401 ? "Nao autenticado" : "Sem permissao", status);

  const body = await req.json().catch(() => null);
  const parsed = ClientCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Payload invalido", 400);
  }

  const input = parsed.data;
  const name = (input.company_name || input.name || "").trim();
  if (!name) {
    return jsonError("Campo 'name' ou 'company_name' e obrigatorio", 400);
  }

  const desiredSlug = (input.slug || "").trim();
  const slugBase = toSlug(desiredSlug || name) || `empresa-${randomUUID().slice(0, 8)}`;

  const company = await prisma.company.create({
    data: { name, slug: slugBase },
  });

  const payload = ClientSchema.parse(mapCompany(company));

  await addAuditLogSafe({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: "client.created",
    entityType: "client",
    entityId: payload.id,
    entityLabel: payload.name,
    metadata: { slug: payload.slug, active: payload.active },
  });

  return NextResponse.json(payload, { status: 201 });
}
