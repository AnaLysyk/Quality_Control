import "server-only";

import type { AuthUser } from "@/backend/jwtAuth";
import { hasPermissionAccess } from "@/backend/permissionMatrix";
import { prisma } from "@/database/prismaClient";
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
export async function toolSuggestNextStep(
  user: AuthUser,
  context: AssistantScreenContext,
): Promise<AssistantExecutorResult> {
  const suggestions: string[] = [];
  const smartTips: string[] = [];

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

    for (const memory of relevantMemories) {
      if (memory.memoryType === "PATTERN") {
        smartTips.push(`💡 ${memory.title}`);
      }
    }
  } catch {
    // Brain optional
  }

  const isAccessRequestsContext = context.route.startsWith("/admin/access-requests");
  const isBrainContext =
    context.module === "brain" ||
    context.route.startsWith("/brain") ||
    context.route.startsWith("/admin/brain");

  if (isAccessRequestsContext) {
    suggestions.push(
      "🔎 Buscar uma pessoa na fila de solicitações",
      "🧭 Explicar o que falta para aprovar uma solicitação",
      "📝 Orientar quais campos devolver para ajuste",
      "📄 Abrir ou baixar o PDF da solicitação visível",
    );
  }

  if (isBrainContext) {
    suggestions.push(
      "🧠 Resumir o Brain e o que ele já sabe",
      "🕸️ Explicar relações do grafo de conhecimento",
      "🔎 Buscar contexto em memórias, telas e entidades",
      "➡️ Sugerir o próximo passo como agente",
    );
  }

  if (context.module === "support") {
    suggestions.push(
      "🔍 Buscar tickets de alta prioridade sem responsável",
      "📋 Resumir um chamado pelo ID para acelerar triagem",
    );
    if (
      hasPermissionAccess(user.permissions, "tickets", "create") ||
      hasPermissionAccess(user.permissions, "support", "create")
    ) {
      suggestions.push(
        "✏️ Transformar um relato em chamado estruturado",
        "🎫 Criar novo ticket a partir de descrição",
      );
    }
  }

  if (context.module === "permissions") {
    suggestions.push(
      "🔐 Explicar por que um perfil não vê um módulo",
      "📊 Listar ações disponíveis para o usuário analisado",
      "🔧 Analisar escopo de acesso atual",
    );
  }

  if (context.module === "test_plans") {
    suggestions.push(
      "🧪 Gerar caso de teste a partir do bug atual",
      "📝 Criar roteiro de teste estruturado",
      "✅ Validar cobertura de testes existente",
    );
  }

  if (context.module === "dashboard" && !isAccessRequestsContext && !isBrainContext) {
    suggestions.push(
      "📈 Analisar métricas de qualidade do período",
      "🎯 Identificar tendências nos indicadores",
      "⚠️ Listar áreas que precisam de atenção",
    );
  }

  if (context.module === "releases") {
    suggestions.push(
      "🚀 Verificar status do último deploy",
      "📦 Analisar testes pendentes para release",
      "📋 Gerar relatório de qualidade da versão",
    );
  }

  if (context.module === "company") {
    if (isEmpresaUser(user)) {
      suggestions.push(
        "🏢 Resumir status atual da minha empresa",
        "🐛 Listar defeitos e bugs ativos no projeto",
        "📊 Ver métricas de qualidade dos testes",
        "🚀 Checar status dos planos de release",
      );
    } else {
      suggestions.push(
        "🏢 Resumir perfil da empresa",
        "📊 Analisar métricas de atendimento do cliente",
        "📋 Listar integrações ativas",
        "👥 Ver usuários vinculados à empresa",
      );
    }
  }

  if (!suggestions.length) {
    suggestions.push(
      "📍 Mostrar o contexto atual da tela",
      "🔍 Buscar registros no seu escopo de acesso",
      "🔐 Explicar permissões da tela atual",
      "💡 O que posso fazer por você?",
    );
  }

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
    actions: mainSuggestions.map((prompt) => {
      const cleanPrompt = prompt.replace(/^[^\s]+\s/, "");
      return {
        kind: "prompt",
        label: cleanPrompt,
        prompt: cleanPrompt,
      };
    }),
    reply: replyText,
  };
}
