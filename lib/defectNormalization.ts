export type DefectStatus = "open" | "in_progress" | "done";

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

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

export function resolveOpenedAt(value: unknown, fallback?: string): string {
  const str = asString(value);
  if (str) return str;
  if (fallback && typeof fallback === "string") return fallback;
  return new Date().toISOString();
}

export function resolveClosedAt(status: DefectStatus, closedAt?: unknown, fallback?: string | null): string | null {
  const str = asString(closedAt);
  if (str) return str;
  if (status === "done") {
    if (fallback) return fallback;
    return new Date().toISOString();
  }
  return null;
}
