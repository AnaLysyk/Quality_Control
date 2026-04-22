import "server-only";

import { prisma } from "@/lib/prismaClient";
import { getSubgraph, getNodeMemories, searchNodes } from "@/lib/brain";

function normalizeBrainText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function scoreBrainMatch(query: string, values: Array<string | null | undefined>) {
  const normalizedQuery = normalizeBrainText(query);
  if (!normalizedQuery) return 0;

  const haystack = normalizeBrainText(values.filter(Boolean).join(" "));
  if (!haystack) return 0;

  let score = haystack.includes(normalizedQuery) ? 12 : 0;
  for (const term of normalizedQuery.split(/\s+/)) {
    if (term.length < 2) continue;
    const occurrences = haystack.split(term).length - 1;
    if (occurrences > 0) {
      score += occurrences * (term.length >= 5 ? 3 : 1);
    }
  }
  return score;
}

/**
 * Gera contexto do Brain para alimentar o assistente de IA.
 * Busca informacoes relevantes do grafo para enriquecer as respostas.
 */
export async function buildBrainContextForAI(options: {
  companySlug?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  userQuery?: string;
}): Promise<string | null> {
  try {
    const parts: string[] = [];

    // 0. Se tem query do usuario, trazer o que mais pontua por relevancia
    if (options.userQuery && options.userQuery.length > 3) {
      const queryTerms = normalizeBrainText(options.userQuery).split(/\s+/).filter((term) => term.length > 2);
      const seenMemoryIds = new Set<string>();

      if (queryTerms.length > 0) {
        const candidateNodes = await searchNodes({
          query: options.userQuery,
          limit: 12,
        });
        const relevantNodes = candidateNodes
          .map((node) => ({
            node,
            score: scoreBrainMatch(options.userQuery ?? "", [node.label, node.description]),
          }))
          .filter((entry) => entry.score > 0)
          .sort((left, right) => right.score - left.score)
          .slice(0, 6);

        if (relevantNodes.length > 0) {
          parts.push("## Conhecimento Relevante do Brain:");
          for (const { node } of relevantNodes) {
            parts.push(`- **${node.label}** (${node.type}): ${node.description || "sem descricao"}`);

            const nodeMemories = (await getNodeMemories(node.id))
              .map((memory) => ({
                memory,
                score: scoreBrainMatch(options.userQuery ?? "", [memory.title, memory.summary]) + memory.importance * 2,
              }))
              .filter((entry) => entry.score > 0 && !seenMemoryIds.has(entry.memory.id))
              .sort((left, right) => right.score - left.score)
              .slice(0, 2);

            for (const { memory } of nodeMemories) {
              seenMemoryIds.add(memory.id);
              parts.push(`  - [${memory.memoryType}] ${memory.title}`);
            }
          }
          parts.push("");
        }

        const memoryCandidates = await prisma.brainMemory.findMany({
          where: {
            status: "ACTIVE",
            OR: queryTerms.map((term) => ({
              OR: [
                { title: { contains: term, mode: "insensitive" as const } },
                { summary: { contains: term, mode: "insensitive" as const } },
              ],
            })),
          },
          orderBy: { importance: "desc" },
          take: 12,
          include: {
            node: { select: { label: true, type: true } },
          },
        });
        const relevantMemories = memoryCandidates
          .map((memory) => ({
            memory,
            score:
              scoreBrainMatch(options.userQuery ?? "", [memory.title, memory.summary, memory.node?.label]) +
              memory.importance * 2,
          }))
          .filter((entry) => entry.score > 0 && !seenMemoryIds.has(entry.memory.id))
          .sort((left, right) => right.score - left.score)
          .slice(0, 6);

        if (relevantMemories.length > 0) {
          parts.push("### Aprendizados e Decisoes:");
          for (const { memory: m } of relevantMemories) {
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
          if (apps.length) parts.push(`- **Aplicacoes:** ${apps.map((a) => a.label).join(", ")}`);
          if (modules.length) parts.push(`- **Modulos:** ${modules.map((m) => m.label).join(", ")}`);
          if (defects.length) parts.push(`- **Defeitos ativos:** ${defects.length}`);
          if (tickets.length) parts.push(`- **Tickets:** ${tickets.length}`);

          if (memories.length) {
            parts.push("\n### Memorias/Decisoes da Empresa:");
            for (const m of memories.slice(0, 5)) {
              parts.push(`- **[${m.memoryType}]** ${m.title}: ${m.summary}`);
            }
          }
          parts.push("");
        }
      }
    }

    // 2. Se tem entidade especifica, buscar seu contexto
    if (options.entityType && options.entityId) {
      const entityNode = await prisma.brainNode.findFirst({
        where: { refType: options.entityType, refId: options.entityId },
      });

      if (entityNode) {
        const subgraph = await getSubgraph(entityNode.id, 1);
        const memories = await getNodeMemories(entityNode.id);

        parts.push(`## Contexto de ${options.entityType}: ${entityNode.label}`);
        if (entityNode.description) parts.push(`**Descricao:** ${entityNode.description}`);

        const related = subgraph.nodes.filter((n) => n.id !== entityNode.id);
        if (related.length) {
          parts.push(`**Relacionados:** ${related.map((n) => `${n.label} (${n.type})`).join(", ")}`);
        }

        if (memories.length) {
          parts.push("**Memorias:**");
          for (const m of memories.slice(0, 3)) {
            parts.push(`- [${m.memoryType}] ${m.title}: ${m.summary}`);
          }
        }
        parts.push("");
      }
    }

    // 3. Estatisticas gerais do brain (resumidas)
    if (!options.companySlug && !options.entityId && parts.length === 0) {
      const [nodeCount, edgeCount, memoryCount] = await Promise.all([
        prisma.brainNode.count(),
        prisma.brainEdge.count(),
        prisma.brainMemory.count(),
      ]);

      if (nodeCount > 0) {
        parts.push(`## Brain Graph: ${nodeCount} nos, ${edgeCount} conexoes, ${memoryCount} memorias`);

        // Buscar memorias mais importantes
        const topMemories = await prisma.brainMemory.findMany({
          where: { status: "ACTIVE" },
          orderBy: { importance: "desc" },
          take: 5,
          include: {
            node: { select: { label: true, type: true } },
          },
        });

        if (topMemories.length) {
          parts.push("### Conhecimento Prioritario:");
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

