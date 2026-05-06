import "server-only";

import type { AuthUser } from "@/lib/jwtAuth";
import { hasPermissionAccess } from "@/lib/permissionMatrix";
import { prisma } from "@/lib/prismaClient";
import type { AssistantScreenContext, AssistantConversationTurn } from "../types";
import { isEmpresaUser } from "../data";
import type { AssistantExecutorResult } from "./types";

export async function toolSuggestNextStep(
  user: AuthUser,
  context: AssistantScreenContext,
  history: AssistantConversationTurn[] = [],
): Promise<AssistantExecutorResult> {
  const suggestions: string[] = [];

  // Detecta continuidade temática para manter conversa natural.
  const lastFewTurns = history.slice(-3);
  const recentTopics = lastFewTurns
    .map((turn) => String(turn?.text ?? "").toLowerCase())
    .join(" ");

  const memoryHints: string[] = [];
  try {
    const relevantMemories = await prisma.brainMemory.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ memoryType: "RULE" }, { memoryType: "PATTERN" }, { memoryType: "DECISION" }],
      },
      orderBy: { importance: "desc" },
      take: 2,
      select: { title: true, memoryType: true },
    });

    for (const memory of relevantMemories) {
      if (memory.memoryType === "PATTERN") {
        memoryHints.push(`- ${memory.title}`);
      }
    }
  } catch {
    // Brain enrichment é opcional.
  }

  if (context.module === "support") {
    suggestions.push("🔍 Buscar chamados por código, status, prioridade ou responsável");
    suggestions.push("📋 Resumir um ticket para triagem rápida");
    if (
      hasPermissionAccess(user.permissions, "tickets", "create") ||
      hasPermissionAccess(user.permissions, "support", "create")
    ) {
      suggestions.push("🎫 Criar chamado estruturado a partir do seu relato");
    }
    if (/coment|respond/.test(recentTopics)) {
      suggestions.unshift("💬 Continuar revisão dos comentários e próximos passos do chamado");
    }
  }

  if (context.module === "permissions") {
    suggestions.push("🔐 Explicar por que um perfil não acessa um módulo");
    suggestions.push("📊 Comparar escopos entre perfis");
    suggestions.push("⚙️ Sugerir ajuste de acesso com menor risco");
  }

  if (context.module === "test_plans") {
    suggestions.push("🧪 Gerar caso de teste baseado no bug atual");
    suggestions.push("📝 Estruturar pré-condições, passos e resultado esperado");
    suggestions.push("✅ Revisar cobertura de teste do fluxo");
  }

  if (context.module === "dashboard") {
    suggestions.push("📈 Ler indicadores e apontar onde atacar primeiro");
    suggestions.push("🎯 Comparar tendência com período anterior");
    suggestions.push("⚠️ Listar riscos operacionais que merecem ação imediata");
  }

  if (context.module === "releases") {
    suggestions.push("🚀 Verificar status de release e bloqueios");
    suggestions.push("📦 Revisar pendências de teste antes do deploy");
    suggestions.push("📋 Montar resumo executivo da versão");
  }

  if (context.module === "company") {
    if (isEmpresaUser(user)) {
      suggestions.push("🏢 Resumir situação atual da empresa");
      suggestions.push("🐛 Listar defeitos críticos em aberto");
      suggestions.push("📊 Mostrar métrica de qualidade mais sensível agora");
    } else {
      suggestions.push("🏢 Resumir empresa e vínculos ativos");
      suggestions.push("👥 Listar usuários e perfis da empresa");
      suggestions.push("🔗 Mapear integrações ativas e impacto operacional");
    }
  }

  if (!suggestions.length) {
    suggestions.push("📍 Ler contexto da tela atual");
    suggestions.push("🔍 Buscar informação operacional no seu escopo");
    suggestions.push("🔐 Explicar por que algo está bloqueado para seu perfil");
  }

  const mainSuggestions = suggestions.slice(0, 3);
  const hintsBlock = memoryHints.length
    ? `\n\nNo histórico da TC, vale considerar:\n${memoryHints.join("\n")}`
    : "";

  const reply = [
    `Fechou. No fluxo de **${context.module}**, eu toco isso com você sem sair do contexto da TC.`,
    "",
    "Podemos seguir por aqui:",
    ...mainSuggestions.map((item) => `- ${item}`),
    hintsBlock,
    "",
    "Me fala qual caminho você quer agora e eu já executo o próximo passo.",
  ]
    .join("\n")
    .trim();

  return {
    tool: "suggest_next_step",
    success: true,
    summary: "próximos passos contextuais",
    actions: mainSuggestions.map((prompt) => ({
      kind: "prompt" as const,
      label: prompt.replace(/^[^\s]+\s/, ""),
      prompt: prompt.replace(/^[^\s]+\s/, ""),
    })),
    reply,
  };
}
