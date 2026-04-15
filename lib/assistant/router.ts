/**
 * Score-based tool router with semantic intent analysis.
 *
 * Each tool gets a score based on the message content, user intent,
 * conversation momentum, and screen context. The tool with the
 * highest score wins.
 *
 * Enhanced with:
 *   - Intent analysis for better understanding
 *   - Conversation momentum tracking
 *   - Context-aware scoring boosts
 *   - Entity extraction for smarter matching
 */

import type { AssistantConversationTurn, AssistantScreenContext, AssistantToolName } from "./types";
import { normalizeSearch, normalizeText } from "./helpers";
import { extractTicketReference } from "./pure/parsing";
import { extractNarrativePayload, parseStructuredTicketDraft } from "./tools/ticketHelpers";
import { analyzeIntent, getConversationMomentum, type UserIntent } from "./intentAnalyzer";

/* ──────────────────── Conversation state helpers ──────────────────── */

function getLastMeaningfulAssistantTurn(history: AssistantConversationTurn[]) {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const t = history[i];
    if (t?.from === "assistant" && t.text) return t;
  }
  return null;
}

export function isAwaitingTicketPayload(history: AssistantConversationTurn[]) {
  const last = getLastMeaningfulAssistantTurn(history);
  if (!last || last.tool !== "create_ticket") return false;
  const text = normalizeSearch(last.text);
  return (
    text.includes("preciso do conteúdo real") ||
    text.includes("preciso validar os dados do módulo de suporte") ||
    text.includes("use este modelo para eu estruturar melhor o chamado") ||
    text.includes("pendências encontradas") ||
    text.includes("complete o modelo") ||
    text.includes("faltam campos")
  );
}

export function isAwaitingTestCasePayload(history: AssistantConversationTurn[]) {
  const last = getLastMeaningfulAssistantTurn(history);
  if (!last || last.tool !== "draft_test_case") return false;
  const text = normalizeSearch(last.text);
  return (
    text.includes("antes de montar o caso de teste") ||
    text.includes("use este modelo para eu validar o caso de teste") ||
    text.includes("preciso passar pelas validações do módulo de testes")
  );
}

function looksLikeFreeformContent(message: string) {
  const trimmed = normalizeText(message, 3000);
  if (!trimmed || trimmed.length < 6) return false;
  const n = normalizeSearch(trimmed);
  if (/^(resumir|explicar|mostrar|buscar|procurar|gerar|montar|criar|transformar|converter|comentar|publicar|listar)\b/.test(n)) return false;
  return true;
}

function isGreetingPrompt(message: string) {
  return /^(oi|ola|olá|bom dia|boa tarde|boa noite|e ai|e aí)\b/.test(normalizeSearch(message));
}

/* ──────────────────── Scoring rules ──────────────────── */

type ScoringRule = {
  tool: AssistantToolName;
  score: (n: string, ctx: AssistantScreenContext, history: AssistantConversationTurn[], raw: string, intent: UserIntent) => number;
};

