import "server-only";

import type { AuthUser } from "@/lib/jwtAuth";
import { hasPermissionAccess } from "@/lib/permissionMatrix";
import { prisma } from "@/lib/prismaClient";
import type { AssistantScreenContext } from "../types";
import { isEmpresaUser } from "../data";
import type { AssistantExecutorResult } from "./types";

/**
 * Gera sugestÃµes inteligentes baseadas em:
 * 1. Contexto da tela atual
 * 2. PermissÃµes do usuÃ¡rio
 * 3. Conhecimento do Brain (memÃ³rias e padrÃµes)
 * 4. Atividade recente
 */
export async function toolSuggestNextStep(user: AuthUser, context: AssistantScreenContext): Promise<AssistantExecutorResult> {
  const suggestions: string[] = [];
  const smartTips: string[] = [];

  // Buscar memÃ³rias relevantes do Brain para contexto
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

  // SugestÃµes contextuais por rota/tela antes do mÃ³dulo genÃ©rico
  const isAccessRequestsContext = context.route.startsWith("/admin/access-requests");
  const isBrainContext =
    context.module === "brain" ||
    context.route.startsWith("/brain") ||
    context.route.startsWith("/admin/brain");

  if (isAccessRequestsContext) {
    suggestions.push("ðŸ”Ž Buscar uma pessoa na fila de solicitaÃ§Ãµes");
    suggestions.push("ðŸ§­ Explicar o que falta para aprovar uma solicitaÃ§Ã£o");
    suggestions.push("ðŸ“ Orientar quais campos devolver para ajuste");
    suggestions.push("ðŸ“„ Abrir ou baixar o PDF da solicitaÃ§Ã£o visÃ­vel");
  }

  if (isBrainContext) {
    suggestions.push("ðŸ§  Resumir o Brain e o que ele jÃ¡ sabe");
    suggestions.push("ðŸ•¸ï¸ Explicar relaÃ§Ãµes do grafo de conhecimento");
    suggestions.push("ðŸ”Ž Buscar contexto em memÃ³rias, telas e entidades");
    suggestions.push("âž¡ï¸ Sugerir o prÃ³ximo passo como agente");
  }

  // SugestÃµes contextuais por mÃ³dulo
  if (context.module === "support") {
    suggestions.push("ðŸ” Buscar tickets de alta prioridade sem responsÃ¡vel");
    suggestions.push("ðŸ“‹ Resumir um chamado pelo ID para acelerar triagem");
    if (hasPermissionAccess(user.permissions, "tickets", "create") || hasPermissionAccess(user.permissions, "support", "create")) {
      suggestions.push("âœï¸ Transformar um relato em chamado estruturado");
      suggestions.push("ðŸŽ« Criar novo ticket a partir de descriÃ§Ã£o");
    }
  }

  if (context.module === "permissions") {
    suggestions.push("ðŸ” Explicar por que um perfil nÃ£o vÃª um mÃ³dulo");
    suggestions.push("ðŸ“Š Listar aÃ§Ãµes disponÃ­veis para o usuÃ¡rio analisado");
    suggestions.push("ðŸ”§ Analisar escopo de acesso atual");
  }

  if (context.module === "test_plans") {
    suggestions.push("ðŸ§ª Gerar caso de teste a partir do bug atual");
    suggestions.push("ðŸ“ Criar roteiro de teste estruturado");
    suggestions.push("âœ… Validar cobertura de testes existente");
  }

  if (context.module === "dashboard" && !isAccessRequestsContext && !isBrainContext) {
    suggestions.push("ðŸ“ˆ Analisar mÃ©tricas de qualidade do perÃ­odo");
    suggestions.push("ðŸŽ¯ Identificar tendÃªncias nos indicadores");
    suggestions.push("âš ï¸ Listar Ã¡reas que precisam de atenÃ§Ã£o");
  }

  if (context.module === "releases") {
    suggestions.push("ðŸš€ Verificar status do Ãºltimo deploy");
    suggestions.push("ðŸ“¦ Analisar testes pendentes para release");
    suggestions.push("ðŸ“‹ Gerar relatÃ³rio de qualidade da versÃ£o");
  }

  if (context.module === "company") {
    if (isEmpresaUser(user)) {
      suggestions.push("ðŸ¢ Resumir status atual da minha empresa");
      suggestions.push("ðŸ› Listar defeitos e bugs ativos no projeto");
      suggestions.push("ðŸ“Š Ver mÃ©tricas de qualidade dos testes");
      suggestions.push("ðŸš€ Checar status dos planos de release");
    } else {
      suggestions.push("ðŸ¢ Resumir perfil da empresa");
      suggestions.push("ðŸ“Š Analisar mÃ©tricas de atendimento do cliente");
      suggestions.push("ðŸ“‹ Listar integraÃ§Ãµes ativas");
      suggestions.push("ðŸ‘¥ Ver usuÃ¡rios vinculados Ã  empresa");
    }
  }

  // SugestÃµes genÃ©ricas se nÃ£o hÃ¡ contexto especÃ­fico
  if (!suggestions.length) {
    suggestions.push("ðŸ“ Mostrar o contexto atual da tela");
    suggestions.push("ðŸ” Buscar registros no seu escopo de acesso");
    suggestions.push("ðŸ” Explicar permissÃµes da tela atual");
    suggestions.push("ðŸ’¡ O que posso fazer por vocÃª?");
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
    summary: "prÃ³ximos passos sugeridos com contexto inteligente",
    actions: mainSuggestions.map((prompt) => ({ 
      kind: "prompt", 
      label: prompt.replace(/^[^\s]+\s/, ""), // Remove emoji for clean label
      prompt: prompt.replace(/^[^\s]+\s/, ""), 
    })),
    reply: replyText,
  };
}

