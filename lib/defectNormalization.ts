
/**
 * Status padronizado de defeitos.
 * - open: aberto/novo
 * - in_progress: em andamento, reteste, ativo
 * - done: finalizado, aprovado, resolvido
 */
export type DefectStatus = "open" | "in_progress" | "done";


// Converte valor desconhecido para string normalizada ou null
function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}


/**
 * Normaliza status de defeito para valores padronizados.
 * Aceita variantes em português e inglês.
 * @param input Valor de status (string ou desconhecido)
 * @returns DefectStatus padronizado
 */
export function normalizeDefectStatus(input: unknown): DefectStatus {
  const raw = asString(input)?.toLowerCase() ?? "";
  if (
    raw === "done" ||
    raw === "closed" ||
    raw === "resolved" ||
    raw === "finalized" ||
    raw === "finalizada" ||
    raw === "finalizado" ||
    raw === "concluido" ||
    raw === "concluida" ||
    raw === "aprovado" ||
    raw === "aprovada"
  ) {
    return "done";
  }
  if (
    raw === "in_progress" ||
    raw === "in progress" ||
    raw === "progress" ||
    raw === "retest" ||
    raw === "active" ||
    raw === "ativo" ||
    raw === "ativa" ||
    raw === "running" ||
    raw === "em_andamento" ||
    raw === "em andamento"
  ) {
    return "in_progress";
  }
  return "open";
}


/**
 * Resolve a data de abertura do defeito.
 * @param value Valor informado (string ou desconhecido)
 * @param fallback Valor alternativo (opcional)
 * @returns ISO string de data
 */
export function resolveOpenedAt(value: unknown, fallback?: string): string {
  const str = asString(value);
  if (str) return str;
  if (fallback && typeof fallback === "string") return fallback;
  return new Date().toISOString();
}


/**
 * Resolve a data de fechamento do defeito, se aplicável.
 * @param status Status padronizado
 * @param closedAt Valor informado (string ou desconhecido)
 * @param fallback Valor alternativo (opcional)
 * @returns ISO string de data ou null
 */
export function resolveClosedAt(status: DefectStatus, closedAt?: unknown, fallback?: string | null): string | null {
  const str = asString(closedAt);
  if (str) return str;
  if (status === "done") {
    if (fallback) return fallback;
    return new Date().toISOString();
  }
  return null;
}
