/**
 * Intent Analyzer - Extrai intenção semântica das mensagens do usuário.
 * 
 * Usa análise de padrões, contexto conversacional e heurísticas para
 * entender o que o usuário realmente quer fazer.
 */
import "server-only";

import type { AssistantConversationTurn, AssistantScreenContext } from "./types";
import { normalizeSearch } from "./helpers";

/* ──────────────────── Intent Types ──────────────────── */

export type UserIntent = {
  primary: IntentCategory;
  confidence: number; // 0-1
  entities: ExtractedEntity[];
  sentiment: "neutral" | "frustrated" | "urgent" | "curious";
  isQuestion: boolean;
  isCommand: boolean;
  topics: string[];
};

export type IntentCategory =
  | "information_seeking"    // quer saber algo
  | "action_request"         // quer fazer algo
  | "troubleshooting"        // tem um problema
  | "navigation"             // quer ir a algum lugar
  | "creation"               // quer criar algo
  | "analysis"               // quer analisar/entender
  | "greeting"               // cumprimento
  | "clarification"          // pedindo esclarecimento
  | "confirmation"           // confirmando algo
  | "unknown";

export type ExtractedEntity = {
  type: "ticket" | "user" | "company" | "module" | "date" | "priority" | "status" | "number";
  value: string;
  position: number;
};

/* ──────────────────── Pattern Definitions ──────────────────── */

const QUESTION_PATTERNS = [
  /^(o que|como|por que|porque|quando|onde|qual|quais|quem|quanto)/,
  /\?$/,
  /(pode me|pode explicar|seria possivel|é possivel)/,
];

const COMMAND_PATTERNS = [
  /^(mostra|mostre|lista|liste|busca|busque|cria|crie|abre|abra|faz|faça|gera|gere)/,
  /^(procura|procure|encontra|encontre|localiza|localize)/,
  /^(explica|explique|resume|resuma|analisa|analise)/,
];

const URGENCY_PATTERNS = [
  /(urgente|critico|crítico|bloqueado|bloqueando|produção|producao)/,
  /(agora|rapido|rápido|imediato|imediatamente)/,
  /(socorro|help|ajuda.*urgente)/,
];

const FRUSTRATION_PATTERNS = [
  /(nao funciona|não funciona|erro|falha|bug|quebrou|parou)/,
  /(de novo|outra vez|mais uma vez|sempre)/,
  /(nao entendi|não entendi|confuso|dificil|difícil)/,
];

const NAVIGATION_PATTERNS = [
  /(ir para|vai para|acessar|acessa|navegar|navega)/,
  /(abrir|abre|entrar|entra|ver página|ver pagina)/,
  /(modulo de|módulo de|tela de|área de|area de)/,
];

const CREATION_PATTERNS = [
  /(criar|cria|novo|nova|gerar|gera|montar|monta)/,
  /(abrir.*ticket|abrir.*chamado|criar.*ticket|criar.*chamado)/,
  /(transformar em|converter em|montar.*baseado)/,
];

const ANALYSIS_PATTERNS = [
  /(analisar|analisa|avaliar|avalia|verificar|verifica)/,
  /(entender|compreender|explicar|explica)/,
  /(resumir|resume|sumarizar|sintetizar)/,
];

const TROUBLESHOOTING_PATTERNS = [
  /(erro|falha|bug|problema|issue)/,
  /(nao consigo|não consigo|nao aparece|não aparece)/,
  /(porque nao|por que não|deveria.*mas)/,
];

/* ──────────────────── Entity Extraction ──────────────────── */

