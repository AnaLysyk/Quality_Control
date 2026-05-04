/**
 * Input validation for assistant-generated tickets, comments, and test cases.
 * Relies on Zod schemas from lib/validation and local heuristics.
 */

import { assistantTestCaseSchema, ticketCommentSchema, ticketDraftSchema } from "@/lib/validation";
import { normalizeSearch, normalizeText, compactMultiline } from "./helpers";
import type { TicketPriority, TicketType } from "@/lib/ticketsStore";

/* ──────────────────── Result types ──────────────────── */

export type AssistantTicketValidationResult = {
  ok: boolean;
  title: string;
  description: string;
  type: TicketType;
  priority: TicketPriority;
  issues: string[];
};

export type AssistantCommentValidationResult = {
  ok: boolean;
  body: string;
  issues: string[];
};

export type AssistantTestCaseValidationResult = {
  ok: boolean;
  sourceTitle: string;
  objective: string;
  reproductionBase: string;
  expectedResult: string;
  issues: string[];
};

/* ──────────────────── Normalizers ──────────────────── */

export function normalizeTicketTypeInput(value: string): TicketType | null {
  if (!value) return null;
  if (value === "bug" || value === "tarefa" || value === "melhoria") return value;
  return null;
}

export function normalizeTicketPriorityInput(value: string): TicketPriority | null {
  if (!value) return null;
  if (value === "high" || value === "alta" || value === "urgente") return "high";
  if (value === "low" || value === "baixa") return "low";
  if (value === "medium" || value === "media" || value === "média") return "medium";
  return null;
}

/* ──────────────────── "Instruction only" detector ──────────────────── */

const INSTRUCTION_ONLY_EXACT = new Set([
  "mostrar acoes disponiveis",
  "explicar meu escopo de acesso",
  "resumir esta tela",
  "resumir meu perfil atual",
  "buscar chamado por id",
  "buscar ticket por id",
  "criar chamado",
  "criar ticket",
  "abrir chamado",
  "abrir ticket",
  "transformar texto ou nota em chamado",
  "transformar texto em chamado",
  "transformar nota em chamado",
  "transformar relato em chamado",
  "converter nota em chamado",
  "gerar caso de teste",
  "criar caso de teste",
  "montar caso de teste",
  "usar modelo de chamado",
  "usar modelo de caso de teste",
  "publicar comentario",
  "montar comentario tecnico",
]);

export function looksLikeInstructionOnly(value: string) {
  const normalized = normalizeSearch(value);
  if (!normalized) return true;
  if (INSTRUCTION_ONLY_EXACT.has(normalized)) return true;
  if (/^(criar|abrir|gerar|montar|transformar|converter)\s+(um\s+)?(chamado|ticket|caso de teste|nota)\b/.test(normalized)) return true;
  return false;
}

/* ──────────────────── Validators ──────────────────── */

export function validateAssistantTicketDraft(input: {
  title?: unknown;
  description?: unknown;
  type?: unknown;
  priority?: unknown;
}): AssistantTicketValidationResult {
  const title = normalizeText(input.title, 120);
  const description = normalizeText(input.description, 2000);
  const typeValue = normalizeSearch(normalizeText(input.type, 20));
  const priorityValue = normalizeSearch(normalizeText(input.priority, 20));
  const issues: string[] = [];

  const parsed = ticketDraftSchema.safeParse({
    title,
    description,
    type: normalizeTicketTypeInput(typeValue) ?? undefined,
    priority: normalizeTicketPriorityInput(priorityValue) ?? undefined,
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    if (fieldErrors.title?.length) {
      issues.push("Título do chamado obrigatório, com pelo menos 3 caracteres.");
    }
    if (fieldErrors.description?.length) {
      issues.push("Descrição do chamado obrigatória, com pelo menos 8 caracteres.");
    }
  }

  if (typeValue && !normalizeTicketTypeInput(typeValue)) {
    issues.push("Tipo do chamado inválido. Use bug, tarefa ou melhoria.");
  }
  if (priorityValue && !normalizeTicketPriorityInput(priorityValue)) {
    issues.push("Prioridade inválida. Use baixa, média ou alta.");
  }
  if (looksLikeInstructionOnly(title)) {
    issues.push("O título ainda está como instrução. Informe o título real do chamado.");
  }
  if (looksLikeInstructionOnly(description)) {
    issues.push("A descrição ainda não traz o relato real. Cole o problema, a nota ou o comportamento observado.");
  }

  return {
    ok: issues.length === 0,
    title,
    description,
    type: normalizeTicketTypeInput(typeValue) ?? "tarefa",
    priority: normalizeTicketPriorityInput(priorityValue) ?? "medium",
    issues,
  };
}

export function validateAssistantCommentBody(bodyInput: unknown): AssistantCommentValidationResult {
  const body = normalizeText(bodyInput, 2000);
  const issues: string[] = [];
  const parsed = ticketCommentSchema.safeParse({ body });

  if (!parsed.success) {
    issues.push("Comentário obrigatório, com pelo menos 3 caracteres.");
  }
  if (looksLikeInstructionOnly(body)) {
    issues.push("O texto do comentário ainda está como instrução. Informe o comentário real antes de publicar.");
  }

  return { ok: issues.length === 0, body, issues };
}

export function validateAssistantTestCaseDraft(input: {
  sourceTitle: string;
  objective: string;
  reproductionBase: string;
  expectedResult: string;
}): AssistantTestCaseValidationResult {
  const sourceTitle = normalizeText(input.sourceTitle, 120);
  const objective = normalizeText(input.objective, 600);
  const reproductionBase = normalizeText(input.reproductionBase, 500);
  const expectedResult = normalizeText(input.expectedResult, 600);
  const issues: string[] = [];
  const parsed = assistantTestCaseSchema.safeParse({ sourceTitle, objective, reproductionBase, expectedResult });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    if (fieldErrors.sourceTitle?.length) issues.push("Título/base do caso de teste obrigatório.");
    if (fieldErrors.objective?.length) issues.push("Objetivo do caso de teste obrigatório e precisa ser mais específico.");
    if (fieldErrors.reproductionBase?.length) issues.push("Preciso do fluxo, bug ou relato base para montar os passos do teste.");
    if (fieldErrors.expectedResult?.length) issues.push("Resultado esperado obrigatório para validar o comportamento.");
  }

  if (looksLikeInstructionOnly(sourceTitle) || looksLikeInstructionOnly(reproductionBase)) {
    issues.push("Ainda não tenho contexto funcional suficiente. Envie o bug, relato ou ticket base antes de gerar o caso de teste.");
  }

  return { ok: issues.length === 0, sourceTitle, objective, reproductionBase, expectedResult, issues };
}
