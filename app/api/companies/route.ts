import { NextRequest, NextResponse } from "next/server";

import { addAuditLogSafe } from "@/data/auditLogRepository";
import { createLocalCompany, deleteLocalCompany, listLocalCompanies, type LocalAuthCompany } from "@/backend/auth/localStore";
import { requireGlobalAdminWithStatus } from "@/backend/rbac/requireGlobalAdmin";
import { requirePermission } from "@/backend/rbac/requirePermission";
import { syncCompanyToBrain } from "@/backend/brain-sync";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/backend/auth/roles";
import type { AccessContext } from "@/backend/auth/session";

// Módulo oficial do catálogo de permissões para empresas/clientes/aplicações
// (backend/permissionCatalog.ts: id "applications", label "Empresas e aplicações").
// Não existe módulo específico "companies"/"clients" — reaproveita o existente
// em vez de inventar uma permissão nova.
const COMPANIES_MODULE = "applications";

// Projeção segura para listagem: nunca inclui segredos (tokens, credenciais,
// config de integração completa). Presença de integração é só um booleano
// (hasQaseToken/hasJiraToken) — nunca o valor, tamanho, prefixo/sufixo ou
// provedor detalhado do token. Campos usam snake_case para casar com o
// contrato que os consumidores atuais (app/admin/clients/page.tsx) já leem.
type CompanyListItem = {
  id: string;
  name: string;
  company_name: string | null;
  slug: string;
  status: string | null;
  active: boolean;
  logo_url: string | null;
  tax_id: string | null;
  address: string | null;
  phone: string | null;
  cep: string | null;
  website: string | null;
  description: string | null;
  notes: string | null;
  docs_link: string | null;
  linkedin_url: string | null;
  notifications_fanout_enabled: boolean;
  jira_base_url: string | null;
  jira_email: string | null;
  integration_mode: string | null;
  qase_project_code: string | null;
  qase_project_codes: string[];
  hasQaseToken: boolean;
  hasJiraToken: boolean;
  created_at: string | null;
  updated_at: string | null;
};

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

// Só devolve se existe (booleano). Nunca o valor, tamanho, prefixo/sufixo ou
// o provedor específico dentro de integrations — só "está configurado ou não".
function hasIntegrationSecret(integrations: unknown, type: string, key: string): boolean {
  if (!Array.isArray(integrations)) return false;
  return integrations.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const record = entry as Record<string, unknown>;
    if (String(record.type ?? "").toUpperCase() !== type) return false;
    const config = record.config;
    if (!config || typeof config !== "object") return false;
    return Boolean(readString((config as Record<string, unknown>)[key]));
  });
}

// Allowlist estrita: só inclui campos que o front realmente usa. Nunca faz
// spread do objeto cru do store (que tem shape aberto e pode carregar
// qase_token, jira_api_token, integrations[].config.{token,apiToken} e
// qualquer outro campo de integração no nível que o cadastro aceitar).
function toCompanyListItem(company: LocalAuthCompany): CompanyListItem {
  const raw = company as Record<string, unknown>;
  const integrations = raw.integrations;

  return {
    id: company.id,
    name: company.name,
    company_name: readString(raw.company_name),
    slug: company.slug,
    status: readString(raw.status) ?? (company.active === false ? "inactive" : "active"),
    active: company.active !== false,
    logo_url: readString(raw.logo_url),
    tax_id: readString(raw.tax_id),
    address: readString(raw.address),
    phone: readString(raw.phone),
    cep: readString(raw.cep),
    website: readString(raw.website),
    description: readString(raw.description),
    notes: readString(raw.notes),
    docs_link: readString(raw.docs_link),
    linkedin_url: readString(raw.linkedin_url),
    notifications_fanout_enabled: raw.notifications_fanout_enabled !== false,
    jira_base_url: readString(raw.jira_base_url),
    jira_email: readString(raw.jira_email),
    integration_mode: readString(raw.integration_mode),
    qase_project_code: readString(raw.qase_project_code),
    qase_project_codes: readStringArray(raw.qase_project_codes),
    hasQaseToken: Boolean(readString(raw.qase_token)) || hasIntegrationSecret(integrations, "QASE", "token"),
    hasJiraToken: Boolean(readString(raw.jira_api_token)) || hasIntegrationSecret(integrations, "JIRA", "apiToken"),
    created_at: readString(raw.created_at) ?? readString(raw.createdAt),
    updated_at: readString(raw.updated_at) ?? readString(raw.updatedAt),
  };
}

function resolveRole(access: AccessContext) {
  return (
    normalizeLegacyRole(access.role) ??
    normalizeLegacyRole(access.companyRole) ??
    normalizeLegacyRole(access.globalRole)
  );
}

