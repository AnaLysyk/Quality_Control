import { type NextRequest, NextResponse } from "next/server";

import { gateway } from "@ai-sdk/gateway";
import { streamText } from "ai";

import { getGraphMetrics, getNodeWithContext, getRelatedMemories } from "@/lib/brain";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export async function POST(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json(
      { error: status === 401 ? "Nao autorizado" : "Sem permissao" },
      { status },
    );
  }

  try {
    const body = await req.json();
    const { messages, nodeId } = body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      nodeId?: string | null;
    };

    if (!messages?.length) {
      return NextResponse.json({ error: "Mensagens obrigatorias" }, { status: 400 });
    }

    const metrics = await getGraphMetrics();

    let nodeContext = "";
    if (nodeId) {
      try {
        const ctx = await getNodeWithContext(nodeId);
        if (ctx?.node) {
          const memories = await getRelatedMemories(nodeId, 2);
          const neighborLabels = ctx.neighbors
            .slice(0, 8)
            .map((n: { label: string }) => n.label)
            .join(", ");

          nodeContext = [
            `\n## No em foco: "${ctx.node.label}" (tipo: ${ctx.node.type})`,
            ctx.node.description ? `Descricao: ${ctx.node.description}` : "",
            `Conexoes de entrada: ${ctx.incoming.length} | Saida: ${ctx.outgoing.length}`,
            neighborLabels ? `Vizinhos diretos: ${neighborLabels}` : "",
            memories.length > 0
              ? `\nMemorias associadas (${memories.length}):\n${memories
                  .slice(0, 6)
                  .map(
                    (m: { memoryType: string; title: string; summary: string; importance: number }) =>
                      `- [${m.memoryType} I${m.importance}] ${m.title}: ${m.summary}`,
                  )
                  .join("\n")}`
              : "Sem memorias associadas.",
          ]
            .filter(Boolean)
            .join("\n");
        }
      } catch {
        // node context is optional
      }
    }

    const systemPrompt = `Você é o **assistente neural da Testing Company** — empresa especialista em QA e qualidade de software.

## Identidade
- Empresa: Testing Company (plataforma de gestão de qualidade)
- Função: Auxiliar equipes de QA a entender o grafo de conhecimento, identificar riscos, padrões e oportunidades de melhoria
- Especialidade: Quality Assurance, testes de software, gestão de defeitos, releases, automações

## Estado atual do Brain
- Nós: ${metrics.nodeCount} | Conexões: ${metrics.edgeCount} | Memórias: ${metrics.memoryCount}
- Grau médio: ${metrics.averageDegree} | Densidade: ${metrics.density.toFixed(4)}
- Nós órfãos: ${metrics.orphanedNodes} | Ciclos detectados: ${metrics.cyclesDetected}
${nodeContext}

## Tipos de nós no sistema
- **Company**: clientes/empresas gerenciadas pela Testing Company
- **Application**: sistemas/apps de cada empresa
- **Ticket**: chamados de suporte abertos pelos clientes
- **Defect**: defeitos encontrados em testes (manuais ou via Qase/Jira)
- **Release**: releases de teste (integradas Qase/Jira ou manuais)
- **User**: membros da equipe e usuários das empresas
- **Integration**: integrações ativas (Qase, Jira, etc.)
- **Note**: notas capturadas durante o trabalho
- **TestRun**: execuções de teste registradas

## Como responder
- Use português do Brasil, seja direto e acionável
- Referencie nós, memórias e padrões do Brain quando relevante
- Identifique riscos, conexões não óbvias e inconsistências
- Para perguntas sobre QA, sugira estratégias baseadas no grafo
- Quando falar de empresas/clientes, use os dados do Brain (nós tipo Company)
- Formate com markdown quando ajudar na leitura
- Se não tiver dados suficientes no Brain, sugira executar um sync completo`;

    const result = streamText({
      model: gateway("anthropic/claude-haiku-4-5-20251001"),
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      maxTokens: 1024,
    });

    return result.toDataStream();
  } catch (error) {
    console.error("[brain/ask] POST error:", error);
    return NextResponse.json({ error: "Erro ao processar pergunta" }, { status: 500 });
  }
}
