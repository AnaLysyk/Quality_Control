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

  if (reference?.code) {
    const exact = tickets.find((t) => t.code.toLowerCase() === reference.code.toLowerCase());
    if (exact) tickets = [exact];
  } else if (query) {
    tickets = tickets
      .map((t) => ({ ticket: t, score: scoreTicketMatch(t, query) }))
      .filter((i) => i.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((i) => i.ticket);
  }

  if (!reference && !query && !hasExplicitFilters) {
    const latest = tickets.slice(0, MAX_RESULTS);
    return {
      tool: "search_internal_records",
      success: true,
      summary: latest.length ? `${latest.length} chamados recentes visiveis` : "nenhum chamado visivel",
      actions: [
        { kind: "prompt", label: "Buscar chamado por ID", prompt: "Buscar o chamado SP-000001" },
        { kind: "prompt", label: "Alta sem responsavel", prompt: "Buscar tickets com prioridade alta sem responsavel" },
        { kind: "prompt", label: "Transformar nota em chamado", prompt: "Transformar este texto em chamado estruturado" },
      ],
      reply: latest.length
        ? [
            "Posso buscar por ID, status, prioridade, empresa ou usuario. Tambem consigo usar seu contexto atual para transformar texto ou nota em chamado. Enquanto isso, aqui estao alguns chamados visiveis no seu escopo:",
            "",
            ...latest.map((t) => `- ${t.code} | ${t.title} | ${t.status} | prioridade ${t.priority}`),
          ].join("\n")
        : "Nao encontrei chamados visiveis neste escopo agora. Se quiser, me informe um ID como `SP-000027` ou um filtro mais especifico.",
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

  const sections: string[] = [];
  if (tickets.length) {
    sections.push(
      "Chamados encontrados:",
      ...tickets.slice(0, MAX_RESULTS).map((t) => `- ${t.code} | ${t.title} | ${t.status} | prioridade ${t.priority}`),
    );
  }
  if (users.length) {
    sections.push("", "Usuarios encontrados:", ...users.map((u) => `- ${u.name} | ${u.login} | ${u.email}`));
  }
  if (companies.length) {
    sections.push("", "Empresas encontradas:", ...companies.map((c) => `- ${c.name} | slug ${c.slug}`));
  }

  if (!sections.length) {
    return {
      tool: "search_internal_records",
      success: true,
      summary: "nenhum registro encontrado",
      actions: [
        { kind: "prompt", label: "Explicar meu escopo", prompt: "Explicar meu escopo de acesso" },
        { kind: "prompt", label: "Resumir esta tela", prompt: "Resumir esta tela" },
        { kind: "prompt", label: "Transformar texto em chamado", prompt: "Transformar texto ou nota em chamado" },
      ],
      reply: "Nao encontrei registros visiveis para esse criterio dentro do seu escopo atual. Posso tentar por ID do chamado, nome, status, prioridade ou empresa.",
    };
  }

  return {
    tool: "search_internal_records",
    success: true,
    summary: `tickets ${tickets.length} | usuarios ${users.length} | empresas ${companies.length}`,
    actions: tickets[0]
      ? [
          { kind: "prompt", label: "Resumir primeiro chamado", prompt: `Resumir o chamado ${tickets[0].code}` },
          { kind: "prompt", label: "Sugerir proximo passo", prompt: `Qual o proximo passo para o chamado ${tickets[0].code}?` },
        ]
      : buildPromptActions(context),
    reply: sections.join("\n"),
  };
}
