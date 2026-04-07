import "server-only";

import { getLocalUserById } from "@/lib/auth/localStore";
import { listTicketComments } from "@/lib/ticketCommentsStore";
import type { AuthUser } from "@/lib/jwtAuth";
import type { AssistantScreenContext } from "../types";
import { compactMultiline, formatDateTime, normalizeSearch } from "../helpers";
import { buildPromptActions, displayName, displayRole, findVisibleTicket, getVisibleCompanies } from "../data";
import type { AssistantExecutorResult } from "./types";

export async function toolSummarizeEntity(user: AuthUser, context: AssistantScreenContext, message: string): Promise<AssistantExecutorResult> {
  const normalized = normalizeSearch(message);

  if (normalized.includes("perfil") || normalized.includes("meus dados") || normalized.includes("meu usuario") || normalized.includes("meu usuário")) {
    const currentUser = await getLocalUserById(user.id);
    return {
      tool: "summarize_entity",
      success: true,
      summary: "perfil atual",
      actions: buildPromptActions(context),
      reply: compactMultiline([
        `Resumo do seu perfil atual: ${displayName(currentUser)}`,
        `Login: ${currentUser?.user ?? currentUser?.email ?? user.email}`,
        `Email: ${currentUser?.email ?? user.email}`,
        `Papel: ${displayRole(user)}`,
        `Empresa/tenant atual: ${context.companySlug ?? user.companySlug ?? "global"}`,
        "Posso usar esse contexto para estruturar chamado, comentario, resumo e outras acoes dentro do seu escopo.",
      ].join("\n")),
    };
  }

  const ticket = await findVisibleTicket(user, message);
  if (ticket) {
    const comments = await listTicketComments(ticket.id, { limit: 20, offset: 0 });
    return {
      tool: "summarize_entity",
      success: true,
      summary: ticket.code,
      actions: [
        { kind: "prompt", label: "Gerar caso de teste", prompt: `Gerar caso de teste para o chamado ${ticket.code}` },
        { kind: "prompt", label: "Montar comentario tecnico", prompt: `Montar comentario tecnico para o chamado ${ticket.code}` },
      ],
      reply: compactMultiline([
        `${ticket.code} — ${ticket.title}`,
        `Status: ${ticket.status} | Prioridade: ${ticket.priority} | Tipo: ${ticket.type}`,
        `Criado por: ${ticket.createdByName ?? "nao identificado"} em ${formatDateTime(ticket.createdAt)}`,
        `Responsavel atual: ${ticket.assignedToName ?? "nao definido"}`,
        `Ultima atualizacao: ${formatDateTime(ticket.updatedAt)}`,
        `Comentarios visiveis: ${comments.length}`,
        "",
        "Resumo do conteudo:",
        ticket.description || "Sem descricao detalhada.",
      ].join("\n")),
    };
  }

  if (context.module === "company") {
    const companies = await getVisibleCompanies(user);
    const current = companies.find((c) => normalizeSearch(c.slug) === normalizeSearch(context.companySlug ?? "")) ?? companies[0];
    if (current) {
      return {
        tool: "summarize_entity",
        success: true,
        summary: current.slug,
        actions: buildPromptActions(context),
        reply: compactMultiline([
          `Empresa: ${current.name}`,
          `Slug: ${current.slug}`,
          `Status: ${current.status ?? (current.active === false ? "inativa" : "ativa")}`,
          "Posso agora buscar chamados vinculados a esta empresa, resumir contexto ou sugerir proximo passo.",
        ].join("\n")),
      };
    }
  }

  const currentUser = await getLocalUserById(user.id);
  return {
    tool: "summarize_entity",
    success: true,
    summary: "contexto atual",
    actions: buildPromptActions(context),
    reply: compactMultiline([
      `Resumo do contexto atual para ${displayName(currentUser)}.`,
      `${context.screenLabel}: ${context.screenSummary}`,
      `Perfil ativo: ${displayRole(user)}`,
      `Escopo de empresa: ${context.companySlug ?? user.companySlug ?? "global"}`,
    ].join("\n")),
  };
}
