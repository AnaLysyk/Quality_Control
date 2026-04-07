/**
 * Ticket-specific parsing, inference and template logic shared across
 * createTicket and draftTestCase tools.
 */

import type { TicketPriority, TicketType } from "@/lib/ticketsStore";
import type { AssistantScreenContext } from "../types";
import { compactMultiline, normalizeSearch } from "../helpers";
import { TICKET_TEMPLATE_LINES } from "../messages";

/* ──────────────────── Structured draft ──────────────────── */

export type StructuredTicketDraft = {
  hasNamedFields: boolean;
  title: string;
  description: string;
  impact: string;
  expectedBehavior: string;
  currentBehavior: string;
  type: TicketType | null;
  priority: TicketPriority | null;
};

export function parseStructuredTicketDraft(message: string): StructuredTicketDraft | null {
  const lines = message.split(/\r?\n/);
  const buckets: Record<string, string[]> = {
    title: [], description: [], impact: [], expectedBehavior: [], currentBehavior: [], type: [], priority: [],
  };

  let currentField: keyof typeof buckets | null = null;
  let hasNamedFields = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (currentField && currentField !== "title" && currentField !== "type" && currentField !== "priority") {
        buckets[currentField].push("");
      }
      continue;
    }

    const matchers: Array<[keyof typeof buckets, RegExp]> = [
      ["title", /^(titulo|título)\s*:\s*(.*)$/i],
      ["description", /^(descricao|descrição)\s*:\s*(.*)$/i],
      ["impact", /^(impacto)\s*:\s*(.*)$/i],
      ["expectedBehavior", /^(comportamento esperado|resultado esperado)\s*:\s*(.*)$/i],
      ["currentBehavior", /^(comportamento atual|resultado atual)\s*:\s*(.*)$/i],
      ["type", /^(tipo)\s*:\s*(.*)$/i],
      ["priority", /^(prioridade|severidade)\s*:\s*(.*)$/i],
    ];

    const matched = matchers.find(([, pattern]) => pattern.test(line));
    if (matched) {
      const [field, pattern] = matched;
      const value = line.replace(pattern, "$2").trim();
      hasNamedFields = true;
      currentField = field;
      if (value) buckets[field].push(value);
      continue;
    }

    const normalized = normalizeSearch(line);
    if (
      normalized.startsWith("titulo") || normalized.startsWith("descricao") ||
      normalized.startsWith("impacto") || normalized.startsWith("comportamento esperado") ||
      normalized.startsWith("comportamento atual")
    ) continue;

    if (currentField) buckets[currentField].push(line);
  }

  const title = compactMultiline(buckets.title.join("\n"));
  const description = compactMultiline(buckets.description.join("\n"));
  const impact = compactMultiline(buckets.impact.join("\n"));
  const expectedBehavior = compactMultiline(buckets.expectedBehavior.join("\n"));
  const currentBehavior = compactMultiline(buckets.currentBehavior.join("\n"));
  const typeRaw = normalizeSearch(compactMultiline(buckets.type.join(" ")));
  const priorityRaw = normalizeSearch(compactMultiline(buckets.priority.join(" ")));

  const parsedType: TicketType | null = typeRaw.includes("bug") ? "bug"
    : typeRaw.includes("melhoria") ? "melhoria"
    : typeRaw.includes("tarefa") ? "tarefa"
    : null;

  const parsedPriority: TicketPriority | null =
    (priorityRaw.includes("urgente") || priorityRaw.includes("alta") || priorityRaw.includes("high")) ? "high"
    : (priorityRaw.includes("baixa") || priorityRaw.includes("low")) ? "low"
    : (priorityRaw.includes("media") || priorityRaw.includes("média") || priorityRaw.includes("medium")) ? "medium"
    : null;

  if (!hasNamedFields && !title && !description && !impact && !expectedBehavior && !currentBehavior && !parsedType && !parsedPriority) {
    return null;
  }

  return { hasNamedFields, title, description, impact, expectedBehavior, currentBehavior, type: parsedType, priority: parsedPriority };
}

/* ──────────────────── Infer type / priority ──────────────────── */

export function inferTicketType(message: string, context: AssistantScreenContext): TicketType {
  const n = normalizeSearch(message);
  if (n.includes("bug") || n.includes("erro") || n.includes("falha")) return "bug";
  if (n.includes("melhoria") || n.includes("sugest")) return "melhoria";
  if (context.module === "test_plans") return "tarefa";
  return "tarefa";
}

