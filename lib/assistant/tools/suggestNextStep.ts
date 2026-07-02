import "server-only";

import type { AuthUser } from "@/lib/jwtAuth";
import { hasPermissionAccess } from "@/lib/permissionMatrix";
import { prisma } from "@/lib/prismaClient";
import type { AssistantScreenContext } from "../types";
import { isEmpresaUser } from "../data";
import type { AssistantExecutorResult } from "./types";

/**
 * Gera sugestões inteligentes baseadas em:
 * 1. Contexto da tela atual
 * 2. Permissões do usuário
 * 3. Conhecimento do Brain (memórias e padrões)
 * 4. Atividade recente
 */
export async function toolSuggestNextStep(user: AuthUser, context: AssistantScreenContext): Promise<AssistantExecutorResult> {
  const suggestions: string[] = [];
  const smartTips: string[] = [];

  // Buscar memórias relevantes do Brain para contexto
  try {
    const relevantMemories = await prisma.brainMemory.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { memoryType: "RULE" },
          { memoryType: "PATTERN" },
          { memoryType: "DECISION" },
        ],
      },
      orderBy: { importance: "desc" },
      take: 3,
      select: { title: true, summary: true, memoryType: true },
    });

    for (const mem of relevantMemories) {
      if (mem.memoryType === "PATTERN") {
        smartTips.push(`ðŸ’¡ ${mem.title}`);
      }
    }
  } catch {
    // Brain optional
  }

  // Sugestões contextuais por rota/tela antes do módulo genérico
  const isAccessRequestsContext = context.route.startsWith("/admin/access-requests");
  const isBrainContext =
    context.module === "brain" ||
    context.route.startsWith("/brain") ||
    context.route.startsWith("/admin/brain");

  if (isAccessRequestsContext) {
    suggestions.push("ðŸ”Ž Buscar uma pessoa na fila de solicitações");
    suggestions.push("ðŸ§­ Explicar o que falta para aprovar uma solicitação");
    suggestions.push("ðŸ“ Orientar quais campos devolver para ajuste");
    suggestions.push("ðŸ“„ Abrir ou baixar o PDF da solicitação visível");
  }

  if (isBrainContext) {
    suggestions.push("ðŸ§  Resumir o Brain e o que ele já sabe");
    suggestions.push("ðŸ•¸ï¸ Explicar relações do grafo de conhecimento");
    suggestions.push("ðŸ”Ž Buscar contexto em memórias, telas e entidades");
    suggestions.push("âž¡ï¸ Sugerir o próximo passo como agente");
  }

  // Sugestões contextuais por módulo
  if (context.module === "support") {
    suggestions.push("ðŸ” Buscar tickets de alta prioridade sem responsável");
    suggestions.push("ðŸ“‹ Resumir um chamado pelo ID para acelerar triagem");
    if (hasPermissionAccess(user.permissions, "tickets", "create") || hasPermissionAccess(user.permissions, "support", "create")) {
      suggestions.push("âœï¸ Transformar um relato em chamado estruturado");
      suggestions.push("ðŸŽ« Criar novo ticket a partir de descrição");
    }
  }

  if (context.module === "permissions") {
    suggestions.push("ðŸ” Explicar por que um perfil não vê um módulo");
    suggestions.push("ðŸ“Š Listar ações disponíveis para o usuário analisado");
    suggestions.push("ðŸ”§ Analisar escopo de acesso atual");
  }

  if (context.module === "test_plans") {
    suggestions.push("ðŸ§ª Gerar caso de teste a partir do bug atual");
    suggestions.push("ðŸ“ Criar roteiro de teste estruturado");
    suggestions.push("âœ… Validar cobertura de testes existente");
  }

  if (context.module === "dashboard" && !isAccessRequestsContext && !isBrainContext) {
    suggestions.push("ðŸ“ˆ Analisar métricas de qualidade do período");
    suggestions.push("ðŸŽ¯ Identificar tendências nos indicadores");
    suggestions.push("âš ï¸ Listar áreas que precisam de atenção");
  }

  if (context.module === "releases") {
    suggestions.push("ðŸš€ Verificar status do último deploy");
    suggestions.push("ðŸ“¦ Analisar testes pendentes para release");
    suggestions.push("ðŸ“‹ Gerar relatório de qualidade da versão");
  }

  if (context.module === "company") {
    if (isEmpresaUser(user)) {
      suggestions.push("ðŸ¢ Resumir status atual da minha empresa");
      suggestions.push("ðŸ› Listar defeitos e bugs ativos no projeto");
      suggestions.push("ðŸ“Š Ver métricas de qualidade dos testes");
      suggestions.push("ðŸš€ Checar status dos planos de release");
    } else {
      suggestions.push("ðŸ¢ Resumir perfil da empresa");
      suggestions.push("ðŸ“Š Analisar métricas de atendimento do cliente");
      suggestions.push("ðŸ“‹ Listar integrações ativas");
      suggestions.push("ðŸ‘¥ Ver usuários vinculados à empresa");
    }
  }

  // Sugestões genéricas se não há contexto específico
  if (!suggestions.length) {
    suggestions.push("ðŸ“ Mostrar o contexto atual da tela");
    suggestions.push("ðŸ” Buscar registros no seu escopo de acesso");
    suggestions.push("ðŸ” Explicar permissões da tela atual");
    suggestions.push("ðŸ’¡ O que posso fazer por você?");
  }

  // Montar resposta
  const mainSuggestions = suggestions.slice(0, 4);
  let replyText = "**O que posso ajudar agora:**\n\n";
  replyText += mainSuggestions.map((item, index) => `${index + 1}. ${item}`).join("\n");

  if (smartTips.length) {
    replyText += "\n\n---\n**Dicas do Brain:**\n";
    replyText += smartTips.slice(0, 2).join("\n");
  }

  return {
    tool: "suggest_next_step",
    success: true,
    summary: "próximos passos sugeridos com contexto inteligente",
    actions: mainSuggestions.map((prompt) => ({ 
      kind: "prompt", 
      label: prompt.replace(/^[^\s]+\s/, ""), // Remove emoji for clean label
      prompt: prompt.replace(/^[^\s]+\s/, ""), 
    })),
    reply: replyText,
  };
}

