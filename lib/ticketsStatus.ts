export type TicketStatus = "backlog" | "doing" | "review" | "done";

export const KANBAN_STATUS_OPTIONS: Array<{ value: TicketStatus; label: string }> = [
  { value: "backlog", label: "Backlog" },
  { value: "doing", label: "Em andamento" },
  { value: "review", label: "Em revisão" },
  { value: "done", label: "Concluído" },
];

export const TICKET_STATUS_OPTIONS: Array<{ value: TicketStatus; label: string }> = [
  { value: "backlog", label: "Backlog" },
  { value: "doing", label: "Em andamento" },
  { value: "review", label: "Em revisão" },
  { value: "done", label: "Concluído" },
];

export function getTicketStatusLabel(status: TicketStatus) {
  return TICKET_STATUS_OPTIONS.find((opt) => opt.value === status)?.label ?? status;
}

export function normalizeKanbanStatus(status: TicketStatus | string): TicketStatus {
  const normalized = (status ?? "").toString().trim().toLowerCase();
  if (normalized === "refining" || normalized === "ticket") return "backlog";
  if (normalized === "ready_deploy") return "review";
  if (normalized === "in_review" || normalized === "review") return "review";
  if (normalized === "in_progress" || normalized === "doing") return "doing";
  if (normalized === "done") return "done";
  return "backlog";
}

export const LEGACY_TICKET_STATUS_MAP: Record<string, TicketStatus> = {
  open: "backlog",
  analysis: "backlog",
  refining: "backlog",
  ticket: "backlog",
  in_progress: "doing",
  doing: "doing",
  in_review: "review",
  in_test: "review",
  review: "review",
  waiting_release: "review",
  ready_deploy: "review",
  closed: "done",
  done: "done",
};


