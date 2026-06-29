/**
 * Assistant service — orchestrator.
 *
 * This file is intentionally thin. It coordinates:
 *   1. context resolution
 *   2. input normalisation
 *   3. tool routing (via score-based router)
 *   4. tool execution (delegated to tools/)
 *   5. repeat/collapse guard
 *   6. audit logging
 *
 * All business logic lives in the tool files under tools/.
 */
import "server-only";

import { appendAssistantAuditEntry } from "@/lib/assistantAuditLog";
import { resolveAssistantScreenContext } from "@/lib/assistant/screenContext";
import type {
  AssistantAction,
  AssistantClientRequest,
  AssistantConversationTurn,
  AssistantReplyPayload,
  AssistantScreenContext,
  AssistantToolAction,
  AssistantToolName,
} from "@/lib/assistant/types";
import type { AuthUser } from "@/lib/jwtAuth";

import { normalizePromptText, normalizeSearch, normalizeText, compactMultiline, sanitizeRoute } from "./helpers";
import { REPEATED_REPLY_MESSAGES } from "./messages";
import { chooseTool, isAwaitingTicketPayload, isAwaitingTestCasePayload, analyzeIntent } from "./router";
import { buildPromptActions } from "./data";
import { extractTicketReference } from "./pure/parsing";
import { extractNarrativePayload, isTicketTemplateRequest, parseStructuredTicketDraft } from "./tools/ticketHelpers";
import { buildBrainContextForAI } from "@/lib/brain/aiContext";
import {
  toolGetScreenContext,
  toolListAvailableActions,
  toolSearchInternalRecords,
  toolSummarizeEntity,
  toolDraftTestCase,
  toolExplainPermission,
  buildTicketCreationAction,
  executeCreateTicket,
  buildCommentCreationAction,
  executeCreateComment,
  executeCreateTestCase,
  toolSuggestNextStep,
  type AssistantExecutorResult,
} from "./tools";

/* ──────────────────── Conversation helpers ──────────────────── */

function normalizeConversationHistory(history: AssistantClientRequest["history"]) {
  if (!Array.isArray(history)) return [] as AssistantConversationTurn[];
  return history
    .slice(-12)
    .map((item) => ({
      from: (item?.from === "assistant" ? "assistant" : "user") as "assistant" | "user",
      text: normalizeText(item?.text, 4000),
      tool: item?.tool ?? null,
      ts: typeof item?.ts === "number" ? item.ts : undefined,
      actionLabels: Array.isArray(item?.actionLabels)
        ? item.actionLabels.map((label) => normalizeText(label, 160)).filter(Boolean)
        : [],
    }))
    .filter((item) => item.text);
}

function getLastAssistantTurn(history: AssistantConversationTurn[]) {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.from === "assistant") return history[i];
  }
  return null;
}

function getLastUserTurn(history: AssistantConversationTurn[]) {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.from === "user") return history[i];
  }
  return null;
}

