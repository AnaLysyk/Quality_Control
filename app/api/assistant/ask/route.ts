import { NextResponse } from "next/server";
import { authenticateRequest } from "@/backend/jwtAuth";
import { InternalBrainEngine } from "@/backend/brain/internalEngine";
import { logAgentExecution } from "@/backend/brain/orchestrator";
import { AGENT_REGISTRY } from "@/backend/brain/agents";
import { buildBrainAccessContextFromAuthUser } from "@/backend/brain/access";
import { answerBrainChatQuestion } from "@/backend/brain/chat";
import { buildAutoBrainRoute } from "@/backend/brain/autoRouter";
import { hasPermissionAccess } from "@/backend/permissionMatrix";
import { buildWebSupportContext, shouldUseWebSupport } from "@/backend/assistant/webSupport";
import type { AgentMode } from "@/backend/brain/agents";
import type { AssistantClientRequest, AssistantOpenEventDetail } from "@/backend/assistant/types";
import { rateLimit } from "@/backend/rateLimit";

export const runtime = "nodejs";

const ASSISTANT_ENABLED = process.env.NEXT_PUBLIC_AI_ASSISTANT_ENABLED !== "false";
const MAX_ASSISTANT_PAYLOAD_BYTES = 256 * 1024;
const MAX_HISTORY_MESSAGES = 4;
const MAX_MESSAGE_CHARS = 1600;
const MAX_REPLY_CHARS = 5000;
const MAX_AGENT_RUNTIME_MS = 60_000;
const MAX_BRAIN_DIRECT_MS = 60_000;
const MAX_WEB_CONTEXT_CHARS = 1600;

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

function limitMessageContent(value: unknown, max = MAX_MESSAGE_CHARS) {
  return compactText(String(value ?? ""), max);
}

function limitMessageList(items: unknown): Array<{ role: "user" | "assistant"; content: string }> {
  if (!Array.isArray(items)) return [];
  return items
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => {
      const entry = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        role: entry.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: limitMessageContent(entry.content),
      };
    })
    .filter((item) => item.content);
}

function limitHistoryList(items: unknown) {
  if (!Array.isArray(items)) return null;
  return items
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => {
      const entry = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        ...entry,
        text: limitMessageContent(entry.text),
      };
    });
}

function sanitizeBrainContext(value: AssistantOpenEventDetail | null | undefined): AssistantOpenEventDetail | null {
  if (!value) return null;
  return {
    ...value,
    metadata: compactJson(value.metadata, 2500) ? { compact: compactJson(value.metadata, 2500) } : null,
  } as AssistantOpenEventDetail;
}

