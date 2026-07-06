import { type NextRequest, NextResponse } from "next/server";

import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { logAgentExecution } from "@/lib/brain/orchestrator";
import { InternalBrainEngine } from "@/lib/brain/internalEngine";
import type { AgentMode } from "@/lib/brain/agents";
import { runAllGuardrails } from "@/lib/brain/guardrails";
import { buildMockBrainGraph } from "@/brain/_data/brainMockGraph";
import { normalizeBrainText } from "@/brain/_utils/brainGraphFormatters";
import { filterBrainDomainGraphByAccess, resolveBrainAccess } from "@/lib/brain/access";
import { answerBrainChatQuestion } from "@/lib/brain/chat";
import { formatWebSearchForBrain, searchBrainWeb, shouldUseWebSearch } from "@/lib/brain/webSearch";

function isE2eJsonMode() {
  return process.env.E2E_USE_JSON === "1" || process.env.E2E_USE_JSON === "true";
}

function normalizeForBrain(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function isSmallTalk(message: string) {
  return /^(oi|ola|bom dia|boa tarde|boa noite|tudo bem|valeu|obrigada|obrigado)[!.?\s]*$/.test(normalizeForBrain(message));
}

function shouldTryWebFallback(message: string, foundNodes: number) {
  if (shouldUseWebSearch(message)) return true;
  if (foundNodes > 0 || isSmallTalk(message)) return false;
  const text = normalizeForBrain(message);
  if (text.split(/\s+/).filter(Boolean).length < 3) return false;
  return /\b(quem|qual|quando|onde|como|porque|por que|o que|me explica|sabe|conhece)\b/.test(text);
}

function humanizeBrainReply(input: {
  message: string;
  baseReply: string;
  foundNodes: number;
  pendingCount: number;
  webContext: string | null;
  webEnabled: boolean;
}) {
  if (input.webContext) {
    const intro = input.webEnabled
      ? "Procurei primeiro no Brain. Como a pergunta dependia de informação externa ou atual, também consultei a internet."
      : "Procurei primeiro no Brain. Para completar com internet, ainda falta configurar a chave de busca do ambiente.";
    return `${intro}\n\n${input.webContext}`;
  }

  if (input.foundNodes > 0) {
    return input.baseReply
      .replace(/^Encontrei no Brain:/, "Encontrei isso no Brain para você:")
      .replace(/Modo QA ativado:/g, "Vou te apoiar em modo QA:");
  }

  if (isSmallTalk(input.message)) {
    return "Oi, Ana. Estou aqui. Me diga o que você quer fazer agora: investigar um erro, criar bug, montar caso de teste, revisar permissão ou consultar algo fora do Brain.";
  }

  return [
    "Ana, eu procurei no Brain, RAG e contexto permitido para o seu perfil, mas não achei uma base forte para responder com segurança.",
    input.pendingCount ? `Também vi ${input.pendingCount} pendência(s) de contexto interno que podem deixar a resposta incompleta.` : null,
    "Posso seguir por dois caminhos: você me dá mais contexto do sistema/projeto, ou eu uso busca na internet quando a pergunta for externa/atual e a chave de busca estiver configurada.",
  ].filter(Boolean).join("\n\n");
}

export async function POST(req: NextRequest) {
  const lightweightBody = (await req.clone().json().catch(() => ({}))) as {
    message?: string;
    selectedNodeId?: string | null;
    activeContext?: { module?: string | null };
    visibleFilters?: Record<string, unknown>;
  };

  if (typeof lightweightBody.message === "string") {
    const accessResult = await resolveBrainAccess(req);
    if (!accessResult.ok) {
      return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
    }
    const graph = buildMockBrainGraph();
    const visibleGraph = filterBrainDomainGraphByAccess(graph.nodes, graph.edges, accessResult.context);
    const text = normalizeBrainText(lightweightBody.message);
    const moduleName = lightweightBody.activeContext?.module ?? null;
    const visibleNodes = visibleGraph.nodes.filter((node) => {
      if (moduleName && node.module !== moduleName) return false;
      return true;
    });
    const connectedNodeIds = new Set(visibleGraph.edges.flatMap((edge) => [edge.source, edge.target]));
    const visibleOrphanCount = visibleNodes.filter((node) => !connectedNodeIds.has(node.id)).length;
    const pending = visibleNodes.filter((node) => ["pending", "missing", "warning", "error", "orphan"].includes(node.status));
    const pendingMappings = visibleNodes.flatMap((node) => node.missingKnowledge ?? []);
    const selectedNode = visibleNodes.find((node) => node.id === lightweightBody.selectedNodeId) ?? null;

    if (/\borfaos?\b/.test(text)) {
      return NextResponse.json({
        reply: `Filtrei os nós órfãos do contexto. Encontrei ${visibleOrphanCount} nó(s) sem conexão suficiente.`,
        action: "show_orphans",
        filters: { onlyOrphans: true },
        suggestedActions: ["Mostrar pendências", "Ver tudo que tenho acesso"],
        requiresConfirmation: false,
      });
    }

    if (/\bpendencias?\b|\bfalta mapear\b/.test(text)) {
      return NextResponse.json({
        reply: `No contexto ${moduleName ?? "geral"}, encontrei ${pending.length} pendência(s). Principais pontos: ${pendingMappings.slice(0, 4).join("; ") || "sem pendências críticas no fallback"}.`,
        action: "show_pending",
        filters: { onlyPending: true },
        suggestedActions: ["Explicar no selecionado", "Atualizar grafo"],
        requiresConfirmation: false,
      });
    }

    if (/\bexplica\b|\binformacao\b/.test(text) && selectedNode) {
      return NextResponse.json({
        reply: selectedNode.information ?? `${selectedNode.label} ainda precisa de mais conexões para formar uma informação completa.`,
        action: "explain_node",
        selectedNodeId: selectedNode.id,
        suggestedActions: ["Mostrar grafo local", "Expandir conexões"],
        requiresConfirmation: false,
      });
    }

    if (/\bsolicitacoes?\b|\bacesso\b/.test(text)) {
      return NextResponse.json({
        reply: "Apliquei o recorte de Solicitações. Esse módulo mostra pedidos, solicitantes, perfis, status, logs, e-mails e decisões quando permitidos pelo seu perfil.",
        action: "filter_context",
        filters: { module: "Solicitacoes" },
        suggestedActions: ["Mostrar pendências desse projeto", "Abrir solicitações de acesso"],
        requiresConfirmation: false,
      });
    }

    const brainAnswer = await answerBrainChatQuestion({
      message: lightweightBody.message,
      access: accessResult.context,
      currentBrainContext: selectedNode
        ? {
            lastNodeId: selectedNode.id,
            lastNodeType: selectedNode.type,
            lastCompanyId: selectedNode.companyId ?? null,
            lastProjectId: selectedNode.projectId ?? null,
            lastRoute: null,
            lastIntent: "inspect",
          }
        : null,
    });

    const needsWebSearch = shouldTryWebFallback(lightweightBody.message, brainAnswer.foundNodes.length);
    const webSearch = needsWebSearch ? await searchBrainWeb(lightweightBody.message).catch((error) => ({
      enabled: false,
      provider: "none" as const,
      query: lightweightBody.message ?? "",
      results: [],
      warning: `Busca web indisponível agora: ${String(error)}`,
    })) : null;
    const webContext = webSearch ? formatWebSearchForBrain(webSearch) : null;
    const fallbackReply = `Procurei no Brain e encontrei ${visibleNodes.length} nó(s), ${visibleGraph.edges.length} conexão(ões) e ${pending.length} pendência(s) neste recorte.`;
    const baseReply = brainAnswer.foundNodes.length ? brainAnswer.answer : fallbackReply;
    const reply = humanizeBrainReply({
      message: lightweightBody.message,
      baseReply,
      foundNodes: brainAnswer.foundNodes.length,
      pendingCount: pending.length,
      webContext,
      webEnabled: Boolean(webSearch?.enabled),
    });

    return NextResponse.json({
      reply,
      action: brainAnswer.navigation ? "navigate" : webSearch ? "web_search_context" : "summarize_context",
      navigation: brainAnswer.navigation ?? null,
      foundNodes: brainAnswer.foundNodes,
      webSearch,
      suggestedActions: brainAnswer.suggestedActions.map((action) => action.label).slice(0, 5),
      filters: lightweightBody.visibleFilters ?? {},
      requiresConfirmation: false,
    });
  }

  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json(
      { error: status === 401 ? "Nao autorizado" : "Sem permissao" },
      { status },
    );
  }

  if (isE2eJsonMode()) {
    const body = (await req.json().catch(() => ({}))) as {
      messages?: Array<{ role: "user" | "assistant"; content: string }>;
      agentMode?: AgentMode | null;
    };
    if (!body.messages?.length) {
      return NextResponse.json({ error: "Mensagens obrigatorias" }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(JSON.stringify({
          type: "text-delta",
          text: `Brain E2E respondeu em modo ${body.agentMode ?? "qa"} com contexto mockado e seguro.`,
        }) + "\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Agent-Mode": body.agentMode ?? "qa",
        "Cache-Control": "no-cache",
      },
    });
  }

  try {
    const body = await req.json();
    const { messages, nodeId, agentMode, companySlug, route, screenLabel } = body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      nodeId?: string | null;
      agentMode?: AgentMode | null;
      companySlug?: string | null;
      route?: string | null;
      screenLabel?: string | null;
    };

    if (!messages?.length) {
      return NextResponse.json({ error: "Mensagens obrigatorias" }, { status: 400 });
    }

    const lastUserMessage = [...messages].reverse().find((item) => item.role === "user")?.content ?? "";
    const guardrailResult = runAllGuardrails(lastUserMessage);
    if (!guardrailResult.allowed) {
      return NextResponse.json({
        error: guardrailResult.blocked?.reason ?? "Mensagem bloqueada por guardrails de segurança.",
        guardrail: guardrailResult.blocked?.guardrail ?? "unknown",
      }, { status: 400 });
    }

    const engine = new InternalBrainEngine();
    const events = engine.run({ messages, nodeId, agentMode, companySlug, route, screenLabel });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let success = true;
        try {
          for await (const event of events) {
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
            if (event.type === "error") success = false;
          }
        } catch (err) {
          success = false;
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: "error", error: String(err) }) + "\n"),
          );
        } finally {
          controller.close();
          void logAgentExecution({
            agentMode: (agentMode ?? "qa") as AgentMode,
            userId: (admin as { id?: string }).id ?? "unknown",
            nodeId,
            messageCount: messages.length,
            success,
          });
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Agent-Mode": agentMode ?? "qa",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("[brain/ask] POST error:", error);
    return NextResponse.json({ error: "Erro ao processar agente" }, { status: 500 });
  }
}
