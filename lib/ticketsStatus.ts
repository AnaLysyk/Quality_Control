export type SuporteStatus = "backlog" | "doing" | "review" | "done";
// Aliases para compatibilidade com imports antigos
export type TicketStatusOption = SuporteStatusOption;
export const formatTicketStatusLabel = formatSuporteStatusLabel;
// TICKET_STATUS_OPTIONS alias moved below SUPORTE_STATUS_OPTIONS definition
export const getTicketStatusLabel = getSuporteStatusLabel;
export type TicketStatus = SuporteStatus;
// Aliases para compatibilidade com imports antigos


export type SuporteStatusOption = { value: SuporteStatus | string; label: string };

export const KANBAN_STATUS_OPTIONS: SuporteStatusOption[] = [
  { value: "backlog", label: "Backlog" },
  { value: "doing", label: "Em andamento" },
  { value: "review", label: "Em revisao" },
  { value: "done", label: "Concluido" },
];

export const SUPORTE_STATUS_OPTIONS: SuporteStatusOption[] = [
  { value: "backlog", label: "Backlog" },
  { value: "doing", label: "Em andamento" },
  { value: "review", label: "Em revisao" },
  { value: "done", label: "Concluido" },
];

// Aliases for legacy compatibility (must be after SUPORTE_STATUS_OPTIONS definition)
export const TICKET_STATUS_OPTIONS = SUPORTE_STATUS_OPTIONS;

export function formatSuporteStatusLabel(value: string) {
  if (!value) return "Backlog";
  const cleaned = value
    .toString()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  if (!cleaned) return "Backlog";
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getSuporteStatusLabel(status: SuporteStatus | string, options: SuporteStatusOption[] = SUPORTE_STATUS_OPTIONS) {
  return options.find((opt) => opt.value === status)?.label ?? formatSuporteStatusLabel(status);
}

export function normalizeKanbanStatus(status: SuporteStatus | string): SuporteStatus | string {
  const normalized = (status ?? "").toString().trim().toLowerCase();
  if (!normalized) return "backlog";
  const ascii = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const mapped = ascii in LEGACY_SUPORTE_STATUS_MAP ? LEGACY_SUPORTE_STATUS_MAP[ascii] : normalized;
  if (mapped === "backlog" || mapped === "doing" || mapped === "review" || mapped === "done") {
    return mapped;
  }
  const safe = mapped
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return safe || "backlog";
}

export const LEGACY_SUPORTE_STATUS_MAP: Record<string, SuporteStatus> = {
  open: "backlog",
  analysis: "backlog",
  refining: "backlog",
  suporte: "backlog",
  in_progress: "doing",
  doing: "doing",
  "em andamento": "doing",
  in_review: "review",
  in_test: "review",
  review: "review",
  "em revisao": "review",
  waiting_release: "review",
  ready_deploy: "review",
  closed: "done",
  done: "done",
  concluido: "done",
};
