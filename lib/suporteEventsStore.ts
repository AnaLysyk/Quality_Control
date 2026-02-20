import { appendTicketEvent } from "./ticketEventsStore";
export type SuporteEventInput = {
	suporteId?: string;
	ticketId?: string;
	type: string;
	actorUserId?: string | null;
	createdAt?: string;
	payload?: Record<string, unknown> | null;
	// Permitir propriedades extras para compatibilidade
	[key: string]: any;
};

export async function appendSuporteEvent(event: any) {
// Compatibilidade: aceita suporteId ou ticketId
const ticketId = event.suporteId ?? event.ticketId ?? "";
return await appendTicketEvent({
	ticketId,
	type: event.type,
	actorUserId: event.actorUserId,
	createdAt: event.createdAt,
	payload: event.payload,
});
}
// Alias para manter compatibilidade após refatoração
export * from './ticketEventsStore';
