import { type NextRequest, NextResponse } from "next/server";

import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { logAgentExecution } from "@/lib/brain/orchestrator";
import { InternalBrainEngine } from "@/lib/brain/internalEngine";
import type { AgentMode } from "@/lib/brain/agents";

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
