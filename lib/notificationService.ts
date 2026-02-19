// lib/notificationService.ts
// Arquivo "limpo" (sem encoding fantasma) + stubs tipados.
// Objetivo: parar o build agora e deixar pontos claros para implementar notificação real depois.

export type NotificationChannel = "log" | "redis" | "email" | "webhook";

export type NotificationMeta = Record<string, unknown>;

type BaseInput = {
  channel?: NotificationChannel; // default: "log"
  meta?: NotificationMeta;
};

/**
 * Ponto único de saída (hoje log; amanhã você troca por Redis/email/etc).
 */
function emit(event: string, payload: Record<string, unknown>, input?: BaseInput) {
  const channel: NotificationChannel = input?.channel ?? "log";
  const meta = input?.meta ?? {};

  // Stubs: log estruturado e previsível (ótimo pra debugar / evoluir).
  // NÃO use template string multilinha aqui — uma linha só (proteção extra).
  // eslint-disable-next-line no-console
  console.log(`[notify:${channel}] ${event}`, { ...payload, meta });
}

/* -------------------------------------------------------------------------- */
/*                                Tickets/QA                                  */
/* -------------------------------------------------------------------------- */

export type NotifyTicketCreatedInput = BaseInput & {
  ticketId: string;
  createdByUserId?: string | null;
  companySlug?: string | null;
};

export async function notifyTicketCreated(input: NotifyTicketCreatedInput): Promise<void> {
  emit("ticket.created", input, input);
}

export type NotifyTicketAssignedInput = BaseInput & {
  // formato novo (correto)
  ticketId?: string;

  // formato antigo/legado (errado no type, mas existe no código)
  ticket?: { id?: string } | Record<string, unknown> | null;

  assignedToUserId?: string | null;
  assignedByUserId?: string | null;
  // aliases para compatibilidade máxima
  assigneeId?: string | null;
  actorId?: string | null;
};

export async function notifyTicketAssigned(input: NotifyTicketAssignedInput): Promise<void> {
  const ticketId =
    (typeof input.ticketId === "string" && input.ticketId.trim()) ||
    (input.ticket && typeof (input.ticket as any).id === "string" ? String((input.ticket as any).id) : "") ||
    "";

  // Compatibilidade máxima: aceita assignedToUserId ou assigneeId, assignedByUserId ou actorId
  const assignedToUserId = input.assignedToUserId ?? input.assigneeId ?? null;
  const assignedByUserId = input.assignedByUserId ?? input.actorId ?? null;

  emit(
    "ticket.assigned",
    {
      ticketId: ticketId || null,
      assignedToUserId,
      assignedByUserId,
      // Mantém o objeto inteiro se veio (ajuda debug)
      ticket: input.ticket ?? null,
    },
    input,
  );
}

export type NotifyTicketStatusChangedInput = BaseInput & {
  // formato novo (preferido)
  ticketId?: string;
  fromStatus?: string | null;
  toStatus?: string;
  changedByUserId?: string | null;

  // formatos legados (compat)
  ticket?: { id?: string } | Record<string, unknown> | null;
  actorId?: string | null; // alias -> changedByUserId
  nextStatusLabel?: string | null;
  reason?: string | null;
};

export async function notifyTicketStatusChanged(input: NotifyTicketStatusChangedInput): Promise<void> {
  const ticketId =
    (typeof input.ticketId === "string" && input.ticketId.trim()) ||
    (input.ticket && typeof (input.ticket as any).id === "string" ? String((input.ticket as any).id) : "") ||
    "";

  const changedByUserId = input.changedByUserId ?? input.actorId ?? null;

  emit(
    "ticket.status_changed",
    {
      ticketId: ticketId || null,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? input.nextStatusLabel ?? null,
      changedByUserId,
      reason: input.reason ?? null,
      ticket: input.ticket ?? null,
    },
    input,
  );
}

export type NotifyTicketCommentAddedInput = BaseInput & {
  // formato novo (preferido)
  ticketId?: string;
  commentId?: string;

  authorUserId?: string | null;
  authorName?: string | null;

  // aliases legados (compat)
  actorId?: string | null;     // alias -> authorUserId
  actorName?: string | null;   // alias -> authorName

  // formatos legados (compat)
  ticket?: { id?: string } | Record<string, unknown> | null;
  comment?: { id?: string } | Record<string, unknown> | null;

  // opcional: para dedupe / timeline
  dedupeKey?: string;
};

export async function notifyTicketCommentAdded(input: NotifyTicketCommentAddedInput): Promise<void> {
  const ticketId =
    (typeof input.ticketId === "string" && input.ticketId.trim()) ||
    (input.ticket && typeof (input.ticket as any).id === "string"
      ? String((input.ticket as any).id)
      : "") ||
    "";

  const commentId =
    (typeof input.commentId === "string" && input.commentId.trim()) ||
    (input.comment && typeof (input.comment as any).id === "string"
      ? String((input.comment as any).id)
      : "") ||
    "";

  const authorUserId = input.authorUserId ?? input.actorId ?? null;
  const authorName = input.authorName ?? input.actorName ?? null;

  // dedupeKey sempre em uma linha
  const dedupeKey =
    input.dedupeKey ??
    `notification:ticket:${ticketId || "unknown"}:comment:${commentId || "unknown"}`;

  emit(
    "ticket.comment_added",
    {
      ticketId: ticketId || null,
      commentId: commentId || null,
      authorUserId,
      authorName,
      dedupeKey,
      ticket: input.ticket ?? null,
      comment: input.comment ?? null,
    },
    input,
  );
}

