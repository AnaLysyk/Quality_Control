
export type TicketStatus = "backlog" | "doing" | "review" | "done";


export type TicketStatusOption = { value: TicketStatus; label: string };


export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  backlog: "Backlog",
  doing: "Em andamento",
  review: "Em revisao",
  done: "Concluido",
};

export const TICKET_STATUS_OPTIONS: TicketStatusOption[] = (Object.entries(TICKET_STATUS_LABELS) as [TicketStatus, string][]) 
  .map(([value, label]) => ({ value, label }));

export const KANBAN_STATUS_OPTIONS = TICKET_STATUS_OPTIONS;


export function formatTicketStatusLabel(value: string) {
  if (!value) return TICKET_STATUS_LABELS.backlog;
  const cleaned = value
    .toString()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  if (!cleaned) return TICKET_STATUS_LABELS.backlog;
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}


export function getTicketStatusLabel(status: string, options: TicketStatusOption[] = TICKET_STATUS_OPTIONS) {
  if (status in TICKET_STATUS_LABELS) {
    return TICKET_STATUS_LABELS[status as TicketStatus];
  }
  return options.find((opt) => opt.value === status)?.label ?? formatTicketStatusLabel(status);
}


export function normalizeKanbanStatus(status: string): TicketStatus {
  const normalized = (status ?? "").toString().trim().toLowerCase();
  if (!normalized) return "backlog";
  const ascii = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const mapped = ascii in LEGACY_TICKET_STATUS_MAP ? LEGACY_TICKET_STATUS_MAP[ascii] : normalized;
  if (Object.keys(TICKET_STATUS_LABELS).includes(mapped)) {
    return mapped as TicketStatus;
  }
  const safe = mapped
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (Object.keys(TICKET_STATUS_LABELS).includes(safe) ? safe : "backlog") as TicketStatus;
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

export function getAllTicketStatuses(): TicketStatus[] {
  return Object.keys(TICKET_STATUS_LABELS) as TicketStatus[];
}
