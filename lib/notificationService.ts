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
  runId?: string;
  title?: string | null;

  // compat: chamadores antigos podem mandar "release" inteiro
  release?: { id?: string | number; title?: string; name?: string } | Record<string, unknown> | null;

  // compat: se existirem, aceitamos (não exigimos)
  createdByUserId?: string | null;
  projectCode?: string | null;
};

export async function notifyManualRunCreated(
  inputOrRelease: NotifyManualRunCreatedInput | Record<string, unknown>,
): Promise<void> {
  const obj = (inputOrRelease && typeof inputOrRelease === "object")
    ? (inputOrRelease as any)
    : {};

  const release = obj.release ?? obj;

  const rawId =
    obj.runId ??
    release?.id ??
    obj.id ??
    null;

  const runId = rawId === null || rawId === undefined ? "" : String(rawId);

  const title =
    obj.title ??
    release?.title ??
    release?.name ??
    null;

  emit("manual_run.created", {
    runId: runId || null,
    title,
    createdByUserId: obj.createdByUserId ?? obj.createdBy ?? null,
    projectCode: obj.projectCode ?? obj.project ?? null,
    release: obj.release ?? null,
  }, obj);
}

export type NotifyManualRunFailureInput = BaseInput & {
  runId?: string;
  reason?: string;

  // compat
  updated?: Record<string, unknown> | null;
  release?: { id?: string | number } | Record<string, unknown> | null;
  detail?: unknown;
  projectCode?: unknown;
};

export async function notifyManualRunFailure(
  inputOrUpdated: NotifyManualRunFailureInput | Record<string, unknown>,
  reasonMaybe?: unknown,
): Promise<void> {
  // formato antigo: (updated, reason)
  if (reasonMaybe !== undefined) {
    const updated =
      inputOrUpdated && typeof inputOrUpdated === "object"
        ? (inputOrUpdated as Record<string, unknown>)
        : {};

    const rawId = (updated as any)?.runId ?? (updated as any)?.id ?? (updated as any)?.release?.id ?? null;
    const runId = rawId === null || rawId === undefined ? "" : String(rawId);

    emit("manual_run.failure", {
      runId: runId || null,
      reason: String(reasonMaybe),
      updated,
    });

    return;
  }

  // formato novo: ({ runId, reason, ... })
  const input = inputOrUpdated as any;

  const rawId = input.runId ?? input?.release?.id ?? input?.updated?.id ?? input?.id ?? null;
  const runId = rawId === null || rawId === undefined ? "" : String(rawId);

  emit("manual_run.failure", {
    runId: runId || null,
    reason: input.reason ? String(input.reason) : "unknown",
    updated: input.updated ?? null,
    release: input.release ?? null,
    // aceita, mas não exige
    detail: input.detail ?? null,
    projectCode: input.projectCode ?? null,
  }, input);
}

/* -------------------------------------------------------------------------- */
/*                             Access Requests / RBAC                         */
/* -------------------------------------------------------------------------- */

export type NotifyAccessRequestCommentInput = BaseInput & {
  requestId?: string;
  commentId?: string;

  // compat
  request?: { id?: string } | Record<string, unknown> | null;
  comment?: { id?: string } | Record<string, unknown> | null;

  actorId?: string | null;
  actorName?: string | null;

  // esses estavam “quebrando” o type — agora aceitamos:
  authorName?: string | null;
  body?: string | null;

  dedupeKey?: string;
};

export async function notifyAccessRequestComment(input: NotifyAccessRequestCommentInput): Promise<void> {
  const requestId =
    (typeof input.requestId === "string" && input.requestId.trim()) ||
    (input.request && typeof (input.request as any).id === "string" ? String((input.request as any).id) : "") ||
    "";

  const commentId =
    (typeof input.commentId === "string" && input.commentId.trim()) ||
    (input.comment && typeof (input.comment as any).id === "string" ? String((input.comment as any).id) : "") ||
    "";

  const dedupeKey =
    input.dedupeKey ??
    `notification:access_request:${requestId || "unknown"}:comment:${commentId || "unknown"}`;

  emit("access_request.comment_added", {
    requestId: requestId || null,
    commentId: commentId || null,
    actorId: input.actorId ?? null,
    actorName: input.actorName ?? input.authorName ?? null,
    body: input.body ?? null, // loga se vier
    dedupeKey,
  }, input);
}