export type NotifyTicketReactionAddedInput = BaseInput & {
  ticketId: string;
  reactionId?: string | null;
  emoji: string; // ex: "❤️"
  userId?: string | null;
};

export async function notifyTicketReactionAdded(input: NotifyTicketReactionAddedInput): Promise<void> {
  emit("ticket.reaction_added", input, input);
}

/* -------------------------------------------------------------------------- */
/*                                  Suporte                                   */
/* -------------------------------------------------------------------------- */

export type NotifySuporteCreatedInput = BaseInput & {
  suporteId: string;
  createdByUserId?: string | null;
  companySlug?: string | null;
};

export async function notifySuporteCreated(input: NotifySuporteCreatedInput): Promise<void> {
  emit("suporte.created", input, input);
}

export type NotifySuporteCommentAddedInput = BaseInput & {
  suporteId: string;
  commentId: string;
  authorUserId?: string | null;
  dedupeKey?: string;
};

export async function notifySuporteCommentAdded(input: NotifySuporteCommentAddedInput): Promise<void> {
  const dedupeKey =
    input.dedupeKey ?? `notification:suporte:${input.suporteId}:comment:${input.commentId}`;

  emit("suporte.comment_added", { ...input, dedupeKey }, input);
}

/**
 * Alias compatível: alguns lugares usam notifySuporteCommentAdded como fallback.
 * (Você citou que é usada como alias em alguns pontos.)
 */
export const notifySuporteCommentAddedAlias = notifySuporteCommentAdded;

/* -------------------------------------------------------------------------- */
/*                         Password reset / Auth flow                          */
/* -------------------------------------------------------------------------- */

export type NotifyPasswordResetRequestInput = BaseInput & {
  userId?: string | null;
  email?: string | null;
  requestId?: string | null;
};

export async function notifyPasswordResetRequest(
  input: NotifyPasswordResetRequestInput,
): Promise<void> {
  emit("auth.password_reset.request", input, input);
}

export type NotifyPasswordResetStatusInput = BaseInput & {
  userId?: string | null;
  email?: string | null;
  requestId?: string | null;

  /**
   * Relaxado para compatibilidade com o que o projeto já manda hoje (RequestRecord etc).
   * Você pode re-endurecer depois quando refatorar os chamadores.
   */
  status: string;

  detail?: string | null;

  /**
   * Payload original (ex: RequestRecord) — opcional, útil pra debug/telemetria.
   */
  updated?: Record<string, unknown> | null;
};

export async function notifyPasswordResetStatus(
  inputOrUpdated: NotifyPasswordResetStatusInput | Record<string, unknown>,
  nextStatusMaybe?: unknown,
): Promise<void> {
  // Caso A: formato antigo (updated, nextStatus)
  if (nextStatusMaybe !== undefined) {
    const updated =
      inputOrUpdated && typeof inputOrUpdated === "object"
        ? (inputOrUpdated as Record<string, unknown>)
        : {};

    const status = String(nextStatusMaybe);

    emit(
      "auth.password_reset.status",
      {
        status,
        updated,
        // tenta extrair campos úteis se existirem no updated (sem depender de tipo)
        requestId:
          (updated["id"] as string | undefined) ??
          (updated["requestId"] as string | undefined) ??
          null,
        email: (updated["email"] as string | undefined) ?? null,
        userId:
          (updated["userId"] as string | undefined) ??
          (updated["user_id"] as string | undefined) ??
          null,
      },
      { channel: "log" },
    );

    return;
  }

  // Caso B: formato novo (objeto)
  const input = inputOrUpdated as NotifyPasswordResetStatusInput;

  emit(
    "auth.password_reset.status",
    {
      status: String(input.status),
      detail: input.detail ?? null,
      requestId: input.requestId ?? null,
      email: input.email ?? null,
      userId: input.userId ?? null,
      updated: input.updated ?? null,
    },
    input,
  );
}

/* -------------------------------------------------------------------------- */
/*                              Manual Runs (QA)                              */
/* -------------------------------------------------------------------------- */

export type NotifyManualRunCreatedInput = BaseInput & {
  runId: string;
  title?: string | null;
  createdByUserId?: string | null;
  projectCode?: string | null;
};

export async function notifyManualRunCreated(input: NotifyManualRunCreatedInput): Promise<void> {
  emit("manual_run.created", input, input);
}

export type NotifyManualRunFailureInput = BaseInput & {
  runId: string;
  reason: string;
  detail?: string | null;
  projectCode?: string | null;
};

export async function notifyManualRunFailure(input: NotifyManualRunFailureInput): Promise<void> {
  emit("manual_run.failure", input, input);
}

/* -------------------------------------------------------------------------- */
/*                             Access Requests / RBAC                         */
/* -------------------------------------------------------------------------- */

export type NotifyAccessRequestCommentInput = BaseInput & {
  requestId: string;
  commentId: string;
  authorUserId?: string | null;
  companySlug?: string | null;
  dedupeKey?: string;
};

export async function notifyAccessRequestComment(
  input: NotifyAccessRequestCommentInput,
): Promise<void> {
  const dedupeKey =
    input.dedupeKey ?? `notification:access_request:${input.requestId}:comment:${input.commentId}`;

  emit("access_request.comment_added", { ...input, dedupeKey }, input);
}
