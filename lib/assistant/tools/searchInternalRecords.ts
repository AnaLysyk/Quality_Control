import "server-only";

import type { AuthUser } from "@/lib/jwtAuth";
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

export async function toolSearchInternalRecords(user: AuthUser, context: AssistantScreenContext, message: string): Promise<AssistantExecutorResult> {
  const visibleTickets = await getVisibleTickets(user);
  const normalized = normalizeSearch(message);
  const statusFilters = getStatusFilters(message);
  const priorityFilters = getPriorityFilters(message);
  const wantsOnlyUnassigned = normalized.includes("sem responsavel") || normalized.includes("sem responsável");
  const wantsOnlyAssigned = normalized.includes("com responsavel") || normalized.includes("com responsável");
  const reference = extractTicketReference(message);

  let tickets = [...visibleTickets];
  if (statusFilters) tickets = tickets.filter((t) => statusFilters.has(t.status));
  if (priorityFilters) tickets = tickets.filter((t) => priorityFilters.has(t.priority));
  if (wantsOnlyUnassigned) tickets = tickets.filter((t) => !t.assignedToUserId);
  if (wantsOnlyAssigned) tickets = tickets.filter((t) => Boolean(t.assignedToUserId));

  const query = extractSearchText(message);
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

  const users =
    /usuario|usuário|perfil|responsavel|responsável|login|email/.test(normalized)
      ? visibleUsers.users
          .filter((item) => {
            if (!query) return true;
            const haystack = `${item.name} ${item.email} ${item.login}`.toLowerCase();
            return haystack.includes(normalized);
          })
          .slice(0, MAX_RESULTS)
      : [];

  const companies =
    /empresa|cliente|tenant/.test(normalized)
      ? visibleCompanies
          .filter((item) => {
            if (!query) return true;
            const haystack = `${item.name} ${item.slug}`.toLowerCase();
            return haystack.includes(normalized);
          })
          .slice(0, MAX_RESULTS)
      : [];

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
    summary: `🎫 ${tickets.length} | 👤 ${users.length} | 🏢 ${companies.length}`,
    actions: suggestedActions,
    reply: sections.join("\n"),
  };
}
