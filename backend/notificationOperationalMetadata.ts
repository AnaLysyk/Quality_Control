import "server-only";

export type NotificationOperationalMetadataInput = {
  type: string;
  title?: string | null;
  description?: string | null;
  link?: string | null;
  companySlug?: string | null;
  projectSlug?: string | null;
  requestId?: string | null;
  ticketId?: string | null;
  dedupeKey?: string | null;
  sourceId?: string | null;
};

function compact(value: unknown, max = 240) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function splitKey(value?: string | null) {
  return compact(value, 500)?.split(":").filter(Boolean) ?? [];
}

function areaFromType(type: string) {
  if (type === "RUN_CREATED" || type === "TEST_FAILED") return "qa";
  if (type.startsWith("DEFECT_")) return "defect";
  if (type.startsWith("TICKET_")) return "support";
  if (type.startsWith("ACCESS_REQUEST") || type.startsWith("USER_ACCESS")) return "access";
  if (type.startsWith("PASSWORD_RESET") || type.startsWith("PROFILE_DELETION")) return "security";
  if (type === "DOC_PUBLISHED") return "docs";
  return "general";
}

function entityFromType(type: string) {
  if (type === "RUN_CREATED" || type === "TEST_FAILED") return "run";
  if (type.startsWith("DEFECT_")) return "defect";
  if (type.startsWith("TICKET_")) return "ticket";
  if (type.startsWith("ACCESS_REQUEST")) return "access_request";
  if (type.startsWith("USER_ACCESS")) return "user_access";
  if (type.startsWith("PASSWORD_RESET")) return "password_reset";
  if (type.startsWith("PROFILE_DELETION")) return "profile_deletion";
  if (type === "DOC_PUBLISHED") return "document";
  return "notification";
}

function actionFromType(type: string) {
  if (type.endsWith("_CREATED") || type === "RUN_CREATED" || type === "ACCESS_REQUEST_CREATED") return "created";
  if (type.includes("COMMENT")) return "commented";
  if (type.includes("REACTION")) return "reacted";
  if (type.includes("ASSIGNED")) return "assigned";
  if (type.includes("ACCEPTED") || type.includes("APPROVED")) return "approved";
  if (type.includes("REJECTED")) return "rejected";
  if (type.includes("ADJUSTMENT")) return "adjustment_requested";
  if (type.includes("STATUS_CHANGED") || type.includes("UPDATED") || type.includes("RESTORED")) return "updated";
  if (type === "TEST_FAILED") return "failed";
  if (type === "DOC_PUBLISHED") return "published";
  if (type.includes("PENDING")) return "pending";
  return "notified";
}

function idFromKey(parts: string[], entity: string) {
  if (!parts.length) return null;
  if (entity === "run" && parts[0] === "run") return parts[1] ?? null;
  if (entity === "ticket" && (parts[0] === "suporte" || parts[0] === "ticket")) return parts[1] ?? null;
  if (entity === "defect" && parts[0] === "defect") return parts[1] ?? null;
  if (entity === "document" && parts[0] === "wiki-doc") return parts[2] ?? parts[1] ?? null;
  if (entity === "access_request" && parts[0] === "access-request") return parts[1] ?? null;
  if (entity === "password_reset" && parts[0] === "reset") return parts[2] ?? parts[1] ?? null;
  if (entity === "profile_deletion" && parts[0] === "profile-deletion") return parts[2] ?? parts[1] ?? null;
  return null;
}

function actionFromKey(parts: string[]) {
  if (parts.includes("status")) return "status_changed";
  if (parts.includes("comment")) return "commented";
  if (parts.includes("reaction")) return "reacted";
  if (parts.includes("assigned")) return "assigned";
  if (parts.includes("created")) return "created";
  if (parts.includes("accepted")) return "accepted";
  if (parts.includes("rejected")) return "rejected";
  if (parts.includes("adjustment")) return "adjustment_requested";
  if (parts.includes("fail")) return "failed";
  if (parts.includes("updated")) return "updated";
  return null;
}

export function buildNotificationOperationalMetadata(input: NotificationOperationalMetadataInput) {
  const type = compact(input.type) ?? "UNKNOWN";
  const entityType = entityFromType(type);
  const dedupeParts = splitKey(input.dedupeKey);
  const sourceId = compact(input.sourceId) ?? compact(input.requestId) ?? compact(input.ticketId) ?? idFromKey(dedupeParts, entityType) ?? compact(input.dedupeKey, 500);
  const sourceAction = actionFromKey(dedupeParts) ?? actionFromType(type);

  return {
    operationalArea: areaFromType(type),
    entityType,
    sourceAction,
    sourceId,
    trackingKey: compact(input.dedupeKey, 500),
    route: compact(input.link, 500),
    companySlug: compact(input.companySlug),
    projectSlug: compact(input.projectSlug),
    title: compact(input.title),
    descriptionPreview: compact(input.description, 180),
  };
}

