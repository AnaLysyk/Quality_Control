import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { ClientCreateRequestSchema, ClientListResponseSchema, ClientSchema } from "@/contracts/client";
import { ErrorResponseSchema } from "@/contracts/errors";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { syncCompanyApplications } from "@/lib/applicationsStore";
import { createLocalCompany, listLocalCompanies, type LocalAuthCompany } from "@/lib/auth/localStore";

export const runtime = "nodejs";
export const revalidate = 0;

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

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function normalizeProjectCodes(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const items = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
    return items.length ? Array.from(new Set(items)) : null;
  }
  if (typeof value === "string") {
    const items = value
      .split(/[\s,;|]+/g)
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
    return items.length ? Array.from(new Set(items)) : null;
  }
  return null;
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
    cep: asString(company.cep),
    address_detail: asString(company.address_detail),
    linkedin_url: asString(company.linkedin_url),
    qase_project_code: asString(company.qase_project_code),
    qase_project_codes: asStringArray(company.qase_project_codes),
    qase_token: asString(company.qase_token),
    jira_base_url: asString(company.jira_base_url),
    jira_email: asString(company.jira_email),
    jira_username: asString(company.jira_username),
    jira_api_token: asString(company.jira_api_token),
    integration_mode: asString(company.integration_mode),
    integration_type: asString((company as { integration_type?: unknown }).integration_type),
    short_description: asString(company.short_description),
    internal_notes: asString(company.internal_notes),
    extra_notes: asString(company.extra_notes),
    status: asString(company.status),
    active: company.active ?? true,
    updated_at: asString(company.updated_at),
    created_at: asString(company.created_at),
    created_by: asString(company.created_by),
  };
}

export async function GET(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) return jsonError(status === 401 ? "Nao autenticado" : "Sem permissao", status);

  const companies = await listLocalCompanies();
  const payload = ClientListResponseSchema.parse({ items: companies.map(mapCompany) });
  return NextResponse.json(payload, { status: 200 });
}

export async function POST(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) return jsonError(status === 401 ? "Nao autenticado" : "Sem permissao", status);

  const body = await req.json().catch(() => null);
  // Loga o payload recebido
  console.error('[CLIENTS][POST] Payload recebido:', JSON.stringify(body));
  const parsed = ClientCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    // Loga o erro de validação do Zod
    console.error('[CLIENTS][POST] Erro de validação Zod:', JSON.stringify(parsed.error, null, 2));
    return jsonError("Payload invalido", 400);
  }

  const input = parsed.data;
  const name = (input.company_name || input.name || "").trim();
  if (!name) {
    return jsonError("Campo 'name' ou 'company_name' e obrigatorio", 400);
  }

  const desiredSlug = (input.slug || "").trim();
  const slugBase = toSlug(desiredSlug || name) || `empresa-${randomUUID().slice(0, 8)}`;

  console.debug(`[CLIENTS][POST] admin=${admin?.email ?? "-"} name=${name} desiredSlug=${desiredSlug} slugBase=${slugBase}`);

  const integrationType = (input as { integration_type?: string | null }).integration_type ?? null;
  const normalizedProjectCodes = normalizeProjectCodes(input.qase_project_codes) ?? normalizeProjectCodes(input.qase_project_code);
  const legacyProjectCode = input.qase_project_code ?? normalizedProjectCodes?.[0] ?? null;
  const resolvedNotes =
    input.notes ??
    input.internal_notes ??
    input.extra_notes ??
    input.description ??
    input.short_description ??
    null;
  const company = await createLocalCompany({
    name,
    slug: slugBase,
    company_name: input.company_name ?? input.name ?? name,
    tax_id: input.tax_id ?? null,
    address: input.address ?? null,
    phone: input.phone ?? null,
    website: input.website ?? null,
    logo_url: input.logo_url ?? null,
    docs_link: input.docs_link ?? input.docs_url ?? null,
    notes: resolvedNotes,
    cep: input.cep ?? null,
    address_detail: input.address_detail ?? null,
    linkedin_url: input.linkedin_url ?? null,
    short_description: input.short_description ?? input.description ?? null,
    internal_notes: input.internal_notes ?? input.notes ?? null,
    extra_notes: input.extra_notes ?? null,
    qase_project_code: legacyProjectCode,
    qase_project_codes: normalizedProjectCodes,
    qase_token: input.qase_token ?? null,
    jira_base_url: input.jira_base_url ?? null,
    jira_email: input.jira_email ?? null,
    jira_api_token: input.jira_api_token ?? null,
    integration_mode: input.integration_mode ?? "manual",
    integration_type: integrationType ?? input.integration_mode ?? "manual",
    status: input.status ?? "active",
    active: input.active ?? true,
    created_at: new Date().toISOString(),
    created_by: admin.email || admin.id,
  });

  console.error('[CLIENTS][POST] company stored:', JSON.stringify(company));

  if (Array.isArray((input as any).qase_projects) && (input as any).qase_projects.length) {
    const projects = (input as any).qase_projects
      .filter((p: unknown): p is Record<string, unknown> => typeof p === "object" && p !== null)
      .map((p: Record<string, unknown>) => ({ code: typeof p.code === "string" ? p.code.trim().toUpperCase() : "", title: typeof p.title === "string" ? p.title.trim() : undefined, imageUrl: typeof p.imageUrl === "string" ? p.imageUrl.trim() : null }));
    if (projects.length) {
      await syncCompanyApplications({ companyId: company.id, companySlug: company.slug, projects });
    }
  } else if (normalizedProjectCodes?.length) {
    await syncCompanyApplications({
      companyId: company.id,
      companySlug: company.slug,
      projects: normalizedProjectCodes.map((code) => ({ code })),
    });
  }

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
