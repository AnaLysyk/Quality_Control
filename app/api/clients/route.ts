import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { requireGlobalAdminWithStatus } from "@/backend/rbac/requireGlobalAdmin";
import { ClientCreateRequestSchema, ClientListResponseSchema, ClientSchema } from "@/contracts/client";
import { ErrorResponseSchema } from "@/contracts/errors";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { syncCompanyApplications } from "@/backend/applicationsStore";
import { createLocalCompany, listLocalCompanies } from "@/backend/auth/localStore";
import { mapCompanyRecord } from "@/backend/companyRecord";

const MASK_SECRETS = { maskQaseToken: true, maskJiraToken: true } as const;

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

export async function GET(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) return jsonError(status === 401 ? "Não autenticado" : "Sem permissão", status);

  const companies = await listLocalCompanies();
  const payload = ClientListResponseSchema.parse({
    items: companies.map((company) => mapCompanyRecord(company, MASK_SECRETS)),
  });
  return NextResponse.json(payload, { status: 200 });
}

export async function POST(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) return jsonError(status === 401 ? "Não autenticado" : "Sem permissão", status);

  const body = await req.json().catch(() => null);
  const parsed = ClientCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    // Loga o erro de válidação do Zod
    console.error('[CLIENTS][POST] Erro de válidação Zod:', JSON.stringify(parsed.error, null, 2));
    return jsonError("Payload invalido", 400);
  }

  const input = parsed.data;
  try {
  const name = (input.company_name || input.name || "").trim();
  if (!name) {
    return jsonError("Campo 'name' ou 'company_name' e obrigatório", 400);
  }

  const desiredSlug = (input.slug || "").trim();
  const slugBase = toSlug(desiredSlug || name) || `empresa-${randomUUID().slice(0, 8)}`;

  console.debug(`[CLIENTS][POST] admin=${admin?.email ?? "-"} name=${name} desiredSlug=${desiredSlug} slugBase=${slugBase}`);

  const integrationType = (input as { integration_type?: string | null }).integration_type ?? null;
  const normalizedProjectCodes = normalizeProjectCodes(input.qase_project_codes) ?? normalizeProjectCodes(input.qase_project_code);
  // build integrations array (support legacy qase/jira fields)
  const integrations: Array<{ type: string; config?: Record<string, unknown> }> = [];
  if (input.integrations && Array.isArray((input as any).integrations)) {
    for (const it of (input as any).integrations) {
      if (!it || typeof it !== "object") continue;
      integrations.push({ type: it.type, config: it.config ?? {} });
    }
  }
  // legacy Qase
  if (input.qase_token || normalizedProjectCodes?.length) {
    integrations.push({ type: "QASE", config: { token: input.qase_token ?? null, projects: normalizedProjectCodes ?? [] } });
  }
  // legacy Jira
  if (input.jira_api_token || input.jira_base_url) {
    integrations.push({ type: "JIRA", config: { baseUrl: input.jira_base_url ?? null, email: input.jira_email ?? null, apiToken: input.jira_api_token ?? null } });
  }
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
    address_number: input.address_number ?? null,
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
    notifications_fanout_enabled:
      typeof input.notifications_fanout_enabled === "boolean" ? input.notifications_fanout_enabled : true,
    integrations: integrations.length ? integrations : undefined,
    status: input.status ?? "active",
    active: input.active ?? true,
    created_at: new Date().toISOString(),
    created_by: admin.email || admin.id,
    ...(input.admin_email ? { admin_email: input.admin_email } : {}),
  });

  if (Array.isArray((input as any).qase_projects) && (input as any).qase_projects.length) {
    const projects = (input as any).qase_projects
      .filter((p: unknown): p is Record<string, unknown> => typeof p === "object" && p !== null)
      .map((p: Record<string, unknown>) => ({ code: typeof p.code === "string" ? p.code.trim().toUpperCase() : "", title: typeof p.title === "string" ? p.title.trim() : undefined, imageUrl: typeof p.imageUrl === "string" ? p.imageUrl.trim() : null }));
    if (projects.length) {
      await syncCompanyApplications({ companyId: company.id, companySlug: company.slug, projects, source: "qase" });
    }
  } else if (normalizedProjectCodes?.length) {
    await syncCompanyApplications({
      companyId: company.id,
      companySlug: company.slug,
      projects: normalizedProjectCodes.map((code) => ({ code })),
      source: "qase",
    });
  }

  const payload = ClientSchema.parse(mapCompanyRecord(company, MASK_SECRETS));

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
  } catch (err) {
    console.error('[CLIENTS][POST] error while creating client:', err);
    return jsonError('Erro interno ao criar empresa', 500);
  }
}

