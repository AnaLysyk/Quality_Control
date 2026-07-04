import { NextResponse } from "next/server";

import { listAuditLogs } from "@/data/auditLogRepository";
import { getAccessContext } from "@/lib/auth/session";
import { getLocalUserById, listLocalCompanies, listLocalUsers } from "@/lib/auth/localStore";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";

export const runtime = "nodejs";
export const revalidate = 0;

type RangeKey = "24h" | "7d" | "30d";

const RANGES: Record<RangeKey, { label: string; hours: number }> = {
  "24h": { label: "últimas 24 horas", hours: 24 },
  "7d": { label: "últimos 7 dias", hours: 168 },
  "30d": { label: "últimos 30 dias", hours: 720 },
};

function rangeFrom(value: string | null): RangeKey {
  return value === "7d" || value === "30d" ? value : "24h";
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || "Ana";
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

function companyHref(slug: string, range: RangeKey) {
  const params = new URLSearchParams({ view: "company", range });
  if (slug) params.set("companySlug", slug);
  return `/admin/visao-geral?${params.toString()}`;
}

function userHref(userId: string, range: RangeKey) {
  const params = new URLSearchParams({ view: "user", range });
  if (userId) params.set("userId", userId);
  return `/admin/visao-geral?${params.toString()}`;
}

function isLeaderScope(role?: string | null) {
  const value = (role ?? "").toLowerCase();
  return value.includes("leader") || value.includes("lider") || value.includes("support") || value.includes("suporte") || value.includes("admin");
}

export async function GET(req: Request) {
  const access = await getAccessContext(req);
  if (!access) return NextResponse.json({ error: "Sessão inválida" }, { status: 401, headers: NO_STORE_HEADERS });

  const range = rangeFrom(new URL(req.url).searchParams.get("range"));
  const since = new Date(Date.now() - RANGES[range].hours * 60 * 60 * 1000);
  const user = await getLocalUserById(access.userId);
  const name = firstName(text((user as { full_name?: string | null } | null)?.full_name) || text(user?.name) || text(user?.email) || "Ana");
  const canSeeAll = access.isGlobalAdmin === true || isLeaderScope(access.role) || isLeaderScope(access.companyRole);
  const allowedSlugs = new Set((access.companySlugs ?? []).map((slug) => slug.toLowerCase()).filter(Boolean));

  const [companiesRaw, usersRaw, logs] = await Promise.all([
    listLocalCompanies().catch(() => []),
    listLocalUsers().catch(() => []),
    listAuditLogs({ startDate: since.toISOString(), limit: 300 }).catch(() => []),
  ]);

  const companies = companiesRaw
    .filter((company) => company.active !== false)
    .filter((company) => canSeeAll || allowedSlugs.has(text(company.slug).toLowerCase()) || company.id === access.companyId)
    .slice(0, 30)
    .map((company) => {
      const slug = text(company.slug);
      return {
        id: company.id,
        label: text(company.name) || text((company as { company_name?: string | null }).company_name) || "Empresa",
        value: slug || company.id,
        description: slug || null,
        href: companyHref(slug, range),
      };
    });

  const users = (canSeeAll ? usersRaw : usersRaw.filter((item) => item.id === access.userId))
    .filter((item) => item.active !== false)
    .slice(0, 30)
    .map((item) => ({
      id: item.id,
      label: text((item as { full_name?: string | null }).full_name) || text(item.name) || text(item.email) || "Usuário",
      value: item.id,
      description: text(item.email) || null,
      href: userHref(item.id, range),
    }));

  const scopedLogs = canSeeAll
    ? logs
    : logs.filter((log) => log.actor_user_id === access.userId || log.actor_email?.toLowerCase() === user?.email?.toLowerCase());

  const actors = new Set(scopedLogs.map((log) => log.actor_user_id ?? log.actor_email ?? "").filter(Boolean));
  const flowLogs = scopedLogs.filter((log) => /run|test|flow|flux|release|defect|automation|automacao/i.test(log.action));
  const pendingLogs = scopedLogs.filter((log) => /pending|request|solicit|ticket|chamado/i.test(`${log.action} ${log.entity_type}`));

  const greet = greeting();
  const period = RANGES[range].label;

  return NextResponse.json(
    {
      greeting: greet,
      userName: name,
      profileLabel: canSeeAll ? "Líder TC" : "Usuário",
      range,
      periodLabel: period,
      typedMessages: [
        `${greet}, ${name}. Eu sou o Brain. Analisei as últimas interações do seu contexto nas ${period}.`,
        scopedLogs.length > 0
          ? "Encontrei atualizações em empresas, usuários e fluxos. Você gostaria de começar por empresa, por usuário, por tela ou por fluxo?"
          : "Ainda não encontrei interações recentes nesse período. Posso começar por empresa, usuário, tela ou fluxo para preparar seu contexto.",
      ],
      summary: {
        actions: scopedLogs.length,
        companiesUpdated: Math.min(companies.length, Math.max(0, companies.length ? Math.ceil(scopedLogs.length / 6) : 0)),
        usersInvolved: actors.size,
        pendingItems: pendingLogs.length,
        flowsWithRisk: flowLogs.length,
      },
      companies,
      users,
      highlights: [
        { type: "flow", title: "Fluxos atualizados", description: `${flowLogs.length} fluxos receberam alterações nas ${period}`, href: "/operacoes/dashboard" },
        { type: "company", title: "Empresas com atividade recente", description: `${companies.length} empresas disponíveis para análise`, href: companyHref("", range) },
        { type: "alert", title: "Pendências do período", description: `${pendingLogs.length} itens pedem atenção`, href: "/admin/visao-geral" },
      ],
      routes: { adminOverview: "/admin/visao-geral" },
    },
    { headers: NO_STORE_HEADERS },
  );
}
