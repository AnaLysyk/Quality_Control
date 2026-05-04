/**
 * Shared utility functions used across assistant modules.
 * Pure functions — no side-effects, no imports beyond types.
 */

export function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeSearch(value: string) {
  return stripAccents(value).toLowerCase().trim();
}

export function normalizeText(value: unknown, max = 4000) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

export function normalizePromptText(value: unknown, max = 4000) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .trim()
    .slice(0, max);
}

export function compactMultiline(value: string) {
  return value
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function formatDateTime(value?: string | null) {
  if (!value) return "sem data";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export function normalizeCommentForComparison(text: string) {
  return normalizeSearch(text).replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}

export function formatValidationIssues(issues: string[]) {
  return issues.map((issue, index) => `${index + 1}. ${issue}`).join("\n");
}

export function sanitizeRoute(route?: string | null) {
  if (typeof route !== "string") return "/";
  const trimmed = route.trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