// backend/auth/session.ts (getAccessContext) já deriva
// access.companySlugs/companyId corretamente por perfil, inclusive para
// Líder TC e Usuário TC: para esses dois, a partir de ProjectTeamAssignment
// ativos (role leader_tc/qa_tc, status="active") — não de Membership/link
// antigo. Confirmado lendo backend/auth/session.ts:217-304: um
// vínculo antigo (Membership) sem assignment ativo correspondente NÃO entra
// em companySlugs quando o usuário tem papel leader_tc/qa_tc. Por isso esta
// rota confia diretamente em access.companySlugs/companyId, sem reconsultar
// vínculos por conta própria (o que seria uma fonte secundária e divergente).
async function resolveVisibleCompanies(access: AccessContext, allCompanies: LocalAuthCompany[]): Promise<LocalAuthCompany[]> {
  if (access.isGlobalAdmin) return allCompanies;

  const role = resolveRole(access);
  if (role === SYSTEM_ROLES.TECHNICAL_SUPPORT) return allCompanies;

  const allowedSlugs = new Set((access.companySlugs ?? []).map((slug) => slug.toLowerCase()));
  return allCompanies.filter((company) => {
    if (access.companyId && company.id === access.companyId) return true;
    const slug = typeof company.slug === "string" ? company.slug.toLowerCase() : "";
    return slug ? allowedSlugs.has(slug) : false;
  });
}

export async function GET(request: Request) {
  const permission = await requirePermission(request, COMPANIES_MODULE, "view");
  if (!permission.ok) return permission.response;

  const allCompanies = await listLocalCompanies();
  const visible = await resolveVisibleCompanies(permission.access, allCompanies);

  return NextResponse.json(visible.map(toCompanyListItem));
}

export async function POST(req: Request) {
  const permission = await requirePermission(req, COMPANIES_MODULE, "create");
  if (!permission.ok) return permission.response;

  // applications:create sozinho não basta: o perfil Empresa tem esse default
  // no catálogo (para gerenciar as próprias "aplicações"), o que não deveria
  // autorizar criar OUTRA empresa no sistema. Até existir uma permissão
  // específica de gestão de empresas, exige também admin global verdadeiro
  // (access.isGlobalAdmin — não Líder TC nem Suporte Técnico "global por
  // papel"; session.store.ts já não conflacia isso, ver comentário acima).
  if (!permission.access.isGlobalAdmin) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Campo 'name' obrigatório" }, { status: 400 });
  }
  const slug = readString(body.slug) || body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  // build integrations from legacy fields if integrations array not provided
  const integrations: Array<{ type: string; config?: Record<string, unknown> }> = [];
  if (Array.isArray(body.integrations)) {
    for (const it of body.integrations) {
      if (!it || typeof it !== "object") continue;
      if (typeof it.type !== "string" || !it.type.trim()) continue;
      integrations.push({ type: it.type, config: it.config && typeof it.config === "object" ? it.config : {} });
    }
  } else {
    const normalizedProjectCodes = Array.isArray(body.qase_project_codes)
      ? body.qase_project_codes.filter((code: unknown) => typeof code === "string")
      : typeof body.qase_project_code === "string"
      ? [body.qase_project_code]
      : [];
    if (readString(body.qase_token) || normalizedProjectCodes.length) {
      integrations.push({ type: "QASE", config: { token: readString(body.qase_token), projects: normalizedProjectCodes } });
    }
    if (readString(body.jira_api_token) || readString(body.jira_base_url)) {
      integrations.push({
        type: "JIRA",
        config: { baseUrl: readString(body.jira_base_url), email: readString(body.jira_email), apiToken: readString(body.jira_api_token) },
      });
    }
  }

  const company = await createLocalCompany({
    name: body.name.trim(),
    slug,
    company_name: readString(body.company_name) || body.name.trim(),
    tax_id: readString(body.tax_id),
    address: readString(body.address),
    phone: readString(body.phone),
    cep: readString(body.cep),
    website: readString(body.website),
    description: readString(body.description),
    notes: readString(body.notes),
    docs_link: readString(body.docs_link),
    linkedin_url: readString(body.linkedin_url),
    notifications_fanout_enabled: body.notifications_fanout_enabled !== false,
    integration_mode: readString(body.integration_mode) || "manual",
    qase_project_code:
      (Array.isArray(body.qase_project_codes) && body.qase_project_codes.length ? body.qase_project_codes[0] : readString(body.qase_project_code)) || null,
    qase_project_codes: readStringArray(body.qase_project_codes).length
      ? readStringArray(body.qase_project_codes)
      : readString(body.qase_project_code)
      ? [readString(body.qase_project_code) as string]
      : [],
    qase_token: readString(body.qase_token),
    jira_base_url: readString(body.jira_base_url),
    jira_email: readString(body.jira_email),
    jira_api_token: readString(body.jira_api_token),
    integrations: integrations.length ? integrations : undefined,
    created_at: new Date().toISOString(),
  });

  syncCompanyToBrain({
    id: company.id,
    name: company.name,
    slug: company.slug,
    status: (company as any).status ?? "active",
    integration_mode: (company as any).integration_mode ?? "manual",
  }).catch(() => {});

  await addAuditLogSafe({
    actorUserId: permission.access.userId,
    actorEmail: permission.access.email,
    action: "client.created",
    entityType: "client",
    entityId: company.id,
    entityLabel: company.name ?? company.slug ?? company.id,
    metadata: { slug: company.slug ?? null },
  });

  return NextResponse.json(toCompanyListItem(company), { status: 201 });
}

export async function PATCH(_req: Request) {
  return NextResponse.json({ error: "PATCH não implementado" }, { status: 501 });
}

export async function DELETE(req: NextRequest) {
  const permission = await requirePermission(req, COMPANIES_MODULE, "delete");
  if (!permission.ok) return permission.response;

  // Regra oficial já existente (independente da permissão efetiva): exclusão
  // de empresa exige admin global. Preservada como está — não é escopo desta
  // etapa reavaliá-la.
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
