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
        smartTips.push(`💡 ${mem.title}`);
      }
    }
  } catch {
    // Brain optional
  }

  // Sugestões contextuais por módulo
  if (context.module === "support") {
    suggestions.push("🔍 Buscar tickets de alta prioridade sem responsável");
    suggestions.push("📋 Resumir um chamado pelo ID para acelerar triagem");
    if (hasPermissionAccess(user.permissions, "tickets", "create") || hasPermissionAccess(user.permissions, "support", "create")) {
      suggestions.push("✏️ Transformar um relato em chamado estruturado");
      suggestions.push("🎫 Criar novo ticket a partir de descrição");
    }
  }

  if (context.module === "permissions") {
    suggestions.push("🔐 Explicar por que um perfil não vê um módulo");
    suggestions.push("📊 Listar ações disponíveis para o usuário analisado");
    suggestions.push("🔧 Analisar escopo de acesso atual");
  }

  if (context.module === "test_plans") {
    suggestions.push("🧪 Gerar caso de teste a partir do bug atual");
    suggestions.push("📝 Criar roteiro de teste estruturado");
    suggestions.push("✅ Validar cobertura de testes existente");
  }

  if (context.module === "dashboard") {
    suggestions.push("📈 Analisar métricas de qualidade do período");
    suggestions.push("🎯 Identificar tendências nos indicadores");
    suggestions.push("⚠️ Listar áreas que precisam de atenção");
  }

  if (context.module === "releases") {
    suggestions.push("🚀 Verificar status do último deploy");
    suggestions.push("📦 Analisar testes pendentes para release");
    suggestions.push("📋 Gerar relatório de qualidade da versão");
  }

  if (context.module === "company") {
    if (isEmpresaUser(user)) {
      suggestions.push("🏢 Resumir status atual da minha empresa");
      suggestions.push("🐛 Listar defeitos e bugs ativos no projeto");
      suggestions.push("📊 Ver métricas de qualidade dos testes");
      suggestions.push("🚀 Checar status dos planos de release");
    } else {
      suggestions.push("🏢 Resumir perfil da empresa");
      suggestions.push("📊 Analisar métricas de atendimento do cliente");
      suggestions.push("📋 Listar integrações ativas");
      suggestions.push("👥 Ver usuários vinculados à empresa");
    }
  }

  // Sugestões genéricas se não há contexto específico
  if (!suggestions.length) {
    suggestions.push("📍 Mostrar o contexto atual da tela");
    suggestions.push("🔍 Buscar registros no seu escopo de acesso");
    suggestions.push("🔐 Explicar permissões da tela atual");
    suggestions.push("💡 O que posso fazer por você?");
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
