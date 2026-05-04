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
import { REPEATED_REPLY_MESSAGES, CLARIFY_REPLY } from "./messages";
import { chooseTool, isAwaitingTicketPayload, isAwaitingTestCasePayload, analyzeIntent, getConversationMomentum } from "./router";
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

/* ──────────────────── Repeat / collapse guards ──────────────────── */

function shouldShortCircuitRepeatedPrompt(
  history: AssistantConversationTurn[],
  tool: AssistantToolName,
  message: string,
) {
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

function buildClarifyReply(context: AssistantScreenContext): AssistantExecutorResult {
  return {
    tool: "suggest_next_step",
    success: true,
    summary: "pedido pouco claro",
    actions: buildPromptActions(context),
    reply: compactMultiline(CLARIFY_REPLY),
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

function resolveAssistantRequestContext(user: AuthUser, request: AssistantClientRequest) {
  const baseContext = resolveAssistantScreenContext(sanitizeRoute(request.context?.route));
  const actor = request.actor ?? null;

  const effectiveCompanySlug =
    normalizeCompanySlug(user.companySlug) ??
    normalizeCompanySlug(actor?.companySlug) ??
    normalizeCompanySlug(Array.isArray(user.companySlugs) ? user.companySlugs[0] : null) ??
    normalizeCompanySlug(Array.isArray(actor?.companySlugs) ? actor?.companySlugs?.[0] ?? null : null) ??
    normalizeCompanySlug(baseContext.companySlug);

  // Keep route-derived module/screen info, but enforce active user company scope when available.
  if (!effectiveCompanySlug) return baseContext;

  return {
    ...baseContext,
    companySlug: effectiveCompanySlug,
    entityId: baseContext.entityType === "company" ? effectiveCompanySlug : baseContext.entityId,
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
    if (!isAwaitingTicketPayload(history) && !isAwaitingTestCasePayload(history) && isLowSignalMessage(message, context)) {
      result = buildClarifyReply(context);
    } else {
      const tool = chooseTool(message, context, history);
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
