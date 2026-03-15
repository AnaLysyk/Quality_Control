import {
  formatTicketStatusLabel,
  getTicketStatusLabel,
  KANBAN_STATUS_OPTIONS,
  LEGACY_TICKET_STATUS_MAP,
  normalizeKanbanStatus,
  TICKET_STATUS_OPTIONS,
  type TicketStatus,
  type TicketStatusOption,
} from "./ticketsStatus";

export type SuporteStatus = TicketStatus;
export type SuporteStatusOption = TicketStatusOption;

export const SUPORTE_STATUS_OPTIONS: SuporteStatusOption[] = TICKET_STATUS_OPTIONS;
export const LEGACY_SUPORTE_STATUS_MAP: Record<string, SuporteStatus> = LEGACY_TICKET_STATUS_MAP;

export function formatSuporteStatusLabel(value: string) {
  return formatTicketStatusLabel(value);
}

export function getSuporteStatusLabel(
  status: SuporteStatus,
  options: SuporteStatusOption[] = SUPORTE_STATUS_OPTIONS,
) {
  return getTicketStatusLabel(status, options);
}

export {
  KANBAN_STATUS_OPTIONS,
  normalizeKanbanStatus,
  TICKET_STATUS_OPTIONS,
};
