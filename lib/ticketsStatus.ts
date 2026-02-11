export type TicketStatus = string;

export type TicketStatusOption = { value: TicketStatus; label: string };

export const KANBAN_STATUS_OPTIONS: TicketStatusOption[] = [
  { value: "backlog", label: "Backlog" },
  { value: "doing", label: "Em andamento" },
  { value: "review", label: "Em revisao" },
  { value: "done", label: "Concluido" },
];

export const TICKET_STATUS_OPTIONS: TicketStatusOption[] = [
  { value: "backlog", label: "Backlog" },
  { value: "doing", label: "Em andamento" },
  { value: "review", label: "Em revisao" },
  { value: "done", label: "Concluido" },
];

export function formatTicketStatusLabel(value: string) {
  if (!value) return "Backlog";
  const cleaned = value
    .toString()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  if (!cleaned) return "Backlog";
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getTicketStatusLabel(status: TicketStatus, options: TicketStatusOption[] = TICKET_STATUS_OPTIONS) {
  return options.find((opt) => opt.value === status)?.label ?? formatTicketStatusLabel(status);
}

export function normalizeKanbanStatus(status: TicketStatus | string): TicketStatus {
  const normalized = (status ?? "").toString().trim().toLowerCase();
  if (!normalized) return "backlog";
  const ascii = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const mapped = ascii in LEGACY_TICKET_STATUS_MAP ? LEGACY_TICKET_STATUS_MAP[ascii] : normalized;
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

export const LEGACY_TICKET_STATUS_MAP: Record<string, TicketStatus> = {
  open: "backlog",
  analysis: "backlog",
  refining: "backlog",
  ticket: "backlog",
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
