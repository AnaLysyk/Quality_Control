import "server-only";

import type { Prisma } from "@prisma/client";
import {
  getGraphMetrics,
  getNodeWithContext,
  getRelatedMemories,
} from "@/lib/brain";
import { AGENT_REGISTRY, detectAgentMode } from "@/lib/brain/agents";
import type { AgentMode } from "@/lib/brain/agents";
import { prisma } from "@/database/prismaClient";

export type OrchestratorInput = {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  agentMode?: AgentMode | null;
  nodeId?: string | null;
  companySlug?: string | null;
  route?: string | null;
  screenLabel?: string | null;
};

export type OrchestratorContext = {
  agentMode: AgentMode;
  agent: (typeof AGENT_REGISTRY)[AgentMode];
  systemPrompt: string;
  metricsText: string;
  nodeContext: string;
};

/**
 * BrainOrchestrator: monta contexto completo para o agente IA.
 * 1. Detecta ou confirma o agente certo para a pergunta
 * 2. Busca métricas do grafo
 * 3. Busca contexto do nó selecionado (se houver)
 * 4. Busca contexto da empresa (se houver)
 * 5. Constrói system prompt personalizado
 */
export async function buildOrchestratorContext(
  input: OrchestratorInput,
): Promise<OrchestratorContext> {
  const lastUserMessage =
    [...input.messages].reverse().find((m) => m.role === "user")?.content ?? "";

  // 1. Detectar agente — usa o informado ou detecta automaticamente
  const agentMode: AgentMode =
    input.agentMode && AGENT_REGISTRY[input.agentMode]
      ? input.agentMode
      : detectAgentMode(lastUserMessage);

  const agent = AGENT_REGISTRY[agentMode];

  // 2. Métricas do grafo
  const metrics = await getGraphMetrics();
  const metricsText = [
    `- Nós: ${metrics.nodeCount} | Conexões: ${metrics.edgeCount} | Memórias: ${metrics.memoryCount}`,
    `- Grau médio: ${metrics.averageDegree} | Densidade: ${metrics.density?.toFixed(4) ?? "n/a"}`,
    `- Nós órfãos: ${metrics.orphanedNodes ?? 0}`,
  ].join("\n");

  // 3. Contexto do nó selecionado
  let nodeContext = "";
  if (input.nodeId) {
    try {
      const ctx = await getNodeWithContext(input.nodeId);
      if (ctx?.node) {
        const memories = await getRelatedMemories(input.nodeId, 2);
        const neighborLabels = ctx.neighbors
          .slice(0, 8)
          .map((n: { label: string }) => n.label)
          .join(", ");
        nodeContext = [
          `\n## Nó em foco: "${ctx.node.label}" (${ctx.node.type})`,
          ctx.node.description ?? "",
          neighborLabels ? `Vizinhos: ${neighborLabels}` : "",
          memories.length > 0
            ? `Memórias:\n${memories
                .slice(0, 4)
                .map(
                  (m: { memoryType: string; title: string; summary: string }) =>
                    `- [${m.memoryType}] ${m.title}: ${m.summary}`,
                )
                .join("\n")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");
      }
    } catch {
      // contexto do nó é opcional — não bloqueia
    }
  }

  // 4. Contexto da empresa (se não veio nodeId mas veio companySlug)
  if (!nodeContext && input.companySlug) {
    try {
      const company = await prisma.company.findFirst({
        where: {
          OR: [{ slug: input.companySlug }, { id: input.companySlug }],
        },
        select: { id: true, name: true },
      });
      if (company) {
        const companyNode = await prisma.brainNode.findFirst({
          where: { refType: "Company", refId: company.id },
        });
        if (companyNode) {
          const memories = await getRelatedMemories(companyNode.id, 1);
          nodeContext = [
            `\n## Contexto da empresa: ${company.name}`,
            memories.length > 0
              ? memories
                  .slice(0, 3)
                  .map(
                    (m: { memoryType: string; title: string; summary: string }) =>
                      `- [${m.memoryType}] ${m.title}: ${m.summary}`,
                  )
                  .join("\n")
              : "",
          ]
            .filter(Boolean)
            .join("\n");
        }
      }
    } catch {
      // opcional
    }
  }

  // 5. Contexto da tela/rota atual
  const screenInfo =
    input.screenLabel || input.route
      ? `\n## Tela atual: ${input.screenLabel ?? input.route}`
      : "";

  const systemPrompt = agent.buildSystemPrompt(
    metricsText,
    nodeContext + screenInfo,
  );

  return { agentMode, agent, systemPrompt, metricsText, nodeContext };
}

/**
 * Registra execução do agente no BrainAuditLog.
 */
export async function logAgentExecution(opts: {
  agentMode: AgentMode;
  userId: string;
  nodeId?: string | null;
  messageCount: number;
  toolsUsed?: string[];
  success: boolean;
}) {
  try {
    await prisma.brainAuditLog.create({
      data: {
        action: "AGENT_QUERY",
        entityType: "Agent",
        entityId: opts.nodeId ?? opts.agentMode,
        userId: opts.userId,
        reason: opts.success ? "success" : "failed",
        after: {
          agentMode: opts.agentMode,
          messageCount: opts.messageCount,
          toolsUsed: opts.toolsUsed ?? [],
          success: opts.success,
        } as Prisma.InputJsonValue,
      },
    });
  } catch {
    // log é best-effort — não bloqueia resposta
  }
}

