import {
  normalizeRequestProfileType,
  resolveReviewQueue,
  toRequestProfileTypeLabel,
  type RequestProfileType,
  type ReviewQueue,
} from "@/backend/requestRouting";

export const PASSWORD_RESET_ACCESS_REQUEST_ID_PREFIX = "password-reset:";
const PASSWORD_RESET_ACCESS_REQUEST_MESSAGE_PREFIX = "SELF_SERVICE_REQUEST_V1 ";

type RequestLike = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  companyName: string;
  type: string;
  payload: Record<string, unknown>;
  status: string;
  createdAt: string;
};

export type PasswordResetAccessRequestPayload = {
  kind: "password_reset";
  requestId: string;
  userId: string;
  userName: string;
  userEmail: string;
  companyName: string;
  login: string | null;
  profileType: RequestProfileType;
  reviewQueue: ReviewQueue;
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveRequestProfileType(payload: Record<string, unknown>) {
  return normalizeRequestProfileType(readString(payload.profileType)) ?? "testing_company_user";
}

function resolveRequestReviewQueue(profileType: RequestProfileType, payload: Record<string, unknown>) {
  const explicitQueue = readString(payload.reviewQueue);
  if (explicitQueue === "admin_and_global" || explicitQueue === "global_only") return explicitQueue;
  return resolveReviewQueue(profileType);
}

function mapRequestStatusToAccessStatus(status: string) {
  if (status === "APPROVED") return "closed";
  if (status === "REJECTED") return "rejected";
  if (status === "NEEDS_REVISION") return "in_progress";
  return "open";
}

export function buildPasswordResetAccessRequestId(requestId: string) {
  return `${PASSWORD_RESET_ACCESS_REQUEST_ID_PREFIX}${requestId}`;
}

export function extractPasswordResetRequestId(id: string) {
  return id.startsWith(PASSWORD_RESET_ACCESS_REQUEST_ID_PREFIX)
    ? id.slice(PASSWORD_RESET_ACCESS_REQUEST_ID_PREFIX.length)
    : null;
}

export function composePasswordResetAccessRequestMessage(request: RequestLike) {
  const profileType = resolveRequestProfileType(request.payload);
  const reviewQueue = resolveRequestReviewQueue(profileType, request.payload);
  const login = readString(request.payload.login) || request.userEmail.split("@")[0] || null;
  const payload: PasswordResetAccessRequestPayload = {
    kind: "password_reset",
    requestId: request.id,
    userId: request.userId,
    userName: request.userName,
    userEmail: request.userEmail,
    companyName: request.companyName,
    login,
    profileType,
    reviewQueue,
  };

  return [
    `${PASSWORD_RESET_ACCESS_REQUEST_MESSAGE_PREFIX}${JSON.stringify(payload)}`,
    "Solicitacao de reset de senha",
    "Tipo de solicitacao: Esqueci a senha",
    `Tipo de perfil: ${toRequestProfileTypeLabel(profileType)}`,
    `Destino da fila: ${reviewQueue === "global_only" ? "Global" : "Admin e Global"}`,
    `Nome completo: ${request.userName || request.userEmail}`,
    login ? `Usuario: ${login}` : "",
    `Email: ${request.userEmail}`,
    `Empresa: ${request.companyName || "(nao informado)"}`,
    "Cargo: Reset de senha",
    "Titulo da solicitacao: Reset de senha",
    "Descricao detalhada: Solicitou redefinicao de senha pelo fluxo Esqueci minha senha.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function parsePasswordResetAccessRequestMessage(message: string) {
  const line = message.split("\n").find((item) => item.startsWith(PASSWORD_RESET_ACCESS_REQUEST_MESSAGE_PREFIX));
  if (!line) return null;
  try {
    const parsed = JSON.parse(line.slice(PASSWORD_RESET_ACCESS_REQUEST_MESSAGE_PREFIX.length)) as Record<string, unknown>;
    if (parsed.kind !== "password_reset") return null;
    const profileType = resolveRequestProfileType(parsed);
    const reviewQueue = resolveRequestReviewQueue(profileType, parsed);
    return {
      kind: "password_reset",
      requestId: readString(parsed.requestId),
      userId: readString(parsed.userId),
      userName: readString(parsed.userName),
      userEmail: readString(parsed.userEmail),
      companyName: readString(parsed.companyName),
      login: readString(parsed.login) || null,
      profileType,
      reviewQueue,
    } satisfies PasswordResetAccessRequestPayload;
  } catch {
    return null;
  }
}

export function mapPasswordResetRequestToAccessQueueItem(request: RequestLike) {
  return {
    id: buildPasswordResetAccessRequestId(request.id),
    email: request.userEmail,
    message: composePasswordResetAccessRequestMessage(request),
    status: mapRequestStatusToAccessStatus(request.status),
    created_at: request.createdAt,
    admin_notes: null,
  };
}

