import "server-only";

import { getLocalUserById } from "@/lib/auth/localStore";
import { listTicketComments } from "@/lib/ticketCommentsStore";
import { prisma } from "@/lib/prismaClient";
import type { AuthUser } from "@/lib/jwtAuth";
import type { AssistantScreenContext } from "../types";
import { compactMultiline, formatDateTime, normalizeSearch } from "../helpers";
import { buildPromptActions, displayName, displayRole, findVisibleTicket, getVisibleCompanies } from "../data";
import type { AssistantExecutorResult } from "./types";

/**
 * Busca memÃ³rias relevantes do Brain para uma entidade
 */
async function getBrainInsights(refType: string, refId: string): Promise<string[]> {
  try {
    const node = await prisma.brainNode.findFirst({
      where: { refType, refId },
      include: {
        memories: {
          where: { status: "ACTIVE" },
          orderBy: { importance: "desc" },
          take: 3,
        },
      },
    });

    if (!node?.memories?.length) return [];

    return node.memories.map(
      (m) => `ðŸ’¡ **[${m.memoryType}]** ${m.title}`
    );
  } catch {
    return [];
  }
}

export async function toolSummarizeEntity(user: AuthUser, context: AssistantScreenContext, message: string): Promise<AssistantExecutorResult> {
  const normalized = normalizeSearch(message);

  // â”€â”€â”€ Resumir perfil do usuÃ¡rio â”€â”€â”€
  if (normalized.includes("perfil") || normalized.includes("meus dados") || normalized.includes("meu usuario") || normalized.includes("meu usuÃ¡rio")) {
    const currentUser = await getLocalUserById(user.id);
    const insights = await getBrainInsights("User", user.id);
    
    const replyParts = [
      `## ðŸ‘¤ Perfil: ${displayName(currentUser)}`,
      "",
      `| Campo | Valor |`,
      `|-------|-------|`,
      `| **Login** | ${currentUser?.user ?? currentUser?.email ?? user.email} |`,
      `| **Email** | ${currentUser?.email ?? user.email} |`,
      `| **Papel** | ${displayRole(user)} |`,
      `| **Empresa** | ${context.companySlug ?? user.companySlug ?? "global"} |`,
    ];

    if (insights.length) {
      replyParts.push("", "### ðŸ§  Insights do Brain:", ...insights);
    }

    replyParts.push(
      "",
      "---",
      "ðŸ’¡ Posso usar esse contexto para estruturar chamados, comentÃ¡rios ou outras aÃ§Ãµes."
    );

    return {
      tool: "summarize_entity",
      success: true,
      summary: "perfil atual",
      actions: [
        { kind: "prompt", label: "Explicar minhas permissÃµes", prompt: "Explicar meu escopo de acesso" },
        { kind: "prompt", label: "Meus tickets recentes", prompt: "Buscar tickets criados por mim" },
        ...buildPromptActions(context).slice(0, 1),
      ],
      reply: replyParts.join("\n"),
    };
  }

  // â”€â”€â”€ Resumir ticket â”€â”€â”€
  const ticket = await findVisibleTicket(user, message);
  if (ticket) {
    const comments = await listTicketComments(ticket.id, { limit: 20, offset: 0 });
    const insights = await getBrainInsights("Ticket", ticket.id);
    
    // AnÃ¡lise de urgÃªncia
    const urgencyEmoji = ticket.priority === "high" ? "ðŸ”´" : ticket.priority === "medium" ? "ðŸŸ " : "ðŸŸ¢";
    const statusEmoji = ticket.status === "open" ? "ðŸ“¬" : ticket.status === "in_progress" ? "âš™ï¸" : "âœ…";
    
    const replyParts = [
      `## ${statusEmoji} ${ticket.code} â€” ${ticket.title}`,
      "",
      `| Atributo | Valor |`,
      `|----------|-------|`,
      `| **Status** | ${ticket.status} |`,
      `| **Prioridade** | ${urgencyEmoji} ${ticket.priority} |`,
      `| **Tipo** | ${ticket.type} |`,
      `| **Criado por** | ${ticket.createdByName ?? "nÃ£o identificado"} |`,
      `| **Criado em** | ${formatDateTime(ticket.createdAt)} |`,
      `| **ResponsÃ¡vel** | ${ticket.assignedToName ?? "âš ï¸ nÃ£o definido"} |`,
      `| **Atualizado** | ${formatDateTime(ticket.updatedAt)} |`,
      `| **ComentÃ¡rios** | ${comments.length} |`,
      "",
      "### ðŸ“ DescriÃ§Ã£o:",
      ticket.description || "_Sem descriÃ§Ã£o detalhada._",
    ];

    if (comments.length > 0) {
      replyParts.push(
        "",
        "### ðŸ’¬ Ãšltimos comentÃ¡rios:",
        ...comments.slice(0, 3).map((c) => `- **${c.authorName ?? "AnÃ´nimo"}**: ${c.body?.slice(0, 100)}${(c.body?.length ?? 0) > 100 ? "..." : ""}`)
      );
    }

    if (insights.length) {
      replyParts.push("", "### ðŸ§  Conhecimento do Brain:", ...insights);
    }

    // SugestÃµes contextuais
    const suggestions: Array<{ kind: "prompt"; label: string; prompt: string }> = [
      { kind: "prompt", label: "Gerar caso de teste", prompt: `Gerar caso de teste para ${ticket.code}` },
    ];
    
    if (!ticket.assignedToUserId) {
      suggestions.push({ kind: "prompt", label: "Sugerir responsÃ¡vel", prompt: `Quem deveria ser responsÃ¡vel pelo ${ticket.code}?` });
    }
    
    suggestions.push({ kind: "prompt", label: "Montar comentÃ¡rio", prompt: `Montar comentÃ¡rio tÃ©cnico para ${ticket.code}` });

    return {
      tool: "summarize_entity",
      success: true,
      summary: ticket.code,
      actions: suggestions,
      reply: replyParts.join("\n"),
    };
  }

  // â”€â”€â”€ Resumir empresa â”€â”€â”€
  if (context.module === "company" || normalized.includes("empresa")) {
    const companies = await getVisibleCompanies(user);
    const current = companies.find((c) => normalizeSearch(c.slug) === normalizeSearch(context.companySlug ?? "")) ?? companies[0];
    
    if (current) {
      const insights = await getBrainInsights("Company", current.id);
      const statusEmoji = current.active === false ? "âšª" : "ðŸŸ¢";
      
      const replyParts = [
        `## ðŸ¢ ${current.name}`,
        "",
        `| Atributo | Valor |`,
        `|----------|-------|`,
        `| **Slug** | ${current.slug} |`,
        `| **Status** | ${statusEmoji} ${current.status ?? (current.active === false ? "inativa" : "ativa")} |`,
      ];

      if (insights.length) {
        replyParts.push("", "### ðŸ§  Conhecimento do Brain:", ...insights);
      }

      replyParts.push(
        "",
        "---",
        "ðŸ’¡ Posso buscar tickets, usuÃ¡rios ou gerar relatÃ³rios desta empresa."
      );

      return {
        tool: "summarize_entity",
        success: true,
        summary: current.slug,
        actions: [
          { kind: "prompt", label: "Tickets da empresa", prompt: `Buscar tickets da empresa ${current.name}` },
          { kind: "prompt", label: "UsuÃ¡rios da empresa", prompt: `Listar usuÃ¡rios da empresa ${current.name}` },
          ...buildPromptActions(context).slice(0, 1),
        ],
        reply: replyParts.join("\n"),
      };
    }
  }

  // â”€â”€â”€ Fallback: contexto atual â”€â”€â”€
  const currentUser = await getLocalUserById(user.id);
  return {
    tool: "summarize_entity",
    success: true,
    summary: "contexto atual",
    actions: buildPromptActions(context),
    reply: compactMultiline([
      `## ðŸ“ Contexto Atual`,
      "",
      `**UsuÃ¡rio:** ${displayName(currentUser)}`,
      `**Tela:** ${context.screenLabel}`,
      `**MÃ³dulo:** ${context.module}`,
      `**Perfil:** ${displayRole(user)}`,
      `**Empresa:** ${context.companySlug ?? user.companySlug ?? "global"}`,
      "",
      `> ${context.screenSummary}`,
    ].join("\n")),
  };
}

