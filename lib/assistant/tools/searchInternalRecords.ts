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
    .replace(/\b(sem|com)\s+(responsavel|responsÃ¡vel)\b/gi, "")
    .replace(/\b(backlog|andamento|revisao|revisÃ£o|concluido|concluÃ­do)\b/gi, "")
    .replace(/\b(alta|media|mÃ©dia|baixa|urgente)\b/gi, "")
    .replace(/\b(status|prioridade|empresa|usuario|usuÃ¡rio|perfil)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getPriorityEmoji(priority: string): string {
  switch (priority?.toLowerCase()) {
    case "high":
    case "alta":
      return "ðŸ”´";
    case "medium":
    case "media":
    case "mÃ©dia":
      return "ðŸŸ ";
    case "low":
    case "baixa":
      return "ðŸŸ¢";
    default:
      return "âšª";
  }
}

function getStatusEmoji(status: string): string {
  switch (status?.toLowerCase()) {
    case "open":
    case "backlog":
      return "ðŸ“¬";
    case "in_progress":
    case "andamento":
      return "âš™ï¸";
    case "review":
    case "revisao":
      return "ðŸ‘ï¸";
    case "done":
    case "closed":
    case "concluido":
      return "âœ…";
    default:
      return "ðŸ“‹";
  }
}

export async function toolSearchInternalRecords(user: AuthUser, context: AssistantScreenContext, message: string): Promise<AssistantExecutorResult> {
  const visibleTickets = await getVisibleTickets(user);
  const normalized = normalizeSearch(message);
  const statusFilters = getStatusFilters(message);
  const priorityFilters = getPriorityFilters(message);
  const wantsOnlyUnassigned = normalized.includes("sem responsavel") || normalized.includes("sem responsÃ¡vel");
  const wantsOnlyAssigned = normalized.includes("com responsavel") || normalized.includes("com responsÃ¡vel");
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

  // â”€â”€â”€ Busca sem filtros: mostrar overview â”€â”€â”€
  if (!reference && !query && !hasExplicitFilters) {
    const latest = tickets.slice(0, MAX_RESULTS);
    
    // EstatÃ­sticas rÃ¡pidas
    const highPriority = visibleTickets.filter((t) => t.priority === "high").length;
    const unassigned = visibleTickets.filter((t) => !t.assignedToUserId).length;
    const openCount = visibleTickets.filter((t) => t.status === "open" || t.status === "backlog").length;

    const statsLine = `ðŸ“Š **VisÃ£o geral:** ${visibleTickets.length} tickets | ${openCount} abertos | ${highPriority} alta prioridade | ${unassigned} sem responsÃ¡vel`;

    return {
      tool: "search_internal_records",
      success: true,
      summary: latest.length ? `${latest.length} chamados recentes` : "nenhum chamado visÃ­vel",
      actions: [
        { kind: "prompt", label: "ðŸ” Buscar por ID", prompt: "Buscar o chamado SP-000001" },
        { kind: "prompt", label: "ðŸ”´ Alta prioridade", prompt: "Buscar tickets com prioridade alta" },
        { kind: "prompt", label: "âš ï¸ Sem responsÃ¡vel", prompt: "Buscar tickets sem responsÃ¡vel" },
        { kind: "prompt", label: "âœï¸ Criar chamado", prompt: "Transformar este texto em chamado" },
      ],
      reply: latest.length
        ? [
            "## ðŸ” Busca de Registros",
            "",
            statsLine,
            "",
            "### Chamados Recentes:",
            "",
            "| CÃ³digo | TÃ­tulo | Status | Prioridade |",
            "|--------|--------|--------|------------|",
            ...latest.map((t) => `| **${t.code}** | ${t.title.slice(0, 40)}${t.title.length > 40 ? "..." : ""} | ${getStatusEmoji(t.status)} ${t.status} | ${getPriorityEmoji(t.priority)} ${t.priority} |`),
            "",
            "---",
            "ðŸ’¡ Refine por **ID**, **status**, **prioridade** ou **responsÃ¡vel**",
          ].join("\n")
        : "NÃ£o encontrei chamados visÃ­veis neste escopo. Informe um **ID** como `SP-000027` ou um filtro mais especÃ­fico.",
    };
  }

  const [visibleUsers, visibleCompanies] = await Promise.all([getVisibleUsers(user), getVisibleCompanies(user)]);

  const users =
    /usuario|usuÃ¡rio|perfil|responsavel|responsÃ¡vel|login|email/.test(normalized)
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

  const sections: string[] = ["## ðŸ” Resultados da Busca", ""];

  // â”€â”€â”€ Tickets encontrados â”€â”€â”€
  if (tickets.length) {
    const ticketList = tickets.slice(0, MAX_RESULTS);
    sections.push(
      `### ðŸŽ« Chamados (${ticketList.length}${tickets.length > MAX_RESULTS ? `/${tickets.length}` : ""})`,
      "",
      "| CÃ³digo | TÃ­tulo | Status | Prioridade |",
      "|--------|--------|--------|------------|",
      ...ticketList.map((t) => 
        `| **${t.code}** | ${t.title.slice(0, 35)}${t.title.length > 35 ? "..." : ""} | ${getStatusEmoji(t.status)} ${t.status} | ${getPriorityEmoji(t.priority)} ${t.priority} |`
      ),
    );
  }

  // â”€â”€â”€ UsuÃ¡rios encontrados â”€â”€â”€
  if (users.length) {
    sections.push(
      "",
      `### ðŸ‘¤ UsuÃ¡rios (${users.length})`,
      "",
      "| Nome | Login | Email |",
      "|------|-------|-------|",
      ...users.map((u) => `| ${u.name} | ${u.login ?? "-"} | ${u.email ?? "-"} |`),
    );
  }

  // â”€â”€â”€ Empresas encontradas â”€â”€â”€
  if (companies.length) {
    sections.push(
      "",
      `### ðŸ¢ Empresas (${companies.length})`,
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
        { kind: "prompt", label: "ðŸ” Explicar meu escopo", prompt: "Explicar meu escopo de acesso" },
        { kind: "prompt", label: "ðŸ“ Resumir esta tela", prompt: "Resumir esta tela" },
        { kind: "prompt", label: "âœï¸ Criar chamado", prompt: "Criar chamado a partir de texto" },
      ],
      reply: [
        "## ðŸ” Nenhum resultado encontrado",
        "",
        "NÃ£o encontrei registros para esse critÃ©rio no seu escopo.",
        "",
        "**Tente:**",
        "- Buscar por ID do chamado (ex: `SP-000027`)",
        "- Filtrar por status: `abertos`, `em andamento`, `concluÃ­dos`",
        "- Filtrar por prioridade: `alta`, `mÃ©dia`, `baixa`",
        "- Buscar por empresa ou usuÃ¡rio especÃ­fico",
      ].join("\n"),
    };
  }

  // â”€â”€â”€ AÃ§Ãµes sugeridas â”€â”€â”€
  const suggestedActions = tickets[0]
    ? [
        { kind: "prompt" as const, label: `ðŸ“‹ Resumir ${tickets[0].code}`, prompt: `Resumir o chamado ${tickets[0].code}` },
        { kind: "prompt" as const, label: "ðŸ§ª Gerar caso de teste", prompt: `Gerar caso de teste para ${tickets[0].code}` },
        { kind: "prompt" as const, label: "ðŸ’¬ Montar comentÃ¡rio", prompt: `Montar comentÃ¡rio para ${tickets[0].code}` },
      ]
    : buildPromptActions(context);

  return {
    tool: "search_internal_records",
    success: true,
    summary: `ðŸŽ« ${tickets.length} | ðŸ‘¤ ${users.length} | ðŸ¢ ${companies.length}`,
    actions: suggestedActions,
    reply: sections.join("\n"),
  };
}

