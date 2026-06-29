import { type NextRequest, NextResponse } from "next/server";

import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { logAgentExecution } from "@/lib/brain/orchestrator";
import { InternalBrainEngine } from "@/lib/brain/internalEngine";
import type { AgentMode } from "@/lib/brain/agents";
import { runAllGuardrails } from "@/lib/brain/guardrails";
import { buildMockBrainGraph } from "@/brain/_data/brainMockGraph";
import { normalizeBrainText } from "@/brain/_utils/brainGraphFormatters";
import { resolveBrainAccess } from "@/lib/brain/access";

function isE2eJsonMode() {
  return process.env.E2E_USE_JSON === "1" || process.env.E2E_USE_JSON === "true";
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
    const text = normalizeBrainText(lightweightBody.message);
    const moduleName = lightweightBody.activeContext?.module ?? null;
    const visibleNodes = graph.nodes.filter((node) => {
      if (accessResult.ok && !accessResult.context.hasGlobalVisibility && node.module === "Logs") return false;
      if (moduleName && node.module !== moduleName) return false;
      return true;
    });
    const pending = visibleNodes.filter((node) => ["pending", "missing", "warning", "error", "orphan"].includes(node.status));
    const selectedNode = graph.nodes.find((node) => node.id === lightweightBody.selectedNodeId) ?? null;

    if (/\borfaos?\b/.test(text)) {
      return NextResponse.json({
        reply: `Filtrei os nos orfaos do contexto. Encontrei ${graph.summary.orphanNodes} no(s) sem conexao suficiente.`,
        action: "show_orphans",
        filters: { onlyOrphans: true },
        suggestedActions: ["Mostrar pendencias", "Ver tudo que tenho acesso"],
        requiresConfirmation: false,
      });
    }

    if (/\bpendencias?\b|\bfalta mapear\b/.test(text)) {
      return NextResponse.json({
        reply: `No contexto ${moduleName ?? "geral"}, encontrei ${pending.length} pendencia(s). Principais pontos: ${graph.summary.pendingMappings.slice(0, 4).join("; ") || "sem pendencias criticas no fallback"}.`,
        action: "show_pending",
        filters: { onlyPending: true },
        suggestedActions: ["Explicar no selecionado", "Atualizar grafo"],
        requiresConfirmation: false,
      });
    }

    if (/\bexplica\b|\binformacao\b/.test(text) && selectedNode) {
      return NextResponse.json({
        reply: selectedNode.information ?? `${selectedNode.label} ainda precisa de mais conexoes para formar uma informacao completa.`,
        action: "explain_node",
        selectedNodeId: selectedNode.id,
        suggestedActions: ["Mostrar grafo local", "Expandir conexoes"],
        requiresConfirmation: false,
      });
    }

    if (/\bsolicitacoes?\b|\bacesso\b/.test(text)) {
      return NextResponse.json({
        reply: "Apliquei o recorte de Solicitacoes. Esse modulo mostra pedidos, solicitantes, perfis, status, logs, e-mails e decisoes quando permitidos pelo seu perfil.",
        action: "filter_context",
        filters: { module: "Solicitacoes" },
        suggestedActions: ["Mostrar pendencias desse projeto", "Abrir solicitacoes de acesso"],
        requiresConfirmation: false,
      });
    }

    return NextResponse.json({
      reply: `Oi. No Brain encontrei ${visibleNodes.length} nos e ${graph.edges.length} conexoes neste recorte. Existem ${pending.length} pendencia(s). Posso mostrar modulos, empresas, projetos, nos orfaos, pendencias, criado hoje ou explicar o no selecionado.`,
      action: "summarize_context",
      filters: lightweightBody.visibleFilters ?? {},
      suggestedActions: ["Mostrar pendencias", "Mostrar nos orfaos", "O que foi criado hoje"],
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

