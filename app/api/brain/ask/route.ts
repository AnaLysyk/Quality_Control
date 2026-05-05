import { type NextRequest, NextResponse } from "next/server";

import { gateway } from "@ai-sdk/gateway";
import { streamText, tool } from "ai";
import { z } from "zod";

import {
  getGraphMetrics,
  searchNodes,
  getNodeMemories,
  getSubgraph,
  getMostConnectedNodes,
} from "@/lib/brain";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { prisma } from "@/lib/prismaClient";

const AGENT_MODES = {
  qa: {
    name: "QA Analyst",
    icon: "🔍",
    system: (metrics: string, nodeCtx: string) =>
      `Você é o **QA Analyst Agent** da Testing Company — especialista em cobertura de testes, riscos de qualidade e análise de defeitos.

## Estado do Brain
${metrics}
${nodeCtx}

## Capacidades
Use as ferramentas disponíveis para:
- Buscar conhecimento no Brain (search_brain)
- Analisar cobertura de QA (analyze_coverage)
- Identificar padrões de defeitos (find_patterns)
- Gerar especificações de teste (generate_test_spec)

Seja direto, acionável e cite dados do Brain quando disponíveis. Use português.`,
  },
  debug: {
    name: "Debug Agent",
    icon: "🐛",
    system: (metrics: string, nodeCtx: string) =>
      `Você é o **Debug Agent** da Testing Company — especialista em diagnóstico de problemas, análise de causa raiz e rastreamento de defeitos no Brain.

## Estado do Brain
${metrics}
${nodeCtx}

Use search_brain e find_patterns para investigar. Foque em causa raiz, não sintomas. Use português.`,
  },
  playwright: {
    name: "Playwright Agent",
    icon: "🎭",
    system: (metrics: string, nodeCtx: string) =>
      `Você é o **Playwright Agent** da Testing Company — especialista em geração de testes automatizados, especificações Playwright e estratégias de automação.

## Estado do Brain
${metrics}
${nodeCtx}

Use generate_test_spec para criar specs. Use search_brain para entender o contexto. Siga as convenções do projeto (data-testid, mockAuth, etc.). Use português.`,
  },
  memory: {
    name: "Memory Agent",
    icon: "🧠",
    system: (metrics: string, nodeCtx: string) =>
      `Você é o **Memory Agent** da Testing Company — especialista em conhecimento acumulado, decisões de arquitetura e padrões históricos registrados no Brain.

## Estado do Brain
${metrics}
${nodeCtx}

Use search_brain e find_patterns para recuperar memórias relevantes. Correlacione decisões passadas com o contexto atual. Use português.`,
  },
};

