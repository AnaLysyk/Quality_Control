import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { hasPermissionAccess } from "@/lib/permissionMatrix";
import { InternalBrainEngine } from "@/lib/brain/internalEngine";
import { logAgentExecution } from "@/lib/brain/orchestrator";
import { detectAgentMode } from "@/lib/brain/agents";
import type { AgentMode } from "@/lib/brain/agents";
import type { AssistantOpenEventDetail } from "@/lib/assistant/types";

export const runtime = "nodejs";

const ASSISTANT_ENABLED = process.env.NEXT_PUBLIC_AI_ASSISTANT_ENABLED !== "false";

type AssistantRequestBody = {
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  message?: string;
  history?: Array<{ from: string; text: string }>;
  brainContext?: AssistantOpenEventDetail | null;
};

function buildMessagesFromHistory(body: AssistantRequestBody) {
  const historyMessages = Array.isArray(body.history)
    ? body.history
        .slice(-12)
        .map((item) => ({
          role: item?.from === "assistant" ? ("assistant" as const) : ("user" as const),
          content: String(item?.text ?? "").trim(),
        }))
        .filter((item) => item.content)
    : [];

  const directMessages = Array.isArray(body.messages)
    ? body.messages
        .map((item) => ({
          role: item?.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: String(item?.content ?? "").trim(),
        }))
        .filter((item) => item.content)
    : [];

  // Prefer explicit messages payload when provided; otherwise rebuild from history + current message.
  if (directMessages.length > 0) return directMessages;

  const currentMessage = typeof body.message === "string" ? body.message.trim() : "";
  return currentMessage
    ? [...historyMessages, { role: "user" as const, content: currentMessage }]
    : historyMessages;
}

export async function POST(req: Request) {
  if (!ASSISTANT_ENABLED) {
    return NextResponse.json({ error: "Assistente desativado" }, { status: 410 });
  }

  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (
    !hasPermissionAccess(authUser.permissions, "ai", "view") ||
    !hasPermissionAccess(authUser.permissions, "ai", "use")
  ) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as AssistantRequestBody;
    const brainContext = body.brainContext ?? null;
    const hasBrainContext = Boolean(
      brainContext &&
        (brainContext.nodeId || brainContext.agentMode || brainContext.source === "brain"),
    );

    if (hasBrainContext) {
      const messages = buildMessagesFromHistory(body);

      if (!messages.length) {
        return NextResponse.json({ error: "Mensagem obrigatória" }, { status: 400 });
      }

      const agentMode: AgentMode =
        (brainContext!.agentMode as AgentMode | undefined) ??
        detectAgentMode(messages[messages.length - 1]?.content ?? "");
      const startedAt = Date.now();
      const engine = new InternalBrainEngine();
      const events = engine.run({
        messages,
        nodeId: brainContext!.nodeId,
        agentMode,
        companySlug: brainContext!.companySlug,
        route: brainContext!.route,
        screenLabel: brainContext!.entityType ?? brainContext!.source,
      });

      let replyText = "";
      let lastToolName: string | null = null;
      let success = true;

      for await (const event of events) {
        if (event.type === "text-delta") {
          replyText += event.text;
        } else if (event.type === "tool-input-start") {
          lastToolName = event.toolName;
        } else if (event.type === "error") {
          success = false;
          replyText = replyText || `Erro do agente: ${event.error}`;
        }
      }

      void logAgentExecution({
        agentMode,
        userId: authUser.id ?? "unknown",
        nodeId: brainContext!.nodeId,
        messageCount: messages.length,
        toolsUsed: lastToolName ? [lastToolName] : [],
        success,
      });

      return NextResponse.json({
        reply: replyText || (success ? "Análise concluída." : "Não foi possível obter resposta."),
        tool: lastToolName,
        actions: [],
        context: null,
        meta: {
          agentMode,
          source: brainContext!.source,
          nodeId: brainContext!.nodeId,
          durationMs: Date.now() - startedAt,
        },
      });
    }

    const { runAssistantRequest } = await import("@/lib/assistant/service");
    const response = await runAssistantRequest(authUser, {
      message: body.message,
      messages: body.messages,
      history: body.history,
    } as Parameters<typeof runAssistantRequest>[1]);

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("[assistant/ask] error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