const ENTITY_PATTERNS: Array<{ type: ExtractedEntity["type"]; pattern: RegExp }> = [
  { type: "ticket", pattern: /\b(SP-\d+|TC-\d+|#\d{3,8})\b/gi },
  { type: "priority", pattern: /\b(alta|média|media|baixa|crítica|critica|urgente|bloqueante)\b/gi },
  { type: "status", pattern: /\b(aberto|fechado|em andamento|pendente|resolvido|cancelado)\b/gi },
  { type: "module", pattern: /\b(suporte|tickets|chamados|releases|dashboard|kanban|empresas|usuarios|perfis)\b/gi },
  { type: "date", pattern: /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|hoje|ontem|semana passada|ultimo mes|próximos dias)\b/gi },
  { type: "number", pattern: /\b(\d{3,})\b/g },
];

function extractEntities(message: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  for (const { type, pattern } of ENTITY_PATTERNS) {
    const matches = message.matchAll(new RegExp(pattern));
    for (const match of matches) {
      if (match.index !== undefined) {
        entities.push({
          type,
          value: match[0],
          position: match.index,
        });
      }
    }
  }

  return entities.sort((a, b) => a.position - b.position);
}

/* ──────────────────── Topic Extraction ──────────────────── */

const TOPIC_KEYWORDS: Record<string, string[]> = {
  tickets: ["ticket", "chamado", "suporte", "atendimento", "solicitacao", "solicitação"],
  users: ["usuario", "usuário", "perfil", "acesso", "permissao", "permissão"],
  testing: ["teste", "caso de teste", "qa", "qualidade", "validacao", "validação"],
  releases: ["release", "versao", "versão", "deploy", "producao", "produção"],
  dashboard: ["dashboard", "metricas", "métricas", "indicadores", "estatisticas"],
  companies: ["empresa", "cliente", "companhia", "organizacao", "organização"],
  integrations: ["integracao", "integração", "api", "webhook", "conexao", "conexão"],
  documentation: ["documento", "documentacao", "documentação", "arquivo", "anexo"],
};

function extractTopics(message: string): string[] {
  const normalized = normalizeSearch(message);
  const topics: string[] = [];

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((kw) => normalized.includes(kw))) {
      topics.push(topic);
    }
  }

  return topics;
}

/* ──────────────────── Main Analyzer ──────────────────── */