const SCORING_RULES: ScoringRule[] = [
  /* ── greeting → screen context ── */
  {
    tool: "get_screen_context",
    score: (n, _ctx, _h, raw, intent) => {
      if (!n) return 80;
      if (intent.primary === "greeting") return 85;
      if (isGreetingPrompt(raw)) return 80;
      if (/(mostrar|mostra|ver|ver meu).*(contexto|contexto atual)|contexto atual/.test(n)) return 70;
      return 0;
    },
  },

  /* ── summarize entity (profile, ticket, company) ── */
  {
    tool: "summarize_entity",
    score: (n, _ctx, _h, _raw, intent) => {
      if (/(perfil|meus dados|meu usuario|meu usuário)/.test(n)) return 75;
      if (/(resum|sumario|sumário)/.test(n)) return 60;
      // Boost se o intent é analysis e menciona entidade
      if (intent.primary === "analysis" && intent.entities.length > 0) return 55;
      return 0;
    },
  },

  /* ── explain permission ── */
  {
    tool: "explain_permission",
    score: (n, _ctx, _h, _raw, intent) => {
      if (/(escopo de acesso|meu acesso|explicar meu acesso|explicar meu escopo)/.test(n)) return 75;
      if (/(por que|porque).*(nao ve|nao acessa|não vê|não acessa)/.test(n)) return 70;
      if (/permiss/.test(n)) return 55;
      // Boost para troubleshooting sobre acesso
      if (intent.primary === "troubleshooting" && intent.topics.includes("users")) return 50;
      return 0;
    },
  },

  /* ── list actions ── */
  {
    tool: "list_available_actions",
    score: (n, _ctx, _h, _raw, intent) => {
      if (/(acoes disponiveis|ações disponíveis|o que voce pode fazer|o que você pode fazer|o que posso fazer)/.test(n)) return 70;
      // Boost para quem está curioso sobre capabilities
      if (intent.primary === "information_seeking" && intent.isQuestion && /(fazer|posso|pode)/.test(n)) return 45;
      return 0;
    },
  },

  /* ── draft test case ── */
  {
    tool: "draft_test_case",
    score: (n, _ctx, history, raw, intent) => {
      if (/(caso de teste|teste).*(gera|gerar|monta|montar|cria|criar)|gera.*caso de teste/.test(n)) return 75;
      if (isAwaitingTestCasePayload(history) && looksLikeFreeformContent(raw)) return 65;
      // Boost para criação no contexto de QA
      if (intent.primary === "creation" && intent.topics.includes("testing")) return 60;
      return 0;
    },
  },

  /* ── create comment ── */
  {
    tool: "create_comment",
    score: (n, _ctx, _h, _raw, intent) => {
      if (/(coment|responde|responder|comentario|comentário)/.test(n) && /(ticket|chamado|sp-|\b\d{2,8}\b)/.test(n)) return 75;
      // Se menciona responder e tem entidade ticket
      if (intent.primary === "action_request" && intent.entities.some(e => e.type === "ticket") && /respond/.test(n)) return 60;
      return 0;
    },
  },

  /* ── create ticket ── */
  {
    tool: "create_ticket",
    score: (n, ctx, history, raw, intent) => {
      if (/(modelo).*(ticket|chamado)|\b(titulo|título).*(descricao|descrição).*(impacto)/.test(n)) return 75;
      if (/(cria|criar|abre|abrir|transforma|transformar|monta|montar|converte|converter).*(ticket|chamado|suporte|nota)/.test(n)) return 70;
      if (isAwaitingTicketPayload(history) && (looksLikeFreeformContent(raw) || Boolean(parseStructuredTicketDraft(raw)) || Boolean(extractNarrativePayload(raw)))) return 65;
      // Boost inteligente para criação de ticket
      if (intent.primary === "creation" && intent.topics.includes("tickets")) return 65;
      // Boost para troubleshooting no módulo de suporte (pode virar ticket)
      if (intent.primary === "troubleshooting" && ctx.module === "support" && intent.sentiment === "frustrated") return 50;
      return 0;
    },
  },

  /* ── search ── */
  {
    tool: "search_internal_records",
    score: (n, ctx, _h, raw, intent) => {
      if (/(buscar|busca|procura|procurar|localiza|localizar|encontra|encontrar|listar|lista)/.test(n)) return 50;
      if (Boolean(extractTicketReference(raw))) return 50;
      // Boost para information_seeking com entidades
      if (intent.primary === "information_seeking" && intent.entities.length > 0) return 45;
      // Boost se menciona número que pode ser ticket
      if (intent.entities.some(e => e.type === "number" || e.type === "ticket")) return 40;
      if (ctx.module === "support") return 30; // fallback for support module
      return 0;
    },
  },

  /* ── suggest next step (fallback) ── */
  {
    tool: "suggest_next_step",
    score: (n, _ctx, _h, _raw, intent) => {
      if (/(proximo passo|próximo passo|o que faco agora|o que faço agora|sugere)/.test(n)) return 60;
      // Boost para confirmação (continuar fluxo)
      if (intent.primary === "confirmation") return 40;
      // Boost para clarificação
      if (intent.primary === "clarification") return 35;
      return 10; // always a fallback candidate
    },
  },
];

/* ──────────────────── Public API ──────────────────── */

export function chooseTool(
  message: string,
  context: AssistantScreenContext,
  history: AssistantConversationTurn[],
): AssistantToolName {
  const n = normalizeSearch(message);

  // Analisar intenção do usuário para scoring mais inteligente
  const intent = analyzeIntent(message, context, history);
  const momentum = getConversationMomentum(history);

  let bestTool: AssistantToolName = "suggest_next_step";
  let bestScore = 0;

  for (const rule of SCORING_RULES) {
    let s = rule.score(n, context, history, message, intent);
    
    // Boost contextual baseado na continuidade da conversa
    if (momentum.lastToolUsed === rule.tool && momentum.pendingAction) {
      s += 15; // Boost para continuar fluxo anterior
    }

    // Boost para tools que fazem sentido no contexto atual
    if (context.module === "support" && (rule.tool === "create_ticket" || rule.tool === "search_internal_records")) {
      s += 5;
    }

    // Ajustar baseado na confiança do intent
    if (intent.confidence > 0.7 && s > 30) {
      s += Math.floor(intent.confidence * 10);
    }

    if (s > bestScore) {
      bestScore = s;
      bestTool = rule.tool;
    }
  }

  // Threshold real: só aceita tool se score >= 10
  if (bestScore < 10) {
    return "suggest_next_step";
  }
  return bestTool;
}

// Export intent analyzer for use in other modules
export { analyzeIntent, getConversationMomentum } from "./intentAnalyzer";
