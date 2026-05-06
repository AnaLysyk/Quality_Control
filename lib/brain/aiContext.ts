import "server-only";

import { prisma } from "@/lib/prismaClient";
import { getSubgraph, getNodeMemories, searchNodes } from "@/lib/brain";

/**
 * Gera contexto do Brain para alimentar o assistente de IA.
 * Busca informações relevantes do grafo para enriquecer as respostas.
 */
export async function buildBrainContextForAI(options: {
  companySlug?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  userQuery?: string;
}): Promise<string | null> {
  try {
    const parts: string[] = [];

    // 0. Se tem query do usuário, fazer busca semântica nos nós e memórias
    if (options.userQuery && options.userQuery.length > 3) {
      const queryTerms = options.userQuery.toLowerCase().split(/\s+/).filter(t => t.length > 2);
      
      if (queryTerms.length > 0) {
        // Buscar nós relevantes
        const relevantNodes = await searchNodes({
          query: options.userQuery,
          limit: 5,
        });

        if (relevantNodes.length > 0) {
          parts.push("## Conhecimento Relevante do Brain:");
          for (const node of relevantNodes) {
            parts.push(`- **${node.label}** (${node.type}): ${node.description || 'sem descrição'}`);
            
            // Buscar memórias deste nó
            const nodeMemories = await getNodeMemories(node.id);
            for (const mem of nodeMemories.slice(0, 2)) {
              parts.push(`  • [${mem.memoryType}] ${mem.title}`);
            }
          }
          parts.push("");
        }

        // Buscar memórias diretamente relacionadas à query
        const relevantMemories = await prisma.brainMemory.findMany({
          where: {
            status: "ACTIVE",
            OR: queryTerms.map(term => ({
              OR: [
                { title: { contains: term, mode: "insensitive" as const } },
                { summary: { contains: term, mode: "insensitive" as const } },
              ],
            })),
          },
          orderBy: { importance: "desc" },
          take: 5,
          include: {
            node: { select: { label: true, type: true } },
          },
        });

        if (relevantMemories.length > 0) {
          parts.push("### Aprendizados e Decisões:");
          for (const m of relevantMemories) {
            const nodeInfo = m.node ? ` (de ${m.node.label})` : "";
            parts.push(`- **[${m.memoryType}]** ${m.title}${nodeInfo}`);
            parts.push(`  ${m.summary}`);
          }
          parts.push("");
        }
      }
    }

    // 1. Se tem empresa, buscar contexto da empresa
    if (options.companySlug) {
      const company = await prisma.company.findFirst({
        where: {
          OR: [
            { slug: options.companySlug },
            { id: options.companySlug },
          ],
        },
        select: { id: true, name: true },
      });

      if (company) {
        const companyNode = await prisma.brainNode.findFirst({
          where: { refType: "Company", refId: company.id },
        });

        if (companyNode) {
          const subgraph = await getSubgraph(companyNode.id, 2);
          const memories = await getNodeMemories(companyNode.id);

          const apps = subgraph.nodes.filter((n) => n.type === "Application");
          const modules = subgraph.nodes.filter((n) => n.type === "Module");
          const defects = subgraph.nodes.filter((n) => n.type === "Defect");
          const tickets = subgraph.nodes.filter((n) => n.type === "Ticket");

          parts.push(`## Contexto da Empresa: ${company.name}`);
          if (apps.length) parts.push(`- **Aplicações:** ${apps.map((a) => a.label).join(", ")}`);
          if (modules.length) parts.push(`- **Módulos:** ${modules.map((m) => m.label).join(", ")}`);
          if (defects.length) parts.push(`- **Defeitos ativos:** ${defects.length}`);
          if (tickets.length) parts.push(`- **Tickets:** ${tickets.length}`);

          if (memories.length) {
            parts.push("\n### Memórias/Decisões da Empresa:");
            for (const m of memories.slice(0, 5)) {
              parts.push(`- **[${m.memoryType}]** ${m.title}: ${m.summary}`);
            }
          }
          parts.push("");
        }
      }
    }

    // 2. Se tem entidade específica, buscar seu contexto
    if (options.entityType && options.entityId) {
      const entityNode = await prisma.brainNode.findFirst({
        where: { refType: options.entityType, refId: options.entityId },
      });

      if (entityNode) {
        const subgraph = await getSubgraph(entityNode.id, 1);
        const memories = await getNodeMemories(entityNode.id);

        parts.push(`## Contexto de ${options.entityType}: ${entityNode.label}`);
        if (entityNode.description) parts.push(`**Descrição:** ${entityNode.description}`);

        const related = subgraph.nodes.filter((n) => n.id !== entityNode.id);
        if (related.length) {
          parts.push(`**Relacionados:** ${related.map((n) => `${n.label} (${n.type})`).join(", ")}`);
        }

        if (memories.length) {
          parts.push("**Memórias:**");
          for (const m of memories.slice(0, 3)) {
            parts.push(`- [${m.memoryType}] ${m.title}: ${m.summary}`);
          }
        }
        parts.push("");
      }
    }

    // 3. Estatísticas gerais do brain (resumidas)
    if (!options.companySlug && !options.entityId && parts.length === 0) {
      const [nodeCount, edgeCount, memoryCount] = await Promise.all([
        prisma.brainNode.count(),
        prisma.brainEdge.count(),
        prisma.brainMemory.count(),
      ]);

      if (nodeCount > 0) {
        parts.push(`## Brain Graph: ${nodeCount} nós, ${edgeCount} conexões, ${memoryCount} memórias`);

        // Buscar memórias mais importantes
        const topMemories = await prisma.brainMemory.findMany({
          where: { status: "ACTIVE" },
          orderBy: { importance: "desc" },
          take: 5,
          include: {
            node: { select: { label: true, type: true } },
          },
        });

        if (topMemories.length) {
          parts.push("### Conhecimento Prioritário:");
          for (const m of topMemories) {
            const nodeInfo = m.node ? ` (${m.node.type}: ${m.node.label})` : "";
            parts.push(`- **[${m.memoryType}]** ${m.title}${nodeInfo}`);
            parts.push(`  ${m.summary}`);
          }
        }
      }
    }

    const contextText = parts.join("\n");
    return contextText.length > 0 ? contextText : null;
  } catch (error) {
    console.error("[brainAIContext] Erro ao construir contexto:", error);
    return null;
  }
}