export function analyzeIntent(
  message: string,
  context: AssistantScreenContext,
  history: AssistantConversationTurn[]
): UserIntent {
  const normalized = normalizeSearch(message);
  const entities = extractEntities(message);
  const topics = extractTopics(message);

  // Detectar se é pergunta
  const isQuestion = QUESTION_PATTERNS.some((p) => p.test(normalized));

  // Detectar se é comando
  const isCommand = COMMAND_PATTERNS.some((p) => p.test(normalized));

  // Detectar sentimento
  let sentiment: UserIntent["sentiment"] = "neutral";
  if (URGENCY_PATTERNS.some((p) => p.test(normalized))) {
    sentiment = "urgent";
  } else if (FRUSTRATION_PATTERNS.some((p) => p.test(normalized))) {
    sentiment = "frustrated";
  } else if (isQuestion && !isCommand) {
    sentiment = "curious";
  }

  // Determinar categoria primária com scores
  const scores: Record<IntentCategory, number> = {
    information_seeking: 0,
    action_request: 0,
    troubleshooting: 0,
    navigation: 0,
    creation: 0,
    analysis: 0,
    greeting: 0,
    clarification: 0,
    confirmation: 0,
    unknown: 5, // baseline
  };

  // Greeting
  if (/^(oi|ola|olá|bom dia|boa tarde|boa noite|e ai|e aí)\b/.test(normalized)) {
    scores.greeting += 80;
  }

  // Information seeking
  if (isQuestion) scores.information_seeking += 30;
  if (/(o que é|como funciona|me explica|pode explicar)/.test(normalized)) {
    scores.information_seeking += 40;
  }

  // Action request
  if (isCommand) scores.action_request += 40;

  // Troubleshooting
  if (TROUBLESHOOTING_PATTERNS.some((p) => p.test(normalized))) {
    scores.troubleshooting += 50;
  }
  if (sentiment === "frustrated") scores.troubleshooting += 20;

  // Navigation
  if (NAVIGATION_PATTERNS.some((p) => p.test(normalized))) {
    scores.navigation += 50;
  }

  // Creation
  if (CREATION_PATTERNS.some((p) => p.test(normalized))) {
    scores.creation += 60;
  }

  // Analysis
  if (ANALYSIS_PATTERNS.some((p) => p.test(normalized))) {
    scores.analysis += 50;
  }

  // Clarification (continuação de conversa)
  if (history.length > 0) {
    const lastAssistant = history.filter((h) => h.from === "assistant").pop();
    if (lastAssistant?.text?.includes("?")) {
      // Se o assistente fez uma pergunta e o usuário responde curto
      if (message.length < 50) {
        scores.clarification += 40;
      }
    }
  }

  // Confirmation
  if (/^(sim|nao|não|ok|confirma|confirmo|pode|pode sim|claro|isso|exato)$/i.test(normalized)) {
    scores.confirmation += 70;
  }

  // Boost baseado no contexto da tela
  if (context.module === "support" && topics.includes("tickets")) {
    scores.creation += 15;
    scores.troubleshooting += 15;
  }

  // Encontrar categoria com maior score
  const entries = Object.entries(scores) as [IntentCategory, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const [primary, topScore] = entries[0];
  const totalScore = entries.reduce((sum, [, s]) => sum + s, 0);
  const confidence = totalScore > 0 ? Math.min(topScore / totalScore + 0.3, 1) : 0.5;

  return {
    primary,
    confidence,
    entities,
    sentiment,
    isQuestion,
    isCommand,
    topics,
  };
}

/* ──────────────────── Conversation Context ──────────────────── */

export function getConversationMomentum(history: AssistantConversationTurn[]): {
  recentTopics: string[];
  pendingAction: string | null;
  conversationDepth: number;
  lastToolUsed: string | null;
} {
  const recentMessages = history.slice(-6);
  const recentTopics: string[] = [];
  let pendingAction: string | null = null;
  let lastToolUsed: string | null = null;

  for (const turn of recentMessages) {
    if (turn.from === "user") {
      recentTopics.push(...extractTopics(turn.text));
    }
    if (turn.from === "assistant" && turn.tool) {
      lastToolUsed = turn.tool;
      // Detectar se há ação pendente
      if (turn.text?.includes("confirma") || turn.text?.includes("deseja prosseguir")) {
        pendingAction = turn.tool;
      }
    }
  }

  return {
    recentTopics: [...new Set(recentTopics)],
    pendingAction,
    conversationDepth: history.length,
    lastToolUsed,
  };
}

/* ──────────────────── Smart Suggestions ──────────────────── */

export function generateSmartSuggestions(
  intent: UserIntent,
  context: AssistantScreenContext,
  momentum: ReturnType<typeof getConversationMomentum>
): string[] {
  const suggestions: string[] = [];

  // Baseado no intent
  switch (intent.primary) {
    case "troubleshooting":
      suggestions.push("Descreva o problema em detalhes para eu ajudar");
      if (intent.entities.some((e) => e.type === "ticket")) {
        suggestions.push("Posso analisar o ticket mencionado");
      }
      break;

    case "creation":
      if (intent.topics.includes("tickets")) {
        suggestions.push("Estruturar informações para criar um chamado");
      }
      break;

    case "information_seeking":
      suggestions.push("Posso buscar informações sobre esse tema");
      break;

    case "navigation":
      suggestions.push("Posso guiar você até a área desejada");
      break;
  }

  // Baseado no contexto
  if (context.module === "support" && !intent.topics.includes("tickets")) {
    suggestions.push("Buscar tickets relacionados");
  }

  // Baseado no momentum
  if (momentum.lastToolUsed === "create_ticket" && momentum.pendingAction) {
    suggestions.push("Continuar criação do ticket");
  }

  return suggestions.slice(0, 3);
}
