/**
 * Score-based tool router.
 *
 * Each tool gets a score based on the message content. The tool with the
 * highest score wins. This replaces the fragile if/regex cascade with
 * something easy to tune: just adjust the weights or add new rules.
 *
 * Score ≥ 10 → tool is a candidate.
 * Highest score wins. In a tie, the first rule in the list wins.
 */

import type { AssistantConversationTurn, AssistantScreenContext, AssistantToolName } from "./types";
import { normalizeSearch, normalizeText } from "./helpers";
import { extractTicketReference } from "./data";
import { extractNarrativePayload, parseStructuredTicketDraft } from "./tools/ticketHelpers";

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
    text.includes("preciso do conteudo real") ||
    text.includes("preciso validar os dados do modulo de suporte") ||
    text.includes("use este modelo para eu estruturar melhor o chamado") ||
    text.includes("pendencias encontradas") ||
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
    text.includes("preciso passar pelas validacoes do modulo de testes")
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
  score: (n: string, ctx: AssistantScreenContext, history: AssistantConversationTurn[], raw: string) => number;
};

const SCORING_RULES: ScoringRule[] = [
  /* ── greeting → screen context ── */
  {
    tool: "get_screen_context",
    score: (n, _ctx, _h, raw) => {
      if (!n) return 80;
      if (isGreetingPrompt(raw)) return 80;
      if (/(mostrar|mostra|ver|ver meu).*(contexto|contexto atual)|contexto atual/.test(n)) return 70;
      return 0;
    },
  },

  /* ── summarize entity (profile, ticket, company) ── */
  {
    tool: "summarize_entity",
    score: (n) => {
      if (/(perfil|meus dados|meu usuario|meu usuário)/.test(n)) return 75;
      if (/(resum|sumario|sumário)/.test(n)) return 60;
      return 0;
    },
  },

  /* ── explain permission ── */
  {
    tool: "explain_permission",
    score: (n) => {
      if (/(escopo de acesso|meu acesso|explicar meu acesso|explicar meu escopo)/.test(n)) return 75;
      if (/(por que|porque).*(nao ve|nao acessa|não vê|não acessa)/.test(n)) return 70;
      if (/permiss/.test(n)) return 55;
      return 0;
    },
  },

  /* ── list actions ── */
  {
    tool: "list_available_actions",
    score: (n) => {
      if (/(acoes disponiveis|ações disponíveis|o que voce pode fazer|o que você pode fazer|o que posso fazer)/.test(n)) return 70;
      return 0;
    },
  },

  /* ── draft test case ── */
  {
    tool: "draft_test_case",
    score: (n, _ctx, history, raw) => {
      if (/(caso de teste|teste).*(gera|gerar|monta|montar|cria|criar)|gera.*caso de teste/.test(n)) return 75;
      if (isAwaitingTestCasePayload(history) && looksLikeFreeformContent(raw)) return 65;
      return 0;
    },
  },

  /* ── create comment ── */
  {
    tool: "create_comment",
    score: (n) => {
      if (/(coment|responde|responder|comentario|comentário)/.test(n) && /(ticket|chamado|sp-|\b\d{2,8}\b)/.test(n)) return 75;
      return 0;
    },
  },

  /* ── create ticket ── */
  {
    tool: "create_ticket",
    score: (n, _ctx, history, raw) => {
      if (/(modelo).*(ticket|chamado)|\b(titulo|título).*(descricao|descrição).*(impacto)/.test(n)) return 75;
      if (/(cria|criar|abre|abrir|transforma|transformar|monta|montar|converte|converter).*(ticket|chamado|suporte|nota)/.test(n)) return 70;
      if (isAwaitingTicketPayload(history) && (looksLikeFreeformContent(raw) || Boolean(parseStructuredTicketDraft(raw)) || Boolean(extractNarrativePayload(raw)))) return 65;
      return 0;
    },
  },

  /* ── search ── */
  {
    tool: "search_internal_records",
    score: (n, ctx, _h, raw) => {
      if (/(buscar|busca|procura|procurar|localiza|localizar|encontra|encontrar|listar|lista)/.test(n)) return 50;
      if (Boolean(extractTicketReference(raw))) return 50;
      if (ctx.module === "support") return 30; // fallback for support module
      return 0;
    },
  },

  /* ── suggest next step (fallback) ── */
  {
    tool: "suggest_next_step",
    score: (n) => {
      if (/(proximo passo|próximo passo|o que faco agora|o que faço agora|sugere)/.test(n)) return 60;
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

  let bestTool: AssistantToolName = "suggest_next_step";
  let bestScore = 0;

  for (const rule of SCORING_RULES) {
    const s = rule.score(n, context, history, message);
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