function sanitizeRequestBody(body: AssistantRequestBody): AssistantRequestBody {
  const brainContext = sanitizeBrainContext(body.brainContext ?? null);
  const contextMetadata = compactJson(body.context?.metadata ?? null, 2500);

  return {
    ...body,
    message: typeof body.message === "string" ? limitMessageContent(body.message, MAX_MESSAGE_CHARS) : body.message,
    messages: limitMessageList(body.messages),
    history: limitHistoryList(body.history) as AssistantRequestBody["history"],
    context: body.context
      ? {
          ...body.context,
          metadata: contextMetadata ? { compact: contextMetadata } : null,
        }
      : body.context,
    brainContext,
  };
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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} excedeu ${Math.round(timeoutMs / 1000)}s`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
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
    const { prisma } = await import("@/database/prismaClient");
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
        .slice(-MAX_HISTORY_MESSAGES)
        .map((item) => ({
          role: item?.from === "assistant" ? ("assistant" as const) : ("user" as const),
          content: limitMessageContent(item?.text),
        }))
        .filter((item) => item.content)
    : [];

  const directMessages = Array.isArray(body.messages)
    ? body.messages
        .slice(-MAX_HISTORY_MESSAGES)
        .map((item) => ({
          role: item?.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: limitMessageContent(item?.content),
        }))
        .filter((item) => item.content)
    : [];

  if (directMessages.length > 0) return directMessages;

  const currentMessage = typeof body.message === "string" ? limitMessageContent(body.message) : "";
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
  return /\b(empresa|projeto|tela|rota|permiss|perfil|run|execu[cç][aã]o|defeito|bug|usuario|usu[aá]rio|qase|kase|jira|operacional|brain|brian|n[oó]|dashboard|painel|qa|teste|testes|caso|cen[aá]rio|regress[aã]o|evid[eê]ncia|print|v[ií]deo|log|payload|endpoint|api|postman|playwright|release|aceite|homologa[cç][aã]o|ticket|chamado|erro|falha|risco|impacto|status code|internet|web|pesquisa|google|documenta[cç][aã]o oficial)\b/i.test(message);
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
  const nextContent = [messages[lastUserIndex].content, "", "---", `[${title}]`, context].join("\n");
  messages[lastUserIndex] = {
    ...messages[lastUserIndex],
    content: limitMessageContent(nextContent, MAX_MESSAGE_CHARS + MAX_WEB_CONTEXT_CHARS),
  };
  return messages;
}

export async function POST(req: Request) {
  if (!ASSISTANT_ENABLED) {
    return NextResponse.json({ error: "Assistente desativado" }, { status: 410 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_ASSISTANT_PAYLOAD_BYTES) {
    return NextResponse.json(
      { error: "Mensagem muito grande. Reduza o histÃ³rico/contexto e tente novamente." },
      { status: 413 },
    );
  }

  const authUser = await authenticateRequest(req);
  if (authUser && (!hasPermissionAccess(authUser.permissions, "ai", "view") || !hasPermissionAccess(authUser.permissions, "ai", "use"))) {
    return NextResponse.json({ error: "Sem permissao para usar o assistente" }, { status: 403 });
  }
  if (!authUser) {
    return NextResponse.json({ error: "NÃ£o autenticado" }, { status: 401 });
  }

  const limiter = await rateLimit(req, `assistant-ask:${authUser.id}`, 20, 60);
  if (limiter.limited) return limiter.response;

  try {
    const rawBody = (await req.json().catch(() => ({}))) as AssistantRequestBody;
    const body = sanitizeRequestBody(rawBody);
    const brainContext = body.brainContext ?? null;

    if (isStructuredToolAction(body)) {
      const { runAssistantRequest } = await import("@/backend/assistant/service");
      const response = await withTimeout(runAssistantRequest(authUser, {
        message: body.message,
        context: body.context ?? null,
        actor: body.actor ?? null,
        action: body.action ?? null,
        history: body.history ?? null,
        brainContext: brainContext ?? null,
      } as Parameters<typeof runAssistantRequest>[1]), MAX_AGENT_RUNTIME_MS, "Assistente");

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
    const autoBrainRoute = buildAutoBrainRoute(latestUserMessage);

    if (autoBrainRoute.useBrain || shouldAnswerFromBrain(latestUserMessage)) {
      const brainAccess = await buildBrainAccessContextFromAuthUser(authUser);
      if (brainAccess) {
        const brainAnswer = await withTimeout(answerBrainChatQuestion({
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
        }), MAX_BRAIN_DIRECT_MS, "Brain");

        const webContext = autoBrainRoute.useWeb
          ? await buildWebSupportContext(latestUserMessage).catch(() => "")
          : "";

        const finalBrainReply = [brainAnswer.answer, webContext]
          .filter((item) => String(item ?? "").trim())
          .join("\n\n");

        await persistConversationMemory({
          body,
          authUser,
          reply: finalBrainReply,
          tool: "use_brain_auto",
          agentMode: autoBrainRoute.agentMode,
          brainContext,
        });

        return NextResponse.json({
          reply: compactText(finalBrainReply, MAX_REPLY_CHARS),
          tool: "use_brain_auto",
          actions: brainAnswer.navigation
            ? [{ kind: "prompt", label: brainAnswer.navigation.label, prompt: `abrir ${brainAnswer.navigation.route}` }]
            : brainAnswer.suggestedActions.slice(0, 3).map((action) => ({ kind: "prompt", label: action.label, prompt: action.label })),
          context: null,
          meta: {
            agentMode: autoBrainRoute.agentMode,
            nodeId: brainAnswer.currentBrainContext.lastNodeId ?? null,
            source: "brain",
            navigation: brainAnswer.navigation ?? null,
            blocked: brainAnswer.blocked ?? null,
            evidence: brainAnswer.evidence?.slice(0, 8) ?? [],
          },
        });
      }
    }
    if (!shouldUseBrainFirstContext(brainContext)) {
      const { runAssistantRequest } = await import("@/backend/assistant/service");
      const response = await withTimeout(runAssistantRequest(authUser, {
        message: body.message,
        context: body.context ?? null,
        actor: body.actor ?? null,
        action: body.action ?? null,
        history: body.history ?? null,
        brainContext: brainContext ?? null,
      } as Parameters<typeof runAssistantRequest>[1]), MAX_AGENT_RUNTIME_MS, "Assistente");

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

    const brainRuntimeSnapshot = compactJson(brainContext?.metadata ?? body.context?.metadata ?? null, 2500);
    appendContextToLastUserMessage(messages, "Brain runtime context", brainRuntimeSnapshot);

    if (autoBrainRoute.useWeb || shouldUseWebSupport(latestUserMessage)) {
      const webContext = await buildWebSupportContext(latestUserMessage).catch(() => "");
      appendContextToLastUserMessage(messages, "Apoio externo/web", compactText(webContext, MAX_WEB_CONTEXT_CHARS));
    }

    const lastUserContent = messages.filter((message) => message.role === "user").at(-1)?.content ?? "";
    if (!lastUserContent.trim()) {
      return NextResponse.json({ error: "Mensagem obrigatÃ³ria" }, { status: 400 });
    }

    const companySlug = resolveCompanySlug(body, authUser);
    const explicitAgentMode = brainContext?.agentMode;
    const isValidAgentMode = (value: unknown): value is AgentMode =>
      value === "qa" || value === "debug" || value === "playwright" || value === "memory";
    const agentMode: AgentMode = isValidAgentMode(explicitAgentMode) ? explicitAgentMode : autoBrainRoute.agentMode;
    const agent = AGENT_REGISTRY?.[agentMode] ?? { name: agentMode, icon: "ðŸ§ ", label: "Agente Brain", color: "#5b92ff" };
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
    let timedOut = false;

    for await (const event of events) {
      if (Date.now() - startedAt > MAX_AGENT_RUNTIME_MS) {
        timedOut = true;
        success = false;
        break;
      }
      if (event.type === "text-delta") {
        replyText += event.text;
        if (replyText.length > MAX_REPLY_CHARS) {
          replyText = `${replyText.slice(0, MAX_REPLY_CHARS)}\n\n_Resposta interrompida para proteger a memÃ³ria do servidor._`;
          break;
        }
      }
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

    const finalReply = timedOut
      ? "O assistente interrompeu a anÃ¡lise para proteger a memÃ³ria do servidor local. Tente uma pergunta mais especÃ­fica ou abra um mÃ³dulo menor do Brain."
      : replyText || (success ? "AnÃ¡lise concluÃ­da." : "NÃ£o foi possÃ­vel processar sua pergunta.");

    await persistConversationMemory({ body, authUser, reply: finalReply, tool: lastToolName ?? agentMode, agentMode, brainContext });

    return NextResponse.json({
      reply: compactText(finalReply, MAX_REPLY_CHARS),
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
        timedOut,
      },
    });
  } catch (error) {
    console.error("[assistant/ask] error:", error);
    return NextResponse.json({ error: "Erro interno ao processar a solicitação" }, { status: 500 });
  }
}
