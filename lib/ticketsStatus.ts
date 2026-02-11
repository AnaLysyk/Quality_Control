export type TicketStatus =
  | "backlog"
  | "refining"
  | "ticket"
  | "in_progress"
  | "in_review"
  | "ready_deploy"
  | "done";

export const TICKET_STATUS_OPTIONS: Array<{ value: TicketStatus; label: string }> = [
  { value: "backlog", label: "Backlog" },
  { value: "refining", label: "Refinando" },
  { value: "ticket", label: "Ticket" },
  { value: "in_progress", label: "Em andamento" },
  { value: "in_review", label: "Em revisão" },
  { value: "ready_deploy", label: "Pronto p/ deploy" },
  { value: "done", label: "Concluído" },
];

export function getTicketStatusLabel(status: TicketStatus) {
  return TICKET_STATUS_OPTIONS.find((opt) => opt.value === status)?.label ?? status;
}

export const LEGACY_TICKET_STATUS_MAP: Record<string, TicketStatus> = {
  open: "backlog",
  analysis: "refining",
  in_progress: "in_progress",
  in_test: "in_review",
  waiting_release: "ready_deploy",
  closed: "done",
};
