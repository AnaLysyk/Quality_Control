import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { hasPermissionAccess } from "@/lib/permissionMatrix";
import { InternalBrainEngine } from "@/lib/brain/internalEngine";
import { logAgentExecution } from "@/lib/brain/orchestrator";
import { detectAgentMode } from "@/lib/brain/agents";
import type { AgentMode } from "@/lib/brain/agents";
import type { AssistantClientRequest, AssistantOpenEventDetail } from "@/lib/assistant/types";

export const runtime = "nodejs";

const ASSISTANT_ENABLED = process.env.NEXT_PUBLIC_AI_ASSISTANT_ENABLED !== "false";

type AssistantRequestBody = {
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  brainContext?: AssistantOpenEventDetail | null;
} & AssistantClientRequest;

function compactText(input: string, max = 500) {
  const normalized = String(input ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}...`;
}

function getLatestUserMessage(body: AssistantRequestBody) {
  const explicit = typeof body.message === "string" ? body.message.trim() : "";
  if (explicit) return explicit;

  const direct = Array.isArray(body.messages)
    ? [...body.messages]
        .reverse()
        .find((item) => item?.role === "user" && String(item?.content ?? "").trim())
    : null;
  if (direct?.content) return String(direct.content).trim();

  const fromHistory = Array.isArray(body.history)
    ? [...body.history]
        .reverse()
        .find((item) => item?.from !== "assistant" && String(item?.text ?? "").trim())
    : null;
  return fromHistory?.text ? String(fromHistory.text).trim() : "";
}

async function persistConversationMemory(args: {
  body: AssistantRequestBody;
  authUser: { id?: string | null; companySlug?: string | null };
  reply: string;
  tool?: string | null;
  brainContext?: AssistantOpenEventDetail | null;
}) {
  try {
    const { prisma } = await import("@/lib/prismaClient");
    const userInput = compactText(getLatestUserMessage(args.body), 1500);
    const assistantReply = compactText(args.reply, 1500);
    if (!userInput && !assistantReply) return;

    const route = args.body.context?.route ?? args.brainContext?.route ?? null;
    const commonMetadata = {
      userId: args.authUser.id ?? null,
      companySlug: args.authUser.companySlug ?? args.brainContext?.companySlug ?? null,
      route,
      source: "assistant.ask.route",
      tool: args.tool ?? null,
      agentMode: args.brainContext?.agentMode ?? null,
      nodeId: args.brainContext?.nodeId ?? null,
    };

    if (userInput) {
      await prisma.brainMemory.create({
        data: {
          title: compactText(`Pergunta do usuário: ${userInput}`, 120),
          summary: userInput,
          memoryType: "CONTEXT",
          importance: 1,
          sourceType: "CONVERSATION",
          sourceId: args.authUser.id ?? "anonymous",
          status: "ACTIVE",
          metadata: { ...commonMetadata, role: "user" },
        },
      });
    }

    if (assistantReply) {
      await prisma.brainMemory.create({
        data: {
          title: compactText(`Resposta do assistente: ${assistantReply}`, 120),
          summary: assistantReply,
          memoryType: "CONTEXT",
          importance: 1,
          sourceType: "CONVERSATION",
          sourceId: args.authUser.id ?? "anonymous",
          status: "ACTIVE",
          metadata: { ...commonMetadata, role: "assistant" },
        },
      });
    }
  } catch {
    // Learning persistence must not break chat responses.
  }
}

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

      await persistConversationMemory({
        body,
        authUser,
        reply: replyText || (success ? "Análise concluída." : "Não foi possível obter resposta."),
        tool: lastToolName,
        brainContext,
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
      context: body.context ?? null,
      actor: body.actor ?? null,
      action: body.action ?? null,
      history: body.history ?? null,
    } as Parameters<typeof runAssistantRequest>[1]);

    await persistConversationMemory({
      body,
      authUser,
      reply: String(response.reply ?? ""),
      tool: response.tool,
      brainContext,
    });

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("[assistant/ask] error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
