import "server-only";

import type { NotificationDeliveryRecord, NotificationEventRecord } from "@/backend/notificationEventsStore";

export type NotificationBrianInsight = {
  id: string;
  eventId: string;
  eventType: string;
  title: string;
  summary: string;
  severity: "info" | "warning" | "critical";
  delivered: number;
  suppressed: number;
  explanations: string[];
  recommendedActions: string[];
};

function eventLabel(event: NotificationEventRecord) {
  const releaseName = typeof event.payload.releaseName === "string" ? event.payload.releaseName : null;
  const releaseId = typeof event.payload.releaseId === "string" ? event.payload.releaseId : null;
  return releaseName || releaseId || event.title;
}

function insightSeverity(event: NotificationEventRecord, suppressed: number): NotificationBrianInsight["severity"] {
  if (event.criticality === "critical" || event.mandatory) return "critical";
  if (suppressed > 0 || event.criticality === "high") return "warning";
  return "info";
}

function deliveryExplanation(delivery: NotificationDeliveryRecord) {
  const recipient = delivery.recipientName || delivery.recipientId;
  if (delivery.status === "suppressed") {
    return `${recipient} nao recebeu pelo canal ${delivery.channel}: ${delivery.decisionReason}`;
  }
  if (delivery.decision === "mandatory_override") {
    return `${recipient} recebeu pelo canal ${delivery.channel}: evento obrigatorio ignora opt-out.`;
  }
  return `${recipient} recebeu pelo canal ${delivery.channel}: ${delivery.decisionReason || "nenhuma preferencia bloqueou a entrega."}`;
}

function recommendedActions(event: NotificationEventRecord, deliveries: NotificationDeliveryRecord[]) {
  const suppressed = deliveries.filter((delivery) => delivery.status === "suppressed");
  const actions: string[] = [];

  if (event.eventType === "RELEASE_CALENDAR_BLOCKED") {
    actions.push("Acionar responsavel da release e registrar plano de desbloqueio.");
  }
  if (event.eventType === "RELEASE_CALENDAR_RISK") {
    actions.push("Revisar janela de QA, bugs bloqueantes e prazo da release.");
  }
  if (suppressed.length) {
    actions.push("Revisar preferencias se esse publico deveria receber o alerta.");
  }
  if (event.mandatory) {
    actions.push("Manter evento auditado: notificacao critica nao deve ser removida por opt-out.");
  }
  if (!actions.length) {
    actions.push("Sem acao obrigatoria; manter monitoramento no historico de notificacoes.");
  }

  return actions;
}

export function buildNotificationBrianInsights(input: {
  events: NotificationEventRecord[];
  deliveries: NotificationDeliveryRecord[];
  limit?: number;
}): NotificationBrianInsight[] {
  const limit = Math.max(1, Math.min(input.limit ?? 20, 50));
  const deliveriesByEvent = new Map<string, NotificationDeliveryRecord[]>();
  for (const delivery of input.deliveries) {
    const current = deliveriesByEvent.get(delivery.eventId) ?? [];
    current.push(delivery);
    deliveriesByEvent.set(delivery.eventId, current);
  }

  return input.events.slice(0, limit).map((event) => {
    const deliveries = deliveriesByEvent.get(event.id) ?? [];
    const delivered = deliveries.filter((delivery) => delivery.status === "delivered").length;
    const suppressed = deliveries.filter((delivery) => delivery.status === "suppressed").length;
    const label = eventLabel(event);
    const severity = insightSeverity(event, suppressed);

    return {
      id: `brain-insight::${event.id}`,
      eventId: event.id,
      eventType: event.eventType,
      title: `Brian: ${event.title}`,
      severity,
      delivered,
      suppressed,
      summary:
        suppressed > 0
          ? `${label}: ${delivered} entrega(s) liberada(s) e ${suppressed} suprimida(s) por preferencia.`
          : `${label}: ${delivered} entrega(s) liberada(s); nenhuma supressao registrada.`,
      explanations: deliveries.length ? deliveries.map((delivery) => deliveryExplanation(delivery)) : ["Evento registrado sem entregas calculadas ainda."],
      recommendedActions: recommendedActions(event, deliveries),
    };
  });
}