export function inferTicketPriority(message: string): TicketPriority {
  const n = normalizeSearch(message);
  if (n.includes("urgente") || n.includes("critico") || n.includes("crítico") || n.includes("bloqueia") || n.includes("nao abre") || n.includes("não abre")) return "high";
  if (n.includes("baixa") || n.includes("simples")) return "low";
  return "medium";
}

/* ──────────────────── Title / description builders ──────────────────── */

export function buildTicketTitle(message: string, context: AssistantScreenContext) {
  const cleaned = message
    .replace(/\b(criar|cria|abrir|abre|gerar|gera|transformar|transforma)\b/gi, "")
    .replace(/\b(ticket|chamado|suporte)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const firstSentence = cleaned.split(/[.!?\n]/)[0]?.trim();
  return firstSentence ? firstSentence.slice(0, 110) : `Chamado - ${context.screenLabel}`;
}

export function buildTicketDescription(message: string, context: AssistantScreenContext) {
  return compactMultiline([
    "Relato estruturado pelo agente da plataforma.",
    "",
    `Tela atual: ${context.screenLabel}`,
    `Rota: ${context.route}`,
    "",
    "Descricao:",
    message.trim(),
  ].join("\n")).slice(0, 1900);
}

export function buildStructuredTicketDescription(draft: StructuredTicketDraft, context: AssistantScreenContext) {
  return compactMultiline([
    "Relato estruturado pelo agente da plataforma.",
    "",
    `Tela atual: ${context.screenLabel}`,
    `Rota: ${context.route}`,
    "",
    "Descricao:",
    draft.description || "Nao informado.",
    draft.impact ? `\nImpacto:\n${draft.impact}` : "",
    draft.currentBehavior ? `\nComportamento atual:\n${draft.currentBehavior}` : "",
    draft.expectedBehavior ? `\nComportamento esperado:\n${draft.expectedBehavior}` : "",
  ].filter(Boolean).join("\n")).slice(0, 1900);
}

export function buildStructuredTicketTemplate() {
  return compactMultiline(TICKET_TEMPLATE_LINES.join("\n"));
}

/* ──────────────────── Payload extractors ──────────────────── */

export function extractNarrativePayload(message: string) {
  const directPayloadPatterns = [
    /(?:converter|transformar)\s+(?:esta|essa|a)?\s*nota\s+(.+?)\s+em\s+(?:chamado|ticket)\b/i,
    /(?:criar|montar|abrir)\s+(?:um\s+)?(?:chamado|ticket)\s+com\s+base\s+(?:neste|nesse|nesta|nessa)\s+(?:relato|texto|conteudo|conteúdo)\s*:\s*(.+)$/i,
    /(?:converter|transformar)\s+(?:este|esse|esta|essa)\s+(?:texto|relato|conteudo|conteúdo)\s+em\s+(?:chamado|ticket)\s*:\s*(.+)$/i,
  ];

  for (const pattern of directPayloadPatterns) {
    const match = message.match(pattern);
    if (match?.[1]) return compactMultiline(match[1]).trim();
  }

  const colonMatch = message.match(/(?:nota|relato|texto|conteudo|conteúdo)\s*:\s*(.+)$/i);
  if (colonMatch?.[1]) return compactMultiline(colonMatch[1]).trim();

  return "";
}

export function extractTicketNarrativeSource(message: string) {
  return message
    .replace(/\b(criar|cria|abrir|abre|gerar|gera|transformar|transforma|converter|converte|montar|monta)\b/gi, "")
    .replace(/\b(ticket|chamado|suporte|nota)\b/gi, "")
    .replace(/\b(com base|a partir|desta tela|dessa tela|deste texto|desse texto)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ──────────────────── Prompt detectors ──────────────────── */

export function isTicketTemplateRequest(message: string) {
  const n = normalizeSearch(message);
  return (
    n.includes("modelo de chamado") ||
    n.includes("modelo de ticket") ||
    n.includes("titulo, descricao, impacto e comportamento esperado") ||
    n.includes("titulo descricao impacto e comportamento esperado") ||
    /quero criar .*chamado.*titulo.*descricao.*impacto/.test(n) ||
    /quero criar .*ticket.*titulo.*descricao.*impacto/.test(n)
  );
}

export function isGenericTicketPrompt(message: string) {
  const n = normalizeSearch(message);
  return (
    n === "transformar texto ou nota em chamado" ||
    n === "transformar texto em chamado" ||
    n === "transformar nota em chamado" ||
    n === "criar ticket a partir desta tela" ||
    n === "transformar relato em chamado"
  );
}
