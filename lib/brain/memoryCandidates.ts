import "server-only";

import type { BrainAccessContext } from "@/lib/brain/access";
import { brainPrisma } from "@/lib/brain/brainPrisma";

export const MEMORY_CANDIDATE_KIND = "conversation_memory_candidate";

export type MemoryCandidateType = "DECISION" | "RULE" | "CONTEXT" | "EXCEPTION" | "PATTERN";

type MemoryCandidateDetection =
  | { shouldSave: true; memoryType: MemoryCandidateType; title: string; summary: string }
  | { shouldSave: false };

const GREETING_RE = /^(oi|ol[aá]|bom dia|boa tarde|boa noite|obrigad[oa]|valeu|tchau|até logo)\b[.!?]*$/i;

// Sinais linguisticos de conteudo que vale a pena lembrar: decisao, regra de negocio,
// preferencia, correcao do usuario ou problema recorrente. Uma saudacao simples nao entra.
const DECISION_PATTERNS = [/\bfoi decidido\b/i, /\bdecidimos\b/i, /\bvamos usar\b/i, /\ba partir de agora\b/i, /\bdaqui pra frente\b/i, /\bficou definido\b/i, /\bficou decidido\b/i];
const RULE_PATTERNS = [/\bsempre que\b/i, /\bnunca deve\b/i, /\bdeve seguir\b/i, /\bo limite (?:de|é|e)\b/i, /\bregra (?:é|de negócio|e|de negocio)\b/i, /\bn[aã]o pode\b/i, /\bprecisa seguir\b/i];
const PREFERENCE_PATTERNS = [/\bprefiro que\b/i, /\bquero que sempre\b/i, /\bpor favor sempre\b/i, /\bgostaria que sempre\b/i, /\bprefiro sempre\b/i];
const CORRECTION_PATTERNS = [/\bna verdade\b/i, /\bcorrigindo\b/i, /\bo certo [eé]\b/i, /\bn[aã]o [eé] assim\b/i, /\bisso est[aá] errado\b/i];
const RECURRING_PATTERNS = [/\bde novo\b/i, /\bsempre acontece\b/i, /\besse problema j[aá]\b/i, /\brecorrente\b/i, /\bacontece sempre\b/i];

function classify(text: string): MemoryCandidateType | null {
  if (DECISION_PATTERNS.some((pattern) => pattern.test(text))) return "DECISION";
  if (RULE_PATTERNS.some((pattern) => pattern.test(text))) return "RULE";
  if (PREFERENCE_PATTERNS.some((pattern) => pattern.test(text))) return "CONTEXT";
  if (CORRECTION_PATTERNS.some((pattern) => pattern.test(text))) return "EXCEPTION";
  if (RECURRING_PATTERNS.some((pattern) => pattern.test(text))) return "PATTERN";
  return null;
}

/**
 * Decide se uma troca (pergunta do usuario + resposta do Brain) e candidata a memoria
 * permanente. Nao salva automaticamente toda mensagem — so quando ha sinal de decisao,
 * regra de negocio, preferencia, correcao ou problema recorrente.
 */
export function detectMemoryCandidate(message: string, answer: string): MemoryCandidateDetection {
  const trimmedMessage = message.trim();
  if (trimmedMessage.length < 12 || GREETING_RE.test(trimmedMessage)) {
    return { shouldSave: false };
  }

  const memoryType = classify(trimmedMessage) ?? classify(answer);
  if (!memoryType) return { shouldSave: false };

  return {
    shouldSave: true,
    memoryType,
    title: trimmedMessage.slice(0, 120),
    summary: trimmedMessage.length > 400 ? `${trimmedMessage.slice(0, 400)}...` : trimmedMessage,
  };
}

/**
 * Cria um candidato a memoria (BrainInboxItem) a partir de uma troca de chat, para revisao
 * humana (aprovar/editar/ignorar) antes de virar BrainMemory permanente. Nunca cria a
 * BrainMemory diretamente aqui.
 */
export async function recordMemoryCandidateFromChat(
  access: BrainAccessContext,
  input: { message: string; answer: string; nodeId?: string | null },
) {
  const detection = detectMemoryCandidate(input.message, input.answer);
  if (!detection.shouldSave) return null;

  return brainPrisma.brainInboxItem.create({
    data: {
      kind: MEMORY_CANDIDATE_KIND,
      companySlug: access.userAccess.companySlug ?? null,
      status: "pending",
      title: detection.title,
      summary: detection.summary,
      payload: {
        source: "brain-chat",
        message: input.message,
        answer: input.answer.slice(0, 4000),
        memoryType: detection.memoryType,
        nodeId: input.nodeId ?? null,
        requestedBy: access.user.id,
        requestedByEmail: access.user.email,
        companyId: access.userAccess.companyId,
        createdAt: new Date().toISOString(),
      },
    },
  });
}
