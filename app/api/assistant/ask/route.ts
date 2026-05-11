import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { hasPermissionAccess } from "@/lib/permissionMatrix";
import { InternalBrainEngine } from "@/lib/brain/internalEngine";
import { logAgentExecution } from "@/lib/brain/orchestrator";
import { detectAgentMode, AGENT_REGISTRY } from "@/lib/brain/agents";
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
  agentMode?: string | null;
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
      agentMode: args.agentMode ?? args.brainContext?.agentMode ?? null,
      nodeId: args.brainContext?.nodeId ?? null,
    };

    if (userInput) {
      await prisma.brainMemory.create({
        data: {
          title: compactText(`Pergunta: ${userInput}`, 120),
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
          title: compactText(`Resposta: ${assistantReply}`, 120),
          summary: assistantReply,
          memoryType: "CONTEXT",
          importance: 2,
          sourceType: "CONVERSATION",
          sourceId: args.authUser.id ?? "anonymous",
          status: "ACTIVE",
          metadata: { ...commonMetadata, role: "assistant" },
        },
      });
    }
  } catch {
    // aprendizado nÃ£o pode quebrar o chat
  }
}

function buildMessagesFromHistory(body: AssistantRequestBody): Array<{ role: "user" | "assistant"; content: string }> {
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

  if (directMessages.length > 0) return directMessages;

  const currentMessage = typeof body.message === "string" ? body.message.trim() : "";
  return currentMessage
    ? [...historyMessages, { role: "user" as const, content: currentMessage }]
    : historyMessages;
}

/**
 * AÃ§Ãµes estruturadas (create_ticket, create_comment, create_test_case) precisam passar pelo service.ts
 * porque dependem de lÃ³gica de RBAC e validaÃ§Ã£o. Tudo mais vai direto para o engine.
 */
function isStructuredToolAction(body: AssistantRequestBody) {
  return (
    body.action?.kind === "tool" &&
    (body.action.tool === "create_ticket" || body.action.tool === "create_comment" || body.action.tool === "create_test_case")
  );
}

function resolveCompanySlug(body: AssistantRequestBody, authUser: { companySlug?: string | null }): string | null {
  const fromActor = body.actor?.companySlug ?? body.actor?.companySlugs?.[0] ?? null;
  return fromActor ?? authUser.companySlug ?? body.brainContext?.companySlug ?? null;
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

    // â”€â”€â”€ AÃ§Ãµes estruturadas: create_ticket, create_comment, create_test_case â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (isStructuredToolAction(body)) {
      const { runAssistantRequest } = await import("@/lib/assistant/service");
      const response = await runAssistantRequest(authUser, {
        message: body.message,
        context: body.context ?? null,
        actor: body.actor ?? null,
        action: body.action ?? null,
        history: body.history ?? null,
        brainContext: brainContext ?? null,
      } as Parameters<typeof runAssistantRequest>[1]);

      await persistConversationMemory({
        body, authUser,
        reply: String(response.reply ?? ""),
        tool: response.tool,
        agentMode: null,
        brainContext,
      });

      return NextResponse.json(response);
    }

    const shouldUseBrain = Boolean(
      brainContext?.source === "brain" ||
      brainContext?.nodeId ||
      brainContext?.agentMode,
    );

    if (!shouldUseBrain) {
      const { runAssistantRequest } = await import("@/lib/assistant/service");
      const response = await runAssistantRequest(authUser, {
        message: body.message,
        context: body.context ?? null,
        actor: body.actor ?? null,
        action: body.action ?? null,
        history: body.history ?? null,
        brainContext,
      } as Parameters<typeof runAssistantRequest>[1]);

      await persistConversationMemory({
        body, authUser,
        reply: String(response.reply ?? ""),
        tool: response.tool,
        agentMode: null,
        brainContext,
      });

      return NextResponse.json(response);
    }

    // â”€â”€â”€ Fluxo principal: InternalBrainEngine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const messages = buildMessagesFromHistory(body);
    const lastUserContent = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";

    if (!lastUserContent.trim()) {
      return NextResponse.json({ error: "Mensagem obrigatória" }, { status: 400 });
    }

    const companySlug = resolveCompanySlug(body, authUser);

    // Detecta agente: usa o do brainContext se explÃ­cito, senÃ£o detecta pela mensagem
    const agentMode: AgentMode =
      (brainContext?.agentMode as AgentMode | undefined) ??
      detectAgentMode(lastUserContent);

    const agent = AGENT_REGISTRY?.[agentMode] ?? {
      name: agentMode,
      icon: "🧠",
      label: "Agente Brain",
      color: "#5b92ff",
    };
    const startedAt = Date.now();

    const engine = new InternalBrainEngine();
    const events = engine.run({
      messages,
      nodeId: brainContext?.nodeId ?? null,
      agentMode,
      companySlug,
      route: body.context?.route ?? brainContext?.route ?? null,
      screenLabel: brainContext?.entityType ?? brainContext?.source ?? null,
      userId: authUser.id ?? null,
      actorName: authUser.user ?? authUser.email ?? null,
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
      nodeId: brainContext?.nodeId ?? null,
      messageCount: messages.length,
      toolsUsed: lastToolName ? [lastToolName] : [],
      success,
    });

    const finalReply = replyText || (success ? "Análise concluída." : "Não foi possível processar sua pergunta.");

    await persistConversationMemory({
      body, authUser,
      reply: finalReply,
      tool: lastToolName ?? agentMode,
      agentMode,
      brainContext,
    });

    return NextResponse.json({
      reply: finalReply,
      tool: "use_brain",
      actions: [],
      context: null,
      meta: {
        agentMode,
        agentName: agent.name,
        agentIcon: agent.icon,
        agentLabel: agent.label,
        agentColor: agent.color,
        nodeId: brainContext?.nodeId ?? null,
        source: brainContext?.source ?? "chat",
        durationMs: Date.now() - startedAt,
      },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("[assistant/ask] error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
