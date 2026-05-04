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
 * Busca memórias relevantes do Brain para uma entidade
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
      (m) => `💡 **[${m.memoryType}]** ${m.title}`
    );
  } catch {
    return [];
  }
}

export async function toolSummarizeEntity(user: AuthUser, context: AssistantScreenContext, message: string): Promise<AssistantExecutorResult> {
  const normalized = normalizeSearch(message);

  // ─── Resumir perfil do usuário ───
  if (normalized.includes("perfil") || normalized.includes("meus dados") || normalized.includes("meu usuario") || normalized.includes("meu usuário")) {
    const currentUser = await getLocalUserById(user.id);
    const insights = await getBrainInsights("User", user.id);
    
    const replyParts = [
      `## 👤 Perfil: ${displayName(currentUser)}`,
      "",
      `| Campo | Valor |`,
      `|-------|-------|`,
      `| **Login** | ${currentUser?.user ?? currentUser?.email ?? user.email} |`,
      `| **Email** | ${currentUser?.email ?? user.email} |`,
      `| **Papel** | ${displayRole(user)} |`,
      `| **Empresa** | ${context.companySlug ?? user.companySlug ?? "global"} |`,
    ];

    if (insights.length) {
      replyParts.push("", "### 🧠 Insights do Brain:", ...insights);
    }

    replyParts.push(
      "",
      "---",
      "💡 Posso usar esse contexto para estruturar chamados, comentários ou outras ações."
    );

    return {
      tool: "summarize_entity",
      success: true,
      summary: "perfil atual",
      actions: [
        { kind: "prompt", label: "Explicar minhas permissões", prompt: "Explicar meu escopo de acesso" },
        { kind: "prompt", label: "Meus tickets recentes", prompt: "Buscar tickets criados por mim" },
        ...buildPromptActions(context).slice(0, 1),
      ],
      reply: replyParts.join("\n"),
    };
  }

  // ─── Resumir ticket ───
  const ticket = await findVisibleTicket(user, message);
  if (ticket) {
    const comments = await listTicketComments(ticket.id, { limit: 20, offset: 0 });
    const insights = await getBrainInsights("Ticket", ticket.id);
    
    // Análise de urgência
    const urgencyEmoji = ticket.priority === "high" ? "🔴" : ticket.priority === "medium" ? "🟠" : "🟢";
    const statusEmoji = ticket.status === "open" ? "📬" : ticket.status === "in_progress" ? "⚙️" : "✅";
    
    const replyParts = [
      `## ${statusEmoji} ${ticket.code} — ${ticket.title}`,
      "",
      `| Atributo | Valor |`,
      `|----------|-------|`,
      `| **Status** | ${ticket.status} |`,
      `| **Prioridade** | ${urgencyEmoji} ${ticket.priority} |`,
      `| **Tipo** | ${ticket.type} |`,
      `| **Criado por** | ${ticket.createdByName ?? "não identificado"} |`,
      `| **Criado em** | ${formatDateTime(ticket.createdAt)} |`,
      `| **Responsável** | ${ticket.assignedToName ?? "⚠️ não definido"} |`,
      `| **Atualizado** | ${formatDateTime(ticket.updatedAt)} |`,
      `| **Comentários** | ${comments.length} |`,
      "",
      "### 📝 Descrição:",
      ticket.description || "_Sem descrição detalhada._",
    ];

    if (comments.length > 0) {
      replyParts.push(
        "",
        "### 💬 Últimos comentários:",
        ...comments.slice(0, 3).map((c) => `- **${c.authorName ?? "Anônimo"}**: ${c.body?.slice(0, 100)}${(c.body?.length ?? 0) > 100 ? "..." : ""}`)
      );
    }

    if (insights.length) {
      replyParts.push("", "### 🧠 Conhecimento do Brain:", ...insights);
    }

    // Sugestões contextuais
    const suggestions: Array<{ kind: "prompt"; label: string; prompt: string }> = [
      { kind: "prompt", label: "Gerar caso de teste", prompt: `Gerar caso de teste para ${ticket.code}` },
    ];
    
    if (!ticket.assignedToUserId) {
      suggestions.push({ kind: "prompt", label: "Sugerir responsável", prompt: `Quem deveria ser responsável pelo ${ticket.code}?` });
    }
    
    suggestions.push({ kind: "prompt", label: "Montar comentário", prompt: `Montar comentário técnico para ${ticket.code}` });

    return {
      tool: "summarize_entity",
      success: true,
      summary: ticket.code,
      actions: suggestions,
      reply: replyParts.join("\n"),
    };
  }

  // ─── Resumir empresa ───
  if (context.module === "company" || normalized.includes("empresa")) {
    const companies = await getVisibleCompanies(user);
    const current = companies.find((c) => normalizeSearch(c.slug) === normalizeSearch(context.companySlug ?? "")) ?? companies[0];
    
    if (current) {
      const insights = await getBrainInsights("Company", current.id);
      const statusEmoji = current.active === false ? "⚪" : "🟢";
      
      const replyParts = [
        `## 🏢 ${current.name}`,
        "",
        `| Atributo | Valor |`,
        `|----------|-------|`,
        `| **Slug** | ${current.slug} |`,
        `| **Status** | ${statusEmoji} ${current.status ?? (current.active === false ? "inativa" : "ativa")} |`,
      ];

      if (insights.length) {
        replyParts.push("", "### 🧠 Conhecimento do Brain:", ...insights);
      }

      replyParts.push(
        "",
        "---",
        "💡 Posso buscar tickets, usuários ou gerar relatórios desta empresa."
      );

      return {
        tool: "summarize_entity",
        success: true,
        summary: current.slug,
        actions: [
          { kind: "prompt", label: "Tickets da empresa", prompt: `Buscar tickets da empresa ${current.name}` },
          { kind: "prompt", label: "Usuários da empresa", prompt: `Listar usuários da empresa ${current.name}` },
          ...buildPromptActions(context).slice(0, 1),
        ],
        reply: replyParts.join("\n"),
      };
    }
  }

  // ─── Fallback: contexto atual ───
  const currentUser = await getLocalUserById(user.id);
  return {
    tool: "summarize_entity",
    success: true,
    summary: "contexto atual",
    actions: buildPromptActions(context),
    reply: compactMultiline([
      `## 📍 Contexto Atual`,
      "",
      `**Usuário:** ${displayName(currentUser)}`,
      `**Tela:** ${context.screenLabel}`,
      `**Módulo:** ${context.module}`,
      `**Perfil:** ${displayRole(user)}`,
      `**Empresa:** ${context.companySlug ?? user.companySlug ?? "global"}`,
      "",
      `> ${context.screenSummary}`,
    ].join("\n")),
  };
}
