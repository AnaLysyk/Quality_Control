import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { InternalBrainEngine } from "@/lib/brain/internalEngine";
import { logAgentExecution } from "@/lib/brain/orchestrator";
import { detectAgentMode, AGENT_REGISTRY } from "@/lib/brain/agents";
import { buildBrainAccessContextFromAuthUser } from "@/lib/brain/access";
import { answerBrainChatQuestion } from "@/lib/brain/chat";
import { hasPermissionAccess } from "@/lib/permissionMatrix";
import { buildWebSupportContext, shouldUseWebSupport } from "@/lib/assistant/webSupport";
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

function compactJson(value: unknown, max = 5000) {
  if (!value || typeof value !== "object") return "";
  try {
    return compactText(JSON.stringify(value), max);
  } catch {
    return "";
  }
}

function getLatestUserMessage(body: AssistantRequestBody) {
  const explicit = typeof body.message === "string" ? body.message.trim() : "";
  if (explicit) return explicit;

  const direct = Array.isArray(body.messages)
    ? [...body.messages].reverse().find((item) => item?.role === "user" && String(item?.content ?? "").trim())
    : null;
  if (direct?.content) return String(direct.content).trim();

  const fromHistory = Array.isArray(body.history)
    ? [...body.history].reverse().find((item) => item?.from !== "assistant" && String(item?.text ?? "").trim())
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
    // aprendizado não pode quebrar o chat
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
  return currentMessage ? [...historyMessages, { role: "user" as const, content: currentMessage }] : historyMessages;
}

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

function shouldAnswerFromBrain(message: string) {
  return /\b(empresa|projeto|tela|rota|permiss|perfil|run|execu[cç][aã]o|defeito|bug|usuario|usu[aá]rio|qase|kase|jira|operacional|brain|brian|n[oó]|dashboard|painel)\b/i.test(message);
}

function shouldUseBrainFirstContext(brainContext: AssistantOpenEventDetail | null) {
  return Boolean(brainContext?.source === "brain" || brainContext?.nodeId || brainContext?.agentMode);
}

function appendContextToLastUserMessage(messages: Array<{ role: "user" | "assistant"; content: string }>, title: string, context: string) {
  if (!context.trim()) return messages;
  let lastUserIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      lastUserIndex = index;
      break;
    }
  }
  if (lastUserIndex < 0) return messages;
  messages[lastUserIndex] = {
    ...messages[lastUserIndex],
    content: [messages[lastUserIndex].content, "", "---", `[${title}]`, context].join("\n"),
  };
  return messages;
}

export async function POST(req: Request) {
  if (!ASSISTANT_ENABLED) {
    return NextResponse.json({ error: "Assistente desativado" }, { status: 410 });
  }

  const authUser = await authenticateRequest(req);
  if (authUser && (!hasPermissionAccess(authUser.permissions, "ai", "view") || !hasPermissionAccess(authUser.permissions, "ai", "use"))) {
    return NextResponse.json({ error: "Sem permissao para usar o assistente" }, { status: 403 });
  }
  if (!authUser) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as AssistantRequestBody;
    const brainContext = body.brainContext ?? null;

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
        body,
        authUser,
        reply: String(response.reply ?? ""),
        tool: response.tool,
        agentMode: null,
        brainContext,
      });

      return NextResponse.json(response);
    }

    const messages = buildMessagesFromHistory(body);
    const latestUserMessage = messages.filter((message) => message.role === "user").at(-1)?.content ?? "";
    if (shouldAnswerFromBrain(latestUserMessage)) {
      const brainAccess = await buildBrainAccessContextFromAuthUser(authUser);
      if (brainAccess) {
        const brainAnswer = await answerBrainChatQuestion({
          message: latestUserMessage,
          access: brainAccess,
          currentBrainContext: {
            lastNodeId: brainContext?.nodeId ?? null,
            lastNodeType: brainContext?.nodeType ?? null,
            lastCompanyId: authUser.companyId ?? null,
            lastProjectId: null,
            lastRoute: brainContext?.route ?? body.context?.route ?? null,
            lastIntent: null,
          },
        });

        await persistConversationMemory({
          body,
          authUser,
          reply: brainAnswer.answer,
          tool: "use_brain",
          agentMode: brainContext?.agentMode ?? "qa",
          brainContext,
        });

        return NextResponse.json({
          reply: brainAnswer.answer,
          tool: "use_brain",
          actions: brainAnswer.navigation
            ? [{ kind: "prompt", label: brainAnswer.navigation.label, prompt: `abrir ${brainAnswer.navigation.route}` }]
            : brainAnswer.suggestedActions.slice(0, 3).map((action) => ({ kind: "prompt", label: action.label, prompt: action.label })),
          context: null,
          meta: {
            agentMode: brainContext?.agentMode ?? "qa",
            nodeId: brainAnswer.currentBrainContext.lastNodeId ?? null,
            source: "brain",
            navigation: brainAnswer.navigation ?? null,
            blocked: brainAnswer.blocked ?? null,
            evidence: brainAnswer.evidence,
          },
        });
      }
    }
    if (!shouldUseBrainFirstContext(brainContext)) {
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
        body,
        authUser,
        reply: String(response.reply ?? ""),
        tool: response.tool,
        agentMode: null,
        brainContext,
      });

      return NextResponse.json(response);
    }

    const brainRuntimeSnapshot = compactJson(brainContext?.metadata ?? body.context?.metadata ?? null);
    appendContextToLastUserMessage(messages, "Brain runtime context", brainRuntimeSnapshot);

    if (shouldUseWebSupport(latestUserMessage)) {
      const webContext = await buildWebSupportContext(latestUserMessage).catch(() => "");
      appendContextToLastUserMessage(messages, "Apoio externo/web", webContext);
    }

    const lastUserContent = messages.filter((message) => message.role === "user").at(-1)?.content ?? "";
    if (!lastUserContent.trim()) {
      return NextResponse.json({ error: "Mensagem obrigatória" }, { status: 400 });
    }

    const companySlug = resolveCompanySlug(body, authUser);
    const agentMode: AgentMode = (brainContext?.agentMode as AgentMode | undefined) ?? detectAgentMode(lastUserContent);
    const agent = AGENT_REGISTRY?.[agentMode] ?? { name: agentMode, icon: "🧠", label: "Agente Brain", color: "#5b92ff" };
    const startedAt = Date.now();

    const engine = new InternalBrainEngine();
    const events = engine.run({
      messages,
      nodeId: brainContext?.nodeId ?? null,
      agentMode,
      companySlug,
      route: body.context?.route ?? brainContext?.route ?? null,
      screenLabel: body.context?.screenLabel ?? brainContext?.entityType ?? brainContext?.source ?? null,
      userId: authUser.id ?? null,
      actorName: authUser.user ?? authUser.email ?? null,
    });

    let replyText = "";
    let lastToolName: string | null = null;
    let success = true;

    for await (const event of events) {
      if (event.type === "text-delta") replyText += event.text;
      else if (event.type === "tool-input-start") lastToolName = event.toolName;
      else if (event.type === "error") {
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

    await persistConversationMemory({ body, authUser, reply: finalReply, tool: lastToolName ?? agentMode, agentMode, brainContext });

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
