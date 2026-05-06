import "server-only";

import type { AuthUser } from "@/lib/jwtAuth";
import { prisma } from "@/lib/prismaClient";
import type { AssistantScreenContext } from "../types";
import { normalizeSearch } from "../helpers";
import {
  buildPromptActions,
  getStatusFilters,
  getPriorityFilters,
  getVisibleCompanies,
  getVisibleTickets,
  getVisibleUsers,
  scoreTicketMatch,
  MAX_RESULTS,
} from "../data";
import { extractTicketReference } from "../pure/parsing";
import type { AssistantExecutorResult } from "./types";

function stripInternalAssistantContext(message: string) {
  const marker = "\n---\n[Contexto Brain | uso interno do assistente]";
  const markerIndex = message.indexOf(marker);
  if (markerIndex === -1) return message;
  return message.slice(0, markerIndex).trim();
}

function extractSearchText(message: string) {
  return message
    .replace(/\b(buscar|busca|procura|procurar|localiza|localizar|encontra|encontrar|listar|lista|mostrar|mostra)\b/gi, "")
    .replace(/\b(ticket|tickets|chamado|chamados|suporte|suportes)\b/gi, "")
    .replace(/\b(sem|com)\s+(responsavel|responsável)\b/gi, "")
    .replace(/\b(backlog|andamento|revisao|revisão|concluido|concluído)\b/gi, "")
    .replace(/\b(alta|media|média|baixa|urgente)\b/gi, "")
    .replace(/\b(status|prioridade|empresa|usuario|usuário|perfil)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getPriorityEmoji(priority: string): string {
  switch (priority?.toLowerCase()) {
    case "high":
    case "alta":
      return "🔴";
    case "medium":
    case "media":
    case "média":
      return "🟠";
    case "low":
    case "baixa":
      return "🟢";
    default:
      return "⚪";
  }
}

function getStatusEmoji(status: string): string {
  switch (status?.toLowerCase()) {
    case "open":
    case "backlog":
      return "📬";
    case "in_progress":
    case "andamento":
      return "⚙️";
    case "review":
    case "revisao":
      return "👁️";
    case "done":
    case "closed":
    case "concluido":
      return "✅";
    default:
      return "📋";
  }
}

function includesAny(value: string, words: string[]) {
  return words.some((word) => value.includes(word));
}

function recordMatchesQuery(query: string, ...fields: Array<string | null | undefined>) {
  if (!query) return true;
  const haystack = fields.map((field) => normalizeSearch(field ?? "")).join(" ");
  return query
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .every((word) => haystack.includes(word));
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

export async function toolSearchInternalRecords(user: AuthUser, context: AssistantScreenContext, message: string): Promise<AssistantExecutorResult> {
  const userMessage = stripInternalAssistantContext(message);
  const visibleTickets = await getVisibleTickets(user);
  const normalized = normalizeSearch(userMessage);
  const statusFilters = getStatusFilters(userMessage);
  const priorityFilters = getPriorityFilters(userMessage);
  const wantsOnlyUnassigned = normalized.includes("sem responsavel") || normalized.includes("sem responsável");
  const wantsOnlyAssigned = normalized.includes("com responsavel") || normalized.includes("com responsável");
  const reference = extractTicketReference(userMessage);

  let tickets = [...visibleTickets];
  if (statusFilters) tickets = tickets.filter((t) => statusFilters.has(t.status));
  if (priorityFilters) tickets = tickets.filter((t) => priorityFilters.has(t.priority));
  if (wantsOnlyUnassigned) tickets = tickets.filter((t) => !t.assignedToUserId);
  if (wantsOnlyAssigned) tickets = tickets.filter((t) => Boolean(t.assignedToUserId));

  const query = extractSearchText(userMessage);
  const hasExplicitFilters = Boolean(statusFilters || priorityFilters || wantsOnlyUnassigned || wantsOnlyAssigned);

  if (reference?.type === "code" || reference?.type === "numeric") {
    const exact = tickets.find((t) => t.code.toLowerCase() === reference.code.toLowerCase());
    if (exact) tickets = [exact];
  } else if (query) {
    tickets = tickets
      .map((t) => ({ ticket: t, score: scoreTicketMatch(t, query) }))
      .filter((i) => i.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((i) => i.ticket);
  }

  // ─── Busca sem filtros: mostrar overview ───
  if (!reference && !query && !hasExplicitFilters) {
    const latest = tickets.slice(0, MAX_RESULTS);
    
    // Estatísticas rápidas
    const highPriority = visibleTickets.filter((t) => t.priority === "high").length;
    const unassigned = visibleTickets.filter((t) => !t.assignedToUserId).length;
    const openCount = visibleTickets.filter((t) => t.status === "open" || t.status === "backlog").length;

    const statsLine = `📊 **Visão geral:** ${visibleTickets.length} tickets | ${openCount} abertos | ${highPriority} alta prioridade | ${unassigned} sem responsável`;

    return {
      tool: "search_internal_records",
      success: true,
      summary: latest.length ? `${latest.length} chamados recentes` : "nenhum chamado visível",
      actions: [
        { kind: "prompt", label: "🔍 Buscar por ID", prompt: "Buscar o chamado SP-000001" },
        { kind: "prompt", label: "🔴 Alta prioridade", prompt: "Buscar tickets com prioridade alta" },
        { kind: "prompt", label: "⚠️ Sem responsável", prompt: "Buscar tickets sem responsável" },
        { kind: "prompt", label: "✏️ Criar chamado", prompt: "Transformar este texto em chamado" },
      ],
      reply: latest.length
        ? [
            "## 🔍 Busca de Registros",
            "",
            statsLine,
            "",
            "### Chamados Recentes:",
            "",
            "| Código | Título | Status | Prioridade |",
            "|--------|--------|--------|------------|",
            ...latest.map((t) => `| **${t.code}** | ${t.title.slice(0, 40)}${t.title.length > 40 ? "..." : ""} | ${getStatusEmoji(t.status)} ${t.status} | ${getPriorityEmoji(t.priority)} ${t.priority} |`),
            "",
            "---",
            "💡 Refine por **ID**, **status**, **prioridade** ou **responsável**",
          ].join("\n")
        : "Não encontrei chamados visíveis neste escopo. Informe um **ID** como `SP-000027` ou um filtro mais específico.",
    };
  }

  const [visibleUsers, visibleCompanies] = await Promise.all([getVisibleUsers(user), getVisibleCompanies(user)]);
  const companyIds = visibleCompanies.map((company) => company.id).filter(Boolean);
  const companySlugs = visibleCompanies.map((company) => company.slug).filter(Boolean);
  const companyIdScope = companyIds.length ? { in: companyIds } : undefined;
  const companySlugScope = companySlugs.length ? { in: companySlugs } : undefined;
  const wantsEverything = includesAny(normalized, ["tudo", "sistema", "contexto", "mapa", "geral"]);
  const wantsApplications = wantsEverything || includesAny(normalized, ["aplicacao", "aplicacoes", "aplicaÃ§Ã£o", "aplicaÃ§Ãµes", "app", "apps", "qase"]);
  const wantsRuns = wantsEverything || includesAny(normalized, ["run", "runs", "execucao", "execucoes", "release", "releases", "qase"]);
  const wantsPlans = wantsEverything || includesAny(normalized, ["plano", "planos", "test plan", "caso de teste", "qase"]);
  const wantsDefects = wantsEverything || includesAny(normalized, ["defeito", "defeitos", "bug", "bugs", "falha"]);
  const wantsIntegrations = wantsEverything || includesAny(normalized, ["integracao", "integracoes", "integraÃ§Ã£o", "integraÃ§Ãµes", "qase", "jira", "griaule", "biometria"]);
  const effectiveQuery = wantsEverything ? "" : query;

  const canQueryScopedCompanyData = companyIds.length > 0 || companySlugs.length > 0 || user.isGlobalAdmin;
  const [
    applications,
    releases,
    manualTestPlans,
    defects,
    integrations,
    testRuns,
  ] = canQueryScopedCompanyData
    ? await Promise.all([
        wantsApplications
          ? prisma.application.findMany({
              where: user.isGlobalAdmin
                ? undefined
                : { OR: [{ companyId: companyIdScope }, { companySlug: companySlugScope }] },
              orderBy: { updatedAt: "desc" },
              take: 20,
              select: {
                id: true, name: true, slug: true, companySlug: true, qaseProjectCode: true,
                source: true, active: true, updatedAt: true,
              },
            }).catch(() => [])
          : Promise.resolve([]),
        wantsRuns
          ? prisma.release.findMany({
              where: user.isGlobalAdmin
                ? undefined
                : { OR: [{ companyId: companyIdScope }, { companySlug: companySlugScope }] },
              orderBy: { updatedAt: "desc" },
              take: 20,
              select: {
                id: true, title: true, slug: true, app: true, qaseProject: true, status: true,
                statsPass: true, statsFail: true, statsBlocked: true, statsNotRun: true,
                companySlug: true, updatedAt: true,
              },
            }).catch(() => [])
          : Promise.resolve([]),
        wantsPlans
          ? prisma.manualTestPlan.findMany({
              where: user.isGlobalAdmin ? undefined : { companySlug: companySlugScope },
              orderBy: { updatedAt: "desc" },
              take: 20,
              select: {
                id: true, title: true, companySlug: true, applicationName: true,
                applicationSlug: true, projectCode: true, updatedAt: true,
              },
            }).catch(() => [])
          : Promise.resolve([]),
        wantsDefects
          ? prisma.defect.findMany({
              where: user.isGlobalAdmin ? undefined : { companyId: companyIdScope },
              orderBy: { updatedAt: "desc" },
              take: 20,
              select: { id: true, title: true, description: true, companyId: true, releaseManualId: true, updatedAt: true },
            }).catch(() => [])
          : Promise.resolve([]),
        wantsIntegrations
          ? prisma.companyIntegration.findMany({
              where: user.isGlobalAdmin ? undefined : { companyId: companyIdScope },
              orderBy: { createdAt: "desc" },
              take: 20,
              select: { id: true, companyId: true, type: true, config: true, createdAt: true },
            }).catch(() => [])
          : Promise.resolve([]),
        wantsRuns
          ? prisma.testRun.findMany({
              orderBy: { createdAt: "desc" },
              take: 12,
              select: { id: true, status: true, createdAt: true },
            }).catch(() => [])
          : Promise.resolve([]),
      ])
    : [[], [], [], [], [], []];

  const users =
    wantsEverything || /usuario|usuário|perfil|responsavel|responsável|login|email/.test(normalized)
      ? visibleUsers.users
          .filter((item) => {
            if (!effectiveQuery) return true;
            const haystack = `${item.name} ${item.email} ${item.login}`.toLowerCase();
            return haystack.includes(effectiveQuery);
          })
          .slice(0, MAX_RESULTS)
      : [];

  const companies =
    wantsEverything || /empresa|cliente|tenant|griaule|testing company/.test(normalized)
      ? visibleCompanies
          .filter((item) => {
            if (!effectiveQuery) return true;
            const haystack = `${item.name} ${item.slug}`.toLowerCase();
            return haystack.includes(effectiveQuery);
          })
          .slice(0, MAX_RESULTS)
      : [];

  const applicationResults = applications
    .filter((item) => recordMatchesQuery(effectiveQuery, item.name, item.slug, item.companySlug, item.qaseProjectCode, item.source))
    .slice(0, MAX_RESULTS);
  const releaseResults = releases
    .filter((item) => recordMatchesQuery(effectiveQuery, item.title, item.slug, item.app, item.qaseProject, item.companySlug, item.status))
    .slice(0, MAX_RESULTS);
  const planResults = manualTestPlans
    .filter((item) => recordMatchesQuery(effectiveQuery, item.title, item.applicationName, item.applicationSlug, item.projectCode, item.companySlug))
    .slice(0, MAX_RESULTS);
  const defectResults = defects
    .filter((item) => recordMatchesQuery(effectiveQuery, item.title, item.description, item.companyId))
    .slice(0, MAX_RESULTS);
  const integrationResults = integrations
    .filter((item) => recordMatchesQuery(effectiveQuery, item.type, item.companyId))
    .slice(0, MAX_RESULTS);

  const sections: string[] = ["## 🔍 Resultados da Busca", ""];

  // ─── Tickets encontrados ───
  if (tickets.length) {
    const ticketList = tickets.slice(0, MAX_RESULTS);
    sections.push(
      `### 🎫 Chamados (${ticketList.length}${tickets.length > MAX_RESULTS ? `/${tickets.length}` : ""})`,
      "",
      "| Código | Título | Status | Prioridade |",
      "|--------|--------|--------|------------|",
      ...ticketList.map((t) => 
        `| **${t.code}** | ${t.title.slice(0, 35)}${t.title.length > 35 ? "..." : ""} | ${getStatusEmoji(t.status)} ${t.status} | ${getPriorityEmoji(t.priority)} ${t.priority} |`
      ),
    );
  }

  // ─── Usuários encontrados ───
  if (users.length) {
    sections.push(
      "",
      `### 👤 Usuários (${users.length})`,
      "",
      "| Nome | Login | Email |",
      "|------|-------|-------|",
      ...users.map((u) => `| ${u.name} | ${u.login ?? "-"} | ${u.email ?? "-"} |`),
    );
  }

  // ─── Empresas encontradas ───
  if (companies.length) {
    sections.push(
      "",
      `### 🏢 Empresas (${companies.length})`,
      "",
      "| Nome | Slug |",
      "|------|------|",
      ...companies.map((c) => `| ${c.name} | ${c.slug} |`),
    );
  }

  if (applicationResults.length) {
    sections.push(
      "",
      `### 🧩 Aplicações (${applicationResults.length})`,
      "",
      "| Nome | Empresa | Qase | Origem | Ativa |",
      "|------|---------|------|--------|-------|",
      ...applicationResults.map((app) =>
        `| ${app.name} | ${app.companySlug ?? "-"} | ${app.qaseProjectCode ?? "-"} | ${app.source ?? "manual"} | ${app.active ? "sim" : "não"} |`,
      ),
    );
  }

  if (releaseResults.length) {
    sections.push(
      "",
      `### 🚀 Runs/Releases (${releaseResults.length})`,
      "",
      "| Título | Status | App/Qase | Pass/Fail/Blocked | Atualizado |",
      "|--------|--------|----------|-------------------|-----------|",
      ...releaseResults.map((release) =>
        `| ${release.title} | ${release.status} | ${release.qaseProject ?? release.app ?? "-"} | ${release.statsPass}/${release.statsFail}/${release.statsBlocked} | ${formatDate(release.updatedAt)} |`,
      ),
    );
  }

  if (planResults.length) {
    sections.push(
      "",
      `### 🧪 Planos de Teste (${planResults.length})`,
      "",
      "| Plano | Aplicação | Projeto | Empresa | Atualizado |",
      "|-------|-----------|---------|---------|-----------|",
      ...planResults.map((plan) =>
        `| ${plan.title} | ${plan.applicationName} | ${plan.projectCode ?? "-"} | ${plan.companySlug} | ${formatDate(plan.updatedAt)} |`,
      ),
    );
  }

  if (defectResults.length) {
    sections.push(
      "",
      `### 🐞 Defeitos (${defectResults.length})`,
      "",
      "| Defeito | Release manual | Atualizado |",
      "|---------|----------------|-----------|",
      ...defectResults.map((defect) =>
        `| ${defect.title} | ${defect.releaseManualId ?? "-"} | ${formatDate(defect.updatedAt)} |`,
      ),
    );
  }

  if (integrationResults.length) {
    sections.push(
      "",
      `### 🔌 Integrações (${integrationResults.length})`,
      "",
      "| Tipo | Empresa | Criada em |",
      "|------|---------|----------|",
      ...integrationResults.map((integration) =>
        `| ${integration.type} | ${integration.companyId} | ${formatDate(integration.createdAt)} |`,
      ),
    );
  }

  if (testRuns.length) {
    sections.push(
      "",
      `### ✅ Execuções de Teste (${testRuns.length})`,
      "",
      "| ID | Status | Criado em |",
      "|----|--------|----------|",
      ...testRuns.slice(0, MAX_RESULTS).map((run) =>
        `| ${run.id.slice(0, 8)} | ${run.status} | ${formatDate(run.createdAt)} |`,
      ),
    );
  }

  if (sections.length <= 2) {
    return {
      tool: "search_internal_records",
      success: true,
      summary: "nenhum registro encontrado",
      actions: [
        { kind: "prompt", label: "🔐 Explicar meu escopo", prompt: "Explicar meu escopo de acesso" },
        { kind: "prompt", label: "📍 Resumir esta tela", prompt: "Resumir esta tela" },
        { kind: "prompt", label: "✏️ Criar chamado", prompt: "Criar chamado a partir de texto" },
      ],
      reply: [
        "## 🔍 Nenhum resultado encontrado",
        "",
        "Não encontrei registros para esse critério no seu escopo.",
        "",
        "**Tente:**",
        "- Buscar por ID do chamado (ex: `SP-000027`)",
        "- Filtrar por status: `abertos`, `em andamento`, `concluídos`",
        "- Filtrar por prioridade: `alta`, `média`, `baixa`",
        "- Buscar por empresa ou usuário específico",
        "- Buscar por aplicação, Qase, runs, planos de teste, defeitos ou integrações",
      ].join("\n"),
    };
  }

  // ─── Ações sugeridas ───
  const suggestedActions = tickets[0]
    ? [
        { kind: "prompt" as const, label: `📋 Resumir ${tickets[0].code}`, prompt: `Resumir o chamado ${tickets[0].code}` },
        { kind: "prompt" as const, label: "🧪 Gerar caso de teste", prompt: `Gerar caso de teste para ${tickets[0].code}` },
        { kind: "prompt" as const, label: "💬 Montar comentário", prompt: `Montar comentário para ${tickets[0].code}` },
      ]
    : buildPromptActions(context);

  return {
    tool: "search_internal_records",
    success: true,
    summary: `🎫 ${tickets.length} | 👤 ${users.length} | 🏢 ${companies.length} | 🧩 ${applicationResults.length} | 🚀 ${releaseResults.length} | 🧪 ${planResults.length} | 🐞 ${defectResults.length} | 🔌 ${integrationResults.length}`,
    actions: suggestedActions,
    reply: sections.join("\n"),
  };
}
