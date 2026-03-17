import { NextRequest, NextResponse } from "next/server";

import { ClientCreateRequestSchema, ClientSchema } from "@/contracts/client";
import { ErrorResponseSchema } from "@/contracts/errors";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { syncCompanyApplications } from "@/lib/applicationsStore";
import { deleteLocalCompany, listLocalCompanies, updateLocalCompany, type LocalAuthCompany } from "@/lib/auth/localStore";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export const runtime = "nodejs";
export const revalidate = 0;

const jsonError = (message: string, status: number) =>
  NextResponse.json(ErrorResponseSchema.parse({ error: message }), { status });

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

function normalizeComparableName(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeTaxId(value: string | null | undefined) {
  return (value ?? "").replace(/\D+/g, "");
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

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) return jsonError(status === 401 ? "Nao autenticado" : "Sem permissao", status);

  const { id } = await context.params;
  const companies = await listLocalCompanies();
  const company = companies.find((item) => item.id === id);
  if (!company) return jsonError("Empresa nao encontrada", 404);

  return NextResponse.json(ClientSchema.parse(mapCompany(company)), { status: 200 });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) return jsonError(status === 401 ? "Nao autenticado" : "Sem permissao", status);

  const { id } = await context.params;
  const companies = await listLocalCompanies();
  const current = companies.find((item) => item.id === id);
  if (!current) return jsonError("Empresa nao encontrada", 404);

  const body = await req.json().catch(() => null);
  const parsed = ClientCreateRequestSchema.partial().safeParse(body);
  if (!parsed.success) return jsonError("Payload invalido", 400);

  const input = parsed.data;
  const nextName = (input.company_name ?? input.name ?? current.name ?? current.company_name ?? "").trim();
  if (!nextName) return jsonError("Nome da empresa obrigatorio", 400);
  const nextProjectCodes =
    normalizeProjectCodes(input.qase_project_codes) ??
    normalizeProjectCodes(input.qase_project_code) ??
    normalizeProjectCodes(current.qase_project_codes) ??
    normalizeProjectCodes(current.qase_project_code);
  const nextLegacyProjectCode = input.qase_project_code ?? nextProjectCodes?.[0] ?? current.qase_project_code ?? null;

  const duplicateByName = companies.find(
    (company) =>
      company.id !== id &&
      normalizeComparableName(company.name ?? company.company_name ?? "") === normalizeComparableName(nextName),
  );
  if (duplicateByName) return jsonError("Empresa ja cadastrada com esse nome", 409);

  const nextTaxId = normalizeTaxId(typeof input.tax_id === "string" ? input.tax_id : typeof current.tax_id === "string" ? current.tax_id : null);
  const duplicateByTaxId =
    nextTaxId.length > 0
      ? companies.find((company) => company.id !== id && normalizeTaxId(typeof company.tax_id === "string" ? company.tax_id : null) === nextTaxId)
      : null;
  if (duplicateByTaxId) return jsonError("CNPJ ja cadastrado para outra empresa", 409);

  const updated = await updateLocalCompany(id, {
    name: nextName,
    company_name: input.company_name ?? input.name ?? nextName,
    tax_id: input.tax_id ?? current.tax_id ?? null,
    address: input.address ?? current.address ?? null,
    phone: input.phone ?? current.phone ?? null,
    website: input.website ?? current.website ?? null,
    logo_url: input.logo_url ?? current.logo_url ?? null,
    docs_link: input.docs_link ?? current.docs_link ?? current.docs_url ?? null,
    notes:
      input.notes ??
      input.internal_notes ??
      input.extra_notes ??
      input.description ??
      input.short_description ??
      current.notes ??
      current.description ??
      null,
    linkedin_url: input.linkedin_url ?? current.linkedin_url ?? null,
    qase_project_code: nextLegacyProjectCode,
    qase_project_codes: nextProjectCodes,
    qase_token: input.qase_token ?? current.qase_token ?? null,
    jira_base_url: input.jira_base_url ?? current.jira_base_url ?? null,
    jira_email: input.jira_email ?? current.jira_email ?? null,
    jira_api_token: input.jira_api_token ?? current.jira_api_token ?? null,
    integration_mode: input.integration_mode ?? current.integration_mode ?? "manual",
    integration_type: input.integration_mode ?? current.integration_type ?? current.integration_mode ?? "manual",
    status: input.status ?? (input.active === false ? "inactive" : input.active === true ? "active" : current.status ?? "active"),
    active: typeof input.active === "boolean" ? input.active : current.active ?? true,
    updated_at: new Date().toISOString(),
  });

  if (!updated) return jsonError("Empresa nao encontrada", 404);

  if (Array.isArray((input as any).qase_projects) && (input as any).qase_projects.length) {
    const projects = (input as any).qase_projects
      .filter((p: unknown): p is Record<string, unknown> => typeof p === "object" && p !== null)
      .map((p: Record<string, unknown>) => ({ code: typeof p.code === "string" ? p.code.trim().toUpperCase() : "", title: typeof p.title === "string" ? p.title.trim() : undefined, imageUrl: typeof p.imageUrl === "string" ? p.imageUrl.trim() : null }));
    if (projects.length) {
      await syncCompanyApplications({ companyId: updated.id, companySlug: updated.slug, projects });
    }
  } else if (nextProjectCodes?.length) {
    await syncCompanyApplications({
      companyId: updated.id,
      companySlug: updated.slug,
      projects: nextProjectCodes.map((code) => ({ code })),
    });
  }

  await addAuditLogSafe({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: "client.updated",
    entityType: "client",
    entityId: updated.id,
    entityLabel: updated.name ?? updated.company_name ?? updated.slug ?? updated.id,
    metadata: {
      active: updated.active ?? true,
      integrationMode: updated.integration_mode ?? "manual",
    },
  });

  return NextResponse.json(ClientSchema.parse(mapCompany(updated)), { status: 200 });
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) return jsonError(status === 401 ? "Nao autenticado" : "Sem permissao", status);

  const { id } = await context.params;
  const companies = await listLocalCompanies();
  const current = companies.find((item) => item.id === id);
  if (!current) return jsonError("Empresa nao encontrada", 404);

  const deleted = await deleteLocalCompany(id);
  if (!deleted) return jsonError("Empresa nao encontrada", 404);

  await addAuditLogSafe({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: "client.deleted",
    entityType: "client",
    entityId: current.id,
    entityLabel: current.name ?? current.company_name ?? current.slug ?? current.id,
    metadata: {
      slug: current.slug ?? null,
    },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