function getLatestUserTopic(history: AssistantConversationTurn[], message?: string) {
  const candidates = [
    normalizeSearch(message ?? ""),
    ...history
      .filter((turn) => turn.from === "user")
      .map((turn) => normalizeSearch(turn.text)),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const cleaned = String(candidate)
      .replace(/["'`]/g, "")
      .trim();
    if (cleaned.length < 4) continue;
    if (/^\d+$/.test(cleaned)) continue;
    return cleaned.slice(0, 80);
  }

  return null;
}

/* ──────────────────── Low-signal detection ──────────────────── */

function isLowSignalMessage(message: string, context: AssistantScreenContext) {
  const normalized = normalizeSearch(message);
  if (!normalized) return true;
  if (/^\d+$/.test(normalized)) return true;
  if (Boolean(extractTicketReference(message))) return false;
  if (Boolean(extractNarrativePayload(message))) return false;
  if (Boolean(parseStructuredTicketDraft(message)?.hasNamedFields)) return false;

  // Use intent analyzer for smarter detection
  const intent = analyzeIntent(message, context, []);
  
  // Se tem entidades extraídas, não é low signal
  if (intent.entities.length > 0) return false;
  
  // Se tem tópicos identificados, não é low signal
  if (intent.topics.length > 0) return false;
  
  // Se é uma confirmação ou clarificação válida
  if (intent.primary === "confirmation" || intent.primary === "clarification") return false;
  
  // Se tem confiança alta no intent
  if (intent.confidence > 0.7 && intent.primary !== "unknown") return false;

  const tokenCount = normalized.split(/\s+/).filter(Boolean).length;
  const hasKnownIntent = /(ticket|chamado|bug|erro|empresa|usuario|perfil|permiss|nota|teste|caso|coment|resum|buscar|mostrar|explicar|criar|gerar|transformar|converter|modelo)/.test(normalized);

  if (hasKnownIntent) return false;
  if (tokenCount === 1 && normalized.length <= 14) return true;
  if (tokenCount <= 2 && normalized.length <= 18) return true;
  return false;
}

function isGreetingMessage(message: string) {
  return /^(oi+|ola|olá|bom dia|boa tarde|boa noite|e ai|e aí|hello|hi)\b/i.test(normalizeSearch(message));
}

function isHumanSmallTalk(message: string) {
  const normalized = normalizeSearch(message)
    .replace(/[!?.,;]/g, "")
    .trim();

  return /^(tudo|tudo bem|td|td bem|beleza|blz|ok|okay|certo|show|fechou|sim|ss|aham|uhum|tranquilo|de boa|e vc|e voce|e você)$/.test(normalized);
}

/* ──────────────────── Repeat / collapse guards ──────────────────── */

function shouldShortCircuitRepeatedPrompt(
  history: AssistantConversationTurn[],
  tool: AssistantToolName,
  message: string,
) {
  if (tool === "use_brain") return false;

  const lastUserTurn = getLastUserTurn(history);
  const lastAssistantTurn = getLastAssistantTurn(history);
  if (!lastUserTurn || !lastAssistantTurn) return false;
  if (lastAssistantTurn.tool !== tool) return false;

  if (tool === "create_ticket") {
    if (isAwaitingTicketPayload(history)) return false;
    if (isTicketTemplateRequest(message)) return false;
    if (Boolean(parseStructuredTicketDraft(message))) return false;
    if (Boolean(extractNarrativePayload(message))) return false;
  }
  if (tool === "draft_test_case" && isAwaitingTestCasePayload(history)) return false;

  const current = normalizeSearch(message);
  const previous = normalizeSearch(lastUserTurn.text);
  return Boolean(current) && current === previous;
}

function maybeCollapseRepeatedActions(actions: AssistantAction[] | undefined, history: AssistantConversationTurn[]) {
  if (!actions?.length) return actions;
  const lastAssistantTurn = getLastAssistantTurn(history);
  if (!lastAssistantTurn?.actionLabels?.length) return actions;

  const nextLabels = actions.map((a) => normalizeSearch(a.label));
  const previousLabels = lastAssistantTurn.actionLabels.map((l) => normalizeSearch(l));
  if (nextLabels.length !== previousLabels.length) return actions;
  if (nextLabels.every((l, i) => l === previousLabels[i])) return undefined;
  return actions;
}

function chooseAccessRequestsTool(message: string, context: AssistantScreenContext): AssistantToolName | null {
  if (!context.route.startsWith("/admin/access-requests")) return null;

  const normalized = normalizeSearch(message);

  if (/\b(acoes|acao|posso fazer|executar|comandos|funcoes|função|funcao)\b/.test(normalized)) {
    return "list_available_actions";
  }

  if (/\b(explica|explicar|fluxo|solicitacao|solicitacoes|aprovar|aprovacao|recusar|rejeitar|ajuste|pendencia|pendencias|decisao|falta|historico|histórico)\b/.test(normalized)) {
    return "get_screen_context";
  }

  return null;
}

/* ──────────────────── Shortcut replies ──────────────────── */

function buildRecentDuplicateReply(tool: AssistantToolName, context: AssistantScreenContext): AssistantExecutorResult {
  return {
    tool,
    success: true,
    summary: "resposta repetida evitada",
    actions: buildPromptActions(context),
    reply: REPEATED_REPLY_MESSAGES[tool],
  };
}

function buildClarifyReply(
  context: AssistantScreenContext,
  history: AssistantConversationTurn[] = [],
  message?: string,
): AssistantExecutorResult {
  const topic = getLatestUserTopic(history, message);
  const prefix = topic
    ? `Entendi que estamos falando sobre "${topic}". `
    : "";

  if (isHumanSmallTalk(message ?? "")) {
    if (context.route.startsWith("/brain") || context.route.startsWith("/admin/brain") || context.module === "brain") {
      return {
        tool: "suggest_next_step",
        success: true,
        summary: "conversa curta contextual no Brain",
        reply: compactMultiline([
          "Tudo bem por aqui. Estou no Brain contigo.",
          "",
          "Pode me mandar uma frase solta mesmo. Eu tento entender a intenção antes de responder.",
          "",
          "Posso resumir o Brain, explicar o grafo, buscar contexto, sugerir próximo passo ou te ajudar a transformar uma ideia em ação dentro da plataforma.",
        ].join("\n")),
      };
    }

    if (context.route.startsWith("/admin/access-requests")) {
      return {
        tool: "suggest_next_step",
        success: true,
        summary: "conversa curta contextual em solicitações",
        reply: compactMultiline([
          "Tudo certo. Continuo na tela de Solicitações de acesso.",
          "",
          "Pode falar do seu jeito. Eu consigo buscar pessoa, filtrar status, abrir solicitação, acionar PDF, explicar o fluxo ou orientar aprovação, recusa e ajuste.",
        ].join("\n")),
      };
    }
  }

  if (context.route.startsWith("/admin/access-requests")) {
    if (isGreetingMessage(message ?? "")) {
      return {
        tool: "suggest_next_step",
        success: true,
        summary: "saudacao contextual",
        reply: compactMultiline([
          "Oi. Estou contigo na tela de Solicitacoes de acesso.",
          "",
          "Me fala o que voce quer resolver agora: encontrar uma pessoa, entender uma solicitacao, aprovar, recusar, pedir ajuste ou revisar o historico?",
          "",
          "Se voce ainda estiver decidindo, eu posso primeiro olhar o fluxo contigo e te dizer o melhor proximo passo.",
        ].join("\n")),
      };
    }

    return {
      tool: "suggest_next_step",
      success: true,
      summary: "saudacao contextual",
      reply: compactMultiline([
        `${prefix}Oi. Estou contigo na tela de Solicitacoes de acesso.`,
        "",
        "Pode falar do seu jeito, sem escolher menu. Eu observo essa tela, entendo a fila e consigo te ajudar a decidir ou executar o que for seguro aqui.",
        "",
        "Por exemplo: posso buscar uma pessoa, filtrar recusadas, abrir a primeira solicitacao, explicar o que falta para aprovar, orientar um pedido de ajuste ou acionar o PDF quando o botao estiver disponivel.",
      ].join("\n")),
    };
  }

  if (isGreetingMessage(message ?? "")) {
    return {
      tool: "suggest_next_step",
      success: true,
      summary: "saudacao",
      reply: compactMultiline([
        `Oi. Estou aqui com voce em ${context.screenLabel}.`,
        "",
        "Me conta o que voce quer fazer agora. Pode ser uma frase simples, tipo buscar algo, entender a tela, revisar um registro, criar uma acao ou me pedir para sugerir o caminho.",
        "",
        "Se preferir, eu começo resumindo o que estou vendo nesta tela.",
      ].join("\n")),
    };
  }

  return {
    tool: "suggest_next_step",
    success: true,
    summary: "pedido pouco claro",
    reply: compactMultiline([
      `${prefix}Ainda preciso entender melhor o que voce quer que eu faca.`,
      "",
      `Estou em ${context.screenLabel}. Me diga o objetivo em uma frase e eu sigo contigo passo a passo.`,
      "",
      "Pode ser algo como: buscar um registro, explicar esta tela, revisar uma pendencia, montar uma acao ou sugerir o proximo passo.",
    ].join("\n")),
  };
}

/* ──────────────────── Tool dispatcher ──────────────────── */

async function executeTool(user: AuthUser, context: AssistantScreenContext, tool: AssistantToolName, message: string): Promise<AssistantExecutorResult> {
  switch (tool) {
    case "get_screen_context":     return toolGetScreenContext(user, context);
    case "list_available_actions": return toolListAvailableActions(user, context);
    case "search_internal_records":return toolSearchInternalRecords(user, context, message);
    case "summarize_entity":       return toolSummarizeEntity(user, context, message);
    case "draft_test_case":        return toolDraftTestCase(user, context, message);
    case "explain_permission":     return toolExplainPermission(user, context, message);
    case "create_ticket":          return buildTicketCreationAction(user, context, message);
    case "create_comment":         return buildCommentCreationAction(user, context, message);
    case "suggest_next_step":      return toolSuggestNextStep(user, context);
    default:                       return toolSuggestNextStep(user, context);
  }
}

async function executeToolAction(user: AuthUser, context: AssistantScreenContext, action: AssistantToolAction): Promise<AssistantExecutorResult> {
  switch (action.tool) {
    case "create_ticket":  return executeCreateTicket(user, context, action);
    case "create_comment": return executeCreateComment(user, action);
    case "create_test_case": return executeCreateTestCase(user, context, action);
    default:
      return { tool: "suggest_next_step", success: false, summary: "ação não suportada", reply: "Essa ação não está disponível neste MVP do agente." };
  }
}

/* ──────────────────── Public entry-point ──────────────────── */

function reply(
  tool: AssistantToolName,
  context: AssistantScreenContext,
  result: Omit<AssistantExecutorResult, "tool">,
): AssistantReplyPayload {
  return { tool, reply: result.reply, actions: result.actions, context };
}

function normalizeCompanySlug(value?: string | null) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function sanitizePromptList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const next = value
    .map((item) => normalizeText(typeof item === "string" ? item : "", 180))
    .filter(Boolean)
    .slice(0, 8);
  return next.length > 0 ? next : fallback;
}

function sanitizeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function resolveAssistantRequestContext(user: AuthUser, request: AssistantClientRequest) {
  const requestedRoute = sanitizeRoute(request.context?.route ?? request.brainContext?.route);
  const baseContext = resolveAssistantScreenContext(requestedRoute);
  const requestedContext = request.context ?? null;
  const actor = request.actor ?? null;

  const mergedContext: AssistantScreenContext = {
    ...baseContext,
    route: requestedRoute,
    module: requestedContext?.module ?? baseContext.module,
    screenLabel: normalizeText(requestedContext?.screenLabel ?? "", 140) || baseContext.screenLabel,
    screenSummary: normalizeText(requestedContext?.screenSummary ?? "", 2400) || baseContext.screenSummary,
    entityType: requestedContext?.entityType ?? baseContext.entityType,
    entityId: normalizeText(requestedContext?.entityId ?? "", 160) || baseContext.entityId,
    companySlug: normalizeCompanySlug(requestedContext?.companySlug) ?? baseContext.companySlug,
    suggestedPrompts: sanitizePromptList(requestedContext?.suggestedPrompts, baseContext.suggestedPrompts),
    metadata: sanitizeMetadata(requestedContext?.metadata) ?? null,
  };

  const effectiveCompanySlug =
    normalizeCompanySlug(user.companySlug) ??
    normalizeCompanySlug(actor?.companySlug) ??
    normalizeCompanySlug(Array.isArray(user.companySlugs) ? user.companySlugs[0] : null) ??
    normalizeCompanySlug(Array.isArray(actor?.companySlugs) ? actor?.companySlugs?.[0] ?? null : null) ??
    normalizeCompanySlug(mergedContext.companySlug);

  // Keep route-derived module/screen info, but enforce active user company scope when available.
  if (!effectiveCompanySlug) return mergedContext;

  return {
    ...mergedContext,
    companySlug: effectiveCompanySlug,
    entityId: mergedContext.entityType === "company" ? effectiveCompanySlug : mergedContext.entityId,
  } as AssistantScreenContext;
}

export async function runAssistantRequest(user: AuthUser, request: AssistantClientRequest): Promise<AssistantReplyPayload> {
  const context = resolveAssistantRequestContext(user, request);
  const action = request.action;
  const message = normalizePromptText(request.message, 3000);
  const history = normalizeConversationHistory(request.history);

  let result: AssistantExecutorResult;

  // Enriquecer com contexto do Brain (inclui busca semântica pela query do usuário)
  let brainContext: string | null = null;
  try {
    brainContext = await buildBrainContextForAI({
      companySlug: context.companySlug,
      entityType: context.entityType,
      entityId: context.entityId,
      userQuery: message, // Permite busca semântica nos nós e memórias
    });
  } catch { /* brain context is optional */ }

  // Se há contexto do brain, anexar à mensagem para enriquecer respostas
  const enrichedMessage = brainContext
    ? `${message}\n\n---\n[Brain Context]\n${brainContext}`
    : message;

  if (action?.kind === "tool") {
    result = await executeToolAction(user, context, action);
  } else {
    if (!isAwaitingTicketPayload(history) && !isAwaitingTestCasePayload(history) && isGreetingMessage(message)) {
      result = buildClarifyReply(context, history, message);
    } else if (!isAwaitingTicketPayload(history) && !isAwaitingTestCasePayload(history) && isLowSignalMessage(message, context)) {
      result = buildClarifyReply(context, history, message);
    } else {
      const tool = chooseAccessRequestsTool(message, context) ?? chooseTool(message, context, history);
      result = shouldShortCircuitRepeatedPrompt(history, tool, message)
        ? buildRecentDuplicateReply(tool, context)
        : await executeTool(user, context, tool, enrichedMessage);
    }
  }

  result.actions = maybeCollapseRepeatedActions(result.actions, history);

  await appendAssistantAuditEntry({
    actorUserId: user.id,
    actorEmail: user.email ?? null,
    route: context.route,
    module: context.module,
    actionType: action?.kind === "tool" ? "tool" : "message",
    prompt: action?.kind === "tool" ? null : message || null,
    toolName: result.tool,
    success: result.success,
    summary: result.summary,
  }).catch(() => null);

  return reply(result.tool, context, result);
}
