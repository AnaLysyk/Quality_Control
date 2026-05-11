import { type NextRequest, NextResponse } from "next/server";

import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { logAgentExecution } from "@/lib/brain/orchestrator";
import { InternalBrainEngine } from "@/lib/brain/internalEngine";
import type { AgentMode } from "@/lib/brain/agents";
import { runAllGuardrails } from "@/lib/brain/guardrails";
import { getAiApiKey } from "@/lib/ai/apiKey";

function isE2eJsonMode() {
  return process.env.E2E_USE_JSON === "1" || process.env.E2E_USE_JSON === "true";
}

export async function POST(req: NextRequest) {
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

  if (!getAiApiKey()) {
    return NextResponse.json(
      { error: "AI API key não configurada. Defina OPENAI_API_KEY (recomendado) ou AI_API_KEY no ambiente." },
      { status: 503 },
    );
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