const brainTools = {
  search_brain: tool({
    description:
      "Search the Brain knowledge graph for nodes and memories related to a query",
    parameters: z.object({
      query: z.string().describe("Search query"),
      limit: z.number().optional().describe("Max results (default 8)"),
    }),
    execute: async ({ query, limit = 8 }: { query: string; limit?: number }) => {
      const nodes = await searchNodes({ query, limit });
      const results = await Promise.all(
        nodes.slice(0, 5).map(async (node) => {
          const memories = await getNodeMemories(node.id);
          return {
            id: node.id,
            label: node.label,
            type: node.type,
            description: node.description ?? null,
            memories: memories.slice(0, 3).map((m) => ({
              type: m.memoryType,
              title: m.title,
              summary: m.summary,
            })),
          };
        }),
      );
      return { nodes: results, total: nodes.length };
    },
  }),

  get_metrics: tool({
    description: "Get current Brain graph metrics",
    parameters: z.object({}),
    execute: async () => {
      return await getGraphMetrics();
    },
  }),

  analyze_coverage: tool({
    description:
      "Analyze QA coverage, test runs and defect health for a company or globally",
    parameters: z.object({
      companySlug: z
        .string()
        .optional()
        .describe("Company slug to scope the analysis"),
    }),
    execute: async ({ companySlug }: { companySlug?: string }) => {
      if (companySlug) {
        const company = await prisma.company.findFirst({
          where: { OR: [{ slug: companySlug }, { id: companySlug }] },
          select: { id: true, name: true },
        });
        if (company) {
          const companyNode = await prisma.brainNode.findFirst({
            where: { refType: "Company", refId: company.id },
          });
          if (companyNode) {
            const subgraph = await getSubgraph(companyNode.id, 2);
            const defects = subgraph.nodes.filter((n) => n.type === "Defect");
            const runs = subgraph.nodes.filter((n) => n.type === "TestRun");
            const releases = subgraph.nodes.filter((n) => n.type === "Release");
            const apps = subgraph.nodes.filter((n) => n.type === "Application");
            return {
              company: company.name,
              applications: apps.length,
              activeDefects: defects.length,
              testRuns: runs.length,
              releases: releases.length,
              coverageScore:
                runs.length > 0
                  ? Math.min(
                      100,
                      Math.round((runs.length / Math.max(1, apps.length)) * 20),
                    )
                  : 0,
            };
          }
        }
      }
      const [defectCount, runCount, releaseCount, companyCount] =
        await Promise.all([
          prisma.brainNode.count({ where: { type: "Defect" } }),
          prisma.brainNode.count({ where: { type: "TestRun" } }),
          prisma.brainNode.count({ where: { type: "Release" } }),
          prisma.brainNode.count({ where: { type: "Company" } }),
        ]);
      return {
        companies: companyCount,
        activeDefects: defectCount,
        testRuns: runCount,
        releases: releaseCount,
      };
    },
  }),

  generate_test_spec: tool({
    description:
      "Generate a Playwright test specification for a feature or scenario",
    parameters: z.object({
      feature: z.string().describe("Feature name or description"),
      context: z.string().optional().describe("Additional context"),
      pageUrl: z.string().optional().describe("Target page URL path"),
    }),
    execute: async ({ feature, context, pageUrl = "/" }: { feature: string; context?: string; pageUrl?: string }) => {
      const slug = feature
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      return {
        specName: `${slug}.spec.ts`,
        template: `import { test, expect } from "@playwright/test";\nimport { mockAuth } from "./helpers/mockAuth";\n\ntest.describe("${feature}", () => {\n  test("should render correctly", async ({ page, context }) => {\n    await mockAuth(context, { role: "company", companies: ["DEMO"], clientSlug: "DEMO" });\n    await page.goto("${pageUrl}", { waitUntil: "domcontentloaded" });\n    // TODO: add assertions\n    await expect(page.getByRole("heading")).toBeVisible();\n  });\n\n  test("should handle user interaction", async ({ page, context }) => {\n    await mockAuth(context, { role: "company", companies: ["DEMO"], clientSlug: "DEMO" });\n    await page.goto("${pageUrl}", { waitUntil: "domcontentloaded" });\n    // TODO: test interactions\n  });\n});\n`,
        hints: [
          context ? `Contexto: ${context}` : "Adicione contexto específico da feature",
          "Use data-testid para seletores estáveis",
          "Use mockAuth para autenticação nos testes",
          "Adicione waitForFunction para aguardar hidratação do React se necessário",
        ],
      };
    },
  }),

  find_patterns: tool({
    description:
      "Find defect patterns, quality trends and high-importance memories in the Brain",
    parameters: z.object({
      focus: z
        .enum(["defects", "runs", "releases", "all"])
        .optional()
        .describe("Focus area"),
    }),
    execute: async ({ focus = "all" }) => {
      const hubNodes = await getMostConnectedNodes(5);
      const memories = await prisma.brainMemory.findMany({
        where: { status: "ACTIVE", importance: { gte: 7 } },
        orderBy: { importance: "desc" },
        take: 8,
        include: { node: { select: { label: true, type: true } } },
      });
      const patterns = memories.map((m) => ({
        type: m.memoryType,
        title: m.title,
        summary: m.summary,
        importance: m.importance,
        relatedTo: m.node?.label ?? null,
      }));
      return {
        hubNodes: hubNodes.slice(0, 5).map((n) => ({
          label: n.node.label,
          type: n.node.type,
        })),
        patterns,
        focus,
      };
    },
  }),
};

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
    const {
      messages,
      nodeId,
      agentMode = "qa",
    } = body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      nodeId?: string | null;
      agentMode?: keyof typeof AGENT_MODES;
    };

    if (!messages?.length) {
      return NextResponse.json({ error: "Mensagens obrigatorias" }, { status: 400 });
    }

    const mode = AGENT_MODES[agentMode] ?? AGENT_MODES.qa;
    const metrics = await getGraphMetrics();
    const metricsText = `- Nós: ${metrics.nodeCount} | Conexões: ${metrics.edgeCount} | Memórias: ${metrics.memoryCount}
- Grau médio: ${metrics.averageDegree} | Densidade: ${metrics.density.toFixed(4)}
- Nós órfãos: ${metrics.orphanedNodes}`;

    let nodeContext = "";
    if (nodeId) {
      try {
        const { getNodeWithContext, getRelatedMemories } = await import("@/lib/brain");
        const ctx = await getNodeWithContext(nodeId);
        if (ctx?.node) {
          const memories = await getRelatedMemories(nodeId, 2);
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
                  .map((m: { memoryType: string; title: string; summary: string }) => `- [${m.memoryType}] ${m.title}: ${m.summary}`)
                  .join("\n")}`
              : "",
          ]
            .filter(Boolean)
            .join("\n");
        }
      } catch {
        // node context optional
      }
    }

    const systemPrompt = mode.system(metricsText, nodeContext);

    const result = streamText({
      model: gateway("anthropic/claude-haiku-4-5-20251001"),
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      tools: brainTools,
      maxSteps: 5,
      maxTokens: 2048,
    });

    // Stream full event stream as NDJSON for the frontend to parse tool calls
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const part of result.fullStream) {
            const line = JSON.stringify(part) + "\n";
            controller.enqueue(encoder.encode(line));
          }
        } catch (err) {
          const errLine =
            JSON.stringify({ type: "error", error: String(err) }) + "\n";
          controller.enqueue(encoder.encode(errLine));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Agent-Mode": agentMode,
        "X-Agent-Name": mode.name,
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("[brain/ask] POST error:", error);
    return NextResponse.json({ error: "Erro ao processar agente" }, { status: 500 });
  }
}
